import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useRef, useState } from "react";
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
import { TaskFilesCard } from "./TaskFilesCard";
import { useTaskFiles } from "../hooks/useTaskFiles";
import { isAfter, startOfDay, startOfToday } from "date-fns";

const MAX_LINKS = 10;
const MAX_LINK_LENGTH = 500;

// Save a copy of the form data so we can check what has changed
const snapshotFields = draft =>
  JSON.stringify(draft, (key, value) => (key === "files" ? undefined : value));

// Form for creating, editing and viewing tasks
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
  allowSeriesControls = false,
  seriesEnabled,
  onFilesChange,
}) {
  const [dateError, setDateError] = useState("");
  const [reminderError, setReminderError] = useState("");
  const [checklistItemInput, setChecklistItemInput] = useState("");
  const [checklistError, setChecklistError] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);
  const [checklistToggle, setChecklistToggle] = useState(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linksToggle, setLinksToggle] = useState(null);

  const filesChangedRef = useRef(false);
  const [fieldsAtOpen] = useState(() => snapshotFields(draft));

  // Handle task attachments
  const taskFiles = useTaskFiles(draft, update => {
    filesChangedRef.current = true;
    setDraft(prev => ({ ...prev, files: update(prev.files ?? []) }));
    onFilesChange?.(draft.id, update);
  });

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
  const links = draft.links || [];
  const showLinks = linksToggle ?? links.length > 0;

  // Add a new checklist item
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

  // Add a website link to the task
  const handleAddLink = () => {
    const trimmed = linkInput.trim();

    if (!trimmed) {
      setLinkError("Link can't be empty");
      return;
    }

    if (links.length >= MAX_LINKS) {
      setLinkError(`Max links allowed per task is ${MAX_LINKS}`);
      return;
    }

    const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

    if (withProtocol.length > MAX_LINK_LENGTH) {
      setLinkError(`Link cannot be more than ${MAX_LINK_LENGTH} characters`);
      return;
    }

    let url;
    try {
      url = new URL(withProtocol);
    } catch {
      setLinkError("Please enter a valid link");
      return;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      setLinkError("Link must begin with http:// or https://");
      return;
    }

    setDraft(prev => ({ ...prev, links: [...(prev.links || []), withProtocol] }));
    setLinkInput("");
    setLinkError("");
    setShowLinkInput(false);
  };

  const pausing = draft.repeatEnabled === false && seriesEnabled === true;

  const hidesThisOccurrence =
    pausing && draft.dueDate instanceof Date && isAfter(startOfDay(draft.dueDate), startOfToday());

  // Validate the form before saving
  const handleSave = async event => {
    event.preventDefault();

    if (taskFiles.isBusy || taskSaving) return;

    setDateError("");

    if ((requireDateAndTime || draft.recurrence) && !draft.dueDate) {
      setDateError("Due date is required for adding task to schedule.");
      return;
    }

    setReminderError("");

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

    if (taskFiles.stagedFiles.length > 0 && !(await taskFiles.uploadStaged())) {
      return;
    }

    if (filesChangedRef.current && snapshotFields(draft) === fieldsAtOpen) {
      onCancel();
      return;
    }

    setTaskSaving(true);

    try {
      await onSave();
    } finally {
      setTaskSaving(false);
    }
  };

  // Default repeat settings
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
            <p className="text-sm text-medium-priority">
              Subject cannot be more than 200 characters
            </p>
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

        {/* Focus timer - new feature */}
        {!recurrence && !draft.seriesId && (
          <div className="space-y-2 rounded-md border p-4">
            <Label htmlFor="task-focus-timer">Focus timer</Label>

            <p className="text-sm text-muted-foreground">
              Choose how long you want to focus on this task.
            </p>

            <Select
              disabled={readOnly}
              value={draft.timerMinutes == null ? "none" : String(draft.timerMinutes)}
              onValueChange={value =>
                setDraft(prev => ({
                  ...prev,
                  timerMinutes: value === "none" ? null : Number(value),
                }))
              }
            >
              <SelectTrigger id="task-focus-timer" aria-label="Focus timer" className="w-full">
                <SelectValue placeholder="Select timer" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="none">No timer</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="25">25 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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

        {/* Dates, times and reminders */}
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

          {/* Task time */}
          <div className="space-y-2">
            <Label htmlFor="task-time">
              Time {requireDateAndTime && <span className="text-destructive">*</span>}
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

          {/* Reminder date and reminder time */}
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

        {/* Recurring task settings */}
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
              readOnly={readOnly}
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

        {/* Change existing recurring tasks */}
        {allowSeriesControls && draft.seriesId && typeof draft.repeatEnabled === "boolean" && (
          <div className="space-y-4 rounded-md border p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={draft.repeatEnabled}
                  disabled={readOnly}
                  id="task-series-repeat"
                  onCheckedChange={checked =>
                    setDraft(prev => ({ ...prev, repeatEnabled: checked }))
                  }
                />
                <Label htmlFor="task-series-repeat">Repeat</Label>
              </div>

              <p className="text-sm text-muted-foreground">
                Unticking pauses this series from tomorrow. Today's occurrence stays. Re-tick to
                resume.
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

            {draft.repeatEnabled && draft.seriesPattern && (
              <RecurrenceFields
                recurrence={draft.seriesPattern}
                dueDate={draft.dueDate}
                showReminder={false}
                readOnly={readOnly}
                onChange={changes =>
                  setDraft(prev => ({
                    ...prev,
                    seriesPattern: { ...prev.seriesPattern, ...changes },
                  }))
                }
                onRuleChange={rule =>
                  setDraft(prev => ({
                    ...prev,
                    seriesPattern: { ...prev.seriesPattern, rule },
                  }))
                }
              />
            )}
          </div>
        )}

        {draft.seriesId && !allowSeriesControls && (
          <p className="text-sm text-muted-foreground">
            Part of a repeating series. Change repeat settings on the Tasks page.
          </p>
        )}

        {/* Checklist */}
        <div className="space-y-2 rounded-md border p-4">
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
              {/* Checklist progress */}
              {checklist.length > 0 && (
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-in-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {/* Existing checklist items */}
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

              {/* Add checklist item */}
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

                  {checklistError && (
                    <p className="text-sm text-medium-priority">{checklistError}</p>
                  )}

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

        {/* Links */}
        {(!readOnly || links.length > 0) && (
          <div className="space-y-2 rounded-md border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={showLinks}
                  id="task-links"
                  onCheckedChange={checked => setLinksToggle(Boolean(checked))}
                />
                <Label htmlFor="task-links">Links</Label>
              </div>

              {links.length > 0 && (
                <span className="text-xs text-muted-foreground">{links.length} added</span>
              )}
            </div>

            {showLinks && (
              <>
                {/* Existing links */}
                {links.map((link, index) => (
                  <div
                    key={`${index}-${link}`}
                    className="flex items-center justify-between gap-2 min-w-0"
                  >
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate text-sm text-primary underline"
                    >
                      {link}
                    </a>

                    {!readOnly && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() =>
                          setDraft(prev => ({
                            ...prev,
                            links: prev.links.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                {/* Add a new link */}
                {!readOnly &&
                  (showLinkInput ? (
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <Input
                          autoFocus
                          placeholder="Paste a link"
                          maxLength={MAX_LINK_LENGTH}
                          value={linkInput}
                          onChange={event => {
                            setLinkInput(event.target.value);
                            if (linkError) setLinkError("");
                          }}
                          onKeyDown={event => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleAddLink();
                            }
                          }}
                        />

                        <Button type="button" variant="outline" onClick={handleAddLink}>
                          Done
                        </Button>
                      </div>

                      {linkError && <p className="text-sm text-medium-priority">{linkError}</p>}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLinkInput(true)}
                    >
                      Add link
                    </Button>
                  ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Attachments */}
      <TaskFilesCard taskFiles={taskFiles} readOnly={readOnly} />

      {saveError && <p className="whitespace-pre-line text-sm text-destructive">{saveError}</p>}

      {/* Save and cancel buttons */}
      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>

          <Button type="submit" disabled={taskFiles.isBusy || taskSaving}>
            Save task
          </Button>
        </div>
      )}
    </form>
  );
}

export { TaskForm };
