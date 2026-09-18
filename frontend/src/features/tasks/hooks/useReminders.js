import { useEffect, useRef } from "react";
import { httpClient } from "../../../shared/http-client";

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

            tasks.forEach((task) => {
                // Skip completed tasks and tasks without reminders
                if (task.status === "Completed") return;
                if (!task.reminderDate || !task.reminderTime) return;

                const reminderKey = `${task.reminderDate}T${task.reminderTime}`;

                if (firedRef.current.get(task.id) === reminderKey) return;

                const reminderDateTime = new Date(`${reminderKey}:00`);

                if (isNaN(reminderDateTime.getTime())) return;

                if (reminderDateTime <= now) {
                    firedRef.current.set(task.id, reminderKey);

                    try {
                        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                            new Notification("Task reminder", {
                                body: task.title || "You have a task due",
                            });
                        }

                        document.title = `Reminder: ${task.title || "Task"}`;
                        setTimeout(() => {
                            document.title = originalTitleRef.current;
                        }, 5000);

                        setTasks((current) =>
                            current.map((t) =>
                                t.id === task.id
                                    ? { ...t, reminderDate: null, reminderTime: null }
                                    : t,
                            ),
                        );

                        httpClient(`http://localhost:3000/api/tasks/${task.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ reminderDate: null, reminderTime: null }),
                        }).catch((err) => {
                            console.log("Failed to clear reminder:", err);
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