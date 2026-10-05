import express from "express";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Update user document with their local timezone
router.patch("/timezone", requireAuth, async (req, res) => {
  const tz = req.body?.timezone;
  try {
    if (typeof tz !== "string") throw new Error("Invalid timezone");
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  } catch {
    return res.status(400).json({ message: "Invalid timezone" });
  }
  await db.collection("users").doc(req.user.uid).set({ timezone: tz }, { merge: true });
  res.json({ timezone: tz });
});

export default router;
