import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app.js";
import { db } from "../shared/firebase.js";

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req, res, next) => {
    req.user = { uid: "test-user-1" };
    next();
  },
}));

vi.mock("../shared/firebase.js", () => ({
  db: { collection: vi.fn() },
}));

function mockTaskSeries(addMock, timezone = "UTC") {
  const userDoc = {
    get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ timezone }) }),
  };
  const seriesCollection = { add: addMock };

  db.collection.mockImplementation(collectionName => {
    if (collectionName === "users") {
      return { doc: vi.fn().mockReturnValue(userDoc) };
    }
    if (collectionName === "task_series") {
      return seriesCollection;
    }
    return { add: vi.fn() };
  });
}

const validBody = {
  title: "Submit report",
  description: "Weekly report",
  subject: "Work",
  dueDate: "2026-10-05",
  time: "09:00",
  checklist: [{ text: "Draft outline", completed: true }],
  rule: { type: "weekly", interval: 1, weekdays: [1] },
  reminderOffsetDays: 1,
  reminderTime: "08:00",
  endDate: "2026-12-31",
};

describe("POST /api/task-series", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates one series and returns a virtual first occurrence", async () => {
    const addMock = vi.fn().mockResolvedValue({ id: "series-1" });
    mockTaskSeries(addMock);

    const res = await request(app).post("/api/task-series").send(validBody);

    expect(res.status).toBe(201);
    expect(addMock).toHaveBeenCalledTimes(1);
    const storedSeries = addMock.mock.calls[0][0];
    expect(storedSeries).toMatchObject({
      userId: "test-user-1",
      enabled: true,
      endDate: "2026-12-31",
      segments: [
        {
          from: "2026-10-05",
          until: null,
          rule: { type: "weekly", interval: 1, weekdays: [1] },
        },
      ],
    });
    expect(storedSeries.template).toEqual({
      title: "Submit report",
      description: "Weekly report",
      subject: "Work",
      time: "09:00",
      checklist: [{ text: "Draft outline" }],
      reminderOffsetDays: 1,
      reminderTime: "08:00",
    });
    expect(storedSeries.template).not.toHaveProperty("status");
    expect(storedSeries.template).not.toHaveProperty("dueDate");

    expect(res.body.firstOccurrence).toMatchObject({
      id: "series-1_2026-10-05",
      seriesId: "series-1",
      occurrenceDate: "2026-10-05",
      dueDate: "2026-10-05",
      status: "to do",
      virtual: true,
      priority: "High",
    });
  });

  it("does not create a task document", async () => {
    const addMock = vi.fn().mockResolvedValue({ id: "series-1" });
    const taskAddMock = vi.fn();
    mockTaskSeries(addMock);
    db.collection.mockImplementation(collectionName => {
      if (collectionName === "users") {
        return {
          doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }),
        };
      }
      if (collectionName === "task_series") return { add: addMock };
      if (collectionName === "tasks") return { add: taskAddMock };
      return {};
    });

    const res = await request(app).post("/api/task-series").send(validBody);

    expect(res.status).toBe(201);
    expect(taskAddMock).not.toHaveBeenCalled();
  });

  it.each([
    ["To Do", /status/i],
    ["in progress", /status/i],
    ["completed", /status/i],
  ])("rejects recurring status %s", async (status, message) => {
    const addMock = vi.fn();
    mockTaskSeries(addMock);

    const res = await request(app)
      .post("/api/task-series")
      .send({ ...validBody, status });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("rejects missing due dates, invalid rules, and invalid end dates", async () => {
    const addMock = vi.fn();
    mockTaskSeries(addMock);

    const missingDueDate = await request(app)
      .post("/api/task-series")
      .send({ ...validBody, dueDate: undefined });
    expect(missingDueDate.status).toBe(400);

    const invalidRule = await request(app)
      .post("/api/task-series")
      .send({ ...validBody, rule: { type: "weekly", interval: 1, weekdays: [0] } });
    expect(invalidRule.status).toBe(400);

    const invalidEndDate = await request(app)
      .post("/api/task-series")
      .send({ ...validBody, endDate: "2026-10-04" });
    expect(invalidEndDate.status).toBe(400);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("requires reminder offset and time together", async () => {
    const addMock = vi.fn();
    mockTaskSeries(addMock);

    const res = await request(app)
      .post("/api/task-series")
      .send({ ...validBody, reminderTime: null });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/together/i);
  });
});
