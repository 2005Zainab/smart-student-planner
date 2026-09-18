import express from "express";
import { db } from "../../src/firebase.js";
import { requireAuth } from "../../middleware/auth.js";

const router = express.Router();

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

export default router;
