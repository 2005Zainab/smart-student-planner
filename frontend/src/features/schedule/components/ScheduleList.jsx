import { MoreHorizontal, Clock, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

function ScheduleRow({ task, onEdit, onDelete, onView, onToggle, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex items-start gap-4 p-4 border-l-4 border-l-transparent">
        <Skeleton className="h-5 w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20 hidden sm:flex" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    );
  }
  // Use the parsedDateTime we generated in the SchedulePage, with a fallback just in case
  let displayTime = "No time";
  if (task.parsedDateTime) {
    displayTime = task.parsedDateTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } else if (task.dueTime) {
    // Fallback if parsedDateTime isn't available for some reason
    const [hours, minutes] = task.dueTime.split(":");
    const d = new Date();
    d.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    displayTime = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Determine the accent color based on priority
  const borderAccent =
    task.priority === "High" ? "border-l-high-priority" : task.priority === "Medium" ? "border-l-medium-priority" : task.priority === "Low" ? "border-l-low-priority" : "border-l-primary/40";

  return (
    <div
      className={`group flex cursor-pointer items-start gap-4 p-4 border-l-4 ${borderAccent} hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      onClick={() => onView(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onView(task);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Time Column */}
      <div className="w-25 shrink-0 pt-0.5 text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-accent-foreground" />
        <p className="text-lg text-accent-foreground">{displayTime}</p>
      </div>

      {/* Main Content Column */}
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
        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
          {task.subject}
        </p>
      </div>

      {/* Badges and Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Checklist progress indicator */}
        {task.checklist && task.checklist.length > 0 && (
          <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
            <CheckSquare className="h-3.5 w-3.5" />
            <span>
              {task.checklist.filter((i) => i.completed).length}/{task.checklist.length}
            </span>
          </Badge>
        )}
        <Badge
          variant={task.priority === "High" ? "high" : task.priority === "Medium" ? "medium" : task.priority === "Low" ? "low" : "secondary"}
          className="hidden sm:inline-flex"
        >
          {task.priority}
        </Badge>
        <Badge variant="outline" className="hidden sm:inline-flex">
          {task.status}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(event) => event.stopPropagation()}
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
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <DropdownMenuItem onClick={() => onEdit(task)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(task.id)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// The main list component that maps over the tasks
function ScheduleList({ tasks, isLoading, onEdit, onDelete, onView }) {
  if (isLoading) {
    return (
      <div className="divide-y">
        {/* Render a few skeleton rows while loading */}
        {[...Array(3)].map((_, i) => (
          <ScheduleRow key={i} isLoading={true} />
        ))}
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <div className="divide-y">
      {tasks.map((task) => (
        <ScheduleRow
          key={task.id}
          task={task}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
        />
      ))}
    </div>
  );
}

export { ScheduleList, ScheduleRow };
