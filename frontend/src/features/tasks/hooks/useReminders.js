import { useEffect, useRef } from "react";
import { httpClient } from "../../../shared/http-client";
import { getTaskUrl, isOccurrence } from "../utils/task-endpoints";

// Recurring occurrences are identified by seriesId + occurrenceDate, never by parsing task.id.
// This key survives the virtual -> materialized transition, because both fields are stable.
const firedStorageKey = task => `firedReminder:${task.seriesId}:${task.occurrenceDate}`;

// localStorage can throw or be unavailable (private windows, blocked site data), so every
// access is wrapped. Failing closed here means the in-memory firedRef is the only guard.
function readFired(task) {
  try {
    return localStorage.getItem(firedStorageKey(task));
  } catch {
    return null;
  }
}

function writeFired(task, reminderKey) {
  try {
    localStorage.setItem(firedStorageKey(task), reminderKey);
  } catch {
    // ignore: firedRef still prevents repeat firing for this session
  }
}

export function useReminders(tasks, setTasks) {
  const firedRef = useRef(new Map());
  const originalTitleRef = useRef(document.title);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();

      tasks.forEach(task => {
        // Skip completed tasks and tasks without reminders
        if (task.status === "Completed") return;
        if (!task.reminderDate || !task.reminderTime) return;

        const reminderKey = `${task.reminderDate}T${task.reminderTime}`;

        if (firedRef.current.get(task.id) === reminderKey) return;

        // Persisted "already fired" record for recurring occurrences. Checked for virtual
        // AND materialized occurrences so a reminder that fired while the occurrence was
        // virtual does not fire a second time after it gets materialized.
        if (isOccurrence(task) && readFired(task) === reminderKey) return;

        const reminderDateTime = new Date(`${reminderKey}:00`);

        if (isNaN(reminderDateTime.getTime())) return;

        if (reminderDateTime <= now) {
          firedRef.current.set(task.id, reminderKey);

          try {
            if (isOccurrence(task)) {
              writeFired(task, reminderKey);
            }

            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("Task reminder", {
                body: task.title || "You have a task due",
              });
            }

            document.title = `Reminder: ${task.title || "Task"}`;
            setTimeout(() => {
              document.title = originalTitleRef.current;
            }, 5000);

            setTasks(current =>
              current.map(t =>
                t.id === task.id ? { ...t, reminderDate: null, reminderTime: null } : t,
              ),
            );

            // A virtual occurrence has no document, and the server recomputes its reminder
            // fields from the series template on every fetch. A PATCH would either 404
            // (/tasks/:id) or materialize it as a side effect (occurrence endpoint), so
            // the localStorage record above is the only persistence for it.
            if (isOccurrence(task) && task.virtual) return;

            httpClient(getTaskUrl(task), {
              method: "PATCH",
              body: JSON.stringify({ reminderDate: null, reminderTime: null }),
            }).catch(err => {
              console.log("Failed to clear reminder:", err);
            });

            // Email the reminder too (the server only sends it if the user turned emails on)
            httpClient("http://localhost:3000/api/reminders/email", {
              method: "POST",
              body: JSON.stringify({ taskId: task.id }),
            }).catch(err => {
              console.log("Failed to send reminder email:", err);
            });
          } catch (err) {
            console.log("Error handling reminder for task", task.id, err);
          }
        }
      });
    };

    const intervalId = setInterval(checkReminders, 15000);
    checkReminders();

    return () => clearInterval(intervalId);
  }, [tasks, setTasks]);
}
