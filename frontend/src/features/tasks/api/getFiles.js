import { auth } from "../../../shared/auth";
import { httpClient, httpError } from "../../../shared/http-client";

const API_BASE = "http://localhost:3000/api";

const filesUrl = taskId => `${API_BASE}/tasks/${taskId}/files`;

// Files a browser can show in a tab. (DOCX, PPTX) is downloaded instead.
const OPENS_IN_TAB = new Set(["application/pdf", "image/png", "image/jpeg"]);

// httpClient always sends JSON, which would break a file upload, so uploads and downloads
// use fetch directly with the same login token.
async function fetchWithToken(url, options = {}) {
  const idToken = await auth.currentUser?.getIdToken();

  return fetch(url, {
    ...options,
    headers: { ...(idToken && { Authorization: `Bearer ${idToken}` }) },
  });
}

async function readError(response) {
  const body = await response.json().catch(() => null);

  return new httpError(
    response.status,
    body?.message || `HTTP error! status: ${response.status}`,
    body,
  );
}

// Uploads one file to a task
export async function uploadTaskFile(taskId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchWithToken(filesUrl(taskId), { method: "POST", body: formData });

  if (!response.ok) {
    throw await readError(response);
  }

  return response.json();
}

// Removes one file from a task
export function deleteTaskFile(taskId, fileId) {
  return httpClient(`${filesUrl(taskId)}/${fileId}`, { method: "DELETE" });
}

// The file is opened in a new tab if the browser can show it, otherwise it is downloaded.
export async function openTaskFile(taskId, file) {
  // Open the tab before fetching, otherwise the browsers block it as a popup if the fetch takes too long.
  const tab = OPENS_IN_TAB.has(file.type) ? window.open("", "_blank") : null;

  try {
    const response = await fetchWithToken(`${filesUrl(taskId)}/${file.id}`);

    if (!response.ok) {
      throw await readError(response);
    }

    const url = URL.createObjectURL(await response.blob());

    if (tab) {
      tab.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
    }

    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
