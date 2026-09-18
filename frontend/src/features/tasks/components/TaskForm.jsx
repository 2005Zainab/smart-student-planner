import { format } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/Checkbox";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
}) {
  const [dateError, setDateError] = useState("");
  const [checklistItemInput, setChecklistItemInput] = useState("");
  const [checklistEmptyError, setChecklistEmptyError] = useState("");

  const checklistHandleAddItem = () => {
    if (!checklistItemInput.trim()) {
      setChecklistEmptyError("Checklist item cannot be empty")
      return;
    }
    setChecklistEmptyError("");
    setDraft((prev) => ({
      ...prev,
      checklist: [
        ...(prev.checklist || []),
        { id: `temp-${Date.now()}`, text: checklistItemInput.trim(), completed: false },
      ],
    }));
    setChecklistItemInput("");
  };

  const handleSave = (event) => {
    event.preventDefault();
    setDateError("");

    if (requireDateAndTime && !draft.dueDate) {
      setDateError(
        "Due date is required for adding task to schedule.",
      );
      return;
    }

    onSave();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={handleSave}
    >
      {/* Task name */}
      <div className="space-y-2">
        <Label htmlFor="task-title">
          Task name
        </Label>

        <Input
          id="task-title"
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              title: event.target.value,
            }))
          }
          disabled={readOnly}
          maxLength={200}
          value={draft.title || ""}
        />

        {(draft.title?.length || 0) >= 200 && (
          <p className="text-sm text-medium-priority">
            Title cannot be more than 200 characters
          </p>
        )}

        {titleError && (
          <p className="text-sm text-destructive">
            {titleError}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="task-description">
          Description
        </Label>

        <Textarea
          id="task-description"
          onChange={(event) =>
            setDraft((prev) => ({
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
        <Label htmlFor="task-subject">
          Subject
        </Label>

        <Input
          id="task-subject"
          onChange={(event) =>
            setDraft((prev) => ({
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
          <p className="text-sm text-medium-priority">
            Subject cannot be more than 200 characters
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

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Due date */}
        <div className="space-y-2">
          <Label htmlFor="task-due-date">
            Due date{" "}
            {requireDateAndTime && (
              <span className="text-destructive">
                *
              </span>
            )}
          </Label>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  className={`w-full justify-start font-normal ${dateError
                    ? "border-destructive"
                    : ""
                    }`}
                  disabled={readOnly}
                  id="task-due-date"
                  type="button"
                  variant="outline"
                />
              }
            >
              <CalendarDays />

              {draft.dueDate
                ? format(draft.dueDate, "PPP")
                : "Choose a date"}
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                onSelect={(dueDate) => {
                  setDraft((prev) => ({
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

          {dateError && (
            <p className="text-sm text-destructive">
              {dateError}
            </p>
          )}
        </div>

        {/* Time */}
        <div className="space-y-2">
          <Label htmlFor="task-time">
            Time{" "}
            {requireDateAndTime && (
              <span className="text-destructive">
                *
              </span>
            )}
          </Label>

          <Input
            id="task-time"
            type="time"
            required={requireDateAndTime}
            onChange={(event) =>
              setDraft((prev) => ({
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
          <Label htmlFor="task-status">
            Status
          </Label>

          <Select
            disabled={readOnly}
            onValueChange={(status) =>
              setDraft((prev) => ({
                ...prev,
                status,
              }))
            }
            value={draft.status || "To Do"}
          >
            <SelectTrigger
              aria-label="Status"
              className="w-full"
              id="task-status"
            >
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="To Do">
                To Do
              </SelectItem>

              <SelectItem value="In Progress">
                In Progress
              </SelectItem>

              <SelectItem value="Completed">
                Completed
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <Label>Checklist</Label>

        {(draft.checklist || []).map((item) => (
          <div key={item.id} className="flex items-center gap-2 min-w-0">
            <Checkbox
              checked={item.completed}
              disabled={false}
              onCheckedChange={() => {
                if (readOnly) {
                  onToggleChecklistItem(item.id);
                } else {
                  setDraft((prev) => ({
                    ...prev,
                    checklist: prev.checklist.map((i) =>
                      i.id === item.id ? { ...i, completed: !i.completed } : i
                    ),
                  }));
                }
              }}
            />
            <span className="flex-1 min-w-0 wrap-anywhere text-sm">{item.text}</span>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    checklist: prev.checklist.filter((i) => i.id !== item.id),
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
                onChange={(event) => {
                  setChecklistItemInput(event.target.value);
                  if(checklistEmptyError) setChecklistEmptyError("")
                  }}
                onKeyDown={(event) => {
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
            {checklistEmptyError && (
              <p className="text-sm text-medium-priority">{checklistEmptyError}</p>
            )}
            {checklistItemInput.length >= 100 && (
              <p className="text-sm text-medium-priority">
                Checklist item cannot be more than 100 characters
              </p>
            )}
          </div>
        )}
      </div>

      {saveError && (
        <p className="text-sm text-destructive">
          {saveError}
        </p>
      )}

      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>

          <Button type="submit">
            Save task
          </Button>
        </div>
      )}
    </form>
  );
}

export { TaskForm };