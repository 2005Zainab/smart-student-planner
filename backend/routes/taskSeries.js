import express from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";
import { validateRule, getPriorityFromDueDate } from "../lib/recurrence.js";
import { getUserToday } from "../lib/userTime.js";
import { normalizeStatus, validateDate, validateTaskFields } from "../lib/taskValidation.js";

const router = express.Router();

function validateReminderFields(body) {
  const hasOffset = body.reminderOffsetDays !== undefined && body.reminderOffsetDays !== null;
  const hasTime =
    body.reminderTime !== undefined && body.reminderTime !== null && body.reminderTime !== "";

  if (hasOffset !== hasTime) {
    return { message: "Reminder offset and time must be set together" };
  }

  if (hasOffset && (!Number.isInteger(body.reminderOffsetDays) || body.reminderOffsetDays < 0)) {
    return { message: "Reminder offset days must be a non-negative integer" };
  }

  const reminderValidation = validateTaskFields(
    {
      title: "placeholder",
      description: "",
      subject: "",
      status: "to do",
      reminderTime: hasTime ? body.reminderTime : null,
    },
    { partial: false },
  );
  if (reminderValidation.message) {
    return { message: reminderValidation.message };
  }

  return {
    clean: {
      reminderOffsetDays: hasOffset ? body.reminderOffsetDays : null,
      reminderTime: hasTime ? reminderValidation.clean.reminderTime : null,
    },
  };
}

router.post("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const body = req.body;

  if (
    Object.prototype.hasOwnProperty.call(body, "status") &&
    normalizeStatus(body.status) !== "To Do"
  ) {
    return res.status(400).json({ message: "Recurring task status must be 'to do'" });
  }

  const taskValidation = validateTaskFields({
    title: body.title,
    description: body.description ?? "",
    subject: body.subject ?? "",
    status: "to do",
    dueDate: body.dueDate ?? null,
    time: typeof body.time === "string" && body.time.trim() ? body.time.trim() : null,
    checklist: body.checklist ?? [],
  });
  if (taskValidation.message) {
    return res.status(400).json({ message: taskValidation.message });
  }

  const { clean } = taskValidation;
  if (!clean.dueDate) {
    return res.status(400).json({ message: "Due date is required for recurring tasks" });
  }

  const ruleValidation = validateRule(body.rule);
  if (ruleValidation.errors) {
    return res.status(400).json({ message: ruleValidation.errors[0] });
  }

  const reminderValidation = validateReminderFields(body);
  if (reminderValidation.message) {
    return res.status(400).json({ message: reminderValidation.message });
  }

  let endDate = body.endDate ?? null;
  if (endDate !== null) {
    const endDateError = validateDate(endDate, "End date");
    if (endDateError) {
      return res.status(400).json({ message: endDateError });
    }
    if (endDate < clean.dueDate) {
      return res.status(400).json({ message: "End date cannot be before the due date" });
    }
  }

  try {
    const today = await getUserToday(uid);
    const templateChecklist = clean.checklist.map(item => ({ text: item.text }));
    const template = {
      title: clean.title,
      description: clean.description,
      subject: clean.subject,
      time: clean.time,
      checklist: templateChecklist,
      ...reminderValidation.clean,
    };
    const seriesDoc = {
      userId: uid,
      template,
      segments: [{ from: clean.dueDate, until: null, rule: ruleValidation.clean }],
      enabled: true,
      pauses: [],
      endDate,
      exceptions: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const seriesRef = await db.collection("task_series").add(seriesDoc);
    const firstOccurrence = {
      id: `${seriesRef.id}_${clean.dueDate}`,
      seriesId: seriesRef.id,
      occurrenceDate: clean.dueDate,
      virtual: true,
      ...template,
      dueDate: clean.dueDate,
      status: "To Do",
      priority: getPriorityFromDueDate(clean.dueDate, today),
    };

    return res.status(201).json({
      id: seriesRef.id,
      ...seriesDoc,
      firstOccurrence,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Failed to create task series" });
  }
});

export default router;
