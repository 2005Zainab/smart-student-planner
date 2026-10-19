import { httpClient } from "@/shared/http-client";

// Get the custom themes saved for the signed-in user
async function getCustomThemes() {
  const response = await httpClient("/api/me/themes");

  return response.themes || {};
}

// Save a custom theme to Firestore
async function saveCustomThemeToFirestore(themeId, theme) {
  const response = await httpClient(`/api/me/themes/${encodeURIComponent(themeId)}`, {
    method: "PUT",
    body: JSON.stringify(theme),
  });

  return response.theme;
}

// Delete a custom theme from Firestore
async function deleteCustomThemeFromFirestore(themeId) {
  return httpClient(`/api/me/themes/${encodeURIComponent(themeId)}`, {
    method: "DELETE",
  });
}

export { getCustomThemes, saveCustomThemeToFirestore, deleteCustomThemeFromFirestore };
