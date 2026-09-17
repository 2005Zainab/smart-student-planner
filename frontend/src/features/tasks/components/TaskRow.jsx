import {
  MoreHorizontal,
  Bell,
} from "lucide-react";

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

function TaskRow({
  task,
  onEdit,
  onDelete,
  onToggle,
  onView,
  isLoading,
}) {
  //Show loading layout while tasks are loading
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

  return (
    <div
      className="flex cursor-pointer items-start gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onView}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
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
        onClick={(event) =>
          event.stopPropagation()
        }
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
          {task.subject}
        </p>

        {task.label && (
          <Badge
            className="mt-2"
            variant="outline"
          >
            {task.label}
          </Badge>
        )}

        {/* Notification information */}
        {task.notificationDate && (
          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <Bell className="h-4 w-4" />

            <span>
              Reminder:{" "}
              {task.notificationDate}

              {task.notificationTime &&
                ` at ${task.notificationTime}`}

              {task.notificationFrequency &&
                ` - ${task.notificationFrequency}`}
            </span>
          </div>
        )}
      </div>

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

      <Badge variant="outline">
        {task.status}
      </Badge>

      <Badge variant="outline">
        {task.dueDate || "No due date"}
      </Badge>

      {/* Edit and delete menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(event) =>
            event.stopPropagation()
          }
          render={
            <Button
              aria-label={`Actions for ${task.title}`}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          onClick={(event) =>
            event.stopPropagation()
          }
          onKeyDown={(event) =>
            event.stopPropagation()
          }
        >
          <DropdownMenuItem
            onClick={onEdit}
          >
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={onDelete}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { TaskRow };