import { useState } from "react";
import { httpClient } from "../../../shared/http-client";
import { deleteTaskFile, openTaskFile, uploadTaskFile } from "../api/getFiles";
import { getTaskUrl, isOccurrence } from "../utils/task-endpoints";

// These match the limits on firestore
export const MAX_FILE_BYTES = 900 * 1024;
export const MAX_FILES_PER_TASK = 5;
export const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".docx", ".pptx"];

const getExtension = fileName => {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
};

// onFilesChange gets a function (current files in, new files out), e.g. current => [...current, ...uploaded]
function useTaskFiles(task, onFilesChange) {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isBusy, setIsBusy] = useState(false);

  const files = task.files ?? [];

  const canAttach = Boolean(task.id) && !String(task.id).startsWith("temp-");

  // Checks the chosen files and adds the good ones to the staged list.
  // The bad ones are reported in errors.
  const stageFiles = fileList => {
    const accepted = [];
    const problems = [];
    let total = files.length + stagedFiles.length;

    for (const file of fileList) {
      const alreadyStaged = [...stagedFiles, ...accepted].some(
        staged => staged.name === file.name && staged.size === file.size,
      );

      if (alreadyStaged) continue;
      // Check if the file is already uploaded to the task
      const alreadyUploaded = files.some(
        uploaded => uploaded.name === file.name && uploaded.size === file.size,
      );

      if (alreadyUploaded) {
        problems.push(`${file.name}: this file is already attached to the task`);
        continue;
      }

      if (!ACCEPTED_EXTENSIONS.includes(getExtension(file.name))) {
        problems.push(`${file.name}: only PDF, PNG, JPG, DOCX and PPTX files are allowed`);
      } else if (file.size > MAX_FILE_BYTES) {
        problems.push(`${file.name}: files must be 900 KB or smaller`);
      } else if (total >= MAX_FILES_PER_TASK) {
        problems.push(`${file.name}: a task can have at most ${MAX_FILES_PER_TASK} files`);
      } else {
        accepted.push(file);
        total += 1;
      }
    }

    setStagedFiles(current => [...current, ...accepted]);
    setErrors(problems);
  };

  const unstageFile = fileToRemove => {
    setStagedFiles(current => current.filter(file => file !== fileToRemove));
  };

  // A recurring occurrence doesn't exist in the database until it is first saved.
  // An empty save creates it, so the files have something to belong to.
  const createOccurrenceIfNeeded = async () => {
    if (isOccurrence(task) && task.virtual) {
      await httpClient(getTaskUrl(task), { method: "PATCH", body: JSON.stringify({}) });
    }
  };

  // Returns true if all files were uploaded, false if any failed.
  const uploadStaged = async () => {
    if (stagedFiles.length === 0) return true;

    setIsBusy(true);
    setErrors([]);

    try {
      await createOccurrenceIfNeeded();
    } catch (err) {
      setErrors([err.message || "Couldn't get the task ready for files"]);
      setIsBusy(false);
      return false;
    }

    const uploaded = [];
    const failed = [];

    for (const file of stagedFiles) {
      try {
        uploaded.push(await uploadTaskFile(task.id, file));
      } catch (err) {
        failed.push({ file, message: err.message });
      }
    }

    if (uploaded.length > 0) {
      onFilesChange(current => [...current, ...uploaded]);
    }

    setStagedFiles(failed.map(item => item.file));
    setErrors(failed.map(item => `${item.file.name}: ${item.message}`));
    setIsBusy(false);

    return failed.length === 0;
  };

  // Removes a file
  const removeFile = async file => {
    setErrors([]);

    try {
      await deleteTaskFile(task.id, file.id);
      onFilesChange(current => current.filter(existing => existing.id !== file.id));
    } catch (err) {
      setErrors([`Couldn't remove ${file.name}: ${err.message}`]);
    }
  };

  // Opens a file
  const openFile = async file => {
    setErrors([]);

    try {
      await openTaskFile(task.id, file);
    } catch (err) {
      setErrors([`Couldn't open ${file.name}: ${err.message}`]);
    }
  };

  return {
    files,
    stagedFiles,
    errors,
    isBusy,
    canAttach,
    stageFiles,
    unstageFile,
    uploadStaged,
    removeFile,
    openFile,
  };
}

export { useTaskFiles };
