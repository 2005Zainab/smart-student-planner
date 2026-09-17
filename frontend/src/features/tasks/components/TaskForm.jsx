import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
}) {
  const [dateError, setDateError] = useState("");

  const handleSave = (event) => {
    event.preventDefault();
    setDateError(""); // Reset date error before validation

    if (requireDateAndTime && !draft.dueDate) {
      setDateError("Due date is required for adding task to schedule.");
      return;
    }

    onSave();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        handleSave(event);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="task-title">Task name</Label>
        <Input
          id="task-title"
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, title: event.target.value }))
          }
          disabled={readOnly}
          maxLength={200}
          value={draft.title}
        />
        {draft.title.length >= 200 && (
          <p className="text-sm text-medium-priority">
            Title cannot be more than 200 characters
          </p>
        )}
        {titleError && <p className="text-sm text-destructive">{titleError}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, description: event.target.value }))
          }
          maxLength={1000}
          disabled={readOnly}
          value={draft.description}
        />
        {draft.description.length >= 1000 && (
          <p className="text-sm text-medium-priority">
            Description cannot be more than 1000 characters
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-subject">Subject</Label>
          <Input
            id="task-subject"
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, subject: event.target.value }))
            }
            maxLength={200}
            disabled={readOnly}
            required
            value={draft.subject}
          />
          {draft.subject.length >= 200 && (
            <p className="text-sm text-medium-priority">
              Subject cannot be more than 200 characters
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-priority">Priority</Label>
          <Select
            disabled={readOnly}
            onValueChange={(priority) => setDraft((prev) => ({ ...prev, priority }))}
            value={draft.priority}
          >
            <SelectTrigger
              aria-label="Priority"
              className="w-full"
              id="task-priority"
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-due-date">
            Due date{" "}
            {requireDateAndTime && <span className="text-destructive">*</span>}
          </Label>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  className='w-full justify-start font-normal ${dateError ? "border-destructive" : ""}'
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
                onSelect={(dueDate) => {
                  setDraft((prev) => ({ ...prev, dueDate }));
                  if (dueDate) setDateError(""); // clears the error state when a date is selected
                }}
                selected={draft.dueDate}
              />
            </PopoverContent>
          </Popover>
          {dateError && <p className="text-sm text-destructive">{dateError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-time">
            Time{" "}
            {requireDateAndTime && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="task-time"
            type="time"
            required={requireDateAndTime}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, time: event.target.value }))
            }
            disabled={readOnly}
            value={draft.time || ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-status">Status</Label>
          <Select
            disabled={readOnly}
            onValueChange={(status) => setDraft((prev) => ({ ...prev, status }))}
            value={draft.status}
          >
            <SelectTrigger
              aria-label="Status"
              className="w-full"
              id="task-status"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="To Do">To Do</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
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
