import express from "express";
import { db } from "../src/firebase.js";
import { requireAuth } from "../middleware/auth.js";
import { randomUUID } from "crypto";

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

const ALLOWED_STATUSES = ["to do", "in progress", "completed"];

const STATUS_DISPLAY = {
  "to do": "To Do",
  "in progress": "In Progress",
  completed: "Completed",
};

//Validates the checklist and ensures checklist items added are the proper type
function validateChecklist(checklist) {
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

    //check entered item is correct type and not blank
    if (typeof item.text !== "string" || item.text.trim() === "") {
      return { message: "Checklist item must be text and not empty/blank" };
    }

    //check length of checklist item
    if (item.text.trim().length > 100) {
      return { message: "Checklist item cannot be more than 100 characters" };
    }

    //validate id: must be a non-empty string under 100 chars if client supplied one
    let id;
    if (item.id === undefined || item.id === null || item.id === "") {
      id = randomUUID();
    } else if (typeof item.id !== "string" || item.id.length > 100) {
      return {
        message: "Checklist item id must be a string under 100 characters",
      };
    } else {
      id = item.id;
    }

    if (seenIds.has(id)) {
      return { message: "Checklist item ids must be unique" };
    }
    seenIds.add(id);

    //completed must be an actual boolean, not a truthy/falsy coercion
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

//Work out priority from the due date
function getPriorityFromDueDate(dueDate) {
  //No due date means low priority
  if (!dueDate) {
    return "Low";
  }

  const today = new Date();
  const due = new Date(dueDate + "T00:00:00");

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const differenceInTime = due.getTime() - today.getTime();

  const daysUntilDue = Math.ceil(differenceInTime / (1000 * 60 * 60 * 24));

  //Overdue tasks are high priority
  if (daysUntilDue < 0) {
    return "High";
  }

  //Due today or within 3 days
  if (daysUntilDue <= 3) {
    return "High";
  }

  //Due in 4 to 7 days
  if (daysUntilDue <= 7) {
    return "Medium";
  }

  //More than 7 days away
  return "Low";
}

//Add task
router.post("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  const {
    title,
    description = "",
    subject = "",
    status = "To Do",
    dueDate = null,
    time: rawTime = "",
    checklist = [],
    reminderDate = null,
    reminderTime: rawReminderTime = "",
  } = req.body;

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
  if (time && !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({
      message: "Time must use HH:MM format",
    });
  }

  // validate reminder time
  if (reminderTime && !/^\d{2}:\d{2}$/.test(reminderTime)) {
    return res.status(400).json({
      message: "Reminder time must use HH:MM format",
    });
  }

  // reminder date and time must be set together
  if (Boolean(reminderDate) !== Boolean(reminderTime)) {
    return res.status(400).json({
      message: "Date and time is required to set a reminder.",
    });
  }

  // Title must be text
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

  const cleanTitle = title.trim();

  if (cleanTitle.length > 200) {
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

  const cleanDescription = description.trim();

  if (cleanDescription.length > 1000) {
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

  const cleanSubject = subject.trim();

  if (cleanSubject.length > 200) {
    return res.status(400).json({
      message: "Subject cannot be more than 200 characters",
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
  if (dueDate !== null) {
    if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return res.status(400).json({
        message: "Due date must use YYYY-MM-DD format",
      });
    }

    const dateParsed = new Date(dueDate + "T00:00:00");

    if (isNaN(dateParsed.getTime())) {
      return res.status(400).json({
        message: "Not a valid due date",
      });
    }
  }

  //if checklist returns a message an error has occurred
  const checklistResult = validateChecklist(checklist);
  if (checklistResult.message) {
    return res.status(400).json({ message: checklistResult.message });
  }

  try {
    const priority = getPriorityFromDueDate(dueDate);

    const newTask = {
      title: cleanTitle,
      description: cleanDescription,
      subject: cleanSubject,
      priority,
      status: STATUS_DISPLAY[statusLower],
      dueDate,
      time,
      checklist: checklistResult.cleanChecklist,
      reminderDate,
      reminderTime,
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

  //Check status
  if ("status" in updates) {
    if (typeof updates.status !== "string") {
      return res.status(400).json({
        message: "Status must be text",
      });
    }

    const statusLower = updates.status.trim().toLowerCase();

    if (!ALLOWED_STATUSES.includes(statusLower)) {
      return res.status(400).json({
        message: "Not a valid status",
      });
    }

    updates.status = STATUS_DISPLAY[statusLower];
  }

  //Check due date
  if ("dueDate" in updates) {
    if (
      updates.dueDate !== null &&
      (typeof updates.dueDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(updates.dueDate))
    ) {
      return res.status(400).json({
        message: "Due date must use YYYY-MM-DD format",
      });
    }

    if (updates.dueDate !== null) {
      const dateParsed = new Date(updates.dueDate + "T00:00:00");

      if (isNaN(dateParsed.getTime())) {
        return res.status(400).json({
          message: "Not a valid due date",
        });
      }
    }

    //Update priority when due date changes
    updates.priority = getPriorityFromDueDate(updates.dueDate);
  }

  //Check time
  if ("time" in updates) {
    if (
      updates.time !== null &&
      (typeof updates.time !== "string" || !/^\d{2}:\d{2}$/.test(updates.time))
    ) {
      return res.status(400).json({
        message: "Time must use HH:MM format",
      });
    }

    if (updates.time !== null) {
      const [hours, minutes] = updates.time.split(":").map(Number);

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
  }

  //If message is returned then an error has occured in the checklist
  //Otherwise no message returned, checklist is updated
  if ("checklist" in updates) {
    const checklistResult = validateChecklist(updates.checklist);
    if (checklistResult.message) {
      return res.status(400).json({ message: checklistResult.message });
    }
    updates.checklist = checklistResult.cleanChecklist;
  }
  // Reminder date validation
  if ("reminderDate" in updates && updates.reminderDate !== null) {
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
  if ("reminderTime" in updates && updates.reminderTime !== null) {
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
    const finalReminderDate =
      "reminderDate" in updates
        ? updates.reminderDate
        : existingData.reminderDate;
    const finalReminderTime =
      "reminderTime" in updates
        ? updates.reminderTime
        : existingData.reminderTime;

    if (Boolean(finalReminderDate) !== Boolean(finalReminderTime)) {
      return res.status(400).json({
        message: "Date and time is required to set a reminder.",
      });
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
    const tasksRef = db.collection("tasks");

    const snapshot = await tasksRef.where("userId", "==", uid).get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const tasks = [];

    snapshot.forEach((doc) => {
      const task = {
        id: doc.id,
        ...doc.data(),
      };

      //Recalculate priority when tasks load
      task.priority = getPriorityFromDueDate(task.dueDate);

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
