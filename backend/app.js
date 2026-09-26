import express from "express";
import cors from "cors";
import tasksRoute from "./routes/tasks.js";

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

export default app;
