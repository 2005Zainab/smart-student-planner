const API_BASE = "http://localhost:3000/api";

// Fields PATCH /task-series/:seriesId/occurrences/:date accepts. dueDate is deliberately
// absent: an occurrence cannot be moved (it must equal the occurrence date, §2.2), and
// seriesId / occurrenceDate / userId / priority are never sent from the client.
const OCCURRENCE_FIELDS = [
  "title",
  "description",
  "subject",
  "status",
  "time",
  "checklist",
  "reminderDate",
  "reminderTime",
];

// The form uses "" / undefined for "empty" where the server stores null.
const NULLABLE_FIELDS = new Set(["time", "reminderDate", "reminderTime"]);

// A recurring occurrence (virtual or materialized) always carries an explicit seriesId.
// Never parse `${seriesId}_${date}` out of task.id to get these values.
export const isOccurrence = task => Boolean(task?.seriesId);

export const getTaskUrl = task =>
  isOccurrence(task)
    ? `${API_BASE}/task-series/${task.seriesId}/occurrences/${task.occurrenceDate}`
    : `${API_BASE}/tasks/${task.id}`;

const normalize = (key, value) => {
  if (key === "checklist") return value ?? [];
  if (NULLABLE_FIELDS.has(key)) return value === "" || value === undefined ? null : value;
  return value;
};

const isSame = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Diff for an occurrence edit: only the accepted fields that actually changed.
 * Compares with normalization so an untouched form never produces a change just because
 * the form says undefined/"" where the server says null (which would otherwise send an
 * empty PATCH and needlessly materialize the occurrence).
 */
export function getOccurrenceChanges(edited, original) {
  const changes = {};

  for (const key of OCCURRENCE_FIELDS) {
    const before = normalize(key, original[key]);
    const after = normalize(key, edited[key]);

    if (!isSame(before, after)) {
      changes[key] = after;
    }
  }

  return changes;
}

/**
 * Replace a task in local state with the server's response after a PATCH.
 * A materialized occurrence doc has no `id` field of its own, so merge onto the existing
 * task and keep its id; the client-side id is what keys the list and the next lookup.
 * One-off tasks keep the existing "response replaces task" behavior.
 */
export const mergeSavedTask = (task, saved) =>
  isOccurrence(task) ? { ...task, ...saved, id: task.id } : saved;

/**
 * Same idea for quick updates (status toggle, undo) where the local patch is applied
 * immediately and the response, if any, is layered on top for occurrences.
 */
export const applyTaskUpdate = (task, patch, saved) =>
  isOccurrence(task) ? { ...task, ...patch, ...saved, id: task.id } : { ...task, ...patch };
