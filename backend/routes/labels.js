import express from "express";
import { db } from "../src/firebase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

//Get all labels that belong to the logged in user
router.get("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  try {
    const snapshot = await db
      .collection("labels")
      .where("userId", "==", uid)
      .get();

    const labels = [];

    //Add each label from Firestore into the labels array
    snapshot.forEach((doc) => {
      labels.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return res.status(200).json(labels);
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "Failed to get labels",
    });
  }
});

//Create a new label for the user
router.post("/", requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const { name } = req.body;

  //Make sure the label is not empty
  if (!name || name.trim() === "") {
    return res.status(400).json({
      message: "Label cannot be empty",
    });
  }

  //Stop labels from being too long
  if (name.trim().length > 100) {
    return res.status(400).json({
      message: "Label cannot be more than 100 characters",
    });
  }

  try {
    const newLabel = {
      name: name.trim(),
      userId: uid,
    };

    //Save the new label in Firestore
    const docRef = await db
      .collection("labels")
      .add(newLabel);

    return res.status(201).json({
      id: docRef.id,
      ...newLabel,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "Failed to create label",
    });
  }
});

export default router;