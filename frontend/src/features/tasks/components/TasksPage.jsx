import { useRef, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
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
//import { useTasks } from '../hooks/useTasks';
import { useTasksContext } from "../context/TasksContext";
import { httpClient } from "../../../shared/http-client";
import { buildCreateTaskRequest } from "../utils/build-create-task-request";
import { useTaskUpdates } from "../hooks/useTaskUpdates";
import { getOccurrenceChanges, getSeriesUrl, isOccurrence } from "../utils/task-endpoints";
import { createTempId } from "../utils/temp-id";

function TasksPage() {
  //const { tasks, setTasks, isLoading, error } = useTasks();
  const { tasks, setTasks, isLoading, error, refetch } = useTasksContext();
  const { patchTask, saveEdit, setSeriesEnabled } = useTaskUpdates(setTasks);
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
    recurrence: null,
  });

  //Open the task form
  const openEditor = (task = null, mode = task ? "edit" : "create") => {
    setFormMode(mode);
    setEmptyTitleCheck(null);
    setSaveError(null);

    if (mode === "create") {
      const newTask = {
        id: createTempId(), // Use the createTempId function to generate a temporary ID. Lint errors occurred when using Date.now()
        title: "",
        description: "",
        subject: "",
        priority: "Low",
        status: "To Do",
        dueDate: undefined,
        time: "",
        reminderDate: undefined,
        reminderTime: "",
        recurrence: null,
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

    if (shouldRefetch) {
      refetch();
    }
  };

  const OCCURRENCE_CONTENT_FIELDS = new Set([
    "title",
    "description",
    "subject",
    "time",
    "checklist",
    "reminderDate",
    "reminderTime",
  ]);

  const toDateString = value =>
    value ? (value instanceof Date ? format(value, "yyyy-MM-dd") : value) : null;

  function getOccurrenceDraftChanges(draft, original) {
    return getOccurrenceChanges(
      {
        ...draft,
        reminderDate: toDateString(draft.reminderDate),
        time: draft.time || null,
        reminderTime: draft.reminderTime || null,
        checklist: draft.checklist || [],
      },
      original,
    );
  }

  function getTemplateChanges(changes, draft, original) {
    const templateChanges = {};

    for (const field of ["title", "description", "subject", "time", "checklist"]) {
      if (Object.hasOwn(changes, field)) {
        templateChanges[field] = field === "time" ? changes[field] || null : changes[field];
      }
    }

    // The series API requires both reminder fields whenever either is changed.
    if (Object.hasOwn(changes, "reminderDate") || Object.hasOwn(changes, "reminderTime")) {
      const reminderDate = toDateString(draft.reminderDate);
      const occurrenceDate = original.occurrenceDate;

      templateChanges.reminderOffsetDays = reminderDate
        ? differenceInCalendarDays(parseISO(occurrenceDate), parseISO(reminderDate))
        : null;

      templateChanges.reminderTime = reminderDate ? draft.reminderTime || null : null;
    }

    return templateChanges;
  }

  const isoWeekday = date => (date.getDay() === 0 ? 7 : date.getDay());

  // Order-insensitive, mirroring the server, so [3, 1] vs a stored [1, 3] isn't a change.
  const canonicalRule = rule =>
    JSON.stringify(
      Object.keys(rule)
        .sort()
        .map(key => [key, key === "weekdays" ? [...rule[key]].sort((a, b) => a - b) : rule[key]]),
    );

  // Pattern is only editable while Repeat is ticked, so edits made before unticking are ignored.
  function getPatternChanges(draft, original) {
    const pattern = draft.seriesPattern;
    const stored = original.series;
    if (draft.repeatEnabled !== true || !pattern || !stored?.rule) return {};

    const changes = {};
    if (canonicalRule(pattern.rule) !== canonicalRule(stored.rule)) changes.rule = pattern.rule;

    const endDate = toDateString(pattern.endDate);
    if (endDate !== (stored.endDate ?? null)) changes.endDate = endDate;

    return changes;
  }

  //Save a new task or edit an existing task
  const saveTask = async (scope = null) => {
    //Check title is not empty
    if (!draft.title || draft.title.trim() === "") {
      setEmptyTitleCheck("Title Cannot Be Empty");
      return;
    }

    setEmptyTitleCheck(null);
    setSaveError(null);

    if (formMode === "create") {
      const createRequest = buildCreateTaskRequest(draft);

      try {
        const savedResponse = await httpClient(createRequest.url, {
          method: "POST",
          body: JSON.stringify(createRequest.body),
        });
        const savedTask = createRequest.recurring ? savedResponse.firstOccurrence : savedResponse;

        setTasks(current => current.map(task => (task.id === editingTaskId ? savedTask : task)));

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

      if (isOccurrence(original) && scope === null) {
        const changes = getOccurrenceDraftChanges(draft, original);
        const changedFields = Object.keys(changes);

        const contentOnly =
          changedFields.length > 0 &&
          changedFields.every(field => OCCURRENCE_CONTENT_FIELDS.has(field));

        const recurrenceToggleChanged =
          typeof draft.repeatEnabled === "boolean" &&
          draft.repeatEnabled !== original.series?.enabled;

        if (contentOnly && !recurrenceToggleChanged) {
          setScopeDialogOpen(true);
          return;
        }
      }

      const savedParts = [];

      try {
        // 1. Content: this occurrence only, or the series template ("future")
        let didSave = false;

        if (isOccurrence(original) && scope === "future") {
          const changes = getOccurrenceDraftChanges(draft, original);
          const templateChanges = getTemplateChanges(changes, draft, original);

          if (Object.keys(templateChanges).length > 0) {
            await httpClient(getSeriesUrl(original.seriesId), {
              method: "PATCH",
              body: JSON.stringify(templateChanges),
            });

            seriesChangedRef.current = true;
            didSave = true;
          }
        } else {
          didSave = await saveEdit(original, draft);
        }
        if (didSave) savedParts.push("content changes");

        // 2. Repeat pattern (rule / end date), effective today
        let patternSaved = false;

        if (isOccurrence(original)) {
          const patternChanges = getPatternChanges(draft, original);

          if (Object.keys(patternChanges).length > 0) {
            const savedSeries = await httpClient(getSeriesUrl(original.seriesId), {
              method: "PATCH",
              body: JSON.stringify(patternChanges),
            });

            seriesChangedRef.current = true;
            patternSaved = true;
            savedParts.push("repeat pattern");

            // Keep local series info current so a retry after a later failure diffs correctly
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

        // 3. Pause / resume (unchanged)
        let toggled = false;

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
          toggled = true;
          toast.add({
            title: draft.repeatEnabled ? "Repeat resumed" : "Repeat paused",
            ...(pausedFrom ? { description: `From ${pausedFrom}` } : {}),
            type: "success",
          });
        }

        if (!didSave && !toggled && !patternSaved) {
          closeEditor();
          return;
        }
      } catch (err) {
        console.log(err);

        const savedNote =
          savedParts.length > 0 ? ` Already saved: ${savedParts.join(" and ")}.` : "";
        setSaveError(`${err.message || "Failed to save task"}${savedNote}`);

        return;
      }
    }

    closeEditor();
  };

  const editingTask = tasks.find(task => task.id === editingTaskId);

  //Save task status when checkbox is clicked
  const toggleTask = async id => {
    const task = tasks.find(existingTask => existingTask.id === id);

    const originalStatus = task.status;

    const newStatus =
      originalStatus === "Completed" ? (previousStatusLookup[id] ?? "To Do") : "Completed";

    if (newStatus === "Completed") {
      setPreviousStatusLookup(current => ({
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
      await patchTask(task, patchBody);

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

  //Change completed task back to previous status
  const undoCompleted = async (id, originalStatus) => {
    const task = tasks.find(existingTask => existingTask.id === id);

    if (!task) {
      return;
    }

    try {
      await patchTask(task, { status: originalStatus });
    } catch (err) {
      console.log(err);
    }
  };

  //Toggles a checklists item completeion state and also saves the checklist
  const toggleChecklistItem = async (taskId, itemId) => {
    const task = tasks.find(existingTask => existingTask.id === taskId);

    if (!task || !task.checklist) {
      return;
    }

    const updateChecklist = task.checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );

    try {
      const saved = await patchTask(task, { checklist: updateChecklist });

      setDraft(prev => ({
        ...prev,
        checklist: saved?.checklist ?? updateChecklist,
      }));
    } catch (err) {
      console.log(err);
    }
  };

  //Deletes tasks from Firestore using Express API route then updates local UI
  const deleteTask = async id => {
    try {
      await httpClient(`http://localhost:3000/api/tasks/${id}`, {
        method: "DELETE",
      });

      setTasks(current => current.filter(task => task.id !== id));

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

      <Dialog open={editorOpen} onOpenChange={open => (open ? setEditorOpen(true) : closeEditor())}>
        <DialogContent>
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
            seriesEnabled={editingTask?.series?.enabled}
          />
        </DialogContent>
      </Dialog>

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
              seriesEnabled={editingTask?.series?.enabled}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={scopeDialogOpen} onOpenChange={open => setScopeDialogOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply changes to</AlertDialogTitle>
            <AlertDialogDescription>
              Choose whether these content changes should apply only to this occurrence or to future
              occurrences in the series.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-col-reverse sm:flex-col-reverse">
            <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>

            <Button
              className="w-full"
              type="button"
              variant="outline"
              onClick={() => {
                setScopeDialogOpen(false);
                saveTask("occurrence");
              }}
            >
              This occurrence only
            </Button>

            <AlertDialogAction
              className="w-full"
              onClick={event => {
                event.preventDefault();
                setScopeDialogOpen(false);
                saveTask("future");
              }}
            >
              Apply to future occurrences
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
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
