import express from "express";
import cors from "cors";
import tasksRoute from "./routes/tasks.js";
import settingsRoute from "./routes/settings.js";
import remindersRoute from "./routes/reminders.js";
import taskSeriesRoute from "./routes/taskSeries.js";
import meRoute from "./routes/me.js";
import taskFilesRoute from "./routes/taskFiles.js";
import mfaRoute from "./routes/mfa.js";
import cookieParser from "cookie-parser";

const PORT = process.env.PORT || 3000;

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`req method is ${req.method} & req URL is ${req.url}`);
  next();
});

app.use("/api/tasks/:id/files", taskFilesRoute);
app.use("/api/tasks", tasksRoute);
app.use("/api/settings", settingsRoute);
app.use("/api/reminders", remindersRoute);
app.use("/api/task-series", taskSeriesRoute);
app.use("/api/me", meRoute);
app.use("/api/mfa", mfaRoute);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
