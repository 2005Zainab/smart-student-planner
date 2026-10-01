import express from "express";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";
import { getPriorityFromDueDate } from "../lib/recurrence.js";
import { getUserToday } from "../lib/userTime.js";
import { validateTaskFields } from "../lib/taskValidation.js";

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
    const tasksRef = db.collection("tasks");

    const snapshot = await tasksRef.where("userId", "==", uid).get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const tasks = [];

    snapshot.forEach(doc => {
      const task = {
        id: doc.id,
        ...doc.data(),
      };

      //Recalculate priority when tasks load
      task.priority = getPriorityFromDueDate(task.dueDate, today);

      tasks.push(task);
    });

    return res.status(200).json(tasks);
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "Failed to fetch tasks",
    });
  }
});

export default router;
