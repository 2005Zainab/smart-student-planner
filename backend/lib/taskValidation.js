import { randomUUID } from "crypto";

export const ALLOWED_STATUSES = ["to do", "in progress", "completed"];

export const STATUS_DISPLAY = {
  "to do": "To Do",
  "in progress": "In Progress",
  completed: "Completed",
};

const MAX_LINKS = 10;
const MAX_LINK_LENGTH = 500;

export function normalizeStatus(status) {
  if (typeof status !== "string") return null;
  return STATUS_DISPLAY[status.trim().toLowerCase()] ?? null;
}

export function validateDate(value, fieldName) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${fieldName} must use YYYY-MM-DD format`;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return `Not a valid ${fieldName.toLowerCase()}`;
  }

  return null;
}

function validateTime(value, fieldName) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return `${fieldName} must use HH:MM format`;
  }

  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) {
    return `Not a valid ${fieldName.toLowerCase()}`;
  }

  return null;
}

export function validateChecklist(checklist) {
  if (!Array.isArray(checklist)) {
    return { message: "Checklist must be an Array" };
  }

  if (checklist.length > 10) {
    return { message: "Too many subtasks added. Max is 10" };
  }

  const cleanChecklist = [];
  const seenIds = new Set();

  for (const item of checklist) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { message: "Each checklist item has to be an Object" };
    }

    if (typeof item.text !== "string" || item.text.trim() === "") {
      return { message: "Checklist item must be text and not empty/blank" };
    }

    if (item.text.trim().length > 100) {
      return { message: "Checklist item cannot be more than 100 characters" };
    }

    let id;
    if (item.id === undefined || item.id === null || item.id === "") {
      id = randomUUID();
    } else if (typeof item.id !== "string" || item.id.length > 100) {
      return { message: "Checklist item id must be a string under 100 characters" };
    } else {
      id = item.id;
    }

    if (seenIds.has(id)) {
      return { message: "Checklist item ids must be unique" };
    }
    seenIds.add(id);

    if (item.completed !== undefined && typeof item.completed !== "boolean") {
      return { message: "Checklist item 'completed' must be a boolean" };
    }

    cleanChecklist.push({
      id,
      text: item.text.trim(),
      completed: item.completed === true,
    });
  }

  return { cleanChecklist };
}

//Validates links: Text only, allows valid http/https URL within the length and count limits
export function validateLinks(links) {
  if (!Array.isArray(links)) {
    return { message: "Links must be an Array" };
  }

  if (links.length > MAX_LINKS) {
    return { message: `Too many links added. Max is ${MAX_LINKS}` };
  }

  const cleanLinks = [];

  for (const link of links) {
    if (typeof link !== "string") {
      return { message: "Invalid data type. Links must be a string" };
    }

    //Holds the links after trimming whitespace. Only clean list is saved
    const trimmed = link.trim();

    if (trimmed === "") {
      return { message: "Link field can't be empty" };
    }

    if (trimmed.length > MAX_LINK_LENGTH) {
      return { message: `Max link length is ${MAX_LINK_LENGTH} characters` };
    }

    let url;
    try {
      url = new URL(trimmed);
    } catch {
      return { message: "Link must be a valid URL" };
    }

    //Only allows standard link formats http and https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { message: "Link must start with http:// or https://" };
    }

    cleanLinks.push(trimmed);
  }
  return { cleanLinks };
}

export function validateTaskFields(fields, { partial = false } = {}) {
  const clean = {};

  if (!partial || Object.prototype.hasOwnProperty.call(fields, "title")) {
    if (typeof fields.title !== "string") return { message: "Title has to be a string" };
    clean.title = fields.title.trim();
    if (!clean.title) return { message: "Title cannot be empty or blank" };
    if (clean.title.length > 200) {
      return { message: "Title cannot be more than 200 characters" };
    }
  }

  for (const [field, label, maxLength] of [
    ["description", "Description", 1000],
    ["subject", "Subject", 200],
  ]) {
    if (!partial || Object.prototype.hasOwnProperty.call(fields, field)) {
      if (typeof fields[field] !== "string") return { message: `${label} must be text` };
      clean[field] = fields[field].trim();
      if (clean[field].length > maxLength) {
        return { message: `${label} cannot be more than ${maxLength} characters` };
      }
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(fields, "status")) {
    if (typeof fields.status !== "string") return { message: "Status must be text" };
    const normalizedStatus = normalizeStatus(fields.status);
    if (!normalizedStatus) return { message: "Not a valid status" };
    clean.status = normalizedStatus;
  }

  for (const field of ["dueDate", "reminderDate"]) {
    if (!partial || Object.prototype.hasOwnProperty.call(fields, field)) {
      const value = fields[field] ?? null;
      const error = validateDate(value, field === "dueDate" ? "Due date" : "Reminder date");
      if (error) return { message: error };
      clean[field] = value;
    }
  }

  for (const field of ["time", "reminderTime"]) {
    if (!partial || Object.prototype.hasOwnProperty.call(fields, field)) {
      const value = fields[field] ?? null;
      const error = validateTime(value, field === "time" ? "Time" : "Reminder time");
      if (error) return { message: error };
      clean[field] = value;
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(fields, "checklist")) {
    const checklistResult = validateChecklist(fields.checklist ?? []);
    if (checklistResult.message) return checklistResult;
    clean.checklist = checklistResult.cleanChecklist;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(fields, "links")) {
    const linksResult = validateLinks(fields.links ?? []);
    if (linksResult.message) return linksResult;
    clean.links = linksResult.cleanLinks;
  }

  return { clean };
}
