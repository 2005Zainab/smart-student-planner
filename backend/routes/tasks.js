import express from "express";
import { db } from "../src/firebase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const ALLOWED_FIELDS = [
  "title",
  "description",
  "subject",
  "label",
  "priority",
  "status",
  "dueDate",
  "time",
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

// Automatically sets priority based on deadline
function getPriorityFromDueDate(dueDate) {
  if (!dueDate) return "Medium";

  const today = new Date();
  const due = new Date(dueDate + "T00:00:00");

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const differenceInTime = due.getTime() - today.getTime();

  const daysUntilDue = Math.ceil(
    differenceInTime / (1000 * 60 * 60 * 24),
  );

  if (daysUntilDue <= 3) {
    return "High";
  }

  if (daysUntilDue <= 7) {
    return "Medium";
  }

  return "Low";
}

//Add task to Firestore
router.post("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  const {
    title,
    description = "",
    subject = "",
    label = "",
    priority = "Medium",
    status = "To Do",
    dueDate = null,
    time: rawTime = "",
  } = req.body;

  const time =
    typeof rawTime === "string" && rawTime.trim() !== ""
      ? rawTime.trim()
      : null;

  //Check time
  if (time && !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({
      message: "Time must use HH:MM format",
    });
  }

  if (time) {
    const [hours, minutes] = time.split(":").map(Number);

    if (
      isNaN(hours) ||
      isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return res.status(400).json({
        message: "Not a valid time",
      });
    }
  }

  //Check title
  if (typeof title !== "string") {
    return res.status(400).json({
      message: "Title has to be a string",
    });
  }

  if (title.trim() === "") {
    return res.status(400).json({
      message: "Title cannot be empty or blank",
    });
  }

  if (title.trim().length > 200) {
    return res.status(400).json({
      message: "Title cannot be more than 200 characters",
    });
  }

  //Check description
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

  //Check subject
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

  //Check label
  if (typeof label !== "string") {
    return res.status(400).json({
      message: "Label must be text",
    });
  }

  if (label.length > 100) {
    return res.status(400).json({
      message: "Label cannot be more than 100 characters",
    });
  }

  //Check priority
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

  //Check status
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

  //Check due date
  if (
    dueDate &&
    (typeof dueDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
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
      label: label.trim(),
      priority: getPriorityFromDueDate(dueDate),
      status: STATUS_DISPLAY[statusLower],
      dueDate,
      time,
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
        message:
          "Unauthorized to delete this task: You do not own this task",
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

  //Check title
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

  //Check description
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

  //Check subject
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

  //Check label
  if ("label" in updates) {
    if (typeof updates.label !== "string") {
      return res.status(400).json({
        message: "Label must be text",
      });
    }

    updates.label = updates.label.trim();

    if (updates.label.length > 100) {
      return res.status(400).json({
        message: "Label cannot be more than 100 characters",
      });
    }
  }

  //Check priority
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

  //Check status
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

  //Check due date
  if ("dueDate" in updates) {
    if (
      typeof updates.dueDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(updates.dueDate)
    ) {
      return res.status(400).json({
        message: "Due date must use YYYY-MM-DD format Please",
      });
    }

    const dateParsed = new Date(
      updates.dueDate + "T00:00:00Z",
    );

    if (isNaN(dateParsed.getTime())) {
      return res.status(400).json({
        message: "Not a valid due date",
      });
    }

    //If deadline changes update priority too
    updates.priority = getPriorityFromDueDate(
      updates.dueDate,
    );
  }

  //Check time
  if ("time" in updates) {
    if (
      typeof updates.time !== "string" ||
      !/^\d{2}:\d{2}$/.test(updates.time)
    ) {
      return res.status(400).json({
        message: "Time must use HH:MM format",
      });
    }

    const [hours, minutes] =
      updates.time.split(":").map(Number);

    if (
      isNaN(hours) ||
      isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return res.status(400).json({
        message: "Not a valid time",
      });
    }
  }

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
        message:
          "Unauthorized to edit this task: You do not own this task",
      });
    }

    await taskDoc.update(updates);

    return res.status(200).json({
      message: "Task Updated",
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
    const tasksRef = db.collection("tasks");

    const snapshot = await tasksRef
      .where("userId", "==", uid)
      .get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const tasks = [];

    snapshot.forEach((doc) => {
      tasks.push({
        id: doc.id,
        ...doc.data(),
      });
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