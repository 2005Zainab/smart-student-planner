import express from "express";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";
import {
  expandSeries,
  getNextOccurrence,
  getPriorityFromDueDate,
  shouldRenderMaterialized,
  isDateInRange,
} from "../lib/recurrence.js";
import { getUserToday } from "../lib/userTime.js";
import { validateDate, validateTaskFields } from "../lib/taskValidation.js";
import {
  forEachSnapshot,
  readSeries,
  getVirtualOccurrence,
  getMaterializedOccurrence,
} from "../lib/taskSeriesHelper.js";

const router = express.Router();

const ALLOWED_FIELDS = [
  "title",
  "description",
  "subject",
  "label",
  "status",
  "dueDate",
  "time",
  "checklist",
  "reminderDate",
  "reminderTime",
  "links",
  "timerMinutes",
];

// Create a new task
router.post("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  const fields = {
    title: req.body.title,
    description: req.body.description ?? "",
    subject: req.body.subject ?? "",
    label: req.body.label ?? "",
    status: req.body.status ?? "To Do",
    dueDate: req.body.dueDate ?? null,
    time: typeof req.body.time === "string" && req.body.time.trim() ? req.body.time.trim() : null,
    checklist: req.body.checklist ?? [],
    reminderDate: req.body.reminderDate ?? null,
    reminderTime:
      typeof req.body.reminderTime === "string" && req.body.reminderTime.trim()
        ? req.body.reminderTime.trim()
        : null,
    links: req.body.links ?? [],
    timerMinutes: req.body.timerMinutes ?? null,
  };

  // Validate Task Labels
  if (typeof fields.label !== "string" || fields.label.trim().length > 100) {
    return res.status(400).json({
      message: "Label must be text under 100 characters",
    });
  }

  // Validate task fields, including the Focus Timer
  const validation = validateTaskFields(fields);

  if (validation.message) {
    return res.status(400).json({
      message: validation.message,
    });
  }

  // A reminder requires both date and time
  if (Boolean(fields.reminderDate) !== Boolean(fields.reminderTime)) {
    return res.status(400).json({
      message: "Date and time is required to set a reminder.",
    });
  }

  try {
    const today = await getUserToday(uid);
    const { clean } = validation;

    const newTask = {
      ...clean,
      label: fields.label.trim(),
      timerMinutes: clean.timerMinutes ?? null,
      priority: getPriorityFromDueDate(clean.dueDate, today),
      userId: uid,
    };

    const taskRef = await db.collection("tasks").add(newTask);

    return res.status(201).json({
      id: taskRef.id,
      ...newTask,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "Failed to create task",
    });
  }
});

// Delete an existing task
router.delete("/:id", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  try {
    const taskDoc = db.collection("tasks").doc(req.params.id);
    const taskSnap = await taskDoc.get();

    if (!taskSnap.exists) {
      return res.status(404).json({
        message: "Task Wasn't Found",
      });
    }

    if (taskSnap.data().userId !== uid) {
      return res.status(403).json({
        message: "Unauthorized to delete this task: You do not own this task",
      });
    }

    // Recurring tasks use the task-series endpoint
    if (taskSnap.data().seriesId) {
      return res.status(400).json({
        message: "Recurring occurrences must be deleted through the task-series endpoint",
      });
    }

    // Remove related uploaded files
    const files = taskSnap.data().files ?? [];

    await Promise.all(files.map(file => db.collection("taskFiles").doc(file.id).delete()));

    await taskDoc.delete();

    return res.status(200).json({
      message: "Task Deleted",
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "Failed to Delete Task",
    });
  }
});

// Edit an existing task
router.patch("/:id", requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const updates = {};

  // Only accept allowed task fields
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      updates[key] = req.body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      message: "No valid fields updated",
    });
  }

  // Validate changes to Task Labels
  if (
    Object.hasOwn(updates, "label") &&
    (typeof updates.label !== "string" || updates.label.trim().length > 100)
  ) {
    return res.status(400).json({
      message: "Label must be text under 100 characters",
    });
  }

  if (Object.hasOwn(updates, "label")) {
    updates.label = updates.label.trim();
  }

  // Validate updated fields, including timerMinutes
  const validation = validateTaskFields(updates, {
    partial: true,
  });

  if (validation.message) {
    return res.status(400).json({
      message: validation.message,
    });
  }

  Object.assign(updates, validation.clean);

  try {
    const taskDoc = db.collection("tasks").doc(req.params.id);
    const taskSnap = await taskDoc.get();

    if (!taskSnap.exists) {
      return res.status(404).json({
        message: "Task Wasn't Found",
      });
    }

    if (taskSnap.data().userId !== uid) {
      return res.status(403).json({
        message: "Unauthorized to edit this task: You do not own this task",
      });
    }

    const existingData = taskSnap.data();
    const today = await getUserToday(uid);

    const finalReminderDate =
      "reminderDate" in updates ? updates.reminderDate : existingData.reminderDate;

    const finalReminderTime =
      "reminderTime" in updates ? updates.reminderTime : existingData.reminderTime;

    // Keep reminder date and time consistent
    if (Boolean(finalReminderDate) !== Boolean(finalReminderTime)) {
      return res.status(400).json({
        message: "Date and time is required to set a reminder.",
      });
    }

    // Automatically recalculate priority
    if ("dueDate" in updates) {
      updates.priority = getPriorityFromDueDate(updates.dueDate, today);
    }

    await taskDoc.update(updates);

    // Return the updated task
    const updatedSnap = await taskDoc.get();

    return res.status(200).json({
      id: updatedSnap.id,
      ...updatedSnap.data(),
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "Failed to Update Task",
    });
  }
});

// Get all tasks, including recurring occurrences
router.get("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  try {
    const today = await getUserToday(uid);

    const [taskSnapshot, seriesSnapshot] = await Promise.all([
      db.collection("tasks").where("userId", "==", uid).get(),
      db.collection("task_series").where("userId", "==", uid).get(),
    ]);

    const oneOffs = [];
    const materialized = new Map();

    forEachSnapshot(taskSnapshot, doc => {
      const data = doc.data();

      if (data.seriesId && data.occurrenceDate) {
        materialized.set(`${data.seriesId}_${data.occurrenceDate}`, {
          id: doc.id,
          data,
        });
      } else {
        oneOffs.push({
          id: doc.id,
          ...data,
          priority: getPriorityFromDueDate(data.dueDate, today),
        });
      }
    });

    const occurrences = [];

    for (const series of readSeries(seriesSnapshot)) {
      const missedAndToday = expandSeries(series, series.segments[0].from, today);

      const next = getNextOccurrence(series, today);
      const candidateDates = new Set(missedAndToday);

      if (next) {
        candidateDates.add(next);
      }

      // Include materialized recurring tasks that should appear
      for (const doc of materialized.values()) {
        if (doc.data.seriesId === series.id && shouldRenderMaterialized(doc.data, series, today)) {
          candidateDates.add(doc.data.occurrenceDate);
        }

        if (
          doc.data.seriesId === series.id &&
          expandSeries(series, doc.data.occurrenceDate, doc.data.occurrenceDate).length
        ) {
          candidateDates.add(doc.data.occurrenceDate);
        }
      }

      for (const date of [...candidateDates].sort()) {
        const materializedDoc = materialized.get(`${series.id}_${date}`);

        occurrences.push(
          materializedDoc
            ? getMaterializedOccurrence(materializedDoc, series, today)
            : getVirtualOccurrence(series, date, today),
        );
      }
    }

    return res.status(200).json([...oneOffs, ...occurrences]);
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "Failed to fetch tasks",
    });
  }
});

// Get calendar tasks for a date range
router.get("/calendar", requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({
      message: "from and to are required",
    });
  }

  const fromError = validateDate(from, "From date");
  const toError = validateDate(to, "To date");

  if (fromError || toError) {
    return res.status(400).json({
      message: fromError || toError,
    });
  }

  if (from > to) {
    return res.status(400).json({
      message: "From date cannot be after to date",
    });
  }

  try {
    const today = await getUserToday(uid);

    const [taskSnapshot, seriesSnapshot] = await Promise.all([
      db.collection("tasks").where("userId", "==", uid).get(),
      db.collection("task_series").where("userId", "==", uid).get(),
    ]);

    const oneOffs = [];
    const materialized = new Map();

    forEachSnapshot(taskSnapshot, doc => {
      const data = doc.data();

      if (data.seriesId && data.occurrenceDate) {
        materialized.set(`${data.seriesId}_${data.occurrenceDate}`, {
          id: doc.id,
          data,
        });
      } else if (data.dueDate && isDateInRange(data.dueDate, from, to)) {
        oneOffs.push({
          id: doc.id,
          ...data,
          priority: getPriorityFromDueDate(data.dueDate, today),
        });
      }
    });

    const occurrences = [];

    for (const series of readSeries(seriesSnapshot)) {
      const scheduledDates = new Set(expandSeries(series, from, to));

      for (const date of scheduledDates) {
        const materializedDoc = materialized.get(`${series.id}_${date}`);

        occurrences.push(
          materializedDoc
            ? getMaterializedOccurrence(materializedDoc, series, today)
            : getVirtualOccurrence(series, date, today),
        );
      }

      // Include materialized recurring tasks within the range
      for (const materializedDoc of materialized.values()) {
        if (
          materializedDoc.data.seriesId === series.id &&
          isDateInRange(materializedDoc.data.occurrenceDate, from, to) &&
          !scheduledDates.has(materializedDoc.data.occurrenceDate) &&
          shouldRenderMaterialized(materializedDoc.data, series, today)
        ) {
          occurrences.push(getMaterializedOccurrence(materializedDoc, series, today));
        }
      }
    }

    return res.status(200).json([...oneOffs, ...occurrences]);
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "Failed to fetch calendar tasks",
    });
  }
});

export default router;
