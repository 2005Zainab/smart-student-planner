import { toast } from "@/components/ui/toast";
import { httpClient } from "../../../shared/http-client";
import { getTaskUrl, isOccurrence } from "../utils/task-endpoints";

// Flip to true once deleteSeries is implemented. The dialog's "Delete all" option is disabled until then.
const CAN_DELETE_SERIES = false;

function useTaskDeletion(setTasks, refetch) {
  // A one-off task, or ONE occurrence of a recurring task (getTaskUrl picks the endpoint).
  async function deleteTask(task) {
    await httpClient(getTaskUrl(task), { method: "DELETE" });

    setTasks(current => current.filter(existing => existing.id !== task.id));

    if (isOccurrence(task)) {
      // The list only holds missed + today + the next occurrence, so a deleted "next" needs a refetch.
      refetch();
    }

    toast.add({
      title: isOccurrence(task) ? "Occurrence deleted" : "Task Deleted",
      type: "success",
    });
  }

  // TODO(series-delete): implement DELETE /task-series/:seriesId, then here:
  //   await httpClient(getSeriesUrl(task.seriesId), { method: "DELETE" });
  //   setTasks(current => current.filter(existing => existing.seriesId !== task.seriesId));
  //   toast.add({ title: "Series deleted", type: "success" });
  // and set CAN_DELETE_SERIES to true.
  async function deleteSeries() {
    throw new Error("Deleting a whole series is not implemented yet");
  }

  return { deleteTask, deleteSeries, canDeleteSeries: CAN_DELETE_SERIES };
}

export { useTaskDeletion };
