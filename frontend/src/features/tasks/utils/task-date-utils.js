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
 * Returns a Date object representing the task's due date.
 * If the task has no due date, returns null.
 *
 * @param {Object} task - The task object containing a dueDate property.
 * @returns {Date|null} - The Date object representing the task's due date, or null if no due date.
 */
function getTaskDate(task) {
  if (!task.dueDate) return null;

  const date = parseISO(task.dueDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Returns a Date object representing the task's due date and time.
 * If the task has no due date, returns null.
 * If the task has no time, returns the start of the day for the due date.
 *
 * @param {Object} task - The task object containing dueDate and time properties.
 * @returns {Date|null} - The Date object representing the task's due date and time, or null if no due date.
 */
function getTaskDateAndTime(task) {
  const taskDate = getTaskDate(task);
  if (!taskDate) return null;

  if (!task.time) return startOfDay(taskDate);

  const [hours, minutes] = task.time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;

  taskDate.setHours(hours, minutes, 0, 0);
  return taskDate;
}

/**
 * Checks if a task is incomplete (not completed).
 *
 * @param {Object} task - The task to check.
 * @returns {boolean} - True if the task is incomplete, false otherwise.
 */
function isIncomplete(task) {
  return task.status !== "Completed";
}

/**
 * Adds a parsed date and time to a task.
 *
 * @param {Object} task - The task to add the parsed date and time to.
 * @returns {Object} - The task with the parsed date and time.
 */
function withTaskDateTime(task) {
  return {
    ...task,
    parsedDateTime: getTaskDateAndTime(task),
  };
}

/**
 * Sorts tasks by their parsed date and time in ascending order.
 *
 * @param {Object} firstTask - The first task to compare.
 * @param {Object} secondTask - The second task to compare.
 * @returns {number} - A negative number if the first task is earlier, a positive number if later, or zero if equal.
 */
function sortByDateTime(firstTask, secondTask) {
  return firstTask.parsedDateTime - secondTask.parsedDateTime;
}

/**
 * Returns a list of upcoming tasks within the next 7 days from the reference date.
 *
 * @param {Array} tasks - The list of tasks to filter.
 * @param {Date} referenceDate - The reference date to determine the upcoming tasks (default is today).
 * @returns {Array} - The list of upcoming tasks with days until due.
 */
function getUpcomingTasks(tasks, referenceDate = new Date()) {
  const startDate = startOfDay(referenceDate);
  const endDate = endOfDay(addDays(startDate, 6));

  return tasks
    .filter((task) => isIncomplete(task) && getTaskDate(task))
    .map(withTaskDateTime)
    .filter(
      (task) =>
        task.parsedDateTime &&
        isWithinInterval(task.parsedDateTime, {
          start: startDate,
          end: endDate,
        }),
    )
    .map((task) => ({
      ...task,
      daysUntilDue: differenceInCalendarDays(
        startOfDay(task.parsedDateTime),
        startDate,
      ),
    }))
    .sort(sortByDateTime);
}

/**
 * Returns a weekly schedule of tasks, grouped by day.
 * @param {Array} tasks - The list of tasks to schedule.
 * @param {Date} referenceDate - The reference date to determine the week (default is today).
 * @returns {Array} - An array of objects representing each day of the week with its tasks.
 */
function getWeeklySchedule(tasks, referenceDate = new Date()) {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 0 });
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
    .filter((task) => isIncomplete(task) && getTaskDate(task))
    .map(withTaskDateTime)
    .filter(
      (task) =>
        task.parsedDateTime &&
        isWithinInterval(task.parsedDateTime, {
          start: weekStart,
          end: weekEnd,
        }),
    )
    .sort(sortByDateTime)
    .forEach((task) => {
      const dayIndex = differenceInCalendarDays(
        startOfDay(task.parsedDateTime),
        startOfDay(weekStart),
      );

      weekDays[dayIndex].tasks.push(task);
    });

  return weekDays;
}

/**
 * Returns a list of tasks that are incomplete and do not have a due date.
 *
 * @param {Array} tasks - The list of tasks to filter.
 * @returns {Array} - The list of undated tasks.
 */
function getUndatedTasks(tasks) {
  return tasks.filter((task) => isIncomplete(task) && !task.dueDate);
}

export {
  getTaskDateAndTime,
  getUpcomingTasks,
  getUndatedTasks,
  getWeeklySchedule,
};
