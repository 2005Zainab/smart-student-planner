import express from "express";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Maximum length for a small profile picture
const MAX_PROFILE_PICTURE_LENGTH = 150000;

// Check that a profile picture is a small JPEG data URL
function isValidProfilePicture(value) {
  return (
    typeof value === "string" &&
    value.length <= MAX_PROFILE_PICTURE_LENGTH &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}

// Get the logged-in user's profile picture
router.get("/profile-picture", requireAuth, async (req, res) => {
  try {
    const userDoc = await db.collection("users").doc(req.user.uid).get();

    const profilePicture = userDoc.exists ? (userDoc.data()?.profilePicture ?? null) : null;

    res.status(200).json({ profilePicture });
  } catch (error) {
    console.error("Failed to load profile picture", error);
    res.status(500).json({ message: "Failed to load profile picture" });
  }
});

// Save the logged-in user's profile picture
router.patch("/profile-picture", requireAuth, async (req, res) => {
  const { profilePicture } = req.body ?? {};

  if (!isValidProfilePicture(profilePicture)) {
    return res.status(400).json({
      message: "Please upload a valid, small JPEG profile picture",
    });
  }

  try {
    await db.collection("users").doc(req.user.uid).set({ profilePicture }, { merge: true });

    res.status(200).json({ profilePicture });
  } catch (error) {
    console.error("Failed to save profile picture", error);
    res.status(500).json({ message: "Failed to save profile picture" });
  }
});

// Remove the logged-in user's profile picture
router.delete("/profile-picture", requireAuth, async (req, res) => {
  try {
    await db.collection("users").doc(req.user.uid).set({ profilePicture: null }, { merge: true });

    res.status(200).json({ profilePicture: null });
  } catch (error) {
    console.error("Failed to remove profile picture", error);
    res.status(500).json({ message: "Failed to remove profile picture" });
  }
});

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
