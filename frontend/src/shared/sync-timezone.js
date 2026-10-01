import { httpClient } from './http-client';

export async function syncTimezone(uid) {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const key = `tzSent:${uid}`;
    if (!tz || localStorage.getItem(key) === tz) return;

    await httpClient('http://localhost:3000/api/me/timezone', {
      method: 'PATCH',
      body: JSON.stringify({ timezone: tz }),
    });
    localStorage.setItem(key, tz);
  } catch {
    // Non-fatal: the server falls back to UTC, and we retry on the next load.
  }
}
