import { MoreHorizontal, CheckSquare, Paperclip } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Skeleton } from "@/components/ui/skeleton";
import { differenceInCalendarDays } from "date-fns";
import { isOccurrence } from "../utils/task-endpoints";

function TaskRow({ task, onEdit, onDelete, onToggle, onView, isLoading }) {
  // Show loading layout while tasks are loading
  if (isLoading) {
    return (
      <div className="flex items-start gap-3 p-4">
        <Skeleton className="h-5 w-5" />

        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-1 h-3 w-1/2" />
        </div>

        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-5 w-5" />
      </div>
    );
  }

  const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
  const today = new Date();

  return (
    <div
      className="flex cursor-pointer items-start gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onView}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onView();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Complete task checkbox */}
      <Checkbox
        aria-label={`Mark ${task.title} complete`}
        checked={task.status === "Completed"}
        onClick={event => event.stopPropagation()}
        onCheckedChange={onToggle}
      />

      {/* Task information */}
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

        <p className="mt-1 text-sm text-muted-foreground">
          {isOccurrence(task) && <Badge variant="ghost">Recurring Task</Badge>}{" "}
          {task.subject && ` ${task.subject}`}
        </p>

        {/* Keep Task Labels functionality */}
        {task.label && (
          <Badge className="mt-2" variant="outline">
            {task.label}
          </Badge>
        )}
      </div>

      {/* Overdue indicator */}
      {taskDueDate && differenceInCalendarDays(taskDueDate, today) < 0 && (
        <Badge variant="high">Overdue</Badge>
      )}

      {/* Priority colour changes depending on priority */}
      <Badge
        variant={
          task.priority === "High"
            ? "high"
            : task.priority === "Medium"
              ? "medium"
              : task.priority === "Low"
                ? "low"
                : "secondary"
        }
      >
        {task.priority}
      </Badge>

      {/* Checklist progress indicator */}
      {task.checklist && task.checklist.length > 0 && (
        <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
          <CheckSquare className="h-3.5 w-3.5" />
          <span>
            {task.checklist.filter(item => item.completed).length}/{task.checklist.length}
          </span>
        </Badge>
      )}

      {/* Attached files indicator */}
      {task.files && task.files.length > 0 && (
        <Badge
          variant="outline"
          className="flex items-center gap-1 text-muted-foreground"
          aria-label={`${task.files.length} attached files`}
        >
          <Paperclip className="h-3.5 w-3.5" />
          <span>{task.files.length}</span>
        </Badge>
      )}

      {/* Task status */}
      <Badge variant="outline">{task.status}</Badge>

      {/* Due date */}
      <Badge variant="outline">{task.dueDate || "No due date"}</Badge>

      {/* Edit and delete menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={event => event.stopPropagation()}
          render={
            <Button aria-label={`Actions for ${task.title}`} size="icon-sm" variant="ghost" />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          onClick={event => event.stopPropagation()}
          onKeyDown={event => event.stopPropagation()}
        >
          <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>

          <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { TaskRow };
