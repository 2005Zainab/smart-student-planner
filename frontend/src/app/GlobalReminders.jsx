import { useTasks } from "../features/tasks/hooks/useTasks";
import { useReminders } from "../features/tasks/hooks/useReminders";

function GlobalReminders() {
	const { tasks } = useTasks();
	useReminders(tasks);
	return null;
}

export { GlobalReminders };