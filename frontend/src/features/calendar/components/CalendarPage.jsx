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
  parseISO,
  isSameMonth,
  isToday,
} from "date-fns";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { useTasks } from "../../tasks/hooks/useTasks";
import { TaskForm } from "../../tasks/components/TaskForm";
import { httpClient } from "../../../shared/http-client";

function CalendarPage() {
  const { tasks, setTasks, isLoading, error } = useTasks();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editorOpen, setEditorOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingTaskId, setEditingTaskId] = useState(null);

  const [titleError, setTitleError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const emptyDraft = {
    title: "",
    description: "",
    subject: "",
    priority: "Medium",
    status: "To Do",
    dueDate: undefined,
    time: "",
  };

  const [draft, setDraft] = useState(emptyDraft);

  //Tasks that have a date can show on calendar
  const calendarTasks = tasks.filter((task) => task.dueDate);

  //Group tasks by date
  const tasksByDate = calendarTasks.reduce((groupedTasks, task) => {
    if (!groupedTasks[task.dueDate]) {
      groupedTasks[task.dueDate] = [];
    }

    groupedTasks[task.dueDate].push(task);

    return groupedTasks;
  }, {});

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

  //Open form for a new task
  const openAddForm = (date = undefined) => {
    setFormMode("create");
    setEditingTaskId(null);
    setTitleError(null);
    setSaveError(null);

    setDraft({
      ...emptyDraft,
      dueDate: date,
    });

    setEditorOpen(true);
  };

  //Open existing task to edit
  const openEditForm = (task) => {
    setFormMode("edit");
    setEditingTaskId(task.id);
    setTitleError(null);
    setSaveError(null);

    setDraft({
      ...task,
      dueDate:
        typeof task.dueDate === "string"
          ? parseISO(task.dueDate)
          : task.dueDate,
      time: task.time || "",
    });

    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setFormMode("create");
    setEditingTaskId(null);
    setTitleError(null);
    setSaveError(null);
    setDraft(emptyDraft);
  };

  //Save new task or edited task
  const saveTask = async () => {
    if (!draft.title || draft.title.trim() === "") {
      setTitleError("Title cannot be empty");
      return;
    }

    //Calendar tasks need a date
    if (!draft.dueDate) {
      setSaveError("Please choose a due date for the calendar task");
      return;
    }

    setTitleError(null);
    setSaveError(null);

    const taskToSave = {
      title: draft.title.trim(),
      description: draft.description || "",
      subject: draft.subject || "",
      priority: draft.priority || "Medium",
      status: draft.status || "To Do",

      dueDate:
        draft.dueDate instanceof Date
          ? format(draft.dueDate, "yyyy-MM-dd")
          : draft.dueDate,

      //Send time to backend
      time: draft.time || null,
    };

    try {
      if (formMode === "create") {
        const savedTask = await httpClient(
          "http://localhost:3000/api/tasks",
          {
            method: "POST",
            body: JSON.stringify(taskToSave),
          },
        );

        setTasks((current) => [...current, savedTask]);
      } else {
        await httpClient(
          `http://localhost:3000/api/tasks/${editingTaskId}`,
          {
            method: "PATCH",
            body: JSON.stringify(taskToSave),
          },
        );

        setTasks((current) =>
          current.map((task) =>
            task.id === editingTaskId
              ? {
                  ...task,
                  ...taskToSave,
                }
              : task,
          ),
        );
      }

      closeEditor();
    } catch (err) {
      console.log(err);
      setSaveError(err.message || "Unable to save task");
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
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-3xl font-bold">
              {format(currentMonth, "MMMM yyyy")}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              View and edit your task deadlines.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setCurrentMonth(subMonths(currentMonth, 1))
              }
            >
              ←
            </Button>

            <Button
              variant="outline"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                setCurrentMonth(addMonths(currentMonth, 1))
              }
            >
              →
            </Button>

            <Button onClick={() => openAddForm()}>
              <Plus />
              Add task
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-x border-t bg-muted text-center text-sm font-semibold text-muted-foreground">
          <div className="p-3">Mon</div>
          <div className="p-3">Tue</div>
          <div className="p-3">Wed</div>
          <div className="p-3">Thu</div>
          <div className="p-3">Fri</div>
          <div className="p-3">Sat</div>
          <div className="p-3">Sun</div>
        </div>

        <div className="grid grid-cols-7 border-l border-t">
          {calendarDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate[dateKey] || [];

            return (
              <div
                key={day.toISOString()}
                className={`min-h-36 border-b border-r p-2 ${
                  !isSameMonth(day, currentMonth)
                    ? "bg-muted/40"
                    : "bg-card"
                }`}
                onDoubleClick={() => openAddForm(day)}
              >
                <div className="mb-2 flex justify-end">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      isToday(day)
                        ? "bg-primary font-semibold text-primary-foreground"
                        : isSameMonth(day, currentMonth)
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                <div className="space-y-1">
                  {dayTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        openEditForm(task);
                      }}
                      className="w-full truncate rounded-md bg-secondary px-2 py-1.5 text-left text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                    >
                      {task.time
                        ? `${task.time} - ${task.title}`
                        : task.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (open) {
            setEditorOpen(true);
          } else {
            closeEditor();
          }
        }}
      >
        <DialogContent>
          <DialogTitle>
            {formMode === "create"
              ? "Add task"
              : "Edit task"}
          </DialogTitle>

          <DialogDescription>
            {formMode === "create"
              ? "Create a task for your calendar."
              : "Update the details for this task."}
          </DialogDescription>

          <TaskForm
            draft={draft}
            setDraft={setDraft}
            onSave={saveTask}
            onCancel={closeEditor}
            titleError={titleError}
            saveError={saveError}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}

export { CalendarPage };