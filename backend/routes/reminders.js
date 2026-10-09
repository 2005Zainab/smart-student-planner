import express from "express";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";
import { isMailerConfigured, sendReminderEmail } from "../shared/mailer.js";

const router = express.Router();

// Emails the logged in user a reminder for one of their own tasks
router.post("/email", requireAuth, async (req, res) => {
    const uid = req.user.uid;
    const email = req.user.email;
    const { taskId } = req.body;

    // Task id must be text, and can't contain "/" because Firestore reads that as a path
    if (typeof taskId !== "string" || taskId.trim() === "" || taskId.includes("/")) {
        return res.status(400).json({
            message: "Task id is not valid",
        });
    }

    if (!email) {
        return res.status(400).json({
            message: "Your account does not have an email address",
        });
    }

    try {
        // Only send if the user has turned email reminders on
        const settingsSnap = await db.collection("userSettings").doc(uid).get();

        if (!settingsSnap.exists || settingsSnap.data().emailReminders !== true) {
            return res.status(200).json({ sent: false });
        }

        const taskSnap = await db.collection("tasks").doc(taskId).get();

        if (!taskSnap.exists) {
            return res.status(404).json({
                message: "Task Wasn't Found",
            });
        }

        if (taskSnap.data().userId !== uid) {
            return res.status(403).json({
                message: "Unauthorized to email this task: You do not own this task",
            });
        }

        if (!isMailerConfigured()) {
            return res.status(503).json({
                message: "Email is not set up on the server",
            });
        }

        await sendReminderEmail(email, taskSnap.data());

        res.status(200).json({ sent: true });
    } catch (err) {
        console.log(err);

        res.status(500).json({
            message: "Failed to send reminder email",
        });
    }
});

export default router;