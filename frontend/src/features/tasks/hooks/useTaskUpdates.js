import { format } from "date-fns";
import { httpClient } from "../../../shared/http-client";
import {
  getOccurrenceChanges,
  getSeriesUrl,
  getTaskUrl,
  isOccurrence,
} from "../utils/task-endpoints";
import { getOccurrenceDraftChanges, getTemplateChanges } from "../utils/occurrence-scope";

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

  // Files are never part of an edit. They are uploaded and removed through their own endpoints
  // (see useTaskFiles), so the draft's files list must not be sent with the task fields.
  const changes = isOccurrence(original)
    ? getOccurrenceChanges(edited, original)
    : Object.fromEntries(
        Object.entries(edited).filter(
          ([key, value]) => key !== "files" && value !== original?.[key],
        ),
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
 * - updateFiles(taskId, update): change one task's files list in local state. Sends nothing.
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

  // Changes only the files list of one task in local state. The upload and remove requests are
  // made by useTaskFiles, so nothing is sent from here. update takes the current files and
  // returns the new list.
  function updateFiles(taskId, update) {
    setTasks(current =>
      current.map(task =>
        task.id === taskId ? { ...task, files: update(task.files ?? []) } : task,
      ),
    );
  }

  async function setSeriesEnabled(seriesId, enabled) {
    const saved = await httpClient(getSeriesUrl(seriesId), {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });

    setTasks(current =>
      current.map(task =>
        task.seriesId === seriesId ? { ...task, series: { ...task.series, enabled } } : task,
      ),
    );

    return saved;
  }

  // scope: null/"occurrence" edits this task; "future" patches the series template.
  // Resolves to false, sending nothing, when there was nothing to save.
  async function saveScopedEdit(original, draft, scope = null) {
    if (isOccurrence(original) && scope === "future") {
      const changes = getOccurrenceDraftChanges(draft, original);
      const templateChanges = getTemplateChanges(changes, draft, original);

      if (Object.keys(templateChanges).length === 0) return false;

      await httpClient(getSeriesUrl(original.seriesId), {
        method: "PATCH",
        body: JSON.stringify(templateChanges),
      });
      return true;
    }

    return saveEdit(original, draft);
  }

  return { patchTask, saveEdit, saveScopedEdit, setSeriesEnabled, updateFiles };
}

export { useTaskUpdates };
