import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

const initialTasks = [
  {
    id: 1,
    title: "Complete research outline",
    course: "History",
    priority: "High",
  },
  {
    id: 2,
    title: "Review calculus exercises",
    course: "Mathematics",
    priority: "Medium",
  },
  { id: 3, title: "Read chapter 6", course: "Biology", priority: "Low" },
];

const schedule = [
  { day: "Monday", items: ["Calculus · 10:00 AM", "Study group · 4:00 PM"] },
  { day: "Tuesday", items: ["History · 9:00 AM"] },
  {
    day: "Wednesday",
    items: ["Biology · 11:00 AM", "Library session · 2:00 PM"],
  },
  { day: "Thursday", items: ["Calculus · 10:00 AM"] },
  { day: "Friday", items: ["Project review · 1:00 PM"] },
];

function DashboardPage() {
  const [tasks, setTasks] = useState(initialTasks);

  function toggleTask(taskId) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    );
  }

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <section>
        <p className="text-sm text-muted-foreground">Monday, September 7</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Good morning, Smith
        </h2>
        <p className="mt-1 text-muted-foreground">
          Here is what is on your study plan today.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_1.35fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Tasks to Prioritize</CardTitle>
            <Button render={<Link to="/tasks" />} size="sm" variant="outline">
              View all
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.map((task) => (
              <div
                className="flex items-start gap-3 rounded-lg border p-3"
                key={task.id}
              >
                <Checkbox
                  aria-label={`Mark ${task.title} complete`}
                  checked={task.completed}
                  onCheckedChange={() => toggleTask(task.id)}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      task.completed
                        ? "text-sm text-muted-foreground line-through"
                        : "text-sm font-medium"
                    }
                  >
                    {task.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.course}
                  </p>
                </div>
                <Badge
                  variant={
                    task.priority === "High" ? "destructive" : "secondary"
                  }
                >
                  {task.priority}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Weekly Schedule</CardTitle>
            <Button
              render={<Link to="/calendar" />}
              size="sm"
              variant="outline"
            >
              View calendar
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {schedule.map(({ day, items }) => (
              <div className="rounded-lg bg-muted/50 p-3" key={day}>
                <p className="text-sm font-medium">{day}</p>
                <div className="mt-3 space-y-2">
                  {items.map((item) => (
                    <p
                      className="text-xs leading-relaxed text-muted-foreground"
                      key={item}
                    >
                      {item}
                    </p>
                  ))}
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
