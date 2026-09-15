import { httpClient, HttpError } from "../../../shared/http-client";

// Retrieves the list of tasks from the current authenticated user.
// Returns an array of task objects or an empty array if no tasks are found.
// Throws an error if the request fails.
export async function getTasks() {
  try {
    const tasks = await httpClient("http://localhost:3000/api/tasks", {
      method: "GET",
    });
    return Array.isArray(tasks) ? tasks : [];
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(
        `HTTP Error: ${error.status} - ${error.message}`,
        error.body,
      );
    } else {
      console.error("Unexpected error:", error);
    }
    throw error;
  }
}
