import express from 'express';
import cors from 'cors';
import tasksRoute from './routes/tasks.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

// Middleware
app.use(express.json());

// simple custom middleware that will output to the console the type of request and the url.
app.use((req, res, next) => {
  console.log(`req method is ${req.method} & req URL is ${req.url}`);
  next();
});

app.use('/api/tasks', tasksRoute);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
