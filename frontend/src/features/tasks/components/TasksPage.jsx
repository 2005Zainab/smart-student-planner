import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

import { TaskForm } from "./TaskForm";
import { TaskList } from "./TaskList";
//import { useTasks } from "../hooks/useTasks";
import { useTasksContext } from "../context/TasksContext";
import { httpClient } from "../../../shared/http-client";

function TasksPage() {
  //const { tasks, setTasks, isLoading, error } = useTasks();
  const { tasks, setTasks, isLoading, error } = useTasksContext();

  const [editorOpen, setEditorOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [emptyTitleCheck, setEmptyTitleCheck] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [previousStatusLookup, setPreviousStatusLookup] = useState({});

  const [draft, setDraft] = useState({
    title: "",
    description: "",
    subject: "",
    priority: "Low",
    status: "To Do",
    dueDate: undefined,
    time: "",
    reminderDate: undefined,
    reminderTime: "",
  });

  //Open the task form
  const openEditor = (
    task = null,
    mode = task ? "edit" : "create",
  ) => {
    setFormMode(mode);
    setEmptyTitleCheck(null);
    setSaveError(null);

    if (mode === "create") {
      const newTask = {
        id: `temp-${Date.now()}`,
        title: "",
        description: "",
        subject: "",
        priority: "Low",
        status: "To Do",
        dueDate: undefined,
        time: "",
        reminderDate: undefined,
        reminderTime: "",
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
              reminderDate:
                  typeof task.reminderDate === "string"
                      ? parseISO(task.reminderDate)
                      : task.reminderDate,
            }
          : {
              title: "",
              description: "",
              subject: "",
              priority: "Low",
              status: "To Do",
              dueDate: undefined,
              time: "",
              reminderDate: undefined,
              reminderTime: "",
            },
      );
    }

    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileEditorOpen(true);
    } else {
      setEditorOpen(true);
    }
  };

  //Close the task form
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

  //Save a new task or edit an existing task
  const saveTask = async () => {
    //Check title is not empty
    if (!draft.title || draft.title.trim() === "") {
      setEmptyTitleCheck("Title Cannot Be Empty");
      return;
    }

    setEmptyTitleCheck(null);
    setSaveError(null);

    if (formMode === "create") {
      const taskToSave = {
        title: draft.title,
        description: draft.description,
        subject: draft.subject,
        status: draft.status,
        dueDate: draft.dueDate
          ? draft.dueDate instanceof Date
            ? format(draft.dueDate, "yyyy-MM-dd")
            : draft.dueDate
          : null,
          time: draft.time || null,

          reminderDate: draft.reminderDate
              ? draft.reminderDate instanceof Date
                  ? format(draft.reminderDate, "yyyy-MM-dd")
                  : draft.reminderDate
              : null,
          reminderTime: draft.reminderTime || null,
      };

      try {
        const savedTask = await httpClient(
          "http://localhost:3000/api/tasks",
          {
            method: "POST",
            body: JSON.stringify(taskToSave),
          },
        );

        setTasks((current) =>
          current.map((task) =>
            task.id === editingTaskId
              ? savedTask
              : task,
          ),
        );

        toast.add({
          title: "Task Added",
          type: "success",
        });
      } catch (err) {
        console.log(err);

        setSaveError(
          err.message || "Failed to add task",
        );

        toast.add({
          title: "Failed to add task",
          type: "error",
        });

        return;
      }
    } else {
      //Change the date back to YYYY-MM-DD before saving
      const taskToEdit = {
        ...draft,

        dueDate: draft.dueDate
          ? draft.dueDate instanceof Date
            ? format(draft.dueDate, "yyyy-MM-dd")
            : draft.dueDate
              : undefined,

          reminderDate: draft.reminderDate
              ? draft.reminderDate instanceof Date
                  ? format(draft.reminderDate, "yyyy-MM-dd")
                  : draft.reminderDate
              : undefined,
      };

      const original = tasks.find(
        (task) => task.id === editingTaskId,
      );

      //Only send fields that were changed
      const changes = Object.keys(taskToEdit).reduce(
        (updatedFields, key) => {
          if (taskToEdit[key] !== original?.[key]) {
            updatedFields[key] = taskToEdit[key];
          }

          return updatedFields;
        },
        {},
      );

      if (Object.keys(changes).length === 0) {
        setEditorOpen(false);
        setMobileEditorOpen(false);
        setEditingTaskId(null);
        return;
      }

      try {
        //Backend returns the updated task with new priority
        const updatedTask = await httpClient(
          `http://localhost:3000/api/tasks/${editingTaskId}`,
          {
            method: "PATCH",
            body: JSON.stringify(changes),
          },
        );

        setTasks((current) =>
          current.map((task) =>
            task.id === editingTaskId
              ? updatedTask
              : task,
          ),
        );
      } catch (err) {
        console.log(err);

        setSaveError(
          err.message || "Failed to save task",
        );

        return;
      }
    }

    closeEditor();
  };

  //Save task status when checkbox is clicked
  const toggleTask = async (id) => {
    const task = tasks.find(
      (existingTask) => existingTask.id === id,
    );

    const originalStatus = task.status;

    const newStatus =
      originalStatus === "Completed"
        ? (previousStatusLookup[id] ?? "To Do")
        : "Completed";

    if (newStatus === "Completed") {
      setPreviousStatusLookup((current) => ({
        ...current,
        [id]: originalStatus,
      }));
    }
    // If the task is being marked as completed, clear the reminder date and time
        const patchBody =
      newStatus === "Completed"
        ? { status: newStatus, reminderDate: null, reminderTime: null }
        : { status: newStatus };
    // Update the task status in the backend and update the local state
    try {
      await httpClient(
        `http://localhost:3000/api/tasks/${id}`,
        {
        method: "PATCH",
        body: JSON.stringify(patchBody),
      });
      setTasks((current) =>
        current.map((existingTask) =>
          existingTask.id === id
            ? { ...existingTask, ...patchBody }
            : existingTask,
        ),
      );

      //Show undo option when task is completed
      if (newStatus === "Completed") {
        const toastId = toast.add({
          title: "Task Completed",
          description: task.title,
          type: "success",
          timeout: 10000,

          actionProps: {
            children: "Undo",

            onClick: () => {
              undoCompleted(
                id,
                previousStatusLookup[id] ??
                  originalStatus,
              );

              toast.close(toastId);
            },
          },
        });
      }
    } catch (err) {
      console.log(err);
    }
  };

  //Change completed task back to previous status
  const undoCompleted = async (
    id,
    originalStatus,
  ) => {
    try {
      await httpClient(
        `http://localhost:3000/api/tasks/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: originalStatus,
          }),
        },
      );

      setTasks((current) =>
        current.map((existingTask) =>
          existingTask.id === id
            ? {
                ...existingTask,
                status: originalStatus,
              }
            : existingTask,
        ),
      );
    } catch (err) {
      console.log(err);
    }
  };

  //Deletes tasks from Firestore using Express API route then updates local UI
  const deleteTask = async (id) => {
    try {
      await httpClient(
        `http://localhost:3000/api/tasks/${id}`,
        {
          method: "DELETE",
        },
      );

      setTasks((current) =>
        current.filter((task) => task.id !== id),
      );

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

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Tasks
          </h2>

          <p className="mt-1 text-muted-foreground">
            Keep your coursework moving forward.
          </p>
        </div>

        <Button onClick={() => openEditor()}>
          <Plus />
          Add task
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TaskList
            tasks={tasks}
            isLoading={isLoading}
            error={error}
            onEdit={(task) =>
              openEditor(task, "edit")
            }
            onDelete={setDeleteId}
            onToggle={toggleTask}
            onView={(task) =>
              openEditor(task, "view")
            }
          />
        </CardContent>
      </Card>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) =>
          open
            ? setEditorOpen(true)
            : closeEditor()
        }
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
          />
        </DialogContent>
      </Dialog>

      <Sheet
        open={mobileEditorOpen}
        onOpenChange={(open) =>
          open
            ? setMobileEditorOpen(true)
            : closeEditor()
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
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) =>
          !open && setDeleteId(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete task?
            </AlertDialogTitle>

            <AlertDialogDescription>
              This task will be removed from your
              study plan.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>

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

export { TasksPage };