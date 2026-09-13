import { TaskRow } from "./TaskRow";

function TaskList({ tasks, isLoading, error, onEdit, onDelete, onToggle }) {
  if (isLoading) {
    return (
      <div className="divide-y">
        {Array.from({ length: 4 }, (_, index) => (
          <TaskRow key={index} isLoading />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="p-8 text-center text-sm text-destructive" role="alert">
        Unable to load tasks. Please try again.
      </p>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        No tasks yet.
      </p>
    );
  }

  return (
    <div className="divide-y">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onEdit={() => onEdit(task)}
          onDelete={() => onDelete(task.id)}
          onToggle={() => onToggle(task.id)}
        />
      ))}
    </div>
  );
}

export { TaskList };
