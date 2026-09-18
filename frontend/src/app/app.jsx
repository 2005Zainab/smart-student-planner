import { Provider } from "./provider";
import { Router } from "./router";
import { GlobalReminders } from "./GlobalReminders";
import { TasksProvider } from "../features/tasks/context/TasksContext";

function App() {
    return (
        <Provider>
            <TasksProvider>
                <GlobalReminders />
                <Router />
            </TasksProvider>
        </Provider>
    );
}

export { App };