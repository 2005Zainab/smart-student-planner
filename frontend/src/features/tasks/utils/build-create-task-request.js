import { format } from "date-fns";

// Convert the date into YYYY-MM-DD format
function formatDate(value) {
  if (!value) return null;

  return value instanceof Date ? format(value, "yyyy-MM-dd") : value;
}

// Build the request when a user creates a task
export function buildCreateTaskRequest(draft) {
  const dueDate = formatDate(draft.dueDate);

  // Fields shared by normal and recurring tasks
  const common = {
    title: draft.title,
    description: draft.description || "",
    subject: draft.subject || "",
    dueDate,
    time: draft.time || null,
    checklist: draft.checklist || [],
    links: draft.links || [],
  };

  // Create a recurring task
  if (draft.recurrence) {
    return {
      url: "http://localhost:3000/api/task-series",
      body: {
        ...common,
        rule: draft.recurrence.rule,
        endDate: formatDate(draft.recurrence.endDate),
        reminderOffsetDays: draft.recurrence.reminderOffsetDays ?? null,
        reminderTime: draft.recurrence.reminderTime || null,
      },
      recurring: true,
    };
  }

  // Create a normal task with an optional focus timer
  return {
    url: "http://localhost:3000/api/tasks",
    body: {
      ...common,
      status: draft.status,
      reminderDate: formatDate(draft.reminderDate),
      reminderTime: draft.reminderTime || null,
      timerMinutes: draft.timerMinutes ?? null,
    },
    recurring: false,
  };
}
