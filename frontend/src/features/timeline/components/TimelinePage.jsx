import { useState } from "react";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useTasksContext } from "@/features/tasks/context/TasksContext";
import { useTaskUpdates } from "@/features/tasks/hooks/useTaskUpdates";
import { getTimelineTasks } from "@/features/tasks/utils/task-date-utils";

function TimelinePage() {
  const { tasks, setTasks, isLoading, error } = useTasksContext();
  const { patchTask } = useTaskUpdates(setTasks);

  const [selectedTask, setSelectedTask] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Get the tasks in date order
  const timelineTasks = getTimelineTasks(tasks);

  // Open the date editor when a task is clicked
  const handleTaskClick = task => {
    setSelectedTask(task);
    setNewDate(task.dueDate);
    setSaveError("");
  };

  // Save the new task date
  const handleSaveDate = async () => {
    if (!selectedTask || !newDate || isSaving) return;

    // Close the editor if the date has not changed
    if (newDate === selectedTask.dueDate) {
      setSelectedTask(null);
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      await patchTask(selectedTask, {
        dueDate: newDate,
      });

      // Close the editor after saving
      setSelectedTask(null);
    } catch {
      // Show a message if the date could not be saved
      setSaveError("Could not save the new date. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Close the editor without saving
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
              timelineTasks.map(task => (
                <div key={task.id} className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <div className="size-3 rounded-full bg-primary" />
                    <div className="h-12 w-px bg-border" />
                  </div>

                  <Button
                    variant="outline"
                    className="h-auto w-full justify-start p-4"
                    onClick={() => handleTaskClick(task)}
                    disabled={isSaving}
                  >
                    <div className="text-left">
                      <p className="font-medium">{task.title}</p>

                      <p className="text-sm text-muted-foreground">
                        {format(task.parsedDateTime, "dd/MM/yyyy")}
                      </p>

                      {task.subject && (
                        <p className="text-sm text-muted-foreground">{task.subject}</p>
                      )}
                    </div>
                  </Button>
                </div>
              ))}
          </div>

          {selectedTask && (
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
