import { format } from 'date-fns';

// Formats a date value to a string in the format "yyyy-MM-dd".
// If the value is null or undefined, it returns null.
// If the value is a Date object, it formats it accordingly; otherwise, it assumes the value is already a string and returns it as is.
function formatDate(value) {
  if (!value) return null;
  return value instanceof Date ? format(value, 'yyyy-MM-dd') : value;
}

// TaskDraft is an object representing a task draft with properties like
// title, description, subject, dueDate, time, checklist, status, reminderDate, reminderTime, and recurrence
// Centralizes the logic for building the request payload for creating a task, whether it's a one-time task or part of a recurring series.
// It returns an object containing the URL, request body, and a flag indicating if it's a recurring task.
export function buildCreateTaskRequest(draft) {
  const dueDate = formatDate(draft.dueDate);
  const common = {
    title: draft.title,
    description: draft.description || '',
    subject: draft.subject || '',
    dueDate,
    time: draft.time || null,
    checklist: draft.checklist || [],
  };

  // If the draft has a recurrence property, it indicates that the task is part of a recurring series. In this case, the request will be sent to the task-series endpoint with additional properties like rule, endDate, reminderOffsetDays, and reminderTime.
  if (draft.recurrence) {
    return {
      url: 'http://localhost:3000/api/task-series',
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

  // If the draft does not have a recurrence property, it indicates that the task is a one-time task. In this case, the request will be sent to the tasks endpoint with properties like status, reminderDate, and reminderTime.
  return {
    url: 'http://localhost:3000/api/tasks',
    body: {
      ...common,
      status: draft.status,
      reminderDate: formatDate(draft.reminderDate),
      reminderTime: draft.reminderTime || null,
    },
    recurring: false,
  };
}
