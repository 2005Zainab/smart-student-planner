import { createContext, useContext } from "react";
import { useTasks } from "../hooks/useTasks";

const TasksContext = createContext(null);

function TasksProvider({ children }) {
    const tasksData = useTasks();

    return (
        <TasksContext.Provider value={tasksData}>
            {children}
        </TasksContext.Provider>
    );
}

function useTasksContext() {
    const context = useContext(TasksContext);
    if (!context) {
        throw new Error("useTasksContext must be used inside a TasksProvider");
    }
    return context;
}

export { TasksProvider, useTasksContext };