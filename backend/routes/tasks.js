import express from "express";
import { db } from "../src/firebase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const ALLOWED_FIELDS = [
  "title",
  "description",
  "subject",
  "priority",
  "status",
  "dueDate",
  "time",
  "reminderDate",
  "reminderTime",
];

const ALLOWED_PRIORITIES = ["low", "medium", "high"];
const ALLOWED_STATUSES = ["to do", "in progress", "completed"];

const PRIORITY_DISPLAY = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const STATUS_DISPLAY = {
  "to do": "To Do",
  "in progress": "In Progress",
  completed: "Completed",
};

// Add task to Firestore
router.post("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  const {
    title,
    description = "",
    subject = "",
    priority = "Medium",
    status = "To Do",
    dueDate = null,
    time: rawTime = "",
    reminderDate = null,
    reminderTime: rawReminderTime = "",
  } = req.body;

  // safely trim the time input
  const time =
    typeof rawTime === "string" && rawTime.trim() !== ""
      ? rawTime.trim()
      : null;

  // safely trim the time input
  const reminderTime =
    typeof rawReminderTime === "string" && rawReminderTime.trim() !== ""
      ? rawReminderTime.trim()
      : null;

  // validate time
  if (time && (!/^\d{2}:\d{2}$/.test(time))) {
    return res.status(400).json({
      message: "Time must use HH:MM format",
    });
  }

  // validate reminder time
  if (reminderTime && (!/^\d{2}:\d{2}$/.test(reminderTime))) {
    return res.status(400).json({
      message: "Reminder time must use HH:MM format",
    });
  }

  // Title must be text
  if (typeof title !== "string") {
    return res.status(400).json({
      message: "Title has to be a string",
    });
  }

  // Title cannot be blank
  if (title.trim() === "") {
    return res.status(400).json({
      message: "Title cannot be empty or blank",
    });
  }

  // Title maximum length
  if (title.trim().length > 200) {
    return res.status(400).json({
      message: "Title cannot be more than 200 characters",
    });
  }

  // Description must be text
  if (typeof description !== "string") {
    return res.status(400).json({
      message: "Description must be text",
    });
  }

  if (description.length > 1000) {
    return res.status(400).json({
      message: "Description cannot be more than 1000 characters",
    });
  }

  // Subject must be text
  if (typeof subject !== "string") {
    return res.status(400).json({
      message: "Subject must be text",
    });
  }

  if (subject.length > 200) {
    return res.status(400).json({
      message: "Subject cannot be more than 200 characters",
    });
  }

  // Priority must be text before calling toLowerCase()
  if (typeof priority !== "string") {
    return res.status(400).json({
      message: "Priority must be text",
    });
  }

  const priorityLower = priority.trim().toLowerCase();

  if (!ALLOWED_PRIORITIES.includes(priorityLower)) {
    return res.status(400).json({
      message: "Not a valid priority",
    });
  }

  // Status must be text before calling toLowerCase()
  if (typeof status !== "string") {
    return res.status(400).json({
      message: "Status must be text",
    });
  }

  const statusLower = status.trim().toLowerCase();

  if (!ALLOWED_STATUSES.includes(statusLower)) {
    return res.status(400).json({
      message: "Not a valid status",
    });
  }

  // Validate due date
  if (
    dueDate &&
    (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
  ) {
    return res.status(400).json({
      message: "Due date must use YYYY-MM-DD format",
    });
  }

  try {
    const newTask = {
      title: title.trim(),
      description: description.trim(),
      subject: subject.trim(),
      priority: PRIORITY_DISPLAY[priorityLower],
      status: STATUS_DISPLAY[statusLower],
      dueDate,
      time,
      reminderDate,
      reminderTime,
      userId: uid,
    };

    const taskRef = await db.collection("tasks").add(newTask);

    res.status(201).json({
      id: taskRef.id,
      ...newTask,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
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

    res.status(200).json({
      message: "Task Deleted",
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Failed to Delete Task",
    });
  }
});

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

  // Not allowed blank/empty title
  if ("title" in updates) {
    if (typeof updates.title !== "string") {
      return res.status(400).json({
        message: "Title has to be a string",
      });
    }

    if (updates.title.trim() === "") {
      return res.status(400).json({
        message: "Title cannot be empty or blank",
      });
    }

    updates.title = updates.title.trim();

    if (updates.title.length > 200) {
      return res.status(400).json({
        message: "Title cannot be more than 200 characters",
      });
    }
  }

  // Description validation
  if ("description" in updates) {
    if (typeof updates.description !== "string") {
      return res.status(400).json({
        message: "Description must be text",
      });
    }

    updates.description = updates.description.trim();

    if (updates.description.length > 1000) {
      return res.status(400).json({
        message: "Description cannot be more than 1000 characters",
      });
    }
  }

  // Subject validation
  if ("subject" in updates) {
    if (typeof updates.subject !== "string") {
      return res.status(400).json({
        message: "Subject must be text",
      });
    }

    updates.subject = updates.subject.trim();

    if (updates.subject.length > 200) {
      return res.status(400).json({
        message: "Subject cannot be more than 200 characters",
      });
    }
  }

  // Priority validation
  if ("priority" in updates) {
    if (typeof updates.priority !== "string") {
      return res.status(400).json({
        message: "Priority must be text",
      });
    }

    const trimmedLower = updates.priority.trim().toLowerCase();

    if (!ALLOWED_PRIORITIES.includes(trimmedLower)) {
      return res.status(400).json({
        message: "Not a valid priority",
      });
    }

    updates.priority = PRIORITY_DISPLAY[trimmedLower];
  }

  // Status validation
  if ("status" in updates) {
    if (typeof updates.status !== "string") {
      return res.status(400).json({
        message: "Status must be text",
      });
    }

    const trimmedLower = updates.status.trim().toLowerCase();

    if (!ALLOWED_STATUSES.includes(trimmedLower)) {
      return res.status(400).json({
        message: "Not a valid status",
      });
    }

    updates.status = STATUS_DISPLAY[trimmedLower];
  }

  // Due date validation
  if ("dueDate" in updates) {
    if (
      typeof updates.dueDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(updates.dueDate)
    ) {
      return res.status(400).json({
        message: "Due date must use YYYY-MM-DD format Please",
      });
    }

    const dateParsed = new Date(updates.dueDate + "T00:00:00Z");

    if (isNaN(dateParsed.getTime())) {
      return res.status(400).json({
        message: "Not a valid due date",
      });
    }
  }

  // add time validation here:
  if ("time" in updates) {
    if (
      typeof updates.time !== "string" ||
      !/^\d{2}:\d{2}$/.test(updates.time)
    ) {
      return res.status(400).json({ message: "Time must use HH:MM format" });
    }
    const [hours, minutes] = updates.time.split(":").map(Number);
    if (
      isNaN(hours) ||
      isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return res.status(400).json({ message: "Not a valid time" });
    }
  }

    // Reminder date validation
    if ("reminderDate" in updates) {
        if (
            typeof updates.reminderDate !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(updates.reminderDate)
        ) {
            return res.status(400).json({
                message: "Reminder date must use YYYY-MM-DD format Please",
            });
        }

        const dateParsed = new Date(updates.reminderDate + "T00:00:00Z");

        if (isNaN(dateParsed.getTime())) {
            return res.status(400).json({
                message: "Not a valid reminder date",
            });
        }
    }

    // Reminder time validation 
    if ("reminderTime" in updates) {
        if (
            typeof updates.reminderTime !== "string" ||
            !/^\d{2}:\d{2}$/.test(updates.reminderTime)
        ) {
            return res.status(400).json({ message: "Time must use HH:MM format" });
        }
        const [hours, minutes] = updates.reminderTime.split(":").map(Number);
        if (
            isNaN(hours) ||
            isNaN(minutes) ||
            hours < 0 ||
            hours > 23 ||
            minutes < 0 ||
            minutes > 59
        ) {
            return res.status(400).json({ message: "Not a valid time" });
        }
    }

  try {
    // Fetch task first and check it exists and who owns it
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

    await taskDoc.update(updates);

    res.status(200).json({
      message: "Task Updated",
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Failed to Update Task",
    });
  }
});

// View all tasks
router.get("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  try {
    const tasksRef = db.collection("tasks");
    const snapshot = await tasksRef.where("userId", "==", uid).get();

    if (snapshot.empty) {
      return res.status(200).json({
        message: "No tasks found",
      });
    }

    const tasks = [];

    snapshot.forEach((doc) => {
      tasks.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    res.status(200).json(tasks);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Failed to fetch tasks",
    });
  }
});

export default router;
