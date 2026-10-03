import { httpClient, HttpError } from '../../../shared/http-client';

export async function getCalendarTasks(from, to) {
  try {
    const params = new URLSearchParams({ from, to });
    const tasks = await httpClient(`http://localhost:3000/api/tasks/calendar?${params}`);
    return Array.isArray(tasks) ? tasks : [];
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(`HTTP Error: ${error.status} - ${error.message}`, error.body);
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}
