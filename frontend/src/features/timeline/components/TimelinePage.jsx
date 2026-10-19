import { useState } from "react";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useTasksContext } from "@/features/tasks/context/TasksContext";
import { useTaskUpdates } from "@/features/tasks/hooks/useTaskUpdates";
import { getTimelineTasks } from "@/features/tasks/utils/task-date-utils";
import { isOccurrence } from "@/features/tasks/utils/task-endpoints";

function TimelinePage() {
  const { tasks, setTasks, isLoading, error } = useTasksContext();
  const { patchTask } = useTaskUpdates(setTasks);

  const [selectedTask, setSelectedTask] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Reuse the shared task-date utility to sort the timeline.
  const timelineTasks = getTimelineTasks(tasks);

  // Only one-off tasks can have their due date changed here.
  const handleTaskClick = task => {
    if (isOccurrence(task) || isSaving) return;

    setSelectedTask(task);
    setNewDate(task.dueDate?.slice(0, 10) ?? "");
    setSaveError("");
  };

  // Save the new date for a one-off task.
  const handleSaveDate = async () => {
    if (!selectedTask || !newDate || isSaving) return;

    // Recurring due dates must not be changed through this form.
    if (isOccurrence(selectedTask)) {
      setSaveError("Recurring task dates cannot be changed here.");
      return;
    }

    if (newDate === selectedTask.dueDate?.slice(0, 10)) {
      setSelectedTask(null);
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      await patchTask(selectedTask, {
        dueDate: newDate,
      });

      setSelectedTask(null);
      setNewDate("");
    } catch (err) {
      console.error(err);
      setSaveError("Could not save the new date. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Close the date editor without making changes.
  const handleCancel = () => {
    setSelectedTask(null);
    setNewDate("");
    setSaveError("");
  };

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Timeline</h2>

        <p className="mt-1 text-muted-foreground">
          View your assessments and deadlines in date order.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          {isLoading && <p>Loading timeline...</p>}

          {error && <p>Unable to load tasks.</p>}

          {!isLoading && !error && timelineTasks.length === 0 && (
            <p className="text-muted-foreground">No assessments or deadlines found.</p>
          )}

          <div className="space-y-4">
            {!isLoading &&
              !error &&
              timelineTasks.map(task => {
                const recurring = isOccurrence(task);
                const completed = task.status === "Completed";

                return (
                  <div key={task.id} className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex size-3 items-center justify-center rounded-full ${
                          completed ? "bg-green-600" : "bg-primary"
                        }`}
                      />
                      <div className="h-12 w-px bg-border" />
                    </div>

                    <Button
                      variant="outline"
                      className={`h-auto w-full justify-start p-4 ${completed ? "opacity-70" : ""}`}
                      onClick={() => handleTaskClick(task)}
                      disabled={isSaving || recurring}
                      title={
                        recurring
                          ? "Recurring task dates cannot be changed"
                          : "Click to change the due date"
                      }
                    >
                      <div className="w-full space-y-2 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`font-medium ${completed ? "line-through" : ""}`}>
                            {task.title}
                          </p>

                          {completed && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                              ✓ Completed
                            </span>
                          )}

                          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                            {recurring ? "Recurring" : "One-off"}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {format(task.parsedDateTime, "dd/MM/yyyy")}
                        </p>

                        {task.subject && (
                          <p className="text-sm text-muted-foreground">{task.subject}</p>
                        )}

                        {!recurring && (
                          <p className="text-xs text-muted-foreground">Click to change due date</p>
                        )}

                        {recurring && (
                          <p className="text-xs text-muted-foreground">
                            Recurring task date cannot be changed here
                          </p>
                        )}
                      </div>
                    </Button>
                  </div>
                );
              })}
          </div>

          {/* Date editor for one-off tasks only */}
          {selectedTask && !isOccurrence(selectedTask) && (
            <div className="mt-6 rounded-md border p-4">
              <h3 className="font-semibold">Move assessment</h3>

              <p className="mt-2">{selectedTask.title}</p>

              <label htmlFor="timeline-date" className="mt-4 block text-sm font-medium">
                Choose a new due date
              </label>

              <input
                id="timeline-date"
                type="date"
                value={newDate}
                onChange={event => setNewDate(event.target.value)}
                disabled={isSaving}
                className="mt-2 rounded-md border bg-background p-2"
              />

              {saveError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {saveError}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <Button onClick={handleSaveDate} disabled={!newDate || isSaving}>
                  {isSaving ? "Saving..." : "Save date"}
                </Button>

                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export { TimelinePage };
