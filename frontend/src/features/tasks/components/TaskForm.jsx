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
          <Label htmlFor="task-due-date">Due date</Label>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  className="w-full justify-start font-normal"
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
                onSelect={(dueDate) => setDraft({ ...draft, dueDate })}
                selected={draft.dueDate}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-status">Status</Label>
          <Select
            onValueChange={(status) => setDraft({ ...draft, status })}
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
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit">Save task</Button>
      </div>
    </form>
  );
}

export { TaskForm };
