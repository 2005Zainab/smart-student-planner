import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
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

describe("POST /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an empty title", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "   " });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/empty/i);
  });

  it("rejects an invalid status", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ title: "Essay", status: "not-a-status" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/valid status/i);
  });

  it("rejects a malformed due date", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ title: "Essay", dueDate: "10-10-2026" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/YYYY-MM-DD/);
  });

  it("creates a task and computes High priority when due within 3 days", async () => {
    const addMock = vi.fn().mockResolvedValue({ id: "task-123" });
    db.collection.mockReturnValue({ add: addMock });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const res = await request(app)
      .post("/api/tasks")
      .send({ title: "Finish essay", dueDate: dueDateStr });

    expect(res.status).toBe(201);
    expect(res.body.priority).toBe("High");
    expect(res.body.status).toBe("To Do");
    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Finish essay", userId: "test-user-1" }),
    );
  });
});

describe("GET /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty array when the user has no tasks", async () => {
    const getMock = vi.fn().mockResolvedValue({ empty: true });
    db.collection.mockReturnValue({
      where: vi.fn().mockReturnValue({ get: getMock }),
    });

    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns only the requesting user's tasks with recalculated priority", async () => {
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 1);
    const overdueStr = overdueDate.toISOString().split("T")[0];

    const docs = [
      {
        id: "task-1",
        data: () => ({ title: "Essay", dueDate: overdueStr, userId: "test-user-1" }),
      },
    ];

    const getMock = vi.fn().mockResolvedValue({
      empty: false,
      forEach: cb => docs.forEach(cb),
    });
    db.collection.mockReturnValue({
      where: vi.fn().mockReturnValue({ get: getMock }),
    });

    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("task-1");
    expect(res.body[0].priority).toBe("High");
  });

  it("returns 500 when Firestore throws", async () => {
    db.collection.mockReturnValue({
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error("firestore down")),
      }),
    });

    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Failed to fetch/i);
  });
});

describe("DELETE /api/tasks/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the task does not exist", async () => {
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: getMock }),
    });

    const res = await request(app).delete("/api/tasks/does-not-exist");

    expect(res.status).toBe(404);
  });

  it("returns 403 when the task belongs to a different user", async () => {
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ userId: "someone-else" }),
    });
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: getMock }),
    });

    const res = await request(app).delete("/api/tasks/task-1");

    expect(res.status).toBe(403);
  });

  it("deletes the task and returns 200 when owned by the requester", async () => {
    const deleteMock = vi.fn().mockResolvedValue();
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ userId: "test-user-1" }),
    });
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: getMock, delete: deleteMock }),
    });

    const res = await request(app).delete("/api/tasks/task-1");

    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when Firestore throws", async () => {
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error("firestore down")),
      }),
    });

    const res = await request(app).delete("/api/tasks/task-1");

    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/tasks/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when no valid fields are provided", async () => {
    const res = await request(app).patch("/api/tasks/task-1").send({ notAllowed: "x" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid status", async () => {
    const res = await request(app).patch("/api/tasks/task-1").send({ status: "bogus" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid time format", async () => {
    const res = await request(app).patch("/api/tasks/task-1").send({ time: "9:5" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the task does not exist", async () => {
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: getMock }),
    });

    const res = await request(app).patch("/api/tasks/task-1").send({ title: "New title" });

    expect(res.status).toBe(404);
  });

  it("returns 403 when the task belongs to a different user", async () => {
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ userId: "someone-else" }),
    });
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: getMock }),
    });

    const res = await request(app).patch("/api/tasks/task-1").send({ title: "New title" });

    expect(res.status).toBe(403);
  });

  it("rejects setting a reminder time without a reminder date", async () => {
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ userId: "test-user-1", reminderDate: null, reminderTime: null }),
    });
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: getMock }),
    });

    const res = await request(app).patch("/api/tasks/task-1").send({ reminderTime: "09:00" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Date and time is required/i);
  });

  it("updates the task and recalculates priority when dueDate changes", async () => {
    const updateMock = vi.fn().mockResolvedValue();

    const beforeState = {
      exists: true,
      data: () => ({ userId: "test-user-1", title: "Old title" }),
    };

    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 2);
    const soonStr = soonDate.toISOString().split("T")[0];

    const afterState = {
      id: "task-1",
      data: () => ({
        userId: "test-user-1",
        title: "Updated title",
        dueDate: soonStr,
        priority: "High",
      }),
    };

    const getMock = vi.fn().mockResolvedValueOnce(beforeState).mockResolvedValueOnce(afterState);

    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: getMock, update: updateMock }),
    });

    const res = await request(app)
      .patch("/api/tasks/task-1")
      .send({ title: "Updated title", dueDate: soonStr });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated title");
    expect(res.body.priority).toBe("High");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated title", dueDate: soonStr, priority: "High" }),
    );
  });

  it("returns 500 when Firestore throws", async () => {
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error("firestore down")),
      }),
    });

    const res = await request(app).patch("/api/tasks/task-1").send({ title: "New title" });

    expect(res.status).toBe(500);
  });
});
