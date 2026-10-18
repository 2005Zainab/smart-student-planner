import { ThemeProvider } from "@/theme/theme-provider";
import { AuthProvider } from "@/shared/auth-provider";
import { AiChatProvider } from "@/features/ai/context/AiChatContext";
import { TasksProvider } from "../features/tasks/context/TasksContext";
import { Toaster } from "@/components/ui/toast";

function Provider({ children }) {
  return (
    <AuthProvider>
      <AiChatProvider>
        <TasksProvider>
          <ThemeProvider>
            <Toaster>{children}</Toaster>
          </ThemeProvider>
        </TasksProvider>
      </AiChatProvider>
    </AuthProvider>
  );
}

export { Provider };
