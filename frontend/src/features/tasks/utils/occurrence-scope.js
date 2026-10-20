import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { getOccurrenceChanges, isOccurrence } from "./task-endpoints";

export const OCCURRENCE_CONTENT_FIELDS = new Set([
  "title",
  "description",
  "subject",
  "time",
  "checklist",
  "links",
  "reminderDate",
  "reminderTime",
]);

export const toNullableDateString = value =>
  value ? (value instanceof Date ? format(value, "yyyy-MM-dd") : value) : null;

export function getOccurrenceDraftChanges(draft, original) {
  return getOccurrenceChanges(
    {
      ...draft,
      reminderDate: toNullableDateString(draft.reminderDate),
      time: draft.time || null,
      reminderTime: draft.reminderTime || null,
      checklist: draft.checklist || [],
      links: draft.links || [],
    },
    original,
  );
}

export function getTemplateChanges(changes, draft, original) {
  const templateChanges = {};

  for (const field of ["title", "description", "subject", "time", "checklist", "links"]) {
    if (Object.hasOwn(changes, field)) {
      templateChanges[field] = field === "time" ? changes[field] || null : changes[field];
    }
  }

  // The series API requires both reminder fields whenever either is changed.
  if (Object.hasOwn(changes, "reminderDate") || Object.hasOwn(changes, "reminderTime")) {
    const reminderDate = toNullableDateString(draft.reminderDate);

    templateChanges.reminderOffsetDays = reminderDate
      ? differenceInCalendarDays(parseISO(original.occurrenceDate), parseISO(reminderDate))
      : null;
    templateChanges.reminderTime = reminderDate ? draft.reminderTime || null : null;
  }

  return templateChanges;
}

// True when a recurring occurrence has content changes and the user must pick a scope.
export function needsScopeChoice(original, draft) {
  if (!isOccurrence(original)) return false;

  const changedFields = Object.keys(getOccurrenceDraftChanges(draft, original));
  const contentOnly =
    changedFields.length > 0 && changedFields.every(field => OCCURRENCE_CONTENT_FIELDS.has(field));
  const toggleChanged =
    typeof draft.repeatEnabled === "boolean" && draft.repeatEnabled !== original.series?.enabled;

  return contentOnly && !toggleChanged;
}
