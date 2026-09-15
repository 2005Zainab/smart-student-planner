import { Route } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { TasksPage } from "@/features/tasks/components/TasksPage";
import { SchedulePage } from "@/features/schedule/components/SchedulePage";

function ProtectedRoutes() {
  return (
    <Route element={<RequireAuth />}>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/calendar" element={null} />
        <Route path="/schedule" element={<SchedulePage />} />
      </Route>
    </Route>
  );
}

export { ProtectedRoutes };
