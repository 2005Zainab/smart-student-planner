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
  db: { collection: vi.fn(), runTransaction: vi.fn() },
}));

const PDF_BYTES = Buffer.from("%PDF-1.4 test");

const transaction = { get: vi.fn(), set: vi.fn(), update: vi.fn() };

function mockTask(taskData) {
  db.collection.mockReturnValue({ doc: vi.fn().mockReturnValue({ id: "file-1" }) });
  db.runTransaction.mockImplementation(callback => callback(transaction));
  transaction.get.mockResolvedValue({ exists: true, data: () => taskData });
}

function uploadFile(name = "notes.pdf", bytes = PDF_BYTES) {
  return request(app).post("/api/tasks/task-1/files").attach("file", bytes, name);
}

describe("POST /api/tasks/:id/files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a file and returns its summary", async () => {
    mockTask({ userId: "test-user-1", files: [] });

    const res = await uploadFile();

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: "file-1",
      name: "notes.pdf",
      type: "application/pdf",
      size: PDF_BYTES.length,
    });
    expect(transaction.set).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledTimes(1);
  });

  it("uploads an empty .txt file", async () => {
    mockTask({ userId: "test-user-1", files: [] });

    const res = await uploadFile("blank.txt", Buffer.alloc(0));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: "file-1",
      name: "blank.txt",
      type: "text/plain; charset=utf-8",
      size: 0,
    });
    expect(transaction.set).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when the task belongs to a different user", async () => {
    mockTask({ userId: "someone-else", files: [] });

    const res = await uploadFile();

    expect(res.status).toBe(403);
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("returns 400 when the task already has 5 files", async () => {
    const files = [1, 2, 3, 4, 5].map(n => ({ id: `f${n}`, name: `file${n}.pdf`, size: n }));
    mockTask({ userId: "test-user-1", files });

    const res = await uploadFile();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at most 5/i);
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("returns 409 when the same file is already attached", async () => {
    mockTask({
      userId: "test-user-1",
      files: [{ id: "f1", name: "notes.pdf", size: PDF_BYTES.length }],
    });

    const res = await uploadFile();

    expect(res.status).toBe(409);
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("returns 400 for a file type that isn't allowed", async () => {
    const res = await uploadFile("notes.exe", Buffer.from("hello"));

    expect(res.status).toBe(400);
    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 with a UTF-8 message for a .txt file that isn't valid UTF-8", async () => {
    const res = await uploadFile("notes.txt", Buffer.from([0xca, 0xfe, 0xba, 0xbe]));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/UTF-8/i);
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});

describe("GET /api/tasks/:id/files/:fileId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the file belongs to a different user", async () => {
    const fileDoc = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          taskId: "task-1",
          userId: "someone-else",
          type: "application/pdf",
          data: PDF_BYTES,
        }),
      }),
    };
    db.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(fileDoc) });

    const res = await request(app).get("/api/tasks/task-1/files/file-1");

    expect(res.status).toBe(403);
  });
});
