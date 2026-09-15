import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TaskForm } from "./TaskForm";
import { TaskRow } from "./TaskRow";
import { httpClient } from "../../../shared/http-client";
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

const initialTasks = [
  {
    id: "JS3GV0ZXQvoilDUtpyjk",
    title: "Complete research outline",
    description: "Draft the thesis and supporting points.",
    subject: "History",
    priority: "High",
    status: "To Do",
  },
  {
    id: 2,
    title: "Review calculus exercises",
    description: "Work through the assigned problem set.",
    subject: "Mathematics",
    priority: "Medium",
    status: "In Progress",
  },
  {
    id: 3,
    title: "Read chapter 6",
    description: "Take notes on the key concepts.",
    subject: "Biology",
    priority: "Low",
    status: "Completed",
  },
];

function TasksPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [editorOpen, setEditorOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [emptyTitleCheck, setEmptyTitleCheck] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const [draft, setDraft] = useState({
    title: "",
    description: "",
    subject: "",
    priority: "Medium",
    status: "To Do",
    dueDate: undefined,
  });

  const openEditor = (task = null) => {
    setEmptyTitleCheck(null);
    setSaveError(null);

    if (task) {
      setCreatingTask(false);
      setEditingTaskId(task.id);
      setDraft(task);
    } else {
      const newTask = {
        id: Date.now(),
        title: "",
        description: "",
        subject: "",
        priority: "Medium",
        status: "To Do",
        dueDate: undefined,
      };

      setTasks((current) => [...current, newTask]);
      setCreatingTask(true);
      setEditingTaskId(newTask.id);
      setDraft(newTask);
    }

    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileEditorOpen(true);
    } else {
      setEditorOpen(true);
    }
  };

  const saveTask = async () => {
    //Blank title check, can't be empty or blank space
    if (!draft.title || draft.title.trim() === "") {
      setEmptyTitleCheck("Title Cannot Be Empty");
      return;
    }

    setEmptyTitleCheck(null);
    setSaveError(null);

    const taskToSave = {
      title: draft.title,
      description: draft.description,
      subject: draft.subject,
      priority: draft.priority,
      status: draft.status,
      dueDate: draft.dueDate
        ? draft.dueDate.toLocaleDateString("en-CA")
        : null,
    };

    if (creatingTask) {
      try {
        const savedTask = await httpClient(
          "http://localhost:3000/api/tasks",
          {
            method: "POST",
            body: JSON.stringify(taskToSave),
          },
        );

        const taskForScreen = {
          ...savedTask,
          dueDate: savedTask.dueDate
            ? new Date(savedTask.dueDate + "T00:00:00")
            : undefined,
        };

        setTasks((current) =>
          current.map((task) =>
            task.id === editingTaskId ? taskForScreen : task,
          ),
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
      const original = tasks.find(
        (task) => task.id === editingTaskId,
      );

      const changes = {};

      if (taskToSave.title !== original?.title) {
        changes.title = taskToSave.title;
      }

      if (taskToSave.description !== original?.description) {
        changes.description = taskToSave.description;
      }

      if (taskToSave.subject !== original?.subject) {
        changes.subject = taskToSave.subject;
      }

      if (taskToSave.priority !== original?.priority) {
        changes.priority = taskToSave.priority;
      }

      if (taskToSave.status !== original?.status) {
        changes.status = taskToSave.status;
      }

      const originalDueDate =
        original?.dueDate instanceof Date
          ? original.dueDate.toLocaleDateString("en-CA")
          : original?.dueDate ?? null;

      if (taskToSave.dueDate !== originalDueDate) {
        changes.dueDate = taskToSave.dueDate;
      }

      if (Object.keys(changes).length > 0) {
        try {
          await httpClient(
            `http://localhost:3000/api/tasks/${editingTaskId}`,
            {
              method: "PATCH",
              body: JSON.stringify(changes),
            },
          );

          setTasks((current) =>
            current.map((task) =>
              task.id === editingTaskId
                ? {
                    ...task,
                    ...changes,
                    dueDate:
                      changes.dueDate !== undefined
                        ? changes.dueDate
                          ? new Date(
                              changes.dueDate + "T00:00:00",
                            )
                          : undefined
                        : task.dueDate,
                  }
                : task,
            ),
          );
        } catch (err) {
          console.log(err);
          setSaveError(err.message || "Failed to save task");
          return;
        }
      }
    }

    setEditorOpen(false);
    setMobileEditorOpen(false);
    setEditingTaskId(null);
    setCreatingTask(false);
  };

  const cancelEditor = () => {
    if (creatingTask) {
      setTasks((current) =>
        current.filter(
          (task) => task.id !== editingTaskId,
        ),
      );
    }

    setEditorOpen(false);
    setMobileEditorOpen(false);
    setEditingTaskId(null);
    setCreatingTask(false);
    setEmptyTitleCheck(null);
    setSaveError(null);
  };

  const toggleTask = (id) =>
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              status:
                task.status === "Completed"
                  ? "To Do"
                  : "Completed",
            }
          : task,
      ),
    );

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
          <Plus /> Add task
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden divide-y md:block">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onEdit={() => openEditor(task)}
                onDelete={() => setDeleteId(task.id)}
                onToggle={() => toggleTask(task.id)}
              />
            ))}
          </div>

          <div className="divide-y md:hidden">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onEdit={() => openEditor(task)}
                onDelete={() => setDeleteId(task.id)}
                onToggle={() => toggleTask(task.id)}
              />
            ))}
          </div>

          {tasks.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No tasks yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) {
            cancelEditor();
          } else {
            setEditorOpen(true);
          }
        }}
      >
        <DialogContent>
          <DialogTitle>
            {creatingTask ? "Add task" : "Edit task"}
          </DialogTitle>

          <DialogDescription>
            {creatingTask
              ? "Create a task for your study plan."
              : "Update the details for this task."}
          </DialogDescription>

          <TaskForm
            draft={draft}
            onCancel={cancelEditor}
            onSave={saveTask}
            setDraft={setDraft}
            titleError={emptyTitleCheck}
            saveError={saveError}
          />
        </DialogContent>
      </Dialog>

      <Sheet
        open={mobileEditorOpen}
        onOpenChange={(open) => {
          if (!open) {
            cancelEditor();
          } else {
            setMobileEditorOpen(true);
          }
        }}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {creatingTask ? "Add task" : "Edit task"}
            </SheetTitle>

            <SheetDescription>
              {creatingTask
                ? "Create a task for your study plan."
                : "Update the details for this task."}
            </SheetDescription>
          </SheetHeader>

          <div className="p-4">
            <TaskForm
              draft={draft}
              onCancel={cancelEditor}
              onSave={saveTask}
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
              This task will be removed from your study plan.
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