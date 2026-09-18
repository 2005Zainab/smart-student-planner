import { useTasksContext } from "../features/tasks/context/TasksContext";
import { useReminders } from "../features/tasks/hooks/useReminders";

function GlobalReminders() {
    const { tasks, setTasks } = useTasksContext();
    useReminders(tasks, setTasks);

    return null;
}

export { GlobalReminders }; 