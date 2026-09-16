import { TaskRow } from "./TaskRow";
import { useSearchParams } from "react-router-dom";

function TaskList({
  tasks,
  isLoading,
  error,
  onEdit,
  onDelete,
  onToggle,
  onView,
}) {
  //Keeps current tab open on refresh: Active or Completed
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "active";

  const tabChange = (tab) => {
    setSearchParams({ tab });
  }

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

  //Seperates the tasks by their status and shows them in the relevant tab
  const openTasks = tasks.filter((task) => task.status !== "Completed");
  const completedTasks = tasks.filter((task) => task.status === "Completed");
  const visibleTasks = activeTab === "active" ? openTasks : completedTasks;

  return (
    <div>
      <div className="flex border-b">
        <button
          onClick={() => tabChange("active")}
          className={`px-4 py-2 text-sm font-medium ${activeTab === "active" ? "border-b-2 border-primary text-foreground"
            : "text-muted-foreground"
            }`}
        >
          Active ({openTasks.length})
        </button>
        <button
          onClick={() => tabChange("completed")}
          className={`px-4 py-2 text-sm font-medium ${activeTab === "completed" ? "border-b-2 border-primary text-foreground"
            : "text-muted-foreground"
            }`}
        >
          Completed ({completedTasks.length})
        </button>
      </div>
      <div className="divide-y">
        {visibleTasks.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {activeTab === "active" ? "No Active Tasks" : "No Completed Tasks"}
          </p>
        ) : (
          visibleTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task.id)}
              onToggle={() => onToggle(task.id)}
              onView={() => onView(task)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export { TaskList };
