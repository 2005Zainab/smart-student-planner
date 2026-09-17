import { httpClient } from "../../../shared/http-client";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ScheduleList } from "./ScheduleList";
import { TaskForm } from "../../tasks/components/TaskForm";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTasks } from "../../tasks/hooks/useTasks";

function SchedulePage() {
  const { tasks, setTasks, isLoading, error } = useTasks();
  const [editorOpen, setEditorOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [emptyTitleCheck, setEmptyTitleCheck] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    subject: "",
    priority: "Medium",
    status: "To Do",
    time: "",
  });

  const openEditor = (task = null, mode = task ? "edit" : "create") => {
    setFormMode(mode);
    setEmptyTitleCheck(null);
    setSaveError(null);

    if (mode === "create") {
      const newTask = {
        id: `temp-${Date.now()}`,
        title: "",
        description: "",
        subject: "",
        priority: "Medium",
        status: "To Do",
        dueDate: undefined,
        time: "",
      };

      setEditingTaskId(newTask.id);
      setTasks((current) => [...current, newTask]);
      setDraft(newTask);
    } else {
      setEditingTaskId(task?.id ?? null);
      setDraft(
        task
          ? {
              ...task,
              dueDate:
                typeof task.dueDate === "string"
                  ? parseISO(task.dueDate)
                  : task.dueDate,
            }
          : {
              title: "",
              description: "",
              subject: "",
              priority: "Medium",
              status: "To Do",
              dueDate: undefined,
              time: "",
            },
      );
    }
    if (window.matchMedia("(max-width: 767px)").matches)
      setMobileEditorOpen(true);
    else setEditorOpen(true);
  };

  const closeEditor = () => {
    if (formMode === "create" && editingTaskId !== null) {
      setTasks((current) =>
        current.filter((task) => task.id !== editingTaskId),
      );
    }

    setEditorOpen(false);
    setMobileEditorOpen(false);
    setFormMode("create");
    setEditingTaskId(null);
    setEmptyTitleCheck(null);
    setSaveError(null);
  };

  const saveTask = async () => {
    //Blank title check, can't be empty or blank space
    if (!draft.title || draft.title.trim() === "") {
      setEmptyTitleCheck("Title Cannot Be Empty");
      return;
    }

    setEmptyTitleCheck(null);
    setSaveError(null);

    //Add task (only local right now)
    if (formMode === "create") {
      const taskToSave = {
        title: draft.title,
        description: draft.description,
        subject: draft.subject,
        priority: draft.priority,
        status: draft.status,
        dueDate: draft.dueDate
          ? draft.dueDate instanceof Date
            ? format(draft.dueDate, "yyyy-MM-dd")
            : draft.dueDate
          : null,
        time: draft.time || null,
      };

      try {
        const savedTask = await httpClient("http://localhost:3000/api/tasks", {
          method: "POST",
          body: JSON.stringify(taskToSave),
        });

        setTasks((current) =>
          current.map((task) => (task.id === editingTaskId ? savedTask : task)),
        );

        toast.add({
          title: "Task Added",
          type: "success",
        });
      } catch (err) {
        console.log(err);
        setSaveError(err.message || "Failed to add task");

        toast.add({
          title: "Failed to add task",
          type: "error",
        });

        return;
      }
    } else {
      //edit task sends to backend to check and save to firestore via PATCH route

      // Convert the editor Date back to the API's local YYYY-MM-DD format.
      const correctTimeZone = {
        ...draft,
        dueDate: draft.dueDate
          ? draft.dueDate instanceof Date
            ? format(draft.dueDate, "yyyy-MM-dd")
            : draft.dueDate
          : undefined,
      };

      const original = tasks.find((task) => task.id === editingTaskId);
      const changes = Object.keys(correctTimeZone).reduce((acc, key) => {
        if (correctTimeZone[key] !== original?.[key]) {
          acc[key] = correctTimeZone[key];
        }
        return acc;
      }, {});

      if (Object.keys(changes).length === 0) {
        setEditorOpen(false);
        setMobileEditorOpen(false);
        setEditingTaskId(null);
        return;
      }

      try {
        await httpClient(`http://localhost:3000/api/tasks/${editingTaskId}`, {
          method: "PATCH",
          body: JSON.stringify(changes),
        });
        setTasks((current) =>
          current.map((task) =>
            task.id === editingTaskId ? { ...task, ...changes } : task,
          ),
        );
      } catch (err) {
        console.log(err);
        setSaveError(err.message || "Failed to save task");
        return;
      }
    }
    closeEditor();
  };

  //   const toggleTask = (id) =>
  //     setTasks((current) =>
  //       current.map((task) =>
  //         task.id === id
  //           ? {
  //               ...task,
  //               status: task.status === "Completed" ? "To Do" : "Completed",
  //             }
  //           : task,
  //       ),
  //     );

  const deleteTask = async (id) => {
    try {
      await httpClient(`http://localhost:3000/api/tasks/${id}`, {
        method: "DELETE",
      });
      setTasks((current) => current.filter((task) => task.id !== id));
      toast.add({
        title: "Task Deleted",
        type: "success",
      });
    } catch (err) {
      console.log(err);
    } finally {
      setDeleteId(null);
    }
  };

  const getTaskDateAndTime = (task) => {
    const dateValue = task.dueDate;

    if (!dateValue || !task.time) {
      return null;
    }

    const taskDate = parseISO(dateValue);
    const [hours, minutes] = task.time
      ? task.time.split(":").map(Number)
      : [0, 0];

    taskDate.setHours(hours, minutes);
    return taskDate;
  };

  const now = new Date();

  const upcomingTasks = tasks
    .map((task) => ({
      ...task,
      parsedDateTime: getTaskDateAndTime(task),
    }))
    .filter(
      (task) =>
        task.parsedDateTime !== null &&
        task.parsedDateTime >= now &&
        task.status &&
        task.status !== "Completed",
    )
    .sort((a, b) => a.parsedDateTime - b.parsedDateTime);

  const groupedTasks = upcomingTasks.reduce((acc, task) => {
    const dayLabel = task.parsedDateTime.toLocaleDateString("en-NZ", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    if (!acc[dayLabel]) {
      acc[dayLabel] = [];
    }
    acc[dayLabel].push(task);
    return acc;
  }, {});

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Schedule</h2>
          <p className="mt-1 text-muted-foreground">
            View your daily priorities.
          </p>
        </div>
        <Button onClick={() => openEditor()}>
          <Plus /> Add Event
        </Button>
      </div>

      <Card className="pt-0">
        <CardContent className="p-0">
          {/* Map through the grouped tasks and display them by day */}
          {Object.entries(groupedTasks).length > 0 ? (
            Object.entries(groupedTasks).map(([day, dayTasks]) => (
              <div
                key={day}
                className="border-b last:border-b-0 pb-4 mb-4 last:pb-0 last:mb-0"
              >
                <h3 className="bg-muted-foreground/31 px-4 py-2 text-sm font-medium text-secondary-foreground rounded-t-md">
                  {day}
                </h3>
                <ScheduleList
                  tasks={dayTasks}
                  isLoading={isLoading}
                  error={error}
                  onEdit={(task) => openEditor(task, "edit")}
                  onDelete={setDeleteId}
                  onView={(task) => openEditor(task, "view")}
                />
              </div>
            ))
          ) : (
            /* Fallback for when there are no valid tasks to display */
            <div className="p-8 text-center text-muted-foreground">
              {isLoading ? "Loading tasks..." : "No tasks scheduled."}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => (open ? setEditorOpen(true) : closeEditor())}
      >
        <DialogContent>
          <DialogTitle>
            {formMode === "view"
              ? "View task"
              : formMode === "create"
                ? "Add task"
                : "Edit task"}
          </DialogTitle>
          <DialogDescription>
            {formMode === "view"
              ? "Review the details for this task."
              : formMode === "create"
                ? "Create a task for your study plan."
                : "Update the details for this task."}
          </DialogDescription>
          <TaskForm
            draft={draft}
            onCancel={closeEditor}
            onSave={saveTask}
            readOnly={formMode === "view"}
            setDraft={setDraft}
            titleError={emptyTitleCheck}
            saveError={saveError}
            requireDateAndTime={true}
          />
        </DialogContent>
      </Dialog>

      <Sheet
        open={mobileEditorOpen}
        onOpenChange={(open) =>
          open ? setMobileEditorOpen(true) : closeEditor()
        }
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {formMode === "view"
                ? "View task"
                : formMode === "create"
                  ? "Add task"
                  : "Edit task"}
            </SheetTitle>
            <SheetDescription>
              {formMode === "view"
                ? "Review the details for this task."
                : formMode === "create"
                  ? "Create a task for your study plan."
                  : "Update the details for this task."}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <TaskForm
              draft={draft}
              onCancel={closeEditor}
              onSave={saveTask}
              readOnly={formMode === "view"}
              setDraft={setDraft}
              titleError={emptyTitleCheck}
              saveError={saveError}
              requireDateAndTime={true}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This task will be removed from your study plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteTask(deleteId);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

export { SchedulePage };
