import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RecurrenceFields } from "./RecurrenceFields";
import { isAfter, startOfDay, startOfToday } from "date-fns";

// TaskForm component is used for creating and editing tasks. 
// It includes fields for task name, subject, description, priority, 
// status, due date, time, reminder date and time, recurrence settings, and a checklist.
function TaskForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  titleError,
  saveError,
  readOnly = false,
  requireDateAndTime = false,
  onToggleChecklistItem,
  allowRecurrence = false,
  seriesEnabled,
}) {
  const [dateError, setDateError] = useState("");
  const [reminderError, setReminderError] = useState("");
  const [checklistItemInput, setChecklistItemInput] = useState("");
  const [checklistError, setChecklistError] = useState("");
  // Checklist only shows in view task if the task already has items
  const [checklistToggle, setChecklistToggle] = useState(null);

  const reminderDaysAway = draft.reminderDate
    ? differenceInCalendarDays(
        draft.reminderDate instanceof Date ? draft.reminderDate : parseISO(draft.reminderDate),
        new Date(),
      )
    : null;

  const checklist = draft.checklist || [];
  const completedItems = checklist.filter(item => item.completed).length;
  const progress = checklist.length > 0 ? Math.round((completedItems / checklist.length) * 100) : 0;
  const showChecklist = checklistToggle ?? (readOnly && checklist.length > 0);

  const checklistHandleAddItem = () => {
    if (checklist.length >= 10) {
      setChecklistError("10 is maximum number of checklist items");
      return;
    }

    if (!checklistItemInput.trim()) {
      setChecklistError("Checklist item cannot be empty");
      return;
    }
    setChecklistError("");
    setDraft(prev => ({
      ...prev,
      checklist: [
        ...(prev.checklist || []),
        { id: `temp-${Date.now()}`, text: checklistItemInput.trim(), completed: false },
      ],
    }));
    setChecklistItemInput("");
  };

  const pausing = draft.repeatEnabled === false && seriesEnabled === true;
  const hidesThisOccurrence =
    pausing && draft.dueDate instanceof Date && isAfter(startOfDay(draft.dueDate), startOfToday());

  const handleSave = event => {
    event.preventDefault();
    setDateError("");

    if ((requireDateAndTime || draft.recurrence) && !draft.dueDate) {
      setDateError("Due date is required for adding task to schedule.");
      return;
    }

    setReminderError(""); // Reset reminder error before validation
    const hasReminderDate = draft.recurrence
      ? draft.recurrence.reminderOffsetDays !== null &&
        draft.recurrence.reminderOffsetDays !== undefined
      : Boolean(draft.reminderDate);
    const hasReminderTime = draft.recurrence
      ? Boolean(draft.recurrence.reminderTime)
      : Boolean(draft.reminderTime);

    if (hasReminderDate !== hasReminderTime) {
      setReminderError("Date and time is required to set a reminder.");
      return;
    }
    // Validate that the absolute reminder date and time is not in the past
    if (!draft.recurrence && hasReminderDate && hasReminderTime) {
      const reminderDateOnly =
        draft.reminderDate instanceof Date
          ? format(draft.reminderDate, "yyyy-MM-dd")
          : draft.reminderDate;
      const reminderDateTime = new Date(`${reminderDateOnly}T${draft.reminderTime}:00`);

      if (reminderDateTime <= new Date()) {
        setReminderError("Reminders cannot be set in the past.");
        return;
      }
    }

    onSave();
  };

  const createRecurrence = () => {
    const dueDate = draft.dueDate instanceof Date ? draft.dueDate : new Date();
    const isoWeekday = dueDate.getDay() === 0 ? 7 : dueDate.getDay();

    return {
      rule: {
        type: "daily",
        interval: 1,
      },
      endDate: null,
      reminderOffsetDays: null,
      reminderTime: "",
      defaultWeekday: isoWeekday,
    };
  };

  const recurrence = draft.recurrence;
  // A recurring occurrence's due date is its occurrence date; the server rejects any other
  const isOccurrenceDraft = Boolean(draft.seriesId);

  return (
        <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={handleSave}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
      {/* Task name */}
      <div className="space-y-2">
        <Label htmlFor="task-title">Task name</Label>

        <Input
          id="task-title"
          onChange={event =>
            setDraft(prev => ({
              ...prev,
              title: event.target.value,
            }))
          }
          disabled={readOnly}
          maxLength={200}
          value={draft.title || ""}
        />

        {(draft.title?.length || 0) >= 200 && (
          <p className="text-sm text-medium-priority">Title cannot be more than 200 characters</p>
        )}

        {titleError && <p className="text-sm text-destructive">{titleError}</p>}
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="task-subject">Subject</Label>

        <Input
          id="task-subject"
          onChange={event =>
            setDraft(prev => ({
              ...prev,
              subject: event.target.value,
            }))
          }
          maxLength={200}
          disabled={readOnly}
          value={draft.subject || ""}
        />

        {(draft.subject?.length || 0) >= 200 && (
          <p className="text-sm text-medium-priority">Subject cannot be more than 200 characters</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="task-description">Description</Label>

        <Textarea
          id="task-description"
          onChange={event =>
            setDraft(prev => ({
              ...prev,
              description: event.target.value,
            }))
          }
          maxLength={1000}
          disabled={readOnly}
          value={draft.description || ""}
        />

        {(draft.description?.length || 0) >= 1000 && (
          <p className="text-sm text-medium-priority">
            Description cannot be more than 1000 characters
          </p>
        )}
      </div>

      {/* Priority */}
      <div className="space-y-1">
        <Label>Priority</Label>

        <p className="text-sm text-muted-foreground">
          Priority is automatically calculated from the due date.
        </p>
      </div>

      {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="task-status">Status</Label>

          <Select
            disabled={readOnly}
            onValueChange={status =>
              setDraft(prev => ({
                ...prev,
                status,
              }))
            }
            value={draft.status || "To Do"}
          >
            <SelectTrigger aria-label="Status" className="w-full" id="task-status">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="To Do">To Do</SelectItem>

              <SelectItem value="In Progress">In Progress</SelectItem>

              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Due date */}
        <div className="space-y-2">
          <Label htmlFor="task-due-date">
            Due date
            {(requireDateAndTime || recurrence) && <span className="text-destructive">*</span>}
          </Label>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  className={`w-full justify-start font-normal ${
                    dateError ? "border-destructive" : ""
                  }`}
                  disabled={readOnly || isOccurrenceDraft}
                  id="task-due-date"
                  type="button"
                  variant="outline"
                />
              }
            >
              <CalendarDays />

              {draft.dueDate ? format(draft.dueDate, "PPP") : "Choose a date"}
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                onSelect={dueDate => {
                  setDraft(prev => ({
                    ...prev,
                    dueDate,
                  }));

                  if (dueDate) {
                    setDateError("");
                  }
                }}
                selected={draft.dueDate}
              />
            </PopoverContent>
          </Popover>

          {dateError && <p className="text-sm text-destructive">{dateError}</p>}

          {isOccurrenceDraft && !readOnly && (
            <p className="text-sm text-muted-foreground">
              A recurring occurrence can't be moved to another date.
            </p>
          )}
        </div>

        {/* Time */}
        <div className="space-y-2">
          <Label htmlFor="task-time">
            Due time {requireDateAndTime && <span className="text-destructive">*</span>}
          </Label>

          <Input
            id="task-time"
            type="time"
            required={requireDateAndTime}
            onChange={event =>
              setDraft(prev => ({
                ...prev,
                time: event.target.value,
              }))
            }
            disabled={readOnly}
            value={draft.time || ""}
          />
        </div>

        {/* Reminder date & time */}
        {!recurrence && (
          <>
            <div className="space-y-2">
              <Label htmlFor="task-reminder-date">Reminder date</Label>

              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      className="w-full justify-start font-normal"
                      disabled={readOnly}
                      id="task-reminder-date"
                      type="button"
                      variant="outline"
                    />
                  }
                >
                  <CalendarDays />
                  {draft.reminderDate ? format(draft.reminderDate, "PPP") : "Choose a date"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    onSelect={reminderDate => setDraft(prev => ({ ...prev, reminderDate }))}
                    selected={draft.reminderDate}
                  />
                </PopoverContent>
              </Popover>
              {reminderDaysAway !== null && (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  (
                  {reminderDaysAway > 0
                    ? `${reminderDaysAway} day${reminderDaysAway !== 1 ? "s" : ""} away`
                    : reminderDaysAway === 0
                      ? "today"
                      : `${Math.abs(reminderDaysAway)} day${reminderDaysAway !== -1 ? "s" : ""} ago`}
                  )
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-reminder-time">Reminder time</Label>
              <Input
                id="task-reminder-time"
                type="time"
                onChange={event =>
                  setDraft(prev => ({ ...prev, reminderTime: event.target.value }))
                }
                disabled={readOnly}
                value={draft.reminderTime || ""}
              />
            </div>
          </>
        )}
        {typeof Notification !== "undefined" && Notification.permission === "denied" && (
          <p className="text-sm text-muted-foreground">
            Notifications are blocked in your browser: reminders won't show a popup.
          </p>
        )}
        {reminderError && <p className="text-sm text-destructive">{reminderError}</p>}
      </div>

      {allowRecurrence && (
        <div className="space-y-4 rounded-md border p-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={Boolean(recurrence)}
              disabled={readOnly}
              id="task-repeat"
              onCheckedChange={checked =>
                setDraft(prev => ({
                  ...prev,
                  recurrence: checked ? createRecurrence() : null,
                }))
              }
            />
            <Label htmlFor="task-repeat">Repeat</Label>
          </div>

          <RecurrenceFields
            recurrence={recurrence}
            dueDate={draft.dueDate}
            onChange={changes =>
              setDraft(prev => ({
                ...prev,
                recurrence: {
                  ...prev.recurrence,
                  ...changes,
                },
              }))
            }
            onRuleChange={rule =>
              setDraft(prev => ({
                ...prev,
                recurrence: {
                  ...prev.recurrence,
                  rule,
                },
              }))
            }
          />
        </div>
      )}

      {draft.seriesId && typeof draft.repeatEnabled === "boolean" && (
        <div className="space-y-2 rounded-md border p-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={draft.repeatEnabled}
              disabled={readOnly}
              id="task-repeat"
              onCheckedChange={checked =>
                setDraft(prev => ({
                  ...prev,
                  repeatEnabled: checked,
                }))
              }
            />
            <Label htmlFor="task-repeat">Repeat</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Unticking pauses this series from tomorrow. Today's occurrence stays. Re-tick to resume.
          </p>
          {hidesThisOccurrence && (
            <p className="text-sm text-medium-priority">This occurrence will be hidden too.</p>
          )}
          {draft.repeatEnabled !== seriesEnabled && (
            <p className="text-sm text-muted-foreground">
              {draft.repeatEnabled ? "Resumes today" : "Pauses from tomorrow"}
            </p>
          )}
        </div>
      )}

        {/* Checklist */}
      <div className="space-y-2 rounded-md border p-4">
        {/* Header: tick to show or hide the checklist, the counter stays visible */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={showChecklist}
              id="task-checklist"
              onCheckedChange={checked => setChecklistToggle(Boolean(checked))}
            />
            <Label htmlFor="task-checklist">Checklist</Label>
          </div>
          {checklist.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {completedItems} of {checklist.length} completed
            </span>
          )}
        </div>
        {showChecklist && (
          <>
        
        {/* Progress bar */}
        {checklist.length > 0 && (
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {(draft.checklist || []).map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 min-w-0 p-1.5 rounded-md hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Checkbox
                checked={item.completed}
                className="cursor-pointer"
                disabled={false}
                onCheckedChange={() => {
                  if (readOnly) {
                    onToggleChecklistItem(item.id);
                  } else {
                    setDraft(prev => ({
                      ...prev,
                      checklist: prev.checklist.map(i =>
                        i.id === item.id ? { ...i, completed: !i.completed } : i,
                      ),
                    }));
                  }
                }}
              />
              <span className="flex-1 min-w-0 wrap-anywhere text-sm">{item.text}</span>
            </div>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="cursor-pointer group-focus-within:opacity-100 transition-opacity"
                onClick={() =>
                  setDraft(prev => ({
                    ...prev,
                    checklist: prev.checklist.filter(i => i.id !== item.id),
                  }))
                }
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        {!readOnly && (
          <div className="space-y-1">
            <div className="flex gap-2">
              <Label htmlFor="new-checklist-item" className="sr-only">
                Add a checklist item
              </Label>
              <Input
                id="new-checklist-item"
                placeholder="Add a checklist item"
                maxLength={100}
                value={checklistItemInput}
                onChange={event => {
                  setChecklistItemInput(event.target.value);
                  if (checklistError) setChecklistError("");
                }}
                onKeyDown={event => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    checklistHandleAddItem();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={checklistHandleAddItem}>
                Add
              </Button>
            </div>
            {checklistError && <p className="text-sm text-medium-priority">{checklistError}</p>}
            {checklistItemInput.length >= 100 && (
              <p className="text-sm text-medium-priority">
                Checklist item cannot be more than 100 characters
              </p>
            )}
          </div>
        )}
          </>
        )}
      </div>
      </div>

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>

          <Button type="submit">Save task</Button>
        </div>
      )}
    </form>
  );
}

export { TaskForm };
