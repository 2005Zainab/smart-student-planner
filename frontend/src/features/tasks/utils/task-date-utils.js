import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

/**
 * Get the due date of a task.
 * Return null if the task has no valid due date.
 */
function getTaskDate(task) {
  if (!task.dueDate) return null;

  const date = parseISO(task.dueDate);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Get the date and time of a task.
 * If there is no time, use the start of the day.
 */
function getTaskDateAndTime(task) {
  const taskDate = getTaskDate(task);

  if (!taskDate) return null;

  if (!task.time) return startOfDay(taskDate);

  const [hours, minutes] = task.time.split(":").map(Number);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  taskDate.setHours(hours, minutes, 0, 0);

  return taskDate;
}

/**
 * Check if a task is not completed.
 */
function isIncomplete(task) {
  return task.status !== "Completed";
}

/**
 * Add the parsed date and time to a task.
 */
function withTaskDateTime(task) {
  return {
    ...task,
    parsedDateTime: getTaskDateAndTime(task),
  };
}

/**
 * Compare two tasks by date and time.
 * Earlier tasks will come first.
 */
function sortByDateTime(firstTask, secondTask) {
  return firstTask.parsedDateTime - secondTask.parsedDateTime;
}

/**
 * Get upcoming tasks for the next 7 days.
 */
function getUpcomingTasks(tasks, referenceDate = new Date()) {
  const startDate = startOfDay(referenceDate);
  const endDate = endOfDay(addDays(startDate, 6));

  return tasks
    .filter(task => isIncomplete(task) && getTaskDate(task))
    .map(withTaskDateTime)
    .filter(
      task =>
        task.parsedDateTime &&
        isWithinInterval(task.parsedDateTime, {
          start: startDate,
          end: endDate,
        }),
    )
    .map(task => ({
      ...task,
      daysUntilDue: differenceInCalendarDays(startOfDay(task.parsedDateTime), startDate),
    }))
    .sort(sortByDateTime);
}

/**
 * Get tasks that are overdue.
 */
function getOverDueTasks(tasks, referenceDate = new Date()) {
  const startDate = startOfDay(referenceDate);

  return tasks
    .filter(
      task => isIncomplete(task) && differenceInCalendarDays(getTaskDate(task), startDate) < 0,
    )
    .map(withTaskDateTime)
    .filter(
      task =>
        task.parsedDateTime &&
        isWithinInterval(task.parsedDateTime, {
          start: new Date(0),
          end: startDate,
        }),
    )
    .map(task => ({
      ...task,
      daysUntilDue: differenceInCalendarDays(startOfDay(task.parsedDateTime), startDate),
    }))
    .sort(sortByDateTime);
}

/**
 * Get tasks for the current week.
 * Group the tasks by day.
 */
function getWeeklySchedule(tasks, referenceDate = new Date()) {
  const weekStart = startOfWeek(referenceDate, {
    weekStartsOn: 0,
  });

  const weekEnd = endOfDay(addDays(weekStart, 6));

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);

    return {
      date,
      label: format(date, "EEEE, MMM d"),
      tasks: [],
    };
  });

  tasks
    .filter(task => isIncomplete(task) && getTaskDate(task))
    .map(withTaskDateTime)
    .filter(
      task =>
        task.parsedDateTime &&
        isWithinInterval(task.parsedDateTime, {
          start: weekStart,
          end: weekEnd,
        }),
    )
    .sort(sortByDateTime)
    .forEach(task => {
      const dayIndex = differenceInCalendarDays(
        startOfDay(task.parsedDateTime),
        startOfDay(weekStart),
      );

      weekDays[dayIndex].tasks.push(task);
    });

  return weekDays;
}

/**
 * Get incomplete tasks that have no due date.
 */
function getUndatedTasks(tasks) {
  return tasks.filter(task => isIncomplete(task) && !task.dueDate);
}

/**
 * Get all tasks with valid dates for the Timeline.
 * Sort them from the earliest date to the latest date.
 *
 * Reuse the existing date functions instead of
 * writing the same sorting code in TimelinePage.
 */
function getTimelineTasks(tasks) {
  return tasks
    .map(withTaskDateTime)
    .filter(task => task.parsedDateTime !== null)
    .sort(sortByDateTime);
}

// Export functions so other parts of the app can use them.
export {
  getTaskDateAndTime,
  getUpcomingTasks,
  getOverDueTasks,
  getUndatedTasks,
  getWeeklySchedule,
  getTimelineTasks,
};
