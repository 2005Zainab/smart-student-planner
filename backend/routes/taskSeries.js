import express from "express";
import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";
import {
  expandSeries,
  getPriorityFromDueDate,
  shouldRenderMaterialized,
  validateRule,
  buildOccurrenceChecklist,
} from "../lib/recurrence.js";
import { getUserToday } from "../lib/userTime.js";
import { normalizeStatus, validateDate, validateTaskFields } from "../lib/taskValidation.js";

const router = express.Router();

function validateReminderFields(body) {
  const hasOffset = body.reminderOffsetDays !== undefined && body.reminderOffsetDays !== null;
  const hasTime =
    body.reminderTime !== undefined && body.reminderTime !== null && body.reminderTime !== "";

  if (hasOffset !== hasTime) {
    return { message: "Reminder offset and time must be set together" };
  }

  if (hasOffset && (!Number.isInteger(body.reminderOffsetDays) || body.reminderOffsetDays < 0)) {
    return { message: "Reminder offset days must be a non-negative integer" };
  }

  const reminderValidation = validateTaskFields(
    {
      title: "placeholder",
      description: "",
      subject: "",
      status: "to do",
      reminderTime: hasTime ? body.reminderTime : null,
    },
    { partial: false },
  );
  if (reminderValidation.message) {
    return { message: reminderValidation.message };
  }

  return {
    clean: {
      reminderOffsetDays: hasOffset ? body.reminderOffsetDays : null,
      reminderTime: hasTime ? reminderValidation.clean.reminderTime : null,
    },
  };
}

function offsetDate(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getReminderFields(template, occurrenceDate, today) {
  const isCurrentOrFuture = occurrenceDate >= today;
  const hasReminder =
    template.reminderOffsetDays !== null && template.reminderOffsetDays !== undefined;

  return {
    reminderDate:
      isCurrentOrFuture && hasReminder
        ? offsetDate(occurrenceDate, -template.reminderOffsetDays)
        : null,
    reminderTime: isCurrentOrFuture ? (template.reminderTime ?? null) : null,
  };
}

function getOccurrenceFields(body) {
  const fields = {};
  for (const field of [
    "title",
    "description",
    "subject",
    "status",
    "dueDate",
    "time",
    "checklist",
    "reminderDate",
    "reminderTime",
    "links",
  ]) {
    if (Object.prototype.hasOwnProperty.call(body, field)) fields[field] = body[field];
  }
  return fields;
}

function materializeChecklist(checklist) {
  return (checklist ?? []).map(item => ({
    id: randomUUID(),
    text: item.text,
    completed: false,
  }));
}

function withOccurrenceResponse(data, id, today) {
  return {
    id,
    ...data,
    virtual: false,
    priority: getPriorityFromDueDate(data.dueDate ?? data.occurrenceDate, today),
  };
}

// Series-level fields that belong to other PATCH branches (template edit, pattern change,
// end date) or are occurrence-level. They must not be silently ignored next to `enabled`.
const NON_PAUSE_SERIES_FIELDS = [
  "rule",
  "endDate",
  "title",
  "description",
  "subject",
  "time",
  "checklist",
  "links",
  "reminderOffsetDays",
  "reminderTime",
  "status",
  "dueDate",
];

function comparePausesByFrom(first, second) {
  return first.from < second.from ? -1 : first.from > second.from ? 1 : 0;
}

/**
 * Pause: effective TOMORROW (the only "tomorrow" operation).
 * Returns the new { pauses, enabled } or null when already paused (no-op).
 */
function applyPause(series, today) {
  const pauses = series.pauses ?? [];
  if (pauses.some(pause => pause.until === null)) return null;

  return {
    pauses: [...pauses, { from: offsetDate(today, 1), until: null }].sort(comparePausesByFrom),
    enabled: false,
  };
}

/**
 * Resume: effective TODAY. The open pause is closed at dayBefore(today). If that would
 * leave until < from (the pause never took effect), the entry is deleted instead of being
 * stored inverted. Returns null when no pause is open (no-op).
 */
function applyResume(series, today) {
  const pauses = series.pauses ?? [];
  const open = pauses.find(pause => pause.until === null);
  if (!open) return null;

  const closeAt = offsetDate(today, -1);
  const nextPauses =
    closeAt < open.from
      ? pauses.filter(pause => pause !== open)
      : pauses.map(pause => (pause === open ? { ...pause, until: closeAt } : pause));

  return { pauses: nextPauses, enabled: true };
}

router.post("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const body = req.body;

  if (
    Object.prototype.hasOwnProperty.call(body, "status") &&
    normalizeStatus(body.status) !== "To Do"
  ) {
    return res.status(400).json({ message: "Recurring task status must be 'to do'" });
  }

  const taskValidation = validateTaskFields({
    title: body.title,
    description: body.description ?? "",
    subject: body.subject ?? "",
    status: "to do",
    dueDate: body.dueDate ?? null,
    time: typeof body.time === "string" && body.time.trim() ? body.time.trim() : null,
    checklist: body.checklist ?? [],
    links: body.links ?? [],
  });
  if (taskValidation.message) {
    return res.status(400).json({ message: taskValidation.message });
  }

  const { clean } = taskValidation;
  if (!clean.dueDate) {
    return res.status(400).json({ message: "Due date is required for recurring tasks" });
  }

  const ruleValidation = validateRule(body.rule);
  if (ruleValidation.errors) {
    return res.status(400).json({ message: ruleValidation.errors[0] });
  }

  const reminderValidation = validateReminderFields(body);
  if (reminderValidation.message) {
    return res.status(400).json({ message: reminderValidation.message });
  }

  let endDate = body.endDate ?? null;
  if (endDate !== null) {
    const endDateError = validateDate(endDate, "End date");
    if (endDateError) {
      return res.status(400).json({ message: endDateError });
    }
    if (endDate < clean.dueDate) {
      return res.status(400).json({ message: "End date cannot be before the due date" });
    }
  }

  try {
    const today = await getUserToday(uid);
    const templateChecklist = clean.checklist.map(item => ({ text: item.text }));
    const template = {
      title: clean.title,
      description: clean.description,
      subject: clean.subject,
      time: clean.time,
      checklist: templateChecklist,
      links: clean.links,
      ...reminderValidation.clean,
    };
    const seriesDoc = {
      userId: uid,
      template,
      segments: [{ from: clean.dueDate, until: null, rule: ruleValidation.clean }],
      enabled: true,
      pauses: [],
      endDate,
      exceptions: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const seriesRef = await db.collection("task_series").add(seriesDoc);
    const occurrenceId = `${seriesRef.id}_${clean.dueDate}`;

    const firstOccurrence = {
      id: occurrenceId,
      seriesId: seriesRef.id,
      occurrenceDate: clean.dueDate,
      virtual: true,
      ...template,
      ...getReminderFields(template, clean.dueDate, today),
      checklist: buildOccurrenceChecklist(template.checklist, occurrenceId),
      links: template.links ?? [],
      dueDate: clean.dueDate,
      status: "To Do",
      priority: getPriorityFromDueDate(clean.dueDate, today),
      series: { enabled: true, ruleValid: ruleValidation.clean, endDate },
    };

    return res.status(201).json({
      id: seriesRef.id,
      ...seriesDoc,
      firstOccurrence,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Failed to create task series" });
  }
});

// Series-level edits ---------------------------------------------------------------------
//
// Body shape determines intent. Exactly one intent per request, except that `rule` and
// `endDate` form one "recurrence" group and may be sent together (applied atomically):
//   - `enabled`                         -> pause / resume
//   - `rule` and/or `endDate`           -> recurrence group
//   - template content fields           -> "apply to future occurrences"
// `status` and `dueDate` are occurrence-level and never valid on a series.

const TEMPLATE_FIELDS = [
  "title",
  "description",
  "subject",
  "time",
  "checklist",
  "reminderOffsetDays",
  "reminderTime",
];

function has(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

// ISO weekday: 1 = Monday ... 7 = Sunday. Date.getUTCDay() is 0-based from Sunday, so it is
// converted here at the boundary and never reaches `weekdays`.
function isoWeekday(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function compareSegmentsByFrom(first, second) {
  return first.from < second.from ? -1 : first.from > second.from ? 1 : 0;
}

// Order-insensitive comparison so a form that resubmits [3, 1] for a stored [1, 3] is
// recognised as "unchanged".
function canonicalRule(rule) {
  const canonical = {};
  for (const key of Object.keys(rule).sort()) {
    canonical[key] =
      key === "weekdays" && Array.isArray(rule[key])
        ? [...rule[key]].sort((first, second) => first - second)
        : rule[key];
  }
  return JSON.stringify(canonical);
}

function rulesEqual(first, second) {
  return canonicalRule(first) === canonicalRule(second);
}

/**
 * Runs `build(series)` against the series inside a transaction. `build` returns one of
 *   { error }                        -> 400
 *   { update: null }                 -> nothing to write, 200 with the series as stored
 *   { update, nextSeries }           -> write `update`, 200 with `nextSeries`
 */
async function runSeriesUpdate(seriesId, uid, build) {
  const seriesRef = db.collection("task_series").doc(seriesId);

  return db.runTransaction(async transaction => {
    const seriesSnap = await transaction.get(seriesRef);
    if (!seriesSnap.exists) return { status: 404, message: "Task series not found" };

    const series = seriesSnap.data();
    if (series.userId !== uid) return { status: 403, message: "Unauthorized" };

    const outcome = build(series);
    if (outcome.error) return { status: 400, message: outcome.error };
    if (!outcome.update) return { status: 200, series };

    transaction.update(seriesRef, { ...outcome.update, updatedAt: FieldValue.serverTimestamp() });
    return { status: 200, series: outcome.nextSeries };
  });
}

function sendSeriesOutcome(res, seriesId, outcome) {
  if (outcome.status !== 200) {
    return res.status(outcome.status).json({ message: outcome.message });
  }
  return res.status(200).json({ id: seriesId, ...outcome.series });
}

/**
 * Pause / resume. Unchanged behaviour: pause is effective tomorrow, resume is effective today.
 */
async function handleEnabledChange(req, res) {
  const uid = req.user.uid;
  const { seriesId } = req.params;
  const body = req.body ?? {};

  if (typeof body.enabled !== "boolean") {
    return res.status(400).json({ message: "enabled must be a boolean" });
  }
  if (NON_PAUSE_SERIES_FIELDS.some(field => has(body, field))) {
    return res.status(400).json({ message: "enabled cannot be combined with other series fields" });
  }

  try {
    // "Today" is always server-derived, once per request; any client value is ignored.
    const today = await getUserToday(uid);
    const seriesRef = db.collection("task_series").doc(seriesId);

    // All reads, checks and writes happen in one transaction so concurrent pause/resume
    // requests can't both act on the same stale `pauses` array.
    const outcome = await db.runTransaction(async transaction => {
      const seriesSnap = await transaction.get(seriesRef);
      if (!seriesSnap.exists) {
        return { status: 404, message: "Task series not found" };
      }

      const series = seriesSnap.data();
      if (series.userId !== uid) {
        return { status: 403, message: "Unauthorized" };
      }

      if (body.enabled && series.endDate && today > series.endDate) {
        return { status: 400, message: "This series has already ended" };
      }

      // A pause starts tomorrow, so only occurrences on or before today stay visible. If there
      // are none, pausing would leave the series with no row to open, and so no way to resume
      // or delete it from the UI. Already-paused series fall through to the no-op below.
      if (!body.enabled) {
        const alreadyPaused = (series.pauses ?? []).some(pause => pause.until === null);
        if (!alreadyPaused && expandSeries(series, series.segments[0].from, today).length === 0) {
          return {
            status: 400,
            message: "A series can't be paused until it has an occurrence on or before today",
          };
        }
      }

      const change = body.enabled ? applyResume(series, today) : applyPause(series, today);
      if (!change) {
        return { status: 200, series }; // already in the requested state: no write
      }

      transaction.update(seriesRef, { ...change, updatedAt: FieldValue.serverTimestamp() });
      return { status: 200, series: { ...series, ...change } };
    });

    return sendSeriesOutcome(res, seriesId, outcome);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Failed to update task series" });
  }
}

/**
 * Computes the recurrence-group change (rule and/or endDate) for one series. Pure: no I/O.
 *
 * Rule change is effective TODAY. The open segment is closed at dayBefore(today) and a new
 * one starts today, unless the open segment itself starts today or later (same-day second
 * change, or a series whose seed date has not arrived), in which case its rule is rewritten
 * in place so no inverted or duplicate-`from` segment is ever stored. A rule equal to the
 * open segment's rule is a no-op, because splitting would silently re-anchor interval math.
 *
 * Validity is judged against the RESULTING endDate (stored value overridden by the body), so
 * a request can both lift an old endDate and change the rule, but cannot end the series in
 * the past while also changing its pattern.
 */
function buildRecurrenceUpdate(series, body, today) {
  const hasRule = has(body, "rule");
  const hasEndDate = has(body, "endDate");
  const segments = structuredClone(series.segments);
  const storedEndDate = series.endDate ?? null;
  const nextEndDate = hasEndDate ? body.endDate : storedEndDate;

  if (nextEndDate !== null && nextEndDate < segments[0].from) {
    return { error: "End date cannot be before the first due date" };
  }

  let segmentsChanged = false;

  if (hasRule) {
    if (nextEndDate !== null && today > nextEndDate) {
      return {
        error:
          hasEndDate && nextEndDate !== storedEndDate
            ? "End date cannot be before today when changing the pattern"
            : "This series has already ended",
      };
    }

    const open = segments.find(segment => segment.until === null);
    const rewriteInPlace = open.from >= today;
    const anchorDate = rewriteInPlace ? open.from : today;

    // The route layer (not validateRule) supplies the weekly default: the weekday of the date
    // the rule will be anchored to.
    const candidate = { ...body.rule };
    if (candidate.type === "weekly" && candidate.weekdays === undefined) {
      candidate.weekdays = [isoWeekday(anchorDate)];
    }

    const ruleValidation = validateRule(candidate);
    if (ruleValidation.errors) return { error: ruleValidation.errors[0] };

    if (!rulesEqual(open.rule, ruleValidation.clean)) {
      if (rewriteInPlace) {
        open.rule = ruleValidation.clean;
      } else {
        open.until = offsetDate(today, -1);
        segments.push({ from: today, until: null, rule: ruleValidation.clean });
        segments.sort(compareSegmentsByFrom);
      }
      segmentsChanged = true;
    }
  }

  const endDateChanged = hasEndDate && nextEndDate !== storedEndDate;
  if (!segmentsChanged && !endDateChanged) return { update: null };

  const update = {};
  if (segmentsChanged) update.segments = segments;
  if (endDateChanged) update.endDate = nextEndDate;
  return { update, nextSeries: { ...series, ...update } };
}

async function handleRecurrenceChange(req, res) {
  const uid = req.user.uid;
  const { seriesId } = req.params;
  const body = req.body;

  if (has(body, "rule")) {
    const isPlainObject =
      typeof body.rule === "object" && body.rule !== null && !Array.isArray(body.rule);
    if (!isPlainObject) return res.status(400).json({ message: "rule must be an object" });
  }

  if (has(body, "endDate") && body.endDate !== null) {
    if (typeof body.endDate !== "string") {
      return res.status(400).json({ message: "End date must be a date string or null" });
    }
    const endDateError = validateDate(body.endDate, "End date");
    if (endDateError) return res.status(400).json({ message: endDateError });
  }

  try {
    const today = await getUserToday(uid);
    const outcome = await runSeriesUpdate(seriesId, uid, series =>
      buildRecurrenceUpdate(series, body, today),
    );
    return sendSeriesOutcome(res, seriesId, outcome);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Failed to update task series" });
  }
}

/**
 * Validates the template fields present in the body. Stateless. The reminder pair is one unit:
 * if either key is present, both must be, each valid or null (both null clears the reminder).
 */
function buildTemplateFields(body) {
  const hasOffset = has(body, "reminderOffsetDays");
  const hasTime = has(body, "reminderTime");
  if (hasOffset !== hasTime) {
    return { error: "Reminder offset and time must be sent together" };
  }

  const contentFields = {};
  for (const field of ["title", "description", "subject", "checklist"]) {
    if (has(body, field)) contentFields[field] = body[field];
  }
  if (has(body, "time")) {
    const { time } = body;
    contentFields.time =
      time === null || (typeof time === "string" && !time.trim())
        ? null
        : typeof time === "string"
          ? time.trim()
          : time;
  }

  const clean = {};

  if (Object.keys(contentFields).length > 0) {
    const validation = validateTaskFields(contentFields, { partial: true });
    if (validation.message) return { error: validation.message };

    for (const field of Object.keys(contentFields)) {
      const value = has(validation.clean, field) ? validation.clean[field] : contentFields[field];
      // Template checklist items are seed text only; ids and completion are assigned on
      // materialization.
      clean[field] = field === "checklist" ? value.map(item => ({ text: item.text })) : value;
    }
  }

  if (hasOffset) {
    const reminderValidation = validateReminderFields(body);
    if (reminderValidation.message) return { error: reminderValidation.message };
    Object.assign(clean, reminderValidation.clean);
  }

  return { clean };
}

/**
 * Template edit = "apply to future occurrences". Already-materialized occurrences keep their
 * own values; this never touches the `tasks` collection.
 */
async function handleTemplateEdit(req, res) {
  const uid = req.user.uid;
  const { seriesId } = req.params;

  const fields = buildTemplateFields(req.body);
  if (fields.error) return res.status(400).json({ message: fields.error });

  try {
    const outcome = await runSeriesUpdate(seriesId, uid, series => {
      const update = {};
      for (const [field, value] of Object.entries(fields.clean)) {
        update[`template.${field}`] = value;
      }
      return {
        update,
        nextSeries: { ...series, template: { ...series.template, ...fields.clean } },
      };
    });
    return sendSeriesOutcome(res, seriesId, outcome);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Failed to update task series" });
  }
}

router.patch("/:seriesId", requireAuth, async (req, res) => {
  const body = req.body ?? {};
  req.body = body;

  if (has(body, "enabled")) return handleEnabledChange(req, res);

  if (has(body, "status") || has(body, "dueDate")) {
    return res.status(400).json({
      message: "status and dueDate are occurrence-level and cannot be set on a series",
    });
  }

  const touchesRecurrence = has(body, "rule") || has(body, "endDate");
  const touchesTemplate = TEMPLATE_FIELDS.some(field => has(body, field));

  if (touchesRecurrence && touchesTemplate) {
    return res.status(400).json({
      message: "Recurrence changes and template edits must be sent in separate requests",
    });
  }
  if (touchesRecurrence) return handleRecurrenceChange(req, res);
  if (touchesTemplate) return handleTemplateEdit(req, res);

  return res.status(400).json({ message: "No supported fields to update" });
});

// Occurrence-level edits
router.patch("/:seriesId/occurrences/:date", requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const { seriesId, date } = req.params;
  const dateError = validateDate(date, "Occurrence date");
  if (dateError) return res.status(400).json({ message: dateError });

  try {
    const today = await getUserToday(uid);
    const seriesRef = db.collection("task_series").doc(seriesId);
    const seriesSnap = await seriesRef.get();

    if (!seriesSnap.exists) return res.status(404).json({ message: "Task series not found" });

    const series = { id: seriesSnap.id, ...seriesSnap.data() };
    if (series.userId !== uid) return res.status(403).json({ message: "Unauthorized" });
    if ((series.exceptions ?? []).includes(date)) {
      return res.status(410).json({ message: "This occurrence was deleted" });
    }

    const taskRef = db.collection("tasks").doc(`${seriesId}_${date}`);
    const taskSnap = await taskRef.get();
    const existing = taskSnap.exists ? taskSnap.data() : null;
    const scheduled = expandSeries(series, date, date).length > 0;
    if (!scheduled && (!existing || !shouldRenderMaterialized(existing, series, today))) {
      return res.status(400).json({ message: "Date is not a valid occurrence" });
    }

    const requestedFields = getOccurrenceFields(req.body);
    const validation = validateTaskFields(requestedFields, { partial: true });
    if (validation.message) return res.status(400).json({ message: validation.message });

    if (Object.prototype.hasOwnProperty.call(req.body, "dueDate") && req.body.dueDate !== date) {
      return res.status(400).json({ message: "Occurrence due date cannot be changed" });
    }

    const cleanFields = validation.clean;
    const finalReminderDate = Object.prototype.hasOwnProperty.call(cleanFields, "reminderDate")
      ? cleanFields.reminderDate
      : (existing?.reminderDate ?? null);
    const finalReminderTime = Object.prototype.hasOwnProperty.call(cleanFields, "reminderTime")
      ? cleanFields.reminderTime
      : (existing?.reminderTime ?? null);
    if (Boolean(finalReminderDate) !== Boolean(finalReminderTime)) {
      return res.status(400).json({
        message: "Date and time is required to set a reminder.",
      });
    }

    const result = await db.runTransaction(async transaction => {
      const currentSnap = await transaction.get(taskRef);
      if (currentSnap.exists) {
        const current = currentSnap.data();
        const updated = { ...current, ...cleanFields };
        transaction.set(taskRef, updated);
        return updated;
      }

      const reminderFields = getReminderFields(series.template, date, today);
      const initialized = {
        seriesId,
        occurrenceDate: date,
        userId: uid,
        title: series.template.title,
        description: series.template.description,
        subject: series.template.subject,
        time: series.template.time,
        checklist: materializeChecklist(series.template.checklist),
        links: series.template.links ?? [],
        dueDate: date,
        status: "To Do",
        ...reminderFields,
        ...cleanFields,
      };
      transaction.set(taskRef, initialized);
      return initialized;
    });

    return res.status(200).json(withOccurrenceResponse(result, taskRef.id, today));
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Failed to update task occurrence" });
  }
});

export default router;
