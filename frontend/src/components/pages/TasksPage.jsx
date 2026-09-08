import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const initialTasks = [
  {
    id: 1,
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

function TaskForm({ draft, setDraft, onSave, onCancel }) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="task-title">Task name</Label>
        <Input
          id="task-title"
          onChange={(event) =>
            setDraft({ ...draft, title: event.target.value })
          }
          required
          value={draft.title}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          onChange={(event) =>
            setDraft({ ...draft, description: event.target.value })
          }
          value={draft.description}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-subject">Subject</Label>
          <Input
            id="task-subject"
            onChange={(event) =>
              setDraft({ ...draft, subject: event.target.value })
            }
            required
            value={draft.subject}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-priority">Priority</Label>
          <Select
            onValueChange={(priority) => setDraft({ ...draft, priority })}
            value={draft.priority}
          >
            <SelectTrigger
              aria-label="Priority"
              id="task-priority"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit">Save task</Button>
      </div>
    </form>
  );
}

function TasksPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [editorOpen, setEditorOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    subject: "",
    priority: "Medium",
    status: "To Do",
  });
  const openEditor = () => {
    setDraft({
      title: "",
      description: "",
      subject: "",
      priority: "Medium",
      status: "To Do",
    });
    if (window.matchMedia("(max-width: 767px)").matches)
      setMobileEditorOpen(true);
    else setEditorOpen(true);
  };
  const saveTask = () => {
    setTasks((current) => [...current, { ...draft, id: Date.now() }]);
    setEditorOpen(false);
    setMobileEditorOpen(false);
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
          <DialogTitle>Add task</DialogTitle>
          <DialogDescription>
            Create a task for your study plan.
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
            <SheetTitle>Add task</SheetTitle>
            <SheetDescription>
              Create a task for your study plan.
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
                setTasks((current) =>
                  current.filter((task) => task.id !== deleteId),
                );
                setDeleteId(null);
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

function TaskRow({ task, onDelete, onToggle }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <Checkbox
        aria-label={`Mark ${task.title} complete`}
        checked={task.status === "Completed"}
        onCheckedChange={onToggle}
      />
      <div className="min-w-0 flex-1">
        <p
          className={
            task.status === "Completed"
              ? "font-medium line-through text-muted-foreground"
              : "font-medium"
          }
        >
          {task.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{task.subject}</p>
      </div>
      <Badge variant={task.priority === "High" ? "destructive" : "secondary"}>
        {task.priority}
      </Badge>
      <Badge variant="outline">{task.status}</Badge>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for ${task.title}`}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { TasksPage };
