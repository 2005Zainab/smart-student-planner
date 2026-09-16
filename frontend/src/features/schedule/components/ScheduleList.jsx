import { MoreHorizontal, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

// Helper function to format 24h time ("14:30") to 12h time ("2:30 PM")
const formatTime = (timeString) => {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":");
  const d = new Date();
  d.setHours(parseInt(hours, 10), parseInt(minutes, 10));
  return d.toLocaleTimeString("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
  });
};

function ScheduleRow({ task, onEdit, onDelete, onView, isLoading }) {
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
        <p className="text-lg text-accent-foreground">{formatTime(task.time)}</p>
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
        <Badge
          variant={task.priority === "High" ? "destructive" : "secondary"}
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
