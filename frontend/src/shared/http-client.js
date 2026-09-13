import { auth } from "./auth";

export class HttpError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

/**
 * A wrapper around the fetch API that automatically includes the Firebase ID token in the Authorization header.
 * @param {string} url - The URL to fetch.
 * @param {object} options - The options to pass to fetch.
 * @returns {Promise<any>} - The response body as JSON.
 * @throws {HttpError} - If the response is not ok, throws an HttpError with the status and message.
 *
 * Sample usage:
 *
 * import { httpClient } from "@/shared/http-client";
 *
 * async function fetchData() {
 *   try {
 *     const data = await httpClient("/api/data");
 *     console.log(data);
 *   } catch (error) {
 *     if (error instanceof HttpError) {
 *       console.error(`HTTP Error: ${error.status} - ${error.message}`);
 *     } else {
 *       console.error("Unexpected error:", error);
 *     }
 *   }
 * }
 */
export async function httpClient(url, options = {}) {
  const idToken = await auth.currentUser?.getIdToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      ...(idToken && { Authorization: `Bearer ${idToken}` }),
    },
  });

  if (response.status === 204) return null;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new HttpError(
      response.status,
      body?.message || `HTTP error! status: ${response.status}`,
      body,
    );
  }

  return body;
}
