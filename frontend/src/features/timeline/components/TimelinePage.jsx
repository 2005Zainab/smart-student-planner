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

  // Reviewer feedback: let users hide completed tasks
  const [showCompleted, setShowCompleted] = useState(true);

  // Track the task being edited
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Reuse the shared date utility for sorting
  const timelineTasks = getTimelineTasks(tasks);

  // Filter out completed tasks if the user chooses
  const visibleTasks = showCompleted
    ? timelineTasks
    : timelineTasks.filter(task => task.status !== "Completed");

  const completedCount = timelineTasks.filter(task => task.status === "Completed").length;

  const selectedTask = timelineTasks.find(task => task.id === selectedTaskId);

  // Only allow one-off tasks to change their due date
  const handleTaskClick = task => {
    if (isOccurrence(task) || isSaving) return;

    // Clicking the same task again closes the editor
    if (selectedTaskId === task.id) {
      handleCancel();
      return;
    }

    setSelectedTaskId(task.id);
    setNewDate(task.dueDate?.slice(0, 10) ?? "");
    setSaveError("");
  };

  // Save the new date
  const handleSaveDate = async () => {
    if (!selectedTask || !newDate || isSaving) return;

    if (isOccurrence(selectedTask)) {
      setSaveError("Recurring task dates cannot be changed here.");
      return;
    }

    const originalDate = selectedTask.dueDate?.slice(0, 10) ?? "";

    if (newDate === originalDate) {
      handleCancel();
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      await patchTask(selectedTask, {
        dueDate: newDate,
      });

      handleCancel();
    } catch (err) {
      console.error("Could not update due date:", err);

      setSaveError("Could not save the new date. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Close the date editor
  const handleCancel = () => {
    setSelectedTaskId(null);
    setNewDate("");
    setSaveError("");
  };

  // Show or hide completed tasks
  const handleToggleCompleted = () => {
    if (isSaving) return;

    setShowCompleted(previous => {
      const next = !previous;

      // Close an editor if its task will be hidden
      if (!next && selectedTask?.status === "Completed") {
        handleCancel();
      }

      return next;
    });
  };

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      {/* Timeline heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Timeline</h2>

          <p className="mt-1 text-muted-foreground">
            View your assessments and deadlines in date order.
          </p>
        </div>

        {/* Reviewer feedback: completed task toggle */}
        <Button
          type="button"
          variant="outline"
          onClick={handleToggleCompleted}
          disabled={isSaving}
          aria-pressed={showCompleted}
        >
          {showCompleted
            ? `Hide completed (${completedCount})`
            : `Show completed (${completedCount})`}
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {isLoading && <p className="text-muted-foreground">Loading timeline...</p>}

          {error && (
            <p role="alert" className="text-destructive">
              Unable to load tasks.
            </p>
          )}

          {!isLoading && !error && timelineTasks.length === 0 && (
            <p className="text-muted-foreground">No assessments or deadlines found.</p>
          )}

          {!isLoading && !error && timelineTasks.length > 0 && visibleTasks.length === 0 && (
            <div className="space-y-3">
              <p className="text-muted-foreground">All your current tasks are completed.</p>

              <Button type="button" variant="outline" onClick={() => setShowCompleted(true)}>
                Show completed tasks
              </Button>
            </div>
          )}

          {/* Timeline task list */}
          {!isLoading && !error && (
            <div className="space-y-4">
              {visibleTasks.map(task => {
                const recurring = isOccurrence(task);
                const completed = task.status === "Completed";

                const isEditing = selectedTaskId === task.id && !recurring;

                return (
                  <div key={task.id} className="flex gap-4">
                    {/* Timeline dot and connecting line */}
                    <div className="flex shrink-0 flex-col items-center">
                      <div
                        className={`size-3 rounded-full ${
                          completed ? "bg-green-600" : "bg-primary"
                        }`}
                      />

                      <div className="min-h-12 w-px flex-1 bg-border" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-3 pb-3">
                      {/* Reviewer feedback:
                          Active recurring tasks should not
                          look disabled or completed */}
                      {recurring ? (
                        <div
                          className={`w-full rounded-md border bg-card p-4 ${
                            completed ? "opacity-70" : ""
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className={`font-medium ${completed ? "line-through" : ""}`}>
                                {task.title}
                              </p>

                              {completed && (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                  ✓ Completed
                                </span>
                              )}

                              <span className="rounded-full border px-2 py-0.5 text-xs text-foreground">
                                Recurring
                              </span>
                            </div>

                            <p className="text-sm text-muted-foreground">
                              {format(task.parsedDateTime, "dd/MM/yyyy")}
                            </p>

                            {task.subject && (
                              <p className="text-sm text-muted-foreground">{task.subject}</p>
                            )}

                            <p className="text-xs text-muted-foreground">
                              Recurring task date cannot be changed here
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className={`h-auto w-full justify-start whitespace-normal p-4 ${
                            completed ? "opacity-70" : ""
                          } ${isEditing ? "border-primary" : ""}`}
                          onClick={() => handleTaskClick(task)}
                          disabled={isSaving}
                          aria-expanded={isEditing}
                          title="Click to change the due date"
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
                                One-off
                              </span>
                            </div>

                            <p className="text-sm text-muted-foreground">
                              {format(task.parsedDateTime, "dd/MM/yyyy")}
                            </p>

                            {task.subject && (
                              <p className="text-sm text-muted-foreground">{task.subject}</p>
                            )}

                            <p className="text-xs text-muted-foreground">
                              {isEditing ? "Editing due date" : "Click to change due date"}
                            </p>
                          </div>
                        </Button>
                      )}

                      {/* Reviewer feedback:
                          Editor appears directly underneath
                          the selected task, not at the bottom */}
                      {isEditing && (
                        <div className="rounded-md border bg-card p-4">
                          <h3 className="font-semibold">Move assessment</h3>

                          <p className="mt-2 text-sm">{task.title}</p>

                          <label
                            htmlFor={`timeline-date-${task.id}`}
                            className="mt-4 block text-sm font-medium"
                          >
                            Choose a new due date
                          </label>

                          <input
                            id={`timeline-date-${task.id}`}
                            type="date"
                            value={newDate}
                            onChange={event => setNewDate(event.target.value)}
                            disabled={isSaving}
                            className="mt-2 rounded-md border bg-background p-2 text-foreground"
                          />

                          {saveError && (
                            <p role="alert" className="mt-2 text-sm text-destructive">
                              {saveError}
                            </p>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={handleSaveDate}
                              disabled={!newDate || isSaving}
                            >
                              {isSaving ? "Saving..." : "Save date"}
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCancel}
                              disabled={isSaving}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export { TimelinePage };
