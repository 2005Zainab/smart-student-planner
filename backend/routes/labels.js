import express from "express";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Get all labels belonging to the logged-in user
router.get("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  try {
    const snapshot = await db.collection("labels").where("userId", "==", uid).get();

    const labels = [];

    snapshot.forEach(doc => {
      labels.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return res.status(200).json(labels);
  } catch (err) {
    console.error("Failed to get labels:", err);

    return res.status(500).json({
      message: "Failed to get labels",
    });
  }
});

// Create a new reusable label for the logged-in user
router.post("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const { name } = req.body ?? {};

  if (typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({
      message: "Label cannot be empty",
    });
  }

  const trimmedName = name.trim();

  if (trimmedName.length > 100) {
    return res.status(400).json({
      message: "Label cannot be more than 100 characters",
    });
  }

  try {
    // Check existing labels for the current user.
    const snapshot = await db.collection("labels").where("userId", "==", uid).get();

    const normalizedName = trimmedName.toLocaleLowerCase();

    const duplicateExists = snapshot.docs.some(doc => {
      const existingName = doc.data().name;

      return (
        typeof existingName === "string" &&
        existingName.trim().toLocaleLowerCase() === normalizedName
      );
    });

    if (duplicateExists) {
      return res.status(409).json({
        message: "A label with this name already exists.",
      });
    }

    const newLabel = {
      name: trimmedName,
      userId: uid,
    };

    const docRef = await db.collection("labels").add(newLabel);

    return res.status(201).json({
      id: docRef.id,
      ...newLabel,
    });
  } catch (err) {
    console.error("Failed to create label:", err);

    return res.status(500).json({
      message: "Failed to create label",
    });
  }
});

export default router;
