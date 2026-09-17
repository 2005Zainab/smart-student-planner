import { format } from "date-fns";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/shared/auth-provider";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import {
  getUpcomingTasks,
  getUndatedTasks,
  getWeeklySchedule,
} from "@/features/tasks/utils/task-date-utils";

function DashboardPage() {
  const { user } = useAuth();
  const { tasks, isLoading, error } = useTasks();
  const userName = user?.displayName ?? user?.email ?? "Student";
  const upcomingTasks = getUpcomingTasks(tasks);
  const undatedTasks = getUndatedTasks(tasks);
  const weeklySchedule = getWeeklySchedule(tasks);

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <section>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Good morning, {userName}
        </h2>
        <p className="mt-1 text-muted-foreground">
          Here is what is on your study plan today.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_1.35fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Tasks to Prioritize</CardTitle>
            <Link
              to="/tasks"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <Skeleton className="h-16 w-full" key={item} />
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">Unable to load tasks.</p>
            ) : upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming tasks in the next seven days.
              </p>
            ) : (
              upcomingTasks.map((task) => (
                <div
                  className="flex items-start gap-3 rounded-lg border p-3"
                  key={task.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.subject || "No subject"} ·{" "}
                      {format(task.parsedDateTime, "MMM d")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.daysUntilDue === 0
                        ? "Due today"
                        : `Due in ${task.daysUntilDue} days`}
                    </p>
                  </div>
                  <Badge
                    variant={
                      task.priority === "High"
                        ? "high"
                        : task.priority === "Medium"
                          ? "medium"
                          : task.priority === "Low"
                            ? "low"
                            : "secondary"
                    }
                  >
                    {task.priority}
                  </Badge>
                </div>
              ))
            )}
            {!isLoading && !error && undatedTasks.length > 0 && (
              <div className="border-t pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Without deadlines
                </p>
                {undatedTasks.map((task) => (
                  <div
                    className="flex items-start gap-3 rounded-lg border p-3"
                    key={task.id}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {task.subject || "No subject"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        task.priority === "High"
                          ? "high"
                          : task.priority === "Medium"
                            ? "medium"
                            : task.priority === "Low"
                              ? "low"
                              : "secondary"
                      }
                    >
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Weekly Schedule</CardTitle>
            <Link
              to="/schedule"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {weeklySchedule.map(({ label, tasks: dayTasks }) => (
              <div className="rounded-lg bg-muted/50 p-3" key={label}>
                <p className="text-sm font-medium">{label}</p>
                <div className="mt-3 space-y-2">
                  {dayTasks.length > 0 ? (
                    dayTasks.map((task) => (
                      <div key={task.id}>
                        <p className="text-xs font-medium leading-relaxed">
                          {task.title}
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {task.time
                            ? format(task.parsedDateTime, "h:mm a")
                            : "No time set"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No tasks</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export { DashboardPage };
