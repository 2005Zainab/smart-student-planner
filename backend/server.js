import express from "express";
import cors from "cors";
import tasksRoute from "./routes/tasks.js";
import labelsRoute from "./routes/labels.js";

const app = express();
const PORT = process.env.PORT || 3000;

//Allow the frontend to connect to the backend
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
    ],
  }),
);

//Allow the server to read JSON data
app.use(express.json());

//Show the request method and URL in the terminal
app.use((req, res, next) => {
  console.log(
    `req method is ${req.method} & req URL is ${req.url}`,
  );

  next();
});

//Task routes
app.use("/api/tasks", tasksRoute);

//Label routes
app.use("/api/labels", labelsRoute);

//Start the backend server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});