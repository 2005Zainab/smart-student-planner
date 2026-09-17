import { useEffect } from "react";
import { useTasks } from "../features/tasks/hooks/useTasks";
import { useReminders } from "../features/tasks/hooks/useReminders";

function GlobalReminders() {
    const { tasks, refetch } = useTasks();
    useReminders(tasks);

    useEffect(() => {
        const intervalId = setInterval(refetch, 30000);
        return () => clearInterval(intervalId);
    }, [refetch]);

    return null;
}

export { GlobalReminders };