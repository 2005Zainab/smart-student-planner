import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app.js";
import { db } from "../shared/firebase.js";
import { deleteQueryInBatches } from "../lib/batchDelete.js";

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req, res, next) => {
    req.user = { uid: "test-user-1" };
    next();
  },
}));

vi.mock("../shared/firebase.js", () => ({
  db: { collection: vi.fn(), batch: vi.fn() },
}));

const SERIES_ID = "series-1";

function seriesData(overrides = {}) {
  return {
    userId: "test-user-1",
    template: {
      title: "Study",
      description: "",
      subject: "Math",
      time: "09:00",
      checklist: [],
      reminderOffsetDays: null,
      reminderTime: null,
    },
    segments: [{ from: "2026-10-01", until: null, rule: { type: "daily", interval: 1 } }],
    enabled: true,
    pauses: [],
    exceptions: [],
    endDate: null,
    ...overrides,
  };
}

// Oct 1 2026 is a Thursday, so Oct 2 (today in these tests) is not on this schedule.
const WEEKLY_THURSDAY = [
  { from: "2026-10-01", until: null, rule: { type: "weekly", interval: 1, weekdays: [4] } },
];

// ---------------------------------------------------------------------------------------------
// Mock for single-occurrence delete (and DELETE /tasks/:id).
// series: null simulates a missing series. task: null means no materialized doc.
// ---------------------------------------------------------------------------------------------
function mockStore({ series = seriesData(), task = null, timezone = "UTC" } = {}) {
  const seriesRef = {
    get: vi
      .fn()
      .mockResolvedValue(
        series ? { exists: true, id: SERIES_ID, data: () => series } : { exists: false },
      ),
  };
  const taskRef = {
    get: vi.fn().mockResolvedValue(task ? { exists: true, data: () => task } : { exists: false }),
    delete: vi.fn().mockResolvedValue(),
  };
  const batch = { update: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue() };
  db.batch.mockReturnValue(batch);

  db.collection.mockImplementation(name => {
    if (name === "users") {
      return {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ timezone }) }),
        }),
      };
    }
    if (name === "task_series") return { doc: vi.fn().mockReturnValue(seriesRef) };
    if (name === "tasks") return { doc: vi.fn().mockReturnValue(taskRef) };
    return {};
  });

  return { seriesRef, taskRef, batch };
}

// ---------------------------------------------------------------------------------------------
// Mock for whole-series delete. The tasks collection is queried via where().limit().get().
// pageSizes: how many docs each successive query page returns; after that the query is empty.
// series: null simulates a missing series.
// ---------------------------------------------------------------------------------------------
function makeSnapshot(count) {
  return {
    empty: count === 0,
    size: count,
    docs: Array.from({ length: count }, (_, index) => ({ ref: { id: `doc-${index}` } })),
  };
}

function mockSeriesDelete({
  series = { userId: "test-user-1" },
  pageSizes = [],
  failCommit = false,
} = {}) {
  const events = [];
  const pages = [...pageSizes];

  const seriesRef = {
    get: vi
      .fn()
      .mockResolvedValue(series ? { exists: true, data: () => series } : { exists: false }),
    delete: vi.fn().mockImplementation(async () => {
      events.push("series.delete");
    }),
  };

  const get = vi.fn().mockImplementation(async () => makeSnapshot(pages.shift() ?? 0));
  const limit = vi.fn().mockReturnValue({ get });
  const where = vi.fn().mockReturnValue({ limit });

  const batches = [];
  db.batch.mockImplementation(() => {
    const batch = {
      delete: vi.fn(),
      commit: vi.fn().mockImplementation(async () => {
        if (failCommit) throw new Error("commit failed");
        events.push("batch.commit");
      }),
    };
    batches.push(batch);
    return batch;
  });

  db.collection.mockImplementation(name => {
    if (name === "task_series") return { doc: vi.fn().mockReturnValue(seriesRef) };
    if (name === "tasks") return { where };
    return {};
  });

  return { seriesRef, where, limit, batches, events };
}

const occurrenceUrl = date => `/api/task-series/${SERIES_ID}/occurrences/${date}`;
const seriesUrl = `/api/task-series/${SERIES_ID}`;

describe("DELETE /api/task-series/:seriesId/occurrences/:date", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tombstones a virtual occurrence without deleting any task document", async () => {
    const { seriesRef, batch } = mockStore();

    const res = await request(app).delete(occurrenceUrl("2026-10-03"));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Occurrence deleted");
    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.update).toHaveBeenCalledWith(
      seriesRef,
      expect.objectContaining({ exceptions: expect.anything() }),
    );
    expect(batch.delete).not.toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("also deletes the materialized document in the same batch", async () => {
    const { taskRef, batch } = mockStore({
      task: {
        seriesId: SERIES_ID,
        occurrenceDate: "2026-10-03",
        dueDate: "2026-10-03",
        status: "in progress",
        userId: "test-user-1",
      },
    });

    const res = await request(app).delete(occurrenceUrl("2026-10-03"));

    expect(res.status).toBe(200);
    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.delete).toHaveBeenCalledWith(taskRef);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when the recurring task does not exist", async () => {
    const { batch } = mockStore({ series: null });

    const res = await request(app).delete(occurrenceUrl("2026-10-03"));

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("returns 403 when the series belongs to another user", async () => {
    const { batch } = mockStore({ series: seriesData({ userId: "someone-else" }) });

    const res = await request(app).delete(occurrenceUrl("2026-10-03"));

    expect(res.status).toBe(403);
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("returns 410 when the occurrence was already deleted", async () => {
    const { batch } = mockStore({ series: seriesData({ exceptions: ["2026-10-03"] }) });

    const res = await request(app).delete(occurrenceUrl("2026-10-03"));

    expect(res.status).toBe(410);
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("rejects a malformed date", async () => {
    const { batch } = mockStore();

    const res = await request(app).delete(occurrenceUrl("not-a-date"));

    expect(res.status).toBe(400);
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("rejects a date the series never produces", async () => {
    const { batch } = mockStore(); // daily series starting 2026-10-01

    const res = await request(app).delete(occurrenceUrl("2026-09-30"));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/valid occurrence/i);
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("allows deleting a visible off-schedule document (past, completed)", async () => {
    const { taskRef, batch } = mockStore({
      series: seriesData({ segments: WEEKLY_THURSDAY }),
      task: {
        seriesId: SERIES_ID,
        occurrenceDate: "2026-10-02", // Friday: not scheduled, but dated today
        dueDate: "2026-10-02",
        status: "completed",
        userId: "test-user-1",
      },
    });

    const res = await request(app).delete(occurrenceUrl("2026-10-02"));

    expect(res.status).toBe(200);
    expect(batch.delete).toHaveBeenCalledWith(taskRef);
  });

  it("rejects a hidden future pending off-schedule document", async () => {
    const { batch } = mockStore({
      series: seriesData({ segments: WEEKLY_THURSDAY }),
      task: {
        seriesId: SERIES_ID,
        occurrenceDate: "2026-10-09", // Friday, in the future
        dueDate: "2026-10-09",
        status: "to do",
        userId: "test-user-1",
      },
    });

    const res = await request(app).delete(occurrenceUrl("2026-10-09"));

    expect(res.status).toBe(400);
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("returns 500 when the batch commit fails", async () => {
    const { batch } = mockStore();
    batch.commit.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "log").mockImplementation(() => {});

    const res = await request(app).delete(occurrenceUrl("2026-10-03"));

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/task-series/:seriesId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("deletes the series document when it has no materialized occurrences", async () => {
    const { seriesRef, batches } = mockSeriesDelete();

    const res = await request(app).delete(seriesUrl);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Series deleted");
    expect(batches).toHaveLength(0);
    expect(seriesRef.delete).toHaveBeenCalledTimes(1);
  });

  it("queries materialized occurrences by seriesId", async () => {
    const { where } = mockSeriesDelete({ pageSizes: [3] });

    await request(app).delete(seriesUrl);

    expect(where).toHaveBeenCalledWith("seriesId", "==", SERIES_ID);
  });

  it("deletes occurrences in commits of at most 500, then the series in its own final step", async () => {
    const { limit, batches, events } = mockSeriesDelete({ pageSizes: [500, 500, 120] });

    const res = await request(app).delete(seriesUrl);

    expect(res.status).toBe(200);
    expect(limit).toHaveBeenCalledWith(500);
    expect(batches.map(batch => batch.delete.mock.calls.length)).toEqual([500, 500, 120]);
    expect(events).toEqual(["batch.commit", "batch.commit", "batch.commit", "series.delete"]);
  });

  it("returns 404 when the recurring task does not exist", async () => {
    const { seriesRef, where, batches } = mockSeriesDelete({ series: null });

    const res = await request(app).delete(seriesUrl);

    expect(res.status).toBe(404);
    expect(where).not.toHaveBeenCalled();
    expect(batches).toHaveLength(0);
    expect(seriesRef.delete).not.toHaveBeenCalled();
  });

  it("returns 403 and deletes nothing when the series belongs to another user", async () => {
    const { seriesRef, where, batches } = mockSeriesDelete({
      series: { userId: "someone-else" },
      pageSizes: [3],
    });

    const res = await request(app).delete(seriesUrl);

    expect(res.status).toBe(403);
    expect(where).not.toHaveBeenCalled();
    expect(batches).toHaveLength(0);
    expect(seriesRef.delete).not.toHaveBeenCalled();
  });

  it("keeps the series document and returns 500 when an occurrence batch fails", async () => {
    const { seriesRef } = mockSeriesDelete({ pageSizes: [3], failCommit: true });

    const res = await request(app).delete(seriesUrl);

    expect(res.status).toBe(500);
    expect(seriesRef.delete).not.toHaveBeenCalled();
  });
});

describe("deleteQueryInBatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pages through the query until it is empty and returns the total deleted", async () => {
    const { limit, batches } = mockSeriesDelete({ pageSizes: [2, 2, 1] });
    const query = db.collection("tasks").where("seriesId", "==", SERIES_ID);

    const deleted = await deleteQueryInBatches(query, 2);

    expect(deleted).toBe(5);
    expect(limit).toHaveBeenCalledWith(2);
    expect(batches.map(batch => batch.delete.mock.calls.length)).toEqual([2, 2, 1]);
  });

  it("commits nothing for an empty query", async () => {
    const { batches } = mockSeriesDelete();
    const query = db.collection("tasks").where("seriesId", "==", SERIES_ID);

    expect(await deleteQueryInBatches(query)).toBe(0);
    expect(batches).toHaveLength(0);
  });
});

describe("DELETE /api/tasks/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to delete a materialized recurring occurrence", async () => {
    const { taskRef } = mockStore({
      task: { seriesId: SERIES_ID, occurrenceDate: "2026-10-03", userId: "test-user-1" },
    });

    const res = await request(app).delete(`/api/tasks/${SERIES_ID}_2026-10-03`);

    expect(res.status).toBe(400);
    expect(taskRef.delete).not.toHaveBeenCalled();
  });

  it("still deletes a one-off task", async () => {
    const { taskRef } = mockStore({
      task: { title: "One off", dueDate: "2026-10-03", userId: "test-user-1" },
    });

    const res = await request(app).delete("/api/tasks/one-off-1");

    expect(res.status).toBe(200);
    expect(taskRef.delete).toHaveBeenCalledTimes(1);
  });
});
