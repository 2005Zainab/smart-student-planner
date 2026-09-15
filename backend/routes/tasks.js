import express from 'express';
import { db } from '../src/firebase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const ALLOWED_FIELDS = ["title", "description", "subject", "priority", "status", "dueDate"];
const ALLOWED_PRIORITIES = ["low", "medium", "high"];
const ALLOWED_STATUSES = ["to do", "in progress", "completed"];
const PRIORITY_DISPLAY = {low : "Low", medium : "Medium", high : "High"};
const STATUS_DISPLAY = {"to do" : "To Do", "in progress" : "In Progress", "completed" : "Completed"};

//Try to delete task
router.delete('/:id', requireAuth, async (req, res) => {

    const uid = req.user.uid;

    try {
        const taskDoc = db.collection("tasks").doc(req.params.id);
        const taskSnap = await taskDoc.get();

        if (!taskSnap.exists) {
            return res.status(404).json({ message: "Task Wasn't Found" });
        }

        if (taskSnap.data().userId != uid) {
            return res.status(403).json({ message: "Unauthorized to delete this task: You do not own this task" });
        }

        await taskDoc.delete();
        res.status(200).json({ message: 'Task Deleted' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Failed to Delete Task' });
    }
});

router.patch('/:id', requireAuth, async (req, res) => {
    const uid = req.user.uid;
    const updates = {};

    for (const key of ALLOWED_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
            updates[key] = req.body[key];
        }
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields updated" });
    }

    //Not allowed blank/empty title, rejects before updating firestore
    if ("title" in updates) {
        if (typeof updates.title !== "string") {
            return res.status(400).json({ message: "Title has to be a string" });
        }
        if (updates.title.trim() === "") {
            return res.status(400).json({ message: "Title cannot be empty or blank" });
        }
        //Cap title edits to 200 chars
        updates.title = updates.title.trim();
        if (updates.title.length > 200) {
            return res.status(400).json({ message: "Title cannot be more than 200 characters" });
        }
    }

    //prevent non string entries
    if ("description" in updates) {
        if (typeof updates.description !== "string") {
            return res.status(400).json({ message: "Description must be text" });
        }
        //Cap description edits to 1000 chars
        updates.description = updates.description.trim();
        if (updates.description.length > 1000) {
            return res.status(400).json({ message: "Description cannot be more than 1000 characters" });
        }
    }

    //prevent non string entries
    if ("subject" in updates) {
        if (typeof updates.subject !== "string") {
            return res.status(400).json({ message: "Subject must be text" });
        }
        //Cap subject edits to 200 chars
        updates.subject = updates.subject.trim();
        if (updates.subject.length > 200) {
            return res.status(400).json({ message: "Subject cannot be more than 200 characters" });
        }
    }

    //prevent non string entries
    if ("priority" in updates) {
        if (typeof updates.priority !== "string") {
            return res.status(400).json({ message: "Not a valid priority" });
        }
        //Check case sensitivity
        const trimmedLower = updates.priority.trim().toLowerCase();
        if (!ALLOWED_PRIORITIES.includes(trimmedLower)) {
            return res.status(400).json({ message: "Not a valid priority" });
        }
        updates.priority = PRIORITY_DISPLAY[trimmedLower];
    }

    //prevent non string entries
    if ("status" in updates) {
        if (typeof updates.status !== "string") {
            return res.status(400).json({ message: "Not a valid status" });
        }
        //Check case sensitivity
        const trimmedLower = updates.status.trim().toLowerCase();
        if (!ALLOWED_STATUSES.includes(trimmedLower)) {
            return res.status(400).json({ message: "Not a valid status" });
        }
        updates.status = STATUS_DISPLAY[trimmedLower];
    }

    if ("dueDate" in updates) {
        if(typeof updates.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(updates.dueDate)){
            return res.status(400).json({ message : "Due date must use YYYY-MM-DD format Please"});
        }
        const dateParsed = new Date(updates.dueDate + "T00:00:00Z");
        if (isNaN(dateParsed.getTime())) {
            return res.status(400).json({ message: "Not a valid due date" });
        }
    }


    try {
        //Fetches task first and checks it exists and who owns it
        const taskDoc = db.collection("tasks").doc(req.params.id);
        const taskSnap = await taskDoc.get();

        if (!taskSnap.exists) {
            return res.status(404).json({ message: "Task Wasn't Found" });
        }

        if (taskSnap.data().userId != uid) {
            return res.status(403).json({ message: "Unauthorized to edit this task: You do not own this task" });
        }

        await taskDoc.update(updates);
        res.status(200).json({ message: 'Task Updated' });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Failed to Update Task' })
    }
});

// router.get('/', requireAuth, async (req, res) => {
//     const uid = req.user.uid;
//     try {
//         const tasksSnapshot = await db.collection("tasks").where("userId", "==", uid).get();
//         const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//         res.status(200).json({ tasks });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: 'Failed to fetch tasks' });
//     }
// });

export default router;