import { useEffect, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import { TaskForm } from "../../tasks/components/TaskForm";
import { httpClient } from "../../../shared/http-client";
import { buildCreateTaskRequest } from "../../tasks/utils/build-create-task-request";
import {
  getOccurrenceChanges,
  getTaskUrl,
  isOccurrence,
  mergeSavedTask,
} from "../../tasks/utils/task-endpoints";
import { getCalendarTasks } from "../api/get-calendar-tasks";

//Change task time from 24 hour to 12 hour format
function formatTaskTime(time) {
  if (!time) {
    return "";
  }

  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return format(date, "h:mm a");
}

function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarTasks, setCalendarTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
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
    recurrence: null,
  };

  const [draft, setDraft] = useState(emptyDraft);

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
  const rangeFrom = format(calendarStart, "yyyy-MM-dd");
  const rangeTo = format(calendarEnd, "yyyy-MM-dd");

  useEffect(() => {
    let active = true;

    async function fetchCalendarTasks() {
      setIsLoading(true);
      setError(null);

      try {
        const tasks = await getCalendarTasks(rangeFrom, rangeTo);
        if (active) setCalendarTasks(tasks);
      } catch (loadError) {
        if (active) setError(loadError);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetchCalendarTasks();
    return () => {
      active = false;
    };
  }, [rangeFrom, rangeTo, refreshKey]);

  //Group the bounded calendar response by date.
  const tasksByDate = calendarTasks.reduce((groupedTasks, task) => {
    if (!task.dueDate) return groupedTasks;
    if (!groupedTasks[task.dueDate]) groupedTasks[task.dueDate] = [];
    groupedTasks[task.dueDate].push(task);
    return groupedTasks;
  }, {});

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
  const openEditForm = task => {
    setFormMode("edit");
    setEditingTaskId(task.id);
    setTitleError(null);
    setSaveError(null);

    setDraft({
      ...task,
      dueDate: typeof task.dueDate === "string" ? parseISO(task.dueDate) : task.dueDate,
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

      dueDate: draft.dueDate instanceof Date ? format(draft.dueDate, "yyyy-MM-dd") : draft.dueDate,

      //Send time to backend
      time: draft.time || null,
    };

    try {
      if (formMode === "create") {
        const createRequest = buildCreateTaskRequest(draft);
        const savedResponse = await httpClient(createRequest.url, {
          method: "POST",
          body: JSON.stringify(createRequest.body),
        });
        const savedTask = createRequest.recurring ? savedResponse.firstOccurrence : savedResponse;

        setCalendarTasks(current => [...current, savedTask]);
        setRefreshKey(current => current + 1);
      } else {
        const original = calendarTasks.find(task => task.id === editingTaskId);

        if (isOccurrence(original)) {
          //Recurring occurrence: PATCH /task-series/:seriesId/occurrences/:date with only the
          //fields that changed. dueDate (an occurrence can't be moved) and priority (computed
          //by the server) are never sent.
          const changes = getOccurrenceChanges(
            {
              ...draft,
              title: taskToSave.title,
              time: taskToSave.time,
              checklist: draft.checklist || [],
              reminderDate:
                draft.reminderDate instanceof Date
                  ? format(draft.reminderDate, "yyyy-MM-dd")
                  : draft.reminderDate,
            },
            original,
          );

          //Nothing changed: don't send an empty PATCH (it would materialize the occurrence)
          if (Object.keys(changes).length > 0) {
            const updatedTask = await httpClient(getTaskUrl(original), {
              method: "PATCH",
              body: JSON.stringify(changes),
            });

            setCalendarTasks(current =>
              current.map(task =>
                task.id === editingTaskId ? mergeSavedTask(task, updatedTask) : task,
              ),
            );
          }
        } else {
          await httpClient(getTaskUrl(original ?? { id: editingTaskId }), {
            method: "PATCH",
            body: JSON.stringify(taskToSave),
          });

          setCalendarTasks(current =>
            current.map(task =>
              task.id === editingTaskId
                ? {
                    ...task,
                    ...taskToSave,
                  }
                : task,
            ),
          );
        }
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
            <h2 className="text-3xl font-bold">{format(currentMonth, "MMMM yyyy")}</h2>

            <p className="mt-1 text-sm text-muted-foreground">View and edit your task deadlines.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              ←
            </Button>

            <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>

            <Button variant="outline" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
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
          {calendarDays.map(day => {
            const dateKey = format(day, "yyyy-MM-dd");

            //Sort tasks by time for each day
            const dayTasks = [...(tasksByDate[dateKey] || [])].sort((a, b) => {
              if (!a.time && !b.time) {
                return 0;
              }

              if (!a.time) {
                return 1;
              }

              if (!b.time) {
                return -1;
              }

              return a.time.localeCompare(b.time);
            });

            return (
              <div
                key={day.toISOString()}
                className={`min-h-36 border-b border-r p-2 ${
                  !isSameMonth(day, currentMonth) ? "bg-muted/40" : "bg-card"
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
                  {dayTasks.map(task => (
                    <button
                      key={task.id}
                      type="button"
                      onDoubleClick={event => {
                        event.stopPropagation();
                        openEditForm(task);
                      }}
                      className={`flex w-full items-center rounded-md bg-secondary px-2 py-1.5 text-left text-xs hover:bg-secondary/80 ${
                        task.status === "Completed" ? "opacity-60" : ""
                      }`}
                    >
                      {task.time && (
                        <span className="shrink-0 mr-1 text-muted-foreground">
                          {formatTaskTime(task.time)}
                        </span>
                      )}

                      <span
                        className={`truncate ${
                          task.status === "Completed"
                            ? "line-through text-muted-foreground"
                            : "font-medium text-secondary-foreground"
                        }`}
                        title={task.title}
                      >
                        {task.title}
                      </span>
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
        onOpenChange={open => {
          if (open) {
            setEditorOpen(true);
          } else {
            closeEditor();
          }
        }}
      >
        <DialogContent>
          <DialogTitle>{formMode === "create" ? "Add task" : "Edit task"}</DialogTitle>

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
            allowRecurrence={formMode === "create"}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}

export { CalendarPage };
