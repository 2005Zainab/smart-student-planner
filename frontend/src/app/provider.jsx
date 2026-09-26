import { ThemeProvider } from '@/theme/theme-provider';
import { AuthProvider } from '@/shared/auth-provider';
import { TasksProvider } from '../features/tasks/context/TasksContext';
import { Toaster } from '@/components/ui/toast';

function Provider({ children }) {
  return (
    <AuthProvider>
      <TasksProvider>
        <ThemeProvider>
          <Toaster>{children}</Toaster>
        </ThemeProvider>
      </TasksProvider>
    </AuthProvider>
  );
}

export { Provider };
