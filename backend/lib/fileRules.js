import path from "path";

// Files are stored inside Firestore documents, which can be at most 1 MiB.
// 900 KB leaves room for the file name and the other small fields.
export const MAX_FILE_BYTES = 900 * 1024;
export const MAX_FILES_PER_TASK = 10;

export const FILE_TYPE_MESSAGE = "Only PDF, PNG, JPG, DOCX and PPTX files are allowed";
export const FILE_SIZE_MESSAGE = "Files must be 900 KB or smaller";

const ZIP_START = [0x50, 0x4b, 0x03, 0x04]; // DOCX and PPTX files are zip files

// Every allowed type
const FILE_TYPES = {
  ".pdf": { mimeType: "application/pdf", start: [0x25, 0x50, 0x44, 0x46] },
  ".png": { mimeType: "image/png", start: [0x89, 0x50, 0x4e, 0x47] },
  ".jpg": { mimeType: "image/jpeg", start: [0xff, 0xd8, 0xff] },
  ".jpeg": { mimeType: "image/jpeg", start: [0xff, 0xd8, 0xff] },
  ".docx": {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    start: ZIP_START,
  },
  ".pptx": {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    start: ZIP_START,
  },
};

// Cleans the file name to be safe for storage in Firestore and on disk.
export function cleanFileName(rawName) {
  const name = Buffer.from(String(rawName ?? ""), "latin1").toString("utf8");
  const lastPart = name.split(/[\\/]/).pop();
  const printable = [...lastPart]
    .filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join("")
    .trim();

  return printable.slice(0, 150) || "file";
}

// Prevents .exe files from being uploaded
export function isAllowedFileName(fileName) {
  return Object.hasOwn(FILE_TYPES, path.extname(fileName).toLowerCase());
}

// Check the file's magic number to verify the file type matches the extension
export function getVerifiedMimeType(fileName, buffer) {
  const type = FILE_TYPES[path.extname(fileName).toLowerCase()];
  if (!type || !Buffer.isBuffer(buffer)) return null;

  const matches = type.start.every((byte, index) => buffer[index] === byte);
  return matches ? type.mimeType : null;
}
