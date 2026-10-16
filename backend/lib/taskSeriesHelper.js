import { randomUUID } from "crypto";
import { getPriorityFromDueDate, buildOccurrenceChecklist } from "./recurrence.js";
import { offsetDate } from "./dateHelper.js";

function getSeriesSummary(series) {
  const openSegment =
    series.segments.find(segment => segment.until === null) ?? series.segments.at(-1);
  return {
    enabled: series.enabled !== false,
    rule: openSegment.rule,
    endDate: series.endDate ?? null,
  };
}

export function getVirtualOccurrence(series, date, today) {
  const isFuture = date >= today;
  const reminderOffsetDays = series.template.reminderOffsetDays;

  const occcurrenceId = `${series.id}_${date}`;
  return {
    id: occcurrenceId,
    seriesId: series.id,
    occurrenceDate: date,
    ...series.template,
    checklist: buildOccurrenceChecklist(series.template.checklist, occcurrenceId),
    virtual: true,
    dueDate: date,
    status: "To Do",
    reminderDate:
      isFuture && reminderOffsetDays !== null && reminderOffsetDays !== undefined
        ? offsetDate(date, -reminderOffsetDays)
        : null,
    reminderTime: isFuture ? (series.template.reminderTime ?? null) : null,
    priority: getPriorityFromDueDate(date, today),
    series: getSeriesSummary(series),
  };
}

export function getMaterializedOccurrence(doc, series, today) {
  return {
    id: doc.id,
    ...doc.data,
    virtual: false,
    priority: getPriorityFromDueDate(doc.data.dueDate ?? doc.data.occurrenceDate, today),
    series: getSeriesSummary(series),
  };
}

export function readSeries(snapshot) {
  const series = [];
  if (typeof snapshot.forEach !== "function") return series;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (Array.isArray(data.segments) && data.segments.length > 0) {
      series.push({ id: doc.id, ...data });
    }
  });
  return series;
}

export function forEachSnapshot(snapshot, callback) {
  if (typeof snapshot.forEach === "function") snapshot.forEach(callback);
}

export function getReminderFields(template, occurrenceDate, today) {
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

export function getOccurrenceFields(body) {
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

export function materializeChecklist(checklist) {
  return (checklist ?? []).map(item => ({
    id: randomUUID(),
    text: item.text,
    completed: false,
  }));
}

export function withOccurrenceResponse(data, id, today) {
  return {
    id,
    ...data,
    virtual: false,
    priority: getPriorityFromDueDate(data.dueDate ?? data.occurrenceDate, today),
  };
}

export function comparePausesByFrom(first, second) {
  return first.from < second.from ? -1 : first.from > second.from ? 1 : 0;
}

/**
 * Pause: effective TOMORROW (the only "tomorrow" operation).
 * Returns the new { pauses, enabled } or null when already paused (no-op).
 */
export function applyPause(series, today) {
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
export function applyResume(series, today) {
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

export function has(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

export function compareSegmentsByFrom(first, second) {
  return first.from < second.from ? -1 : first.from > second.from ? 1 : 0;
}

// Order-insensitive comparison so a form that resubmits [3, 1] for a stored [1, 3] is
// recognised as "unchanged".
export function canonicalRule(rule) {
  const canonical = {};
  for (const key of Object.keys(rule).sort()) {
    canonical[key] =
      key === "weekdays" && Array.isArray(rule[key])
        ? [...rule[key]].sort((first, second) => first - second)
        : rule[key];
  }
  return JSON.stringify(canonical);
}

export function rulesEqual(first, second) {
  return canonicalRule(first) === canonicalRule(second);
}
