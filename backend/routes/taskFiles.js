import express from "express";
import multer from "multer";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";
import {
  MAX_FILE_BYTES,
  MAX_FILES_PER_TASK,
  FILE_TYPE_MESSAGE,
  FILE_SIZE_MESSAGE,
  cleanFileName,
  isAllowedFileName,
  getVerifiedMimeType,
} from "../lib/fileRules.js";

// This router handles file uploads, downloads, and deletions for tasks.
const router = express.Router({ mergeParams: true });

// Keeps the uploaded file in memory (never on disk) and rejects anything over the size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

// Handle file uploads and errors
function receiveFile(req, res, next) {
  upload.single("file")(req, res, err => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: FILE_SIZE_MESSAGE });
    }

    return res.status(400).json({ message: "Could not read the uploaded file" });
  });
}

// Upload a file to a task
router.post("/", requireAuth, receiveFile, async (req, res) => {
  const uid = req.user.uid;
  const { taskId } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: "Choose a file to upload" });
  }

  const name = cleanFileName(file.originalname);
  const mimeType = isAllowedFileName(name) ? getVerifiedMimeType(name, file.buffer) : null;

  if (!mimeType) {
    return res.status(400).json({ message: FILE_TYPE_MESSAGE });
  }

  try {
    const taskRef = db.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return res.status(404).json({ message: "Task Wasn't Found" });
    }

    if (taskSnap.data().userId !== uid) {
      return res.status(403).json({
        message: "Unauthorized to add files to this task: You do not own this task",
      });
    }

    if ((taskSnap.data().files ?? []).length >= MAX_FILES_PER_TASK) {
      return res
        .status(400)
        .json({ message: `A task can have at most ${MAX_FILES_PER_TASK} files` });
    }

    // The file's bytes get their own document. The task only keeps a summary,
    // so loading the task list never downloads any file contents.
    const fileRef = db.collection("taskFiles").doc();
    const summary = { id: fileRef.id, name, type: mimeType, size: file.size };

    const batch = db.batch();
    batch.set(fileRef, {
      ...summary,
      taskId,
      userId: uid,
      data: file.buffer,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.update(taskRef, { files: FieldValue.arrayUnion(summary) });
    await batch.commit();

    return res.status(201).json(summary);
  } catch (err) {
    console.log(err);

    return res.status(500).json({ message: "Failed to upload file" });
  }
});

// Download a file (the frontend opens it in a new tab)
router.get("/:fileId", requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const { taskId, fileId } = req.params;

  try {
    const fileSnap = await db.collection("taskFiles").doc(fileId).get();

    if (!fileSnap.exists || fileSnap.data().taskId !== taskId) {
      return res.status(404).json({ message: "File Wasn't Found" });
    }

    const file = fileSnap.data();

    if (file.userId !== uid) {
      return res.status(403).json({ message: "Unauthorized to view this file" });
    }

    res.set({
      "Content-Type": file.type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    });

    return res.send(Buffer.from(file.data));
  } catch (err) {
    console.log(err);

    return res.status(500).json({ message: "Failed to fetch file" });
  }
});

//Remove a file from a task
router.delete("/:fileId", requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const { taskId, fileId } = req.params;

  try {
    const taskRef = db.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return res.status(404).json({ message: "Task Wasn't Found" });
    }

    if (taskSnap.data().userId !== uid) {
      return res.status(403).json({
        message: "Unauthorized to remove files from this task: You do not own this task",
      });
    }

    const summary = (taskSnap.data().files ?? []).find(file => file.id === fileId);

    if (!summary) {
      return res.status(404).json({ message: "File Wasn't Found" });
    }

    const batch = db.batch();
    batch.delete(db.collection("taskFiles").doc(fileId));
    batch.update(taskRef, { files: FieldValue.arrayRemove(summary) });
    await batch.commit();

    return res.status(200).json({ message: "File Deleted" });
  } catch (err) {
    console.log(err);

    return res.status(500).json({ message: "Failed to remove file" });
  }
});

export default router;
