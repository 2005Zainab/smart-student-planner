import { useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { useSearchParams } from "react-router";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
import { useTasksContext } from "../context/TasksContext";
import { httpClient } from "../../../shared/http-client";
import { buildCreateTaskRequest } from "../utils/build-create-task-request";
import { useTaskUpdates } from "../hooks/useTaskUpdates";
import { useTaskDeletion } from "../hooks/useTaskDeletion";
import { createTempId } from "../utils/temp-id";
import { getSeriesUrl, isOccurrence } from "../utils/task-endpoints";
import { ScopeDialog } from "./ScopeDialog";
import { needsScopeChoice, toNullableDateString } from "../utils/occurrence-scope";

const isoWeekday = date => (date.getDay() === 0 ? 7 : date.getDay());

function TasksPage() {
  const { tasks, setTasks, isLoading, error, refetch } = useTasksContext();

  const { patchTask, saveScopedEdit, setSeriesEnabled, updateFiles } = useTaskUpdates(setTasks);

  // Keep the sidebar search feature from main
  const [searchParams, setSearchParams] = useSearchParams();
  const [handledViewId, setHandledViewId] = useState(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [emptyTitleCheck, setEmptyTitleCheck] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [previousStatusLookup, setPreviousStatusLookup] = useState({});

  const seriesChangedRef = useRef(false);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);

  // Keep the task deletion hook from main
  const { deleteTask, deleteSeries } = useTaskDeletion(setTasks, refetch);

  // Information entered in the task form
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    subject: "",
    label: "",
    priority: "Low",
    timerMinutes: null,
    status: "To Do",
    dueDate: undefined,
    time: "",
    reminderDate: undefined,
    reminderTime: "",
    recurrence: null,
    links: [],
  });

  // Open the form to create, edit, or view a task
  const openEditor = (task = null, mode = task ? "edit" : "create") => {
    setFormMode(mode);
    setEmptyTitleCheck(null);
    setSaveError(null);

    if (mode === "create") {
      const newTask = {
        id: createTempId(),
        title: "",
        description: "",
        subject: "",
        label: "",
        priority: "Low",
        timerMinutes: null,
        status: "To Do",
        dueDate: undefined,
        time: "",
        reminderDate: undefined,
        reminderTime: "",
        recurrence: null,
        links: [],
      };

      setEditingTaskId(newTask.id);
      setTasks(current => [...current, newTask]);
      setDraft(newTask);
    } else {
      setEditingTaskId(task?.id ?? null);

      setDraft(
        task
          ? {
              ...task,
              label: task.label ?? "",
              timerMinutes: task.timerMinutes ?? null,
              dueDate: typeof task.dueDate === "string" ? parseISO(task.dueDate) : task.dueDate,
              time: task.time || "",
              reminderDate:
                typeof task.reminderDate === "string"
                  ? parseISO(task.reminderDate)
                  : task.reminderDate,
              recurrence: task.recurrence ?? null,
              repeatEnabled: task.series?.enabled,
              ...(task.series?.rule
                ? {
                    seriesPattern: {
                      rule: task.series.rule,
                      endDate: task.series.endDate ? parseISO(task.series.endDate) : null,
                      defaultWeekday: isoWeekday(parseISO(task.occurrenceDate)),
                    },
                  }
                : {}),
            }
          : {
              title: "",
              description: "",
              subject: "",
              label: "",
              priority: "Low",
              timerMinutes: null,
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

  // Close the task form
  const closeEditor = () => {
    const shouldRefetch = seriesChangedRef.current;
    seriesChangedRef.current = false;

    if (formMode === "create" && editingTaskId !== null) {
      setTasks(current => current.filter(task => task.id !== editingTaskId));
    }

    setEditorOpen(false);
    setMobileEditorOpen(false);
    setEditingTaskId(null);
    setEmptyTitleCheck(null);
    setSaveError(null);

    // Remove ?view= when the task dialog closes
    if (searchParams.has("view")) {
      setSearchParams(
        previous => {
          const next = new URLSearchParams(previous);
          next.delete("view");
          return next;
        },
        { replace: true },
      );
    }

    if (shouldRefetch) {
      refetch();
    }
  };

  // Open a task from the sidebar search results
  const viewId = searchParams.get("view");

  if (viewId !== handledViewId && (!viewId || !isLoading)) {
    setHandledViewId(viewId);

    const taskToView = viewId ? tasks.find(task => task.id === viewId) : undefined;

    if (taskToView) {
      openEditor(taskToView, "view");
    }
  }

  // Compare repeat rules even if weekdays have a different order
  const canonicalRule = rule =>
    JSON.stringify(
      Object.keys(rule)
        .sort()
        .map(key => [key, key === "weekdays" ? [...rule[key]].sort((a, b) => a - b) : rule[key]]),
    );

  // Find changes to the recurring task's repeat pattern
  function getPatternChanges(draft, original) {
    const pattern = draft.seriesPattern;
    const stored = original.series;

    if (draft.repeatEnabled !== true || !pattern || !stored?.rule) {
      return {};
    }

    const changes = {};

    if (canonicalRule(pattern.rule) !== canonicalRule(stored.rule)) {
      changes.rule = pattern.rule;
    }

    const endDate = toNullableDateString(pattern.endDate);

    if (endDate !== (stored.endDate ?? null)) {
      changes.endDate = endDate;
    }

    return changes;
  }

  // Save a new task or edit an existing task
  const saveTask = async (scope = null) => {
    if (!draft.title || draft.title.trim() === "") {
      setEmptyTitleCheck("Title Cannot Be Empty");
      return;
    }

    setEmptyTitleCheck(null);
    setSaveError(null);

    if (formMode === "create") {
      const createRequest = buildCreateTaskRequest(draft);

      if (!createRequest.recurring) {
        createRequest.body.label = draft.label || "";
      }

      try {
        const savedResponse = await httpClient(createRequest.url, {
          method: "POST",
          body: JSON.stringify(createRequest.body),
        });

        const savedTask = createRequest.recurring ? savedResponse.firstOccurrence : savedResponse;

        const taskToInsert = createRequest.recurring
          ? {
              ...savedTask,
              seriesPattern: {
                rule: savedResponse.series?.rule ?? createRequest.body.rule,
                endDate: savedResponse.series?.endDate
                  ? parseISO(savedResponse.series.endDate)
                  : createRequest.body.endDate
                    ? parseISO(createRequest.body.endDate)
                    : null,
                defaultWeekday:
                  savedTask.dueDate instanceof Date
                    ? isoWeekday(savedTask.dueDate)
                    : savedTask.dueDate
                      ? isoWeekday(parseISO(savedTask.dueDate))
                      : undefined,
              },
              repeatEnabled: savedResponse.series?.enabled ?? true,
            }
          : savedTask;

        setTasks(current => current.map(task => (task.id === editingTaskId ? taskToInsert : task)));

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
      const original = tasks.find(task => task.id === editingTaskId) ?? {
        id: editingTaskId,
      };

      if (scope === null && needsScopeChoice(original, draft)) {
        setScopeDialogOpen(true);
        return;
      }

      const savedParts = [];

      try {
        // 1. Content: this occurrence only, or the series template ("future")
        const didSave = await saveScopedEdit(
          original,
          { ...draft, label: draft.label ?? "" },
          scope,
        );
        if (didSave && scope === "future") seriesChangedRef.current = true;
        if (didSave) savedParts.push("content changes");

        if (didSave && scope === "future") {
          seriesChangedRef.current = true;
        }

        if (didSave) {
          savedParts.push("content changes");
        }

        // Update the repeat pattern if needed
        if (isOccurrence(original)) {
          const patternChanges = getPatternChanges(draft, original);

          if (Object.keys(patternChanges).length > 0) {
            const savedSeries = await httpClient(getSeriesUrl(original.seriesId), {
              method: "PATCH",
              body: JSON.stringify(patternChanges),
            });

            seriesChangedRef.current = true;
            savedParts.push("repeat pattern");

            const openRule = savedSeries?.segments?.find(segment => segment.until === null)?.rule;

            setTasks(current =>
              current.map(task =>
                task.seriesId === original.seriesId
                  ? {
                      ...task,
                      series: {
                        ...task.series,
                        rule: openRule ?? task.series?.rule,
                        endDate: savedSeries?.endDate ?? null,
                      },
                    }
                  : task,
              ),
            );

            toast.add({
              title: "Repeat pattern updated",
              description: "Applies from today",
              type: "success",
            });
          }
        }

        // Pause or resume recurring tasks
        if (
          isOccurrence(original) &&
          typeof draft.repeatEnabled === "boolean" &&
          draft.repeatEnabled !== original.series?.enabled
        ) {
          seriesChangedRef.current = true;

          const saved = await setSeriesEnabled(original.seriesId, draft.repeatEnabled);

          const openPause = saved?.pauses?.find(pause => pause.until === null);

          const pausedFrom =
            !draft.repeatEnabled && openPause?.from
              ? format(parseISO(openPause.from), "d MMM")
              : null;

          toast.add({
            title: draft.repeatEnabled ? "Repeat resumed" : "Repeat paused",
            ...(pausedFrom
              ? {
                  description: `From ${pausedFrom}`,
                }
              : {}),
            type: "success",
          });
        }
      } catch (err) {
        console.log(err);

        // Show what was already saved if another step failed
        const savedNote =
          savedParts.length > 0 ? `Already saved: ${savedParts.join(" and ")}.` : "";

        setSaveError([err.message || "Failed to save task", savedNote].filter(Boolean).join("\n"));

        return;
      }
    }

    closeEditor();
  };

  const editingTask = tasks.find(task => task.id === editingTaskId);

  // Update task status when the checkbox is clicked
  const toggleTask = async id => {
    const task = tasks.find(existingTask => existingTask.id === id);

    if (!task) return;

    const originalStatus = task.status;

    const newStatus =
      originalStatus === "Completed" ? (previousStatusLookup[id] ?? "To Do") : "Completed";

    if (newStatus === "Completed") {
      setPreviousStatusLookup(current => ({
        ...current,
        [id]: originalStatus,
      }));
    }

    const patchBody =
      newStatus === "Completed"
        ? {
            status: newStatus,
            reminderDate: null,
            reminderTime: null,
          }
        : {
            status: newStatus,
          };

    try {
      await patchTask(task, patchBody);

      if (newStatus === "Completed") {
        const toastId = toast.add({
          title: "Task Completed",
          description: task.title,
          type: "success",
          timeout: 10000,
          actionProps: {
            children: "Undo",
            onClick: () => {
              undoCompleted(id, previousStatusLookup[id] ?? originalStatus);
              toast.close(toastId);
            },
          },
        });
      }
    } catch (err) {
      console.log(err);
    }
  };

  // Restore the previous task status
  const undoCompleted = async (id, originalStatus) => {
    const task = tasks.find(existingTask => existingTask.id === id);

    if (!task) {
      return;
    }

    try {
      await patchTask(task, {
        status: originalStatus,
      });
    } catch (err) {
      console.log(err);
    }
  };

  // Mark a checklist item complete or incomplete
  const toggleChecklistItem = async (taskId, itemId) => {
    const task = tasks.find(existingTask => existingTask.id === taskId);

    if (!task || !task.checklist) {
      return;
    }

    const updateChecklist = task.checklist.map(item =>
      item.id === itemId
        ? {
            ...item,
            completed: !item.completed,
          }
        : item,
    );

    try {
      const saved = await patchTask(task, {
        checklist: updateChecklist,
      });

      setDraft(prev => ({
        ...prev,
        checklist: saved?.checklist ?? updateChecklist,
      }));
    } catch (err) {
      console.log(err);
    }
  };

  // Find the task that the user wants to delete
  const deletingTask = tasks.find(task => task.id === deleteId);

  const deletingOccurrence = isOccurrence(deletingTask);

  // Delete one task or an entire recurring series
  const confirmDelete = async scope => {
    const task = deletingTask;

    setDeleteId(null);

    try {
      if (task) {
        if (scope === "series") {
          await deleteSeries(task);
        } else {
          await deleteTask(task);
        }
      }
    } catch (err) {
      console.log(err);

      toast.add({
        title: "Failed to delete task",
        type: "error",
      });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
          <p className="mt-1 text-muted-foreground">Keep your coursework moving forward.</p>
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
            onEdit={task => openEditor(task, "edit")}
            onDelete={setDeleteId}
            onToggle={toggleTask}
            onView={task => openEditor(task, "view")}
          />
        </CardContent>
      </Card>

      {/* Task form for desktop */}
      <Dialog open={editorOpen} onOpenChange={open => (open ? setEditorOpen(true) : closeEditor())}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <DialogTitle>
            {formMode === "view" ? "View task" : formMode === "create" ? "Add task" : "Edit task"}
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
            onToggleChecklistItem={itemId => toggleChecklistItem(editingTaskId, itemId)}
            allowRecurrence={formMode === "create"}
            allowSeriesControls={true}
            seriesEnabled={editingTask?.series?.enabled}
            onFilesChange={updateFiles}
          />
        </DialogContent>
      </Dialog>

      {/* Task form for mobile */}
      <Sheet
        open={mobileEditorOpen}
        onOpenChange={open => (open ? setMobileEditorOpen(true) : closeEditor())}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {formMode === "view" ? "View task" : formMode === "create" ? "Add task" : "Edit task"}
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
              onToggleChecklistItem={itemId => toggleChecklistItem(editingTaskId, itemId)}
              allowRecurrence={formMode === "create"}
              allowSeriesControls={true}
              seriesEnabled={editingTask?.series?.enabled}
              onFilesChange={updateFiles}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Choose which recurring tasks to update */}
      <ScopeDialog
        open={scopeDialogOpen}
        onOpenChange={open => setScopeDialogOpen(open)}
        onChoose={scope => {
          setScopeDialogOpen(false);
          saveTask(scope);
        }}
      />

      {/* Delete dialog for one-off tasks */}
      <AlertDialog
        open={deleteId !== null && !deletingOccurrence}
        onOpenChange={open => !open && setDeleteId(null)}
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

            <AlertDialogAction onClick={() => confirmDelete("occurrence")}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog for recurring tasks */}
      <ScopeDialog
        open={deleteId !== null && deletingOccurrence}
        onOpenChange={open => !open && setDeleteId(null)}
        onChoose={confirmDelete}
        title="Delete recurring task"
        description="Delete just this occurrence, or the whole series. Deleting the series also removes its completed occurrences."
        occurrenceLabel="Delete this occurrence"
        seriesLabel="Delete all occurrences"
        seriesScope="series"
        destructive
      />
    </main>
  );
}

export { TasksPage };
