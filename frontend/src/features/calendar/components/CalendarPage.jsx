import { useState } from "react";
import { useTasks } from "../../tasks/hooks/useTasks";
import { httpClient } from "../../../shared/http-client";

function CalendarPage() {
  const { tasks, setTasks, isLoading, error } = useTasks();

  const [editingTask, setEditingTask] = useState(null);
  const [draft, setDraft] = useState({
    title: "",
    dueDate: "",
  });

  const calendarTasks = tasks.filter((task) => task.dueDate);

  const startEditing = (task) => {
    setEditingTask(task);
    setDraft({
      title: task.title,
      dueDate: task.dueDate,
    });
  };

  const saveChanges = async () => {
    try {
      await httpClient(
        `http://localhost:3000/api/tasks/${editingTask.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: draft.title,
            dueDate: draft.dueDate,
          }),
        },
      );

      setTasks((current) =>
        current.map((task) =>
          task.id === editingTask.id
            ? {
                ...task,
                title: draft.title,
                dueDate: draft.dueDate,
              }
            : task,
        ),
      );

      setEditingTask(null);
    } catch (err) {
      console.log(err);
    }
  };

  if (isLoading) {
    return <p className="p-6">Loading calendar...</p>;
  }

  if (error) {
    return <p className="p-6">Unable to load calendar tasks.</p>;
  }

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold">Calendar</h2>
        <p className="mt-1 text-muted-foreground">
          View and manage your study schedule.
        </p>
      </div>

      {calendarTasks.length === 0 && (
        <p>No tasks with due dates yet.</p>
      )}

      {calendarTasks.map((task) => (
        <div
          key={task.id}
          className="rounded-lg border p-4"
        >
          {editingTask?.id === task.id ? (
            <div className="space-y-3">
              <input
                className="w-full rounded border p-2"
                value={draft.title}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    title: event.target.value,
                  })
                }
              />

              <input
                className="w-full rounded border p-2"
                type="date"
                value={draft.dueDate || ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    dueDate: event.target.value,
                  })
                }
              />

              <button
                className="rounded bg-black px-4 py-2 text-white"
                onClick={saveChanges}
              >
                Save changes
              </button>
            </div>
          ) : (
            <>
              <h3 className="font-semibold">{task.title}</h3>
              <p>Date: {task.dueDate}</p>

              <button
                className="mt-4 rounded bg-black px-4 py-2 text-white"
                onClick={() => startEditing(task)}
              >
                Edit
              </button>
            </>
          )}
        </div>
      ))}
    </main>
  );
}

export { CalendarPage };