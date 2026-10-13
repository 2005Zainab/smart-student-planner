import { format } from "date-fns";
import { httpClient } from "../../../shared/http-client";
import { getOccurrenceChanges, getTaskUrl, isOccurrence } from "../utils/task-endpoints";

//Editor dates are Date objects; the API wants YYYY-MM-DD. Empty values become undefined.
const toDateString = value =>
  value ? (value instanceof Date ? format(value, "yyyy-MM-dd") : value) : undefined;

/**
 * Editor draft -> the fields that actually changed, or null when nothing did.
 *
 * A recurring occurrence is diffed against the fields its endpoint accepts (never dueDate,
 * seriesId or priority) with empty values normalized, so an untouched form yields null
 * instead of an empty PATCH that would needlessly materialize the occurrence. One-off tasks
 * keep the original strict field-by-field comparison.
 */
function getEditChanges(original, draft) {
  const edited = {
    ...draft,
    dueDate: toDateString(draft.dueDate),
    reminderDate: toDateString(draft.reminderDate),
    time: draft.time || null,
    checklist: draft.checklist || [],
  };

  const changes = isOccurrence(original)
    ? getOccurrenceChanges(edited, original)
    : Object.fromEntries(
        Object.entries(edited).filter(([key, value]) => value !== original?.[key]),
      );

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * The one place that knows how to update an existing task, whether it is a one-off task or a
 * recurring occurrence. Pages hand in their own local-state setter and keep only their UI
 * concerns (editor open/close, validation, toasts).
 *
 *   const { patchTask, saveEdit } = useTaskUpdates(setTasks);
 *
 * - patchTask(task, changes): PATCH the right endpoint, then merge the result into local
 *   state. Used for edits, status toggles, undo and checklist toggles.
 * - saveEdit(original, draft): diff an editor draft against the original and patch only what
 *   changed. Resolves to false, sending nothing, when nothing changed.
 *
 * Both reject if the request fails, leaving local state untouched; callers show the error.
 */
function useTaskUpdates(setTasks) {
  //Occurrences go to /task-series/:seriesId/occurrences/:date, one-offs to /tasks/:id
  //(see getTaskUrl). Resolves to the raw server response.
  async function patchTask(task, changes) {
    const saved = await httpClient(getTaskUrl(task), {
      method: "PATCH",
      body: JSON.stringify(changes),
    });

    //One merge rule for every caller. The server's response wins over the local changes (it
    //has the recomputed priority and, for a materialized occurrence, virtual: false) and the
    //client-side id is always kept: an occurrence doc has no id field of its own.
    setTasks(current =>
      current.map(existing =>
        existing.id === task.id ? { ...existing, ...changes, ...saved, id: existing.id } : existing,
      ),
    );

    return saved;
  }

  async function saveEdit(original, draft) {
    const changes = getEditChanges(original, draft);

    if (!changes) {
      return false;
    }

    await patchTask(original, changes);
    return true;
  }

  return { patchTask, saveEdit };
}

export { useTaskUpdates };
