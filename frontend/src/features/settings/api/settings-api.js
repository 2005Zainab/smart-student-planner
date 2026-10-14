import { httpClient } from "../../../shared/http-client";

// Gets the logged in user's settings, e.g. { emailReminders: true, passwordLessEnabled: false }
export async function getSettings() {
  return httpClient("http://localhost:3000/api/settings", {
    method: "GET",
  });
}

// Saves the email reminders setting (true or false)
export async function saveEmailReminders(emailReminders) {
  return httpClient("http://localhost:3000/api/settings", {
    method: "PATCH",
    body: JSON.stringify({ emailReminders }),
  });
}

// Saves the password-less sign-in setting (true or false)
export async function savePasswordLessEnabled(passwordLessEnabled) {
  return httpClient("http://localhost:3000/api/settings", {
    method: "PATCH",
    body: JSON.stringify({ passwordLessEnabled }),
  });
}