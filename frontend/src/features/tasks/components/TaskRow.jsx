import { MoreHorizontal } from "lucide-react";
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

function TaskRow({ task, onEdit, onDelete, onToggle, onView, isLoading }) {
  return isLoading ? (
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
  ) : (
    <div
      className="flex cursor-pointer items-start gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onView}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onView();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Checkbox
        aria-label={`Mark ${task.title} complete`}
        checked={task.status === "Completed"}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={onToggle}
      />
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
        <p className="mt-1 text-sm text-muted-foreground">{task.subject}</p>
      </div>
      <Badge variant={task.priority === "High" ? "destructive" : "secondary"}>
        {task.priority}
      </Badge>
      <Badge variant="outline">{task.status}</Badge>
      <Badge variant="outline">{task.dueDate}</Badge>
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
          <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { TaskRow };
