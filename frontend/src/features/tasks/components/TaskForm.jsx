import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      {/* Task name */}
      <div className="space-y-2">
        <Label htmlFor="task-title">Task name</Label>

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
        <Label htmlFor="task-subject">Subject</Label>

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

      {/* Priority information */}
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
          </Label>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  className="w-full justify-start font-normal"
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
                onSelect={(dueDate) =>
                  setDraft((prev) => ({
                    ...prev,
                    dueDate,
                  }))
                }
                selected={draft.dueDate}
              />
            </PopoverContent>
          </Popover>
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

      {/* Save error */}
      {saveError && (
        <p className="text-sm text-destructive">
          {saveError}
        </p>
      )}

      {/* Buttons */}
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