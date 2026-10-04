import express from "express";
import rateLimitPackage from "express-rate-limit";
import { getAuth } from "firebase-admin/auth";
import { db } from "../../shared/firebase.js";
import { requireAuth } from "../../middleware/auth.js";

const router = express.Router();

const authLimiter = rateLimitPackage({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  try {
    // Look up the specific user document by their UID
    const userDoc = await db.collection("users").doc(uid).get();

    // If the user hasn't saved any settings yet, return a safe default
    if (!userDoc.exists) {
      return res.status(200).json({ passwordLessEnabled: false });
    }

    return res.status(200).json(userDoc.data());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch settings" });
  }
});

router.patch("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  // Extract the setting from the request body
  const { passwordLessEnabled: passwordLessEnabled } = req.body;

  // Validate that the required field was actually sent
  if (typeof passwordLessEnabled !== "boolean") {
    return res
      .status(400)
      .json({ message: "Invalid or missing passwordLessEnabled value" });
  }

  try {
    // .set() with { merge: true } is perfect here.
    // It creates the document if it doesn't exist, and updates it if it does,
    // without deleting any other settings the user might have.
    await db
      .collection("users")
      .doc(uid)
      .set({ passwordLessEnabled: passwordLessEnabled }, { merge: true });

    return res.status(200).json({ message: "Settings updated successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update settings" });
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
    const userDoc = await db.collection("users").doc(userRecord.uid).get();

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
