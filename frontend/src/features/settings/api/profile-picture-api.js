import { httpClient } from "../../../shared/http-client";

// Get the logged-in user's saved profile picture
async function getProfilePicture() {
  return httpClient("http://localhost:3000/api/me/profile-picture", {
    method: "GET",
  });
}

// Save a new profile picture
async function saveProfilePicture(profilePicture) {
  return httpClient("http://localhost:3000/api/me/profile-picture", {
    method: "PATCH",
    body: JSON.stringify({ profilePicture }),
  });
}

// Remove the picture and return to the default avatar
async function deleteProfilePicture() {
  return httpClient("http://localhost:3000/api/me/profile-picture", {
    method: "DELETE",
  });
}

export { getProfilePicture, saveProfilePicture, deleteProfilePicture };
