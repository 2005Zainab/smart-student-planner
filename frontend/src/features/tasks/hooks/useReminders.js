import { useEffect, useRef } from "react";

export function useReminders(tasks) {
    const firedRef = useRef(new Set());

    useEffect(() => {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        const checkReminders = () => {
            const now = new Date();

            tasks.forEach((task) => {
                if (!task.reminderDate || !task.reminderTime) return;
                if (firedRef.current.has(task.id)) return;

                const reminderDateTime = new Date(
                    `${task.reminderDate}T${task.reminderTime}:00`
                );

                if (isNaN(reminderDateTime.getTime())) return;

                if (reminderDateTime <= now) {
                    firedRef.current.add(task.id);

                    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                        new Notification("Task reminder", {
                            body: task.title || "You have a task due",
                        });
                    }

                    const originalTitle = document.title;
                    document.title = `Reminder: ${task.title || "Task"}`;
                    setTimeout(() => {
                        document.title = originalTitle;
                    }, 5000);
                }
            });
        };

        const intervalId = setInterval(checkReminders, 15000);
        checkReminders();

        return () => clearInterval(intervalId);
    }, [tasks]);
}