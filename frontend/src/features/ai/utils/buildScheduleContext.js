const WINDOW_DAYS = 14;
const LOOKBACK_DAYS = 30;
const MAX_TASKS = 100;
const MAX_NOTE_LENGTH = 200;

// Local YYYY-MM-DD. Avoids toISOString(), which converts to UTC and can
// return yesterday's date for users ahead of UTC (e.g. New Zealand).
export function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function weekdayOf(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "long" });
}

function describeTask(task, today) {
  const due = `${weekdayOf(task.dueDate)} ${task.dueDate}${task.time ? ` at ${task.time}` : ""}`;
  const parts = [`[${task.priority ?? "No priority"}] ${task.title}`];

  if (task.subject) parts.push(`subject: ${task.subject}`);
  parts.push(task.dueDate < today ? `OVERDUE, was due ${due}` : `due ${due}`);
  parts.push(`status: ${task.status}`);
  if (task.series?.enabled) parts.push("recurring");

  const checklist = task.checklist ?? [];
  if (checklist.length > 0) {
    const remaining = checklist.filter(item => !item.completed);
    const progress = `checklist ${checklist.length - remaining.length}/${checklist.length} done`;
    parts.push(
      remaining.length > 0
        ? `${progress}, remaining: ${remaining.map(item => item.text).join(", ")}`
        : progress,
    );
  }

  if (task.description) {
    parts.push(`notes: ${task.description.slice(0, MAX_NOTE_LENGTH)}`);
  }

  return `- ${parts.join(" | ")}`;
}

/**
 * Builds a plain-text snapshot of the student's open tasks:
 * everything overdue plus everything due in the next `windowDays` days.
 */
export function buildScheduleContext(tasks, { now = new Date(), windowDays = WINDOW_DAYS } = {}) {
  const today = toLocalDateString(now);
  const windowEnd = toLocalDateString(addDays(now, windowDays));
  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const open = (tasks ?? [])
    .filter(task => task.dueDate && task.status !== "Completed" && task.dueDate <= windowEnd)
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
    });

  const shown = open.slice(0, MAX_TASKS);
  const lines = [
    `Current local date and time: ${weekdayOf(today)} ${today}, ${clock}`,
    `Window covered: overdue items, then ${today} through ${windowEnd}`,
    "",
    shown.length > 0
      ? `Open tasks (${shown.length}${open.length > shown.length ? ` of ${open.length}` : ""}):`
      : "Open tasks: none in this window.",
    ...shown.map(task => describeTask(task, today)),
  ];

  return lines.join("\n");
}

/**
 * Date range to request from /api/tasks/calendar: a month of lookback (so overdue
 * items are included) through the end of the planning window.
 */
export function getContextRange(now = new Date()) {
  return {
    from: toLocalDateString(addDays(now, -LOOKBACK_DAYS)),
    to: toLocalDateString(addDays(now, WINDOW_DAYS)),
  };
}

const SYSTEM_PROMPT = `You are the planning and study assistant inside Smart Student Planner. You help a student decide how to spend their time and suggest effective ways to study.

Rules:
- Base your schedule advice only on the task data below. Never invent tasks, deadlines or classes.
- When suggesting study sessions, briefly recommend evidence-based study methods (e.g., Pomodoro technique, active recall, spaced repetition, Feynman technique) tailored to the specific type of task (e.g., outlining for an essay, practice questions for an exam).
- Tasks have a due date and time but NO duration estimate. When you propose time blocks, state the duration you assumed and say it is an estimate the student can adjust. Ask how long something takes if the answer would change the plan.
- Prioritise overdue items first, then nearest deadline, then priority (High before Medium before Low).
- Recurring tasks (daily routines, sleep) are fixed commitments. Plan around them; do not suggest skipping them.
- Be concise: short lists and concrete times where possible.
- If asked about something outside the data window or unrelated to planning, time management, or study methods, say so briefly instead of guessing.
- Reply in Markdown.`;

export function buildSystemInstruction(tasks, options) {
  return `${SYSTEM_PROMPT}\n\n--- STUDENT'S TASK DATA ---\n${buildScheduleContext(tasks, options)}`;
}
