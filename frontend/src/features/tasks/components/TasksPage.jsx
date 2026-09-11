import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TaskForm } from "./TaskForm";
import { TaskRow } from "./TaskRow";
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
    id: "1",
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
  const [deleteId, setDeleteId] = useState(null);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    subject: "",
    priority: "Medium",
    status: "To Do",
  });
  const openEditor = (task = null) => {
    setEditingTaskId(task?.id ?? null);
    setDraft(
      task ?? {
        title: "",
        description: "",
        subject: "",
        priority: "Medium",
        status: "To Do",
        dueDate: undefined,
      },
    );
    if (window.matchMedia("(max-width: 767px)").matches)
      setMobileEditorOpen(true);
    else setEditorOpen(true);
  };
  const saveTask = () => {
    setTasks((current) =>
      editingTaskId === null
        ? [...current, { ...draft, id: Date.now() }]
        : current.map((task) =>
          task.id === editingTaskId ? { ...draft, id: editingTaskId } : task,
        ),
    );
    setEditorOpen(false);
    setMobileEditorOpen(false);
    setEditingTaskId(null);
  };
  const toggleTask = (id) =>
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
            ...task,
            status: task.status === "Completed" ? "To Do" : "Completed",
          }
          : task,
      ),
    );

  //Deletes tasks from Firestore using Express API route then updates local UI
  const deleteTask = async (id) => {
    try {
      const response = await fetch(`http://localhost:3000/api/tasks/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Task Failed to Delete");
      }
      setTasks((current) => current.filter((task) => task.id !== id));
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
          <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
          <p className="mt-1 text-muted-foreground">
            Keep your coursework moving forward.
          </p>
        </div>
        <Button onClick={openEditor}>
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
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogTitle>
            {editingTaskId === null ? "Add task" : "Edit task"}
          </DialogTitle>
          <DialogDescription>
            {editingTaskId === null
              ? "Create a task for your study plan."
              : "Update the details for this task."}
          </DialogDescription>
          <TaskForm
            draft={draft}
            onCancel={() => setEditorOpen(false)}
            onSave={saveTask}
            setDraft={setDraft}
          />
        </DialogContent>
      </Dialog>
      <Sheet open={mobileEditorOpen} onOpenChange={setMobileEditorOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingTaskId === null ? "Add task" : "Edit task"}
            </SheetTitle>
            <SheetDescription>
              {editingTaskId === null
                ? "Create a task for your study plan."
                : "Update the details for this task."}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <TaskForm
              draft={draft}
              onCancel={() => setMobileEditorOpen(false)}
              onSave={saveTask}
              setDraft={setDraft}
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

export { TasksPage };
