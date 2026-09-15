


const initialTasks = [
  {
    id: "JS3GV0ZXQvoilDUtpyjk",
    title: "Complete research outline",
    description: "Draft the thesis and supporting points.",
    subject: "History",
    priority: "High",
    status: "To Do",
  },
  {
    id: 2,
    title: "Review calculus exercises",
    description: "Work through the assigned problem set.",
    subject: "Mathematics",
    priority: "Medium",
    status: "In Progress",
  },
  {
    id: 3,
    title: "Read chapter 6",
    description: "Take notes on the key concepts.",
    subject: "Biology",
    priority: "Low",
    status: "Completed",
  },
];

function SchedulePage() {
  return (
    <main className="flex-1 space-y-6 p-4 pt-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <h2 className="text-2xl font-bold">Schedule</h2>
      </div>
    </main>
  );
}

export { SchedulePage };
