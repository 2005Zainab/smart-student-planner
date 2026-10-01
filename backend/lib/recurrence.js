function dateToUtc(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function getPriorityFromDueDate(dueDateStr, todayStr) {
  if (!dueDateStr) {
    return "Low";
  }

  const differenceInDays = (dateToUtc(dueDateStr) - dateToUtc(todayStr)) / (1000 * 60 * 60 * 24);

  if (differenceInDays <= 3) {
    return "High";
  }

  if (differenceInDays <= 7) {
    return "Medium";
  }

  return "Low";
}
