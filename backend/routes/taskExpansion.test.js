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

function snapshot(docs) {
  return {
    empty: docs.length === 0,
    forEach: callback => docs.forEach(callback),
  };
}

function mockCollections({ taskDocs = [], seriesDocs = [], timezone = "UTC" } = {}) {
  const userDoc = {
    get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ timezone }) }),
  };
  const taskQuery = { get: vi.fn().mockResolvedValue(snapshot(taskDocs)) };
  const seriesQuery = { get: vi.fn().mockResolvedValue(snapshot(seriesDocs)) };

  db.collection.mockImplementation(collectionName => {
    if (collectionName === "users") return { doc: vi.fn().mockReturnValue(userDoc) };
    if (collectionName === "tasks") return { where: vi.fn().mockReturnValue(taskQuery) };
    if (collectionName === "task_series") return { where: vi.fn().mockReturnValue(seriesQuery) };
    return {};
  });
}

function seriesDoc(id, overrides = {}) {
  return {
    id,
    data: () => ({
      userId: "test-user-1",
      template: {
        title: "Study",
        description: "",
        subject: "Math",
        time: "09:00",
        checklist: [],
        reminderOffsetDays: 1,
        reminderTime: "08:00",
      },
      segments: [
        {
          from: "2026-10-01",
          until: null,
          rule: { type: "daily", interval: 1 },
        },
      ],
      enabled: true,
      pauses: [],
      exceptions: [],
      endDate: null,
      ...overrides,
    }),
  };
}

describe("recurring task expansion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns missed, today, and next virtual occurrences with computed reminders", async () => {
    mockCollections({ seriesDocs: [seriesDoc("series-1")] });

    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(200);
    expect(res.body.map(task => task.dueDate)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(res.body[0]).toMatchObject({
      virtual: true,
      status: "To Do",
      dueDate: "2026-10-01",
      reminderDate: null,
      reminderTime: null,
      priority: "High",
      series: { enabled: true },
    });
    expect(res.body[2]).toMatchObject({
      virtual: true,
      reminderDate: "2026-10-02",
      reminderTime: "08:00",
    });
  });

  it("merges materialized occurrences and applies visibility rules", async () => {
    const taskDocs = [
      {
        id: "series-1_2026-10-02",
        data: () => ({
          seriesId: "series-1",
          occurrenceDate: "2026-10-02",
          dueDate: "2026-10-02",
          title: "Custom today",
          status: "in progress",
          userId: "test-user-1",
        }),
      },
      {
        id: "series-1_2026-10-05",
        data: () => ({
          seriesId: "series-1",
          occurrenceDate: "2026-10-05",
          dueDate: "2026-10-05",
          title: "Hidden pending",
          status: "to do",
          userId: "test-user-1",
        }),
      },
      {
        id: "series-1_2026-10-06",
        data: () => ({
          seriesId: "series-1",
          occurrenceDate: "2026-10-06",
          dueDate: "2026-10-06",
          title: "Completed off schedule",
          status: "completed",
          userId: "test-user-1",
        }),
      },
      {
        id: "series-1_2026-10-07",
        data: () => ({
          seriesId: "series-1",
          occurrenceDate: "2026-10-07",
          dueDate: "2026-10-07",
          title: "Excepted",
          status: "completed",
          userId: "test-user-1",
        }),
      },
    ];
    const series = seriesDoc("series-1", {
      segments: [
        {
          from: "2026-10-01",
          until: "2026-10-04",
          rule: { type: "daily", interval: 1 },
        },
        {
          from: "2026-10-08",
          until: null,
          rule: { type: "daily", interval: 1 },
        },
      ],
      exceptions: ["2026-10-07"],
    });
    mockCollections({ taskDocs, seriesDocs: [series] });

    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(200);
    expect(res.body.find(task => task.title === "Custom today")).toBeDefined();
    expect(res.body.find(task => task.title === "Completed off schedule")).toBeDefined();
    expect(res.body.find(task => task.title === "Hidden pending")).toBeUndefined();
    expect(res.body.find(task => task.title === "Excepted")).toBeUndefined();
    expect(res.body.find(task => task.title === "Custom today").series).toEqual({ enabled: true });
  });

  it.each([
    ["enabled", true],
    ["paused", false],
    ["missing enabled", undefined],
  ])("adds series.enabled to virtual and materialized occurrences when %s", async (_, enabled) => {
    const taskDocs = [
      {
        id: "series-1_2026-10-02",
        data: () => ({
          seriesId: "series-1",
          occurrenceDate: "2026-10-02",
          dueDate: "2026-10-02",
          title: "Materialized",
          status: "In Progress",
          userId: "test-user-1",
        }),
      },
    ];
    const series = seriesDoc(
      "series-1",
      enabled === undefined ? { enabled: undefined } : { enabled },
    );
    mockCollections({ taskDocs, seriesDocs: [series] });

    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(200);
    expect(res.body.find(task => task.title === "Materialized").series).toEqual({
      enabled: enabled ?? true,
    });
    expect(res.body.find(task => task.dueDate === "2026-10-01").series).toEqual({
      enabled: enabled ?? true,
    });
  });

  it("includes one-offs and scheduled or visible materialized docs in calendar ranges", async () => {
    const taskDocs = [
      {
        id: "one-off-1",
        data: () => ({
          title: "One off",
          dueDate: "2026-10-03",
          status: "To Do",
          userId: "test-user-1",
        }),
      },
      {
        id: "series-1_2026-10-08",
        data: () => ({
          seriesId: "series-1",
          occurrenceDate: "2026-10-08",
          dueDate: "2026-10-08",
          title: "Edited occurrence",
          status: "to do",
          userId: "test-user-1",
        }),
      },
    ];
    const series = seriesDoc("series-1", {
      segments: [
        {
          from: "2026-10-01",
          until: null,
          rule: { type: "weekly", interval: 1, weekdays: [4] },
        },
      ],
    });
    mockCollections({ taskDocs, seriesDocs: [series] });

    const res = await request(app).get("/api/tasks/calendar?from=2026-10-01&to=2026-10-08");

    expect(res.status).toBe(200);
    expect(res.body.find(task => task.title === "One off")).toBeDefined();
    expect(
      res.body.find(task => task.title === "Study" && task.dueDate === "2026-10-01"),
    ).toBeDefined();
    expect(res.body.find(task => task.title === "Edited occurrence")).toBeDefined();
    expect(res.body.find(task => task.title === "Edited occurrence").series).toEqual({
      enabled: true,
    });
    expect(
      res.body.find(task => task.title === "Study" && task.dueDate === "2026-10-01").series,
    ).toEqual({
      enabled: true,
    });
  });

  it("adds series.enabled to paused and default-enabled calendar occurrences", async () => {
    const taskDocs = [
      {
        id: "series-1_2026-10-02",
        data: () => ({
          seriesId: "series-1",
          occurrenceDate: "2026-10-02",
          dueDate: "2026-10-02",
          title: "Paused materialized",
          status: "In Progress",
          userId: "test-user-1",
        }),
      },
    ];
    mockCollections({
      taskDocs,
      seriesDocs: [
        seriesDoc("series-1", {
          enabled: false,
          pauses: [{ from: "2026-10-03", until: null }],
        }),
      ],
    });

    const paused = await request(app).get("/api/tasks/calendar?from=2026-10-01&to=2026-10-03");

    expect(paused.status).toBe(200);
    expect(paused.body.find(task => task.title === "Paused materialized").series).toEqual({
      enabled: false,
    });
    expect(paused.body.find(task => task.dueDate === "2026-10-01").series).toEqual({
      enabled: false,
    });

    mockCollections({ taskDocs: [], seriesDocs: [seriesDoc("series-1", { enabled: undefined })] });
    const defaultEnabled = await request(app).get(
      "/api/tasks/calendar?from=2026-10-01&to=2026-10-01",
    );

    expect(defaultEnabled.status).toBe(200);
    expect(defaultEnabled.body[0].series).toEqual({ enabled: true });
  });

  it.each([
    ["/api/tasks/calendar", "", "2026-10-08"],
    ["/api/tasks/calendar?from=2026-10-09&to=2026-10-08", null, null],
    ["/api/tasks/calendar?from=bad&to=2026-10-08", null, null],
  ])("rejects invalid calendar range %s", async path => {
    mockCollections();
    const res = await request(app).get(path);
    expect(res.status).toBe(400);
  });
});
