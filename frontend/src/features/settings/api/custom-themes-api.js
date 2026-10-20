import { httpClient } from "@/shared/http-client";

const API_URL = "http://localhost:3000/api/me/themes";

// Load saved custom themes for the signed-in user
async function getCustomThemes() {
  const response = await httpClient(API_URL);

  if (!response || typeof response.themes !== "object" || response.themes === null) {
    throw new Error("The server returned an invalid custom themes response.");
  }

  return response.themes;
}

// Create or update a custom theme in Firestore
async function saveCustomThemeToFirestore(themeId, theme) {
  const response = await httpClient(`${API_URL}/${encodeURIComponent(themeId)}`, {
    method: "PUT",
    body: JSON.stringify(theme),
  });

  if (!response?.theme) {
    throw new Error("The server did not confirm the theme was saved.");
  }

  return response.theme;
}

// Delete a custom theme from Firestore
async function deleteCustomThemeFromFirestore(themeId) {
  return httpClient(`${API_URL}/${encodeURIComponent(themeId)}`, {
    method: "DELETE",
  });
}

export { getCustomThemes, saveCustomThemeToFirestore, deleteCustomThemeFromFirestore };
