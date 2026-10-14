import express from "express";
import rateLimitPackage from "express-rate-limit";
import { getAuth } from "firebase-admin/auth";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const authLimiter = rateLimitPackage({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Get the logged in user's settings
router.get("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  try {
    const settingsSnap = await db
      .collection("users")
      .doc(uid)
      .collection("settings")
      .doc("preferences")
      .get();

    let passwordLessEnabled = false;
    let emailReminders = false;

    if (settingsSnap.exists) {
      const data = settingsSnap.data();
      passwordLessEnabled = data.passwordLessEnabled === true;
      emailReminders = data.emailReminders === true;
    }

    res.status(200).json({ emailReminders, passwordLessEnabled });
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
  const { emailReminders, passwordLessEnabled } = req.body;

  const updates = {};

  if (typeof passwordLessEnabled === "boolean") {
    updates.passwordLessEnabled = passwordLessEnabled;
  }
  if (typeof emailReminders === "boolean") {
    updates.emailReminders = emailReminders;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "No valid settings provided" });
  }

  // Save the settings to the database
  try {
    await db
      .collection("users")
      .doc(uid)
      .collection("settings")
      .doc("preferences")
      .set(updates, { merge: true });

    res.status(200).json({ emailReminders, passwordLessEnabled });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Failed to save settings",
    });
  }
});

router.post("/check-method", authLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    // 1. Find user account by email using Firebase Admin SDK
    const userRecord = await getAuth().getUserByEmail(email);

    // 2. Fetch their settings from Firestore
    const userDoc = await db
      .collection("users")
      .doc(userRecord.uid)
      .collection("settings")
      .doc("preferences")
      .get();

    if (userDoc.exists && userDoc.data().passwordLessEnabled === true) {
      return res.status(200).json({ passwordLessOnly: true });
    }

    return res.status(200).json({ passwordLessOnly: false });
  } catch (err) {
    console.error(err);
    // If user does not exist or any error occurs, fall back safely
    return res.status(200).json({ passwordLessOnly: false });
  }
});

export default router;
