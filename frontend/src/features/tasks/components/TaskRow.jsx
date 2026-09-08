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

function TaskRow({ task, onEdit, onDelete, onToggle }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <Checkbox
        aria-label={`Mark ${task.title} complete`}
        checked={task.status === "Completed"}
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
      <DropdownMenu>
        <DropdownMenuTrigger
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
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { TaskRow };
