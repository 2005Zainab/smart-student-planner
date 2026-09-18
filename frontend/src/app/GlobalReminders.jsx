import { useTasksContext } from "../features/tasks/context/TasksContext";
import { useReminders } from "../features/tasks/hooks/useReminders";

function GlobalReminders() {
    const { tasks } = useTasksContext();
    useReminders(tasks);

    return null;
}

export { GlobalReminders }; 