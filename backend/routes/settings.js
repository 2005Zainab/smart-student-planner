import express from "express";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Get the logged in user's settings
router.get("/", requireAuth, async (req, res) => {
    const uid = req.user.uid;

    try {
        const settingsSnap = await db.collection("userSettings").doc(uid).get();

        // Email reminders are off unless the user has turned them on
        const emailReminders = settingsSnap.exists
            ? settingsSnap.data().emailReminders === true
            : false;

        res.status(200).json({ emailReminders });
    } catch (err) {
        console.log(err);

        res.status(500).json({
            message: "Failed to fetch settings",
        });
    }
});

// Save the logged in user's settings
router.patch("/", requireAuth, async (req, res) => {
    const uid = req.user.uid;
    const { emailReminders } = req.body;

    
    if (typeof emailReminders !== "boolean") {
        return res.status(400).json({
            message: "Email reminders must be true or false",
        });
    }
// Save the email reminders setting to the database
    try {
        await db.collection("userSettings").doc(uid).set({ emailReminders }, { merge: true });

        res.status(200).json({ emailReminders });
    } catch (err) {
        console.log(err);

        res.status(500).json({
            message: "Failed to save settings",
        });
    }
});

export default router;