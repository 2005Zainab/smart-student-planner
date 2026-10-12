import { useState } from "react";
import { parseISO } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useTasksContext } from "@/features/tasks/context/TasksContext";

function TimelinePage() {
  const { tasks, isLoading, error } = useTasksContext();
  const [selectedTask, setSelectedTask] = useState(null);

  // Only show tasks that have a due date
  const timelineTasks = tasks
    .filter(task => task.dueDate)
    .sort((a, b) => {
      const firstDate = parseISO(a.dueDate);
      const secondDate = parseISO(b.dueDate);

      return firstDate - secondDate;
    });

  // Select a task when the user clicks it
  const handleTaskClick = task => {
    setSelectedTask(task);
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

          {!isLoading && timelineTasks.length === 0 && (
            <p className="text-muted-foreground">
              No assessments or deadlines found.
            </p>
          )}

          <div className="space-y-4">
            {timelineTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className="size-3 rounded-full bg-primary" />

                  <div className="h-12 w-px bg-border" />
                </div>

                <Button
                  variant="outline"
                  className="h-auto w-full justify-start p-4"
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="text-left">
                    <p className="font-medium">{task.title}</p>

                    <p className="text-sm text-muted-foreground">
                      {parseISO(task.dueDate).toLocaleDateString("en-NZ")}
                    </p>

                    {task.subject && (
                      <p className="text-sm text-muted-foreground">
                        {task.subject}
                      </p>
                    )}
                  </div>
                </Button>
              </div>
            ))}
          </div>

          {selectedTask && (
            <div className="mt-6 rounded-md border p-4">
              <h3 className="font-semibold">
                Selected task
              </h3>

              <p className="mt-2">
                {selectedTask.title}
              </p>

              <p className="text-sm text-muted-foreground">
                Click editing will be added next.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export { TimelinePage };