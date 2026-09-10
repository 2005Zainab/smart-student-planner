import { Route } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { TasksPage } from "@/features/tasks/components/TasksPage";
import { CalendarPage } from "@/features/calendar/components/CalendarPage";

function ProtectedRoutes() {
  return (
    <Route element={<AppShell />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/calendar" element={<CalendarPage />} /><Route path="/calendar" element={<CalendarPage />} />
    </Route>
  );
}

export { ProtectedRoutes };
