import express from "express";
import cors from "cors";
import tasksRoute from "./routes/tasks.js";
import settingsRoute from "./routes/settings.js";

const PORT = process.env.PORT || 3000;

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
  }),
);

app.use(express.json());

app.use((req, res, next) => {
  console.log(`req method is ${req.method} & req URL is ${req.url}`);
  next();
});

app.use("/api/tasks", tasksRoute);
app.use("/api/settings", settingsRoute);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
