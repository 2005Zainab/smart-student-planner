import "dotenv/config";
import { createTransport } from "nodemailer";

// Builds the subject and text for a reminder email for a given task
export function buildReminderEmail(task) {
    const lines = [`This is a reminder for your task: ${task.title}`, ""];

    if (task.subject) lines.push(`Subject: ${task.subject}`);
    if (task.dueDate) lines.push(`Due: ${task.dueDate}${task.time ? ` at ${task.time}` : ""}`);
    if (task.description) lines.push("", task.description);

    return { subject: `Reminder: ${task.title}`, text: lines.join("\n") };
}

// True when the server has the sender Gmail details in its .env file
export function isMailerConfigured() {
    return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

// Sends a reminder email for one task to the account address
export async function sendReminderEmail(to, task) {
    const transporter = createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    const { subject, text } = buildReminderEmail(task);

    await transporter.sendMail({
        from: `"Smart Student Planner" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        text,
    });
}