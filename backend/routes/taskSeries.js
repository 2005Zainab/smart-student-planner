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
      checklist: buildOccurrenceChecklist(template.checklist, occurrenceId),
      dueDate: clean.dueDate,
      status: "To Do",
      priority: getPriorityFromDueDate(clean.dueDate, today),
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
