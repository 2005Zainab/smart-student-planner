import { hasException } from "./exceptions.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_TYPES = new Set(["daily", "weekly", "monthly"]);

function parseDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

function dateToOrdinal(dateStr) {
  const { year, month, day } = parseDate(dateStr);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function ordinalToDate(ordinal) {
  let days = ordinal + 719468;
  const era = Math.floor((days >= 0 ? days : days - 146096) / 146097);
  const dayOfEra = days - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  let year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPart = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPart + 2) / 5) + 1;
  const month = monthPart + (monthPart < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(dateStr, days) {
  return ordinalToDate(dateToOrdinal(dateStr) + days);
}

function compareDates(first, second) {
  return first < second ? -1 : first > second ? 1 : 0;
}

function isoWeekday(dateStr) {
  const dayFromEpoch = dateToOrdinal(dateStr);
  return ((((dayFromEpoch + 3) % 7) + 7) % 7) + 1;
}

function daysInMonth(year, month) {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isInteger(value) {
  return Number.isInteger(value);
}

function validationError(message) {
  return { errors: [message] };
}

export function validateRule(rule) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return validationError("Rule must be an object");
  }

  if (!VALID_TYPES.has(rule.type)) {
    return validationError("Rule type must be daily, weekly, or monthly");
  }

  if (!isInteger(rule.interval) || rule.interval < 1 || rule.interval > 30) {
    return validationError("Rule interval must be an integer from 1 to 30");
  }

  if (rule.type === "daily") {
    return { clean: { type: "daily", interval: rule.interval } };
  }

  if (rule.type === "weekly") {
    if (
      !Array.isArray(rule.weekdays) ||
      rule.weekdays.length === 0 ||
      rule.weekdays.some(day => !isInteger(day) || day < 1 || day > 7) ||
      new Set(rule.weekdays).size !== rule.weekdays.length
    ) {
      return validationError("Weekly weekdays must be unique ISO weekdays from 1 to 7");
    }

    return {
      clean: {
        type: "weekly",
        interval: rule.interval,
        weekdays: [...rule.weekdays].sort((first, second) => first - second),
      },
    };
  }

  const hasMonthDay = Object.prototype.hasOwnProperty.call(rule, "monthDay");
  const hasLastDay = rule.useLastDayOfMonth === true;

  if (hasMonthDay === hasLastDay) {
    return validationError("Monthly rules need exactly one month-day mode");
  }

  if (hasMonthDay && (!isInteger(rule.monthDay) || rule.monthDay < 1 || rule.monthDay > 31)) {
    return validationError("Monthly monthDay must be an integer from 1 to 31");
  }

  return hasLastDay
    ? { clean: { type: "monthly", interval: rule.interval, useLastDayOfMonth: true } }
    : { clean: { type: "monthly", interval: rule.interval, monthDay: rule.monthDay } };
}

export function matchesRule(rule, anchorDateStr, dateStr) {
  if (compareDates(dateStr, anchorDateStr) < 0) {
    return false;
  }

  const dayDifference = dateToOrdinal(dateStr) - dateToOrdinal(anchorDateStr);

  if (rule.type === "daily") {
    return dayDifference % rule.interval === 0;
  }

  if (rule.type === "weekly") {
    // weekdays: ISO 1=Monday..7=Sunday. isoWeekday(d) returns a value in that same range.
    // weekStart(d)   = d minus ((isoWeekday(d) - 1)) days          // Monday of that week
    // anchorWeek     = weekStart(segment.from)
    // weekIndex(d)   = floor((weekStart(d) - anchorWeek) / 7 days)
    // matches        = weekdays.includes(isoWeekday(d)) && weekIndex(d) % interval === 0 && d >= segment.from
    const dateWeekStart = dateToOrdinal(dateStr) - (isoWeekday(dateStr) - 1);
    const anchorWeekStart = dateToOrdinal(anchorDateStr) - (isoWeekday(anchorDateStr) - 1);
    const weekIndex = Math.floor((dateWeekStart - anchorWeekStart) / 7);

    return rule.weekdays.includes(isoWeekday(dateStr)) && weekIndex % rule.interval === 0;
  }

  const date = parseDate(dateStr);
  const anchor = parseDate(anchorDateStr);
  const monthsBetween = (date.year - anchor.year) * 12 + (date.month - anchor.month);

  if (monthsBetween % rule.interval !== 0) {
    return false;
  }

  return rule.useLastDayOfMonth
    ? date.day === daysInMonth(date.year, date.month)
    : date.day === rule.monthDay;
}

export function expandSegment(segment, isSeedSegment, rangeFromStr, rangeToStr) {
  const from = compareDates(segment.from, rangeFromStr) > 0 ? segment.from : rangeFromStr;
  const segmentTo = segment.until ?? rangeToStr;
  const to = compareDates(segmentTo, rangeToStr) < 0 ? segmentTo : rangeToStr;

  if (compareDates(from, to) > 0) {
    return [];
  }

  const dates = [];
  for (let ordinal = dateToOrdinal(from); ordinal <= dateToOrdinal(to); ordinal += 1) {
    const date = ordinalToDate(ordinal);
    const isForcedSeed = isSeedSegment && date === segment.from;
    if (isForcedSeed || matchesRule(segment.rule, segment.from, date)) {
      dates.push(date);
    }
  }

  return dates;
}

function isDateInRange(dateStr, fromStr, toStr) {
  return compareDates(dateStr, fromStr) >= 0 && compareDates(dateStr, toStr) <= 0;
}

function isPaused(series, dateStr, rangeToStr) {
  return (series.pauses ?? []).some(pause =>
    isDateInRange(dateStr, pause.from, pause.until ?? rangeToStr),
  );
}

export function expandSeries(series, rangeFromStr, rangeToStr) {
  const clippedTo =
    series.endDate && compareDates(series.endDate, rangeToStr) < 0 ? series.endDate : rangeToStr;

  if (compareDates(rangeFromStr, clippedTo) > 0) {
    return [];
  }

  const dates = new Set();
  for (const [index, segment] of (series.segments ?? []).entries()) {
    for (const date of expandSegment(segment, index === 0, rangeFromStr, clippedTo)) {
      if (!isPaused(series, date, clippedTo) && !hasException(series, date)) {
        dates.add(date);
      }
    }
  }

  return [...dates].sort();
}

export function getNextOccurrence(series, afterDateStr) {
  const rangeFrom = addDays(afterDateStr, 1);
  const rangeTo = addDays(rangeFrom, 366 * 2 + 1);
  return expandSeries(series, rangeFrom, rangeTo)[0] ?? null;
}

export function shouldRenderMaterialized(doc, series, todayStr) {
  if (hasException(series, doc.occurrenceDate)) {
    return false;
  }

  if (compareDates(doc.occurrenceDate, todayStr) <= 0) {
    return true;
  }

  return doc.status === "completed";
}

export function getPriorityFromDueDate(dueDateStr, todayStr) {
  if (!dueDateStr) {
    return "Low";
  }

  const differenceInDays = dateToOrdinal(dueDateStr) - dateToOrdinal(todayStr);

  if (differenceInDays <= 3) {
    return "High";
  }

  if (differenceInDays <= 7) {
    return "Medium";
  }

  return "Low";
}
