import { toast } from "@/components/ui/toast";
import { httpClient } from "../../../shared/http-client";
import { getSeriesUrl, getTaskUrl, isOccurrence } from "../utils/task-endpoints";

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

  // The whole series, including completed occurrences.
  async function deleteSeries(task) {
    if (!task?.seriesId) throw new Error("This task is not part of a series");

    await httpClient(getSeriesUrl(task.seriesId), { method: "DELETE" });

    setTasks(current => current.filter(existing => existing.seriesId !== task.seriesId));

    toast.add({ title: "Series deleted", type: "success" });
  }

  return { deleteTask, deleteSeries };
}

export { useTaskDeletion };
