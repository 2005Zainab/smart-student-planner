import { format } from "date-fns";
import { httpClient } from "../../../shared/http-client";
import {
  getOccurrenceChanges,
  getSeriesUrl,
  getTaskUrl,
  isOccurrence,
} from "../utils/task-endpoints";
import { getOccurrenceDraftChanges, getTemplateChanges } from "../utils/occurrence-scope";

// Change a date into the format needed by the backend
const toDateString = value =>
  value ? (value instanceof Date ? format(value, "yyyy-MM-dd") : value) : undefined;

// Find which task details have changed
function getEditChanges(original, draft) {
  const edited = {
    ...draft,
    dueDate: toDateString(draft.dueDate),
    reminderDate: toDateString(draft.reminderDate),
    time: draft.time || null,

    // Save the selected Focus Timer duration
    timerMinutes: draft.timerMinutes ?? null,

    checklist: draft.checklist || [],
    links: draft.links || [],
  };

  // Recurring tasks have their own allowed fields
  const changes = isOccurrence(original)
    ? getOccurrenceChanges(edited, original)
    : Object.fromEntries(
        Object.entries(edited).filter(
          ([key, value]) => key !== "files" && value !== original?.[key],
        ),
      );

  // Return null if nothing has changed
  return Object.keys(changes).length > 0 ? changes : null;
}

// Handles updating tasks and keeping the task list up to date
function useTaskUpdates(setTasks) {
  // Save changes to the backend
  async function patchTask(task, changes) {
    const saved = await httpClient(getTaskUrl(task), {
      method: "PATCH",
      body: JSON.stringify(changes),
    });

    // Update the task in the app after it has been saved
    setTasks(current =>
      current.map(existing =>
        existing.id === task.id ? { ...existing, ...changes, ...saved, id: existing.id } : existing,
      ),
    );

    return saved;
  }

  // Save only the fields that were changed
  async function saveEdit(original, draft) {
    const changes = getEditChanges(original, draft);

    if (!changes) {
      return false;
    }

    await patchTask(original, changes);
    return true;
  }

  // Update the list of files attached to a task
  function updateFiles(taskId, update) {
    setTasks(current =>
      current.map(task =>
        task.id === taskId ? { ...task, files: update(task.files ?? []) } : task,
      ),
    );
  }

  // Pause or resume a recurring task
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

  // Save edits to one task or future recurring tasks
  async function saveScopedEdit(original, draft, scope = null) {
    if (isOccurrence(original) && scope === "future") {
      const changes = getOccurrenceDraftChanges(draft, original);
      const templateChanges = getTemplateChanges(changes, draft, original);

      // Do not send a request if nothing changed
      if (Object.keys(templateChanges).length === 0) {
        return false;
      }

      await httpClient(getSeriesUrl(original.seriesId), {
        method: "PATCH",
        body: JSON.stringify(templateChanges),
      });

      return true;
    }

    // Save changes to a normal task or a single occurrence
    return saveEdit(original, draft);
  }

  return {
    patchTask,
    saveEdit,
    saveScopedEdit,
    setSeriesEnabled,
    updateFiles,
  };
}

export { useTaskUpdates };
