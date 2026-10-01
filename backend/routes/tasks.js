import express from "express";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";
import {
  expandSeries,
  getNextOccurrence,
  getPriorityFromDueDate,
  shouldRenderMaterialized,
} from "../lib/recurrence.js";
import { getUserToday } from "../lib/userTime.js";
import { validateDate, validateTaskFields } from "../lib/taskValidation.js";

const router = express.Router();

const ALLOWED_FIELDS = [
  "title",
  "description",
  "subject",
  "status",
  "dueDate",
  "time",
  "checklist",
  "reminderDate",
  "reminderTime",
];

function offsetDate(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isDateInRange(dateStr, fromStr, toStr) {
  return dateStr >= fromStr && dateStr <= toStr;
}

function getVirtualOccurrence(series, date, today) {
  const isFuture = date >= today;
  const reminderOffsetDays = series.template.reminderOffsetDays;

  return {
    id: `${series.id}_${date}`,
    seriesId: series.id,
    occurrenceDate: date,
    ...series.template,
    virtual: true,
    dueDate: date,
    status: "to do",
    reminderDate:
      isFuture && reminderOffsetDays !== null && reminderOffsetDays !== undefined
        ? offsetDate(date, -reminderOffsetDays)
        : null,
    reminderTime: isFuture ? (series.template.reminderTime ?? null) : null,
    priority: getPriorityFromDueDate(date, today),
  };
}

function getMaterializedOccurrence(doc, today) {
  return {
    id: doc.id,
    ...doc.data,
    virtual: false,
    priority: getPriorityFromDueDate(doc.data.dueDate ?? doc.data.occurrenceDate, today),
  };
}

function readSeries(snapshot) {
  const series = [];
  if (typeof snapshot.forEach !== "function") return series;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (Array.isArray(data.segments) && data.segments.length > 0) {
      series.push({ id: doc.id, ...data });
    }
  });
  return series;
}

function forEachSnapshot(snapshot, callback) {
  if (typeof snapshot.forEach === "function") snapshot.forEach(callback);
}

//Add task
router.post("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  const fields = {
    title: req.body.title,
    description: req.body.description ?? "",
    subject: req.body.subject ?? "",
    status: req.body.status ?? "To Do",
    dueDate: req.body.dueDate ?? null,
    time: typeof req.body.time === "string" && req.body.time.trim() ? req.body.time.trim() : null,
    checklist: req.body.checklist ?? [],
    reminderDate: req.body.reminderDate ?? null,
    reminderTime:
      typeof req.body.reminderTime === "string" && req.body.reminderTime.trim()
        ? req.body.reminderTime.trim()
        : null,
  };
  const validation = validateTaskFields(fields);
  if (validation.message) return res.status(400).json({ message: validation.message });

  if (Boolean(fields.reminderDate) !== Boolean(fields.reminderTime)) {
    return res.status(400).json({ message: "Date and time is required to set a reminder." });
  }

  try {
    const today = await getUserToday(uid);
    const { clean } = validation;

    const newTask = {
      ...clean,
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

//Deletes tasks from Firestore using Express API route then updates local UI
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

    if (taskSnap.data().userId != uid) {
      return res.status(403).json({
        message: "Unauthorized to delete this task: You do not own this task",
      });
    }

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

//Edit task
router.patch("/:id", requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const updates = {};

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

  const validation = validateTaskFields(updates, { partial: true });
  if (validation.message) return res.status(400).json({ message: validation.message });
  Object.assign(updates, validation.clean);

  try {
    const taskDoc = db.collection("tasks").doc(req.params.id);

    const taskSnap = await taskDoc.get();

    if (!taskSnap.exists) {
      return res.status(404).json({
        message: "Task Wasn't Found",
      });
    }

    if (taskSnap.data().userId != uid) {
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

    if (Boolean(finalReminderDate) !== Boolean(finalReminderTime)) {
      return res.status(400).json({
        message: "Date and time is required to set a reminder.",
      });
    }

    if ("dueDate" in updates) {
      updates.priority = getPriorityFromDueDate(updates.dueDate, today);
    }

    await taskDoc.update(updates);

    //Get updated task so frontend gets new priority
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

//View all tasks
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
      const next = getNextOccurrence(series, offsetDate(today, 1));
      const candidateDates = new Set(missedAndToday);
      if (next) candidateDates.add(next);

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
            ? getMaterializedOccurrence(materializedDoc, today)
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

router.get("/calendar", requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ message: "from and to are required" });
  }

  const fromError = validateDate(from, "From date");
  const toError = validateDate(to, "To date");
  if (fromError || toError) {
    return res.status(400).json({ message: fromError || toError });
  }
  if (from > to) {
    return res.status(400).json({ message: "From date cannot be after to date" });
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
        materialized.set(`${data.seriesId}_${data.occurrenceDate}`, { id: doc.id, data });
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
            ? getMaterializedOccurrence(materializedDoc, today)
            : getVirtualOccurrence(series, date, today),
        );
      }

      for (const materializedDoc of materialized.values()) {
        if (
          materializedDoc.data.seriesId === series.id &&
          isDateInRange(materializedDoc.data.occurrenceDate, from, to) &&
          !scheduledDates.has(materializedDoc.data.occurrenceDate) &&
          shouldRenderMaterialized(materializedDoc.data, series, today)
        ) {
          occurrences.push(getMaterializedOccurrence(materializedDoc, today));
        }
      }
    }

    return res.status(200).json([...oneOffs, ...occurrences]);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Failed to fetch calendar tasks" });
  }
});

export default router;
