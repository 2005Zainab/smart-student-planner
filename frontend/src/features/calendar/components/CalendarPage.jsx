import { useState } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";

import { useTasks } from "../../tasks/hooks/useTasks";
import { getTasks } from "../../tasks/api/getTasks";
import { httpClient } from "../../../shared/http-client";

function CalendarPage() {
  const { tasks, setTasks, isLoading, error } = useTasks();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingTask, setEditingTask] = useState(null);

  const [draft, setDraft] = useState({
    title: "",
    dueDate: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  //Show tasks that have a date
  const calendarTasks = tasks.filter((task) => task.dueDate);

  //Get calendar dates
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const calendarStart = startOfWeek(monthStart, {
    weekStartsOn: 1,
  });

  const calendarEnd = endOfWeek(monthEnd, {
    weekStartsOn: 1,
  });

  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  //Open task to edit
  const startEditing = (task) => {
    setEditingTask(task);

    setDraft({
      title: task.title,
      dueDate: task.dueDate,
    });

    setSaveError("");
  };

  //Clear the form
  const clearForm = () => {
    setEditingTask(null);

    setDraft({
      title: "",
      dueDate: "",
    });

    setSaveError("");
  };

  //Add a new item or save changes
  const saveCalendarItem = async () => {
    if (draft.title.trim() === "") {
      setSaveError("Title cannot be empty.");
      return;
    }

    if (!draft.dueDate) {
      setSaveError("Please select a date.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");

      if (editingTask) {
        //Update the task already selected
        await httpClient(
          `http://localhost:3000/api/tasks/${editingTask.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              title: draft.title.trim(),
              dueDate: draft.dueDate,
            }),
          },
        );
      } else {
        //Add a new task to the calendar
        await httpClient("http://localhost:3000/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            title: draft.title.trim(),
            description: "",
            subject: "",
            priority: "Medium",
            status: "To Do",
            dueDate: draft.dueDate,
          }),
        });
      }

      //Load tasks again after saving
      const updatedTasks = await getTasks();

      setTasks(updatedTasks ?? []);

      clearForm();
    } catch (err) {
      console.log(err);
      setSaveError("Unable to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className="p-6">Loading calendar...</p>;
  }

  if (error) {
    return <p className="p-6">Unable to load calendar tasks.</p>;
  }

  return (
    <main className="min-h-screen flex-1 bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl rounded-2xl border bg-white p-6 shadow-sm">

        {/* Calendar heading */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">
              {format(currentMonth, "MMMM yyyy")}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              View, add and edit your task deadlines.
            </p>
          </div>

          {/* Month buttons */}
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border bg-white px-4 py-2 hover:bg-gray-100"
              onClick={() =>
                setCurrentMonth(subMonths(currentMonth, 1))
              }
            >
              ←
            </button>

            <button
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </button>

            <button
              className="rounded-lg border bg-white px-4 py-2 hover:bg-gray-100"
              onClick={() =>
                setCurrentMonth(addMonths(currentMonth, 1))
              }
            >
              →
            </button>
          </div>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 border-x border-t bg-gray-50 text-center text-sm font-semibold text-gray-600">
          <div className="p-3">Mon</div>
          <div className="p-3">Tue</div>
          <div className="p-3">Wed</div>
          <div className="p-3">Thu</div>
          <div className="p-3">Fri</div>
          <div className="p-3">Sat</div>
          <div className="p-3">Sun</div>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 border-l border-t">
          {calendarDays.map((day) => {
            const dayTasks = calendarTasks.filter((task) =>
              isSameDay(
                new Date(task.dueDate + "T00:00:00"),
                day,
              ),
            );

            return (
              <div
                key={day.toISOString()}
                className={`min-h-36 border-b border-r p-2 ${
                  !isSameMonth(day, currentMonth)
                    ? "bg-gray-50"
                    : "bg-white"
                }`}
              >
                {/* Date */}
                <div className="mb-2 flex justify-end">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      isToday(day)
                        ? "bg-black font-semibold text-white"
                        : isSameMonth(day, currentMonth)
                          ? "text-gray-800"
                          : "text-gray-400"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                {/* Tasks */}
                <div className="space-y-1">
                  {dayTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => startEditing(task)}
                      className={`w-full truncate rounded-md px-2 py-1.5 text-left text-xs font-medium transition ${
                        editingTask?.id === task.id
                          ? "bg-violet-300 text-violet-950"
                          : "bg-violet-100 text-violet-800 hover:bg-violet-200"
                      }`}
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add and edit section */}
        <div className="mx-auto mt-6 max-w-xl rounded-2xl border bg-gray-50 p-6 shadow-sm">
          <h3 className="mb-2 text-2xl font-semibold">
            {editingTask
              ? "Edit calendar item"
              : "Add calendar item"}
          </h3>

          <p className="mb-5 text-sm text-gray-500">
            {editingTask
              ? "Change the task details below."
              : "Enter a title and choose a date to add it to the calendar."}
          </p>

          <div className="space-y-5">

            {/* Title */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Title
              </label>

              <input
                className="w-full rounded-lg border bg-white p-3"
                value={draft.title}
                placeholder="Enter task title"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    title: event.target.value,
                  })
                }
              />
            </div>

            {/* Date */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Date
              </label>

              <input
                className="w-full cursor-pointer rounded-lg border bg-white p-3"
                type="date"
                value={draft.dueDate}
                onClick={(event) => {
                  if (event.currentTarget.showPicker) {
                    event.currentTarget.showPicker();
                  }
                }}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    dueDate: event.target.value,
                  })
                }
              />
            </div>

            {/* Error */}
            {saveError && (
              <p className="text-sm text-red-600">
                {saveError}
              </p>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                className="rounded-lg bg-black px-5 py-3 text-white hover:bg-gray-800 disabled:opacity-40"
                onClick={saveCalendarItem}
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving..."
                  : editingTask
                    ? "Save changes"
                    : "Add to calendar"}
              </button>

              <button
                className="rounded-lg border bg-white px-5 py-3 hover:bg-gray-100 disabled:opacity-40"
                onClick={clearForm}
                disabled={isSaving}
              >
                {editingTask ? "Cancel" : "Clear"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export { CalendarPage };