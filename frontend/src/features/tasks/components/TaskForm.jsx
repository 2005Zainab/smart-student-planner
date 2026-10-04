import { format } from "date-fns";
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
}) {
  const [dateError, setDateError] = useState("");
  const [reminderError, setReminderError] = useState("");
  const [checklistItemInput, setChecklistItemInput] = useState("");
  const [checklistError, setChecklistError] = useState("");

  const checklist = draft.checklist || [];
  const completedItems = checklist.filter(item => item.completed).length;
  const progress = checklist.length > 0 ? Math.round((completedItems / checklist.length) * 100) : 0;

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

  const setRecurrenceRule = rule => {
    setDraft(prev => ({
      ...prev,
      recurrence: {
        ...prev.recurrence,
        rule,
      },
    }));
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

  const updateRecurrence = changes => {
    setDraft(prev => ({
      ...prev,
      recurrence: {
        ...prev.recurrence,
        ...changes,
      },
    }));
  };

  const recurrence = draft.recurrence;

  return (
    <form className="space-y-4" onSubmit={handleSave}>
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
          required
          value={draft.subject || ""}
        />

        {(draft.subject?.length || 0) >= 200 && (
          <p className="text-sm text-medium-priority">Subject cannot be more than 200 characters</p>
        )}
      </div>

      {/* Priority */}
      <div className="space-y-1">
        <Label>Priority</Label>

        <p className="text-sm text-muted-foreground">
          Priority is automatically calculated from the due date.
        </p>
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
                  disabled={readOnly}
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
        </div>

        {/* Time */}
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

          {recurrence && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="recurrence-type">Repeat type</Label>
                  <Select
                    value={recurrence.rule.type}
                    onValueChange={type => {
                      if (type === "daily") {
                        setRecurrenceRule({ type, interval: 1 });
                      } else if (type === "weekly") {
                        setRecurrenceRule({
                          type,
                          interval: 1,
                          weekdays: [recurrence.defaultWeekday],
                        });
                      } else {
                        setRecurrenceRule({
                          type,
                          interval: 1,
                          monthDay: draft.dueDate instanceof Date ? draft.dueDate.getDate() : 1,
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="recurrence-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recurrence-interval">Every</Label>
                  <Input
                    id="recurrence-interval"
                    min="1"
                    max="30"
                    onChange={event =>
                      setRecurrenceRule({
                        ...recurrence.rule,
                        interval: Number(event.target.value),
                      })
                    }
                    type="number"
                    value={recurrence.rule.interval}
                  />
                </div>
              </div>

              {recurrence.rule.type === "weekly" && (
                <div className="space-y-2">
                  <Label>Weekdays</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      [1, "Mon"],
                      [2, "Tue"],
                      [3, "Wed"],
                      [4, "Thu"],
                      [5, "Fri"],
                      [6, "Sat"],
                      [7, "Sun"],
                    ].map(([day, label]) => {
                      const selected = recurrence.rule.weekdays.includes(day);
                      return (
                        <Button
                          key={day}
                          onClick={() => {
                            if (selected && recurrence.rule.weekdays.length === 1) return;
                            setRecurrenceRule({
                              ...recurrence.rule,
                              weekdays: selected
                                ? recurrence.rule.weekdays.filter(value => value !== day)
                                : [...recurrence.rule.weekdays, day].sort((a, b) => a - b),
                            });
                          }}
                          type="button"
                          variant={selected ? "default" : "outline"}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {recurrence.rule.type === "monthly" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="recurrence-month-day">Day of month</Label>
                    <Input
                      disabled={recurrence.rule.useLastDayOfMonth === true}
                      id="recurrence-month-day"
                      max="31"
                      min="1"
                      onChange={event =>
                        setRecurrenceRule({
                          type: "monthly",
                          interval: recurrence.rule.interval,
                          monthDay: Number(event.target.value),
                        })
                      }
                      type="number"
                      value={recurrence.rule.monthDay || ""}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={recurrence.rule.useLastDayOfMonth === true}
                      id="recurrence-last-day"
                      onCheckedChange={checked =>
                        setRecurrenceRule(
                          checked
                            ? {
                                type: "monthly",
                                interval: recurrence.rule.interval,
                                useLastDayOfMonth: true,
                              }
                            : {
                                type: "monthly",
                                interval: recurrence.rule.interval,
                                monthDay:
                                  draft.dueDate instanceof Date ? draft.dueDate.getDate() : 1,
                              },
                        )
                      }
                    />
                    <Label htmlFor="recurrence-last-day">Use last day of month</Label>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="recurrence-end-date">End date</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          className="flex-1 justify-start font-normal"
                          id="recurrence-end-date"
                          type="button"
                          variant="outline"
                        />
                      }
                    >
                      <CalendarDays />
                      {recurrence.endDate ? format(recurrence.endDate, "PPP") : "Never"}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        onSelect={endDate => updateRecurrence({ endDate })}
                        selected={recurrence.endDate || undefined}
                      />
                    </PopoverContent>
                  </Popover>
                  {recurrence.endDate && (
                    <Button
                      onClick={() => updateRecurrence({ endDate: null })}
                      type="button"
                      variant="outline"
                    >
                      Never
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="recurrence-reminder-offset">Remind me days before</Label>
                  <Input
                    id="recurrence-reminder-offset"
                    min="0"
                    onChange={event =>
                      updateRecurrence({
                        reminderOffsetDays:
                          event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                    type="number"
                    value={recurrence.reminderOffsetDays ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurrence-reminder-time">At</Label>
                  <Input
                    id="recurrence-reminder-time"
                    onChange={event => updateRecurrence({ reminderTime: event.target.value })}
                    type="time"
                    value={recurrence.reminderTime || ""}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Applies from today</p>
            </div>
          )}
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-2">
        {/* Header with a counter */}
        <div className="flex items-center justify-between">
          <Label>Checklist</Label>
          {checklist.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {completedItems} of {checklist.length} completed
            </span>
          )}
        </div>
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
