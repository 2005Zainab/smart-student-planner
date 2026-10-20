import path from "path";

// Files are stored inside Firestore documents, which can be at most 1 MiB.
// 900 KB leaves room for the file name and the other small fields.
export const MAX_FILE_BYTES = 900 * 1024;
export const MAX_FILES_PER_TASK = 5;

export const FILE_TYPE_MESSAGE = "Only PDF, PNG, JPG, DOCX, PPTX and TXT files are allowed";
export const FILE_SIZE_MESSAGE = "Files must be 900 KB or smaller";
export const TEXT_ENCODING_MESSAGE = "Text files must be saved as UTF-8";

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
  // Plain text has no magic number, so it has no start bytes. It is checked as UTF-8 instead.
  ".txt": { mimeType: "text/plain; charset=utf-8" },
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

// Plain text has no magic number, so check that the bytes decode as valid UTF-8.
// An empty file is valid. The fatal decoder throws on bytes that aren't UTF-8,
// which rejects binary files and older encodings such as UTF-16 or Windows-1252.
function isValidUtf8(buffer) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

// Lets the upload route give text files their own error message
export function isTextFileName(fileName) {
  return path.extname(fileName).toLowerCase() === ".txt";
}

// Check the file's magic number to verify the file type matches the extension.
// Text files have no magic number, so they are checked as UTF-8 instead.
export function getVerifiedMimeType(fileName, buffer) {
  const type = FILE_TYPES[path.extname(fileName).toLowerCase()];
  if (!type || !Buffer.isBuffer(buffer)) return null;

  if (!type.start) return isValidUtf8(buffer) ? type.mimeType : null;

  const matches = type.start.every((byte, index) => buffer[index] === byte);
  return matches ? type.mimeType : null;
}
