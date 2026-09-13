import express from 'express';
import { db } from '../src/firebase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

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
    const { title, description, subject, priority, status, dueDate } = req.body;

    //Not allowed blank/empty title, rejects before updating firestore
    if (!title || title.trim() === "") {
        return res.status(400).json({ message: "Title cannot be empty or blank" });
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

        await taskDoc.update({ title, description, subject, priority, status, dueDate });
        res.status(200).json({ message: 'Task Updated' });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Failed to Update Task' })
    }
});

export default router;