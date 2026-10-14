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
  db: { collection: vi.fn(), runTransaction: vi.fn() },
}));

const occurrenceDate = "2026-10-03";
const url = date => `/api/task-series/series-1/occurrences/${date}`;

function makeSeries(overrides = {}) {
  return {
    userId: "test-user-1",
    template: {
      title: "Template title",
      description: "Template description",
      subject: "Math",
      time: "09:00",
      checklist: [{ text: "Read chapter" }],
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
  };
}

function makeExistingTask(date, overrides = {}) {
  return {
    seriesId: "series-1",
    occurrenceDate: date,
    userId: "test-user-1",
    title: "Stored title",
    description: "Stored description",
    subject: "Science",
    time: null,
    checklist: [{ id: "item-1", text: "Stored item", completed: true }],
    status: "To Do",
    dueDate: date,
    reminderDate: null,
    reminderTime: null,
    ...overrides,
  };
}

/**
 * Simple in-memory Firestore stand-in. Transactions run the callback once and apply the
 * buffered writes afterwards; there is deliberately no conflict detection or retry.
 *
 * `committedWrites` records every write (transactional or direct) so tests can assert
 * that the series doc was never written.
 */
function configureFirestore({
  series = makeSeries(),
  seriesExists = true,
  task = null,
  extraTasks = [],
  userData = { timezone: "UTC" },
} = {}) {
  const taskState = new Map();
  const committedWrites = [];

  if (task) taskState.set(`${task.seriesId}_${task.occurrenceDate}`, task);
  for (const extraTask of extraTasks) taskState.set(extraTask.id, extraTask.data);

  const seriesPath = "task_series/series-1";

  function snapshotFor(path) {
    if (path.startsWith("task_series/")) {
      const data = seriesExists ? structuredClone(series) : undefined;
      return { exists: seriesExists, id: path.split("/")[1], data: () => data };
    }
    const id = path.slice("tasks/".length);
    const data = taskState.has(id) ? structuredClone(taskState.get(id)) : undefined;
    return { exists: data !== undefined, id, data: () => data };
  }

  function applyWrite({ path, type, data, options }) {
    committedWrites.push({ path, type, data });
    if (!path.startsWith("tasks/")) return;
    const id = path.slice("tasks/".length);
    const current = taskState.get(id) ?? {};
    const merge = type === "update" || options?.merge;
    taskState.set(id, merge ? { ...current, ...data } : data);
  }

  const seriesRef = {
    id: "series-1",
    path: seriesPath,
    get: vi.fn(async () => snapshotFor(seriesPath)),
    update: vi.fn(async data => applyWrite({ path: seriesPath, type: "update", data })),
    set: vi.fn(async (data, options) =>
      applyWrite({ path: seriesPath, type: "set", data, options }),
    ),
  };

  const taskRefFor = id => {
    const path = `tasks/${id}`;
    return {
      id,
      path,
      get: vi.fn(async () => snapshotFor(path)),
      set: vi.fn(async (data, options) => applyWrite({ path, type: "set", data, options })),
      update: vi.fn(async data => applyWrite({ path, type: "update", data })),
    };
  };

  db.collection.mockImplementation(collectionName => {
    if (collectionName === "users") {
      return {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => userData }),
        }),
      };
    }
    if (collectionName === "task_series") {
      return { doc: vi.fn().mockReturnValue(seriesRef) };
    }
    if (collectionName === "tasks") {
      return { doc: vi.fn().mockImplementation(taskRefFor) };
    }
    return {};
  });

  db.runTransaction.mockImplementation(async callback => {
    const writes = [];
    const transaction = {
      get: async ref => snapshotFor(ref.path),
      set: (ref, data, options) => {
        writes.push({ path: ref.path, type: "set", data, options });
        return transaction;
      },
      update: (ref, data) => {
        writes.push({ path: ref.path, type: "update", data });
        return transaction;
      },
    };
    const result = await callback(transaction);
    writes.forEach(applyWrite);
    return result;
  });

  return {
    taskState,
    committedWrites,
    seriesWrites: () => committedWrites.filter(w => w.path.startsWith("task_series/")),
  };
}

describe("PATCH /api/task-series/:seriesId/occurrences/:date", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fake only Date so supertest's real I/O is unaffected.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("first materialization", () => {
    it("materializes a valid occurrence from the template with explicit fields overriding it", async () => {
      const { taskState } = configureFirestore();

      const res = await request(app)
        .patch(url(occurrenceDate))
        .send({ title: "Custom title", status: "In Progress" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        seriesId: "series-1",
        occurrenceDate,
        userId: "test-user-1",
        title: "Custom title",
        description: "Template description",
        subject: "Math",
        time: "09:00",
        dueDate: occurrenceDate,
        status: "In Progress",
        reminderDate: "2026-10-02",
        reminderTime: "08:00",
        virtual: false,
      });
      expect(res.body.checklist).toHaveLength(1);
      expect(res.body.checklist[0]).toMatchObject({ text: "Read chapter", completed: false });
      expect(taskState.get(`series-1_${occurrenceDate}`)).toMatchObject({
        title: "Custom title",
        status: "In Progress",
        dueDate: occurrenceDate,
      });
    });

    it("defaults status to 'To Do' and copies every other content field from the template", async () => {
      const { taskState } = configureFirestore();

      const res = await request(app).patch(url(occurrenceDate)).send({ title: "Only title" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        title: "Only title",
        description: "Template description",
        subject: "Math",
        time: "09:00",
        status: "To Do",
        dueDate: occurrenceDate,
        occurrenceDate,
      });
      expect(taskState.get(`series-1_${occurrenceDate}`).status).toBe("To Do");
    });

    it("assigns unique ids to checklist items and starts them uncompleted", async () => {
      const series = makeSeries({
        template: {
          ...makeSeries().template,
          checklist: [{ text: "One" }, { text: "Two" }],
        },
      });
      configureFirestore({ series });

      const res = await request(app).patch(url(occurrenceDate)).send({ title: "Checklist" });

      expect(res.status).toBe(200);
      expect(res.body.checklist).toHaveLength(2);
      const ids = res.body.checklist.map(item => item.id);
      expect(ids.every(id => typeof id === "string" && id.length > 0)).toBe(true);
      expect(new Set(ids).size).toBe(2);
      expect(res.body.checklist.map(item => item.completed)).toEqual([false, false]);
      expect(res.body.checklist.map(item => item.text)).toEqual(["One", "Two"]);
    });

    it("writes only this occurrence's doc and never touches the series doc", async () => {
      const { taskState, seriesWrites } = configureFirestore();

      const res = await request(app).patch(url(occurrenceDate)).send({ title: "Solo" });

      expect(res.status).toBe(200);
      expect([...taskState.keys()]).toEqual([`series-1_${occurrenceDate}`]);
      expect(seriesWrites()).toEqual([]);
    });

    it("sets reminderDate/reminderTime to null for a missed (past) occurrence", async () => {
      // Server today is 2026-10-02 (UTC); 2026-10-01 is a valid, earlier occurrence (§7).
      configureFirestore();

      const res = await request(app).patch(url("2026-10-01")).send({ title: "Missed" });

      expect(res.status).toBe(200);
      expect(res.body.reminderDate).toBeNull();
      expect(res.body.reminderTime).toBeNull();
    });

    it("leaves reminders null when the template has no reminder", async () => {
      const series = makeSeries({
        template: { ...makeSeries().template, reminderOffsetDays: null, reminderTime: null },
      });
      configureFirestore({ series });

      const res = await request(app).patch(url(occurrenceDate)).send({ title: "No reminder" });

      expect(res.status).toBe(200);
      expect(res.body.reminderDate).toBeNull();
      expect(res.body.reminderTime).toBeNull();
    });

    it("derives 'today' from the user's timezone when computing reminders", async () => {
      // Mocked instant 2026-10-02T12:00Z is already 2026-10-03 01:00 in Auckland (UTC+13).
      // 2026-10-02 is therefore "today or later" in UTC (reminder computed) but a missed
      // occurrence in Auckland (reminder null).
      configureFirestore({ userData: { timezone: "Pacific/Auckland" } });
      const auckland = await request(app).patch(url("2026-10-02")).send({ title: "NZ" });

      configureFirestore({ userData: { timezone: "UTC" } });
      const utc = await request(app).patch(url("2026-10-02")).send({ title: "UTC" });

      expect(auckland.status).toBe(200);
      expect(auckland.body.reminderDate).toBeNull();
      expect(auckland.body.reminderTime).toBeNull();

      expect(utc.status).toBe(200);
      expect(utc.body.reminderDate).toBe("2026-10-01");
      expect(utc.body.reminderTime).toBe("08:00");
    });

    it("defaults to UTC when the user has no stored timezone", async () => {
      configureFirestore({ userData: {} });

      const res = await request(app).patch(url("2026-10-02")).send({ title: "Default tz" });

      expect(res.status).toBe(200);
      expect(res.body.reminderDate).toBe("2026-10-01");
    });
  });

  describe("subsequent edits", () => {
    it("does not reapply a changed template on subsequent occurrence edits", async () => {
      const existing = {
        seriesId: "series-1",
        occurrenceDate,
        userId: "test-user-1",
        title: "Occurrence-specific title",
        description: "Old description",
        subject: "Math",
        time: "09:00",
        checklist: [],
        status: "To Do",
        reminderDate: "2026-10-02",
        reminderTime: "08:00",
      };
      const { taskState } = configureFirestore({
        task: existing,
        series: makeSeries({
          template: { ...makeSeries().template, title: "New template title" },
        }),
      });

      const res = await request(app)
        .patch(url(occurrenceDate))
        .send({ description: "New description" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Occurrence-specific title");
      expect(res.body.description).toBe("New description");
      expect(taskState.get(`series-1_${occurrenceDate}`).title).toBe("Occurrence-specific title");
    });

    it("changes only the supplied fields, leaving every unsupplied field as stored", async () => {
      // Stored values deliberately differ from the template (subject, time, checklist,
      // reminders) so any template re-merge would be visible.
      const existing = makeExistingTask(occurrenceDate);
      const { taskState } = configureFirestore({ task: existing });

      const res = await request(app).patch(url(occurrenceDate)).send({ description: "Changed" });

      expect(res.status).toBe(200);
      const stored = taskState.get(`series-1_${occurrenceDate}`);
      expect(stored).toMatchObject({ ...existing, description: "Changed" });
      expect(stored.checklist).toEqual([{ id: "item-1", text: "Stored item", completed: true }]);
      expect(stored.time).toBeNull();
      expect(stored.reminderDate).toBeNull();
      expect(stored.reminderTime).toBeNull();
    });

    it("preserves stored status unless explicitly changed", async () => {
      const existing = {
        seriesId: "series-1",
        occurrenceDate,
        userId: "test-user-1",
        title: "Study",
        description: "",
        subject: "Math",
        time: null,
        checklist: [],
        status: "In Progress",
        reminderDate: null,
        reminderTime: null,
      };
      configureFirestore({ task: existing });

      const res = await request(app).patch(url(occurrenceDate)).send({ title: "Updated study" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("In Progress");
    });

    it("allows an unchanged due date and isolates the occurrence and series from the write", async () => {
      const otherOccurrence = {
        id: "series-1_2026-10-04",
        data: {
          seriesId: "series-1",
          occurrenceDate: "2026-10-04",
          status: "To Do",
        },
      };
      const { taskState, seriesWrites } = configureFirestore({
        extraTasks: [otherOccurrence],
      });

      const res = await request(app)
        .patch(url(occurrenceDate))
        .send({ dueDate: occurrenceDate, status: "Completed" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("Completed");
      expect(taskState.get(otherOccurrence.id)).toEqual(otherOccurrence.data);
      expect(seriesWrites()).toEqual([]);
    });

    it("recomputes priority on the response instead of returning a stale stored value", async () => {
      // The exact priority mapping is covered by getPriorityFromDueDate's unit tests;
      // here we only assert the route recomputes it.
      configureFirestore({
        task: makeExistingTask(occurrenceDate, { priority: "STALE" }),
      });

      const res = await request(app).patch(url(occurrenceDate)).send({ title: "Recompute" });

      expect(res.status).toBe(200);
      expect(res.body.priority).toBeDefined();
      expect(res.body.priority).not.toBe("STALE");
    });
  });

  describe("validation and rejections", () => {
    it("rejects moving an occurrence to another due date", async () => {
      configureFirestore();

      const res = await request(app).patch(url(occurrenceDate)).send({ dueDate: "2026-10-04" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/due date/i);
      expect(db.runTransaction).not.toHaveBeenCalled();
    });

    it("rejects an unrecognized status value", async () => {
      const { taskState } = configureFirestore();

      const res = await request(app).patch(url(occurrenceDate)).send({ status: "Banana" });

      expect(res.status).toBe(400);
      expect(db.runTransaction).not.toHaveBeenCalled();
      expect(taskState.size).toBe(0);
    });

    it("ignores seriesId, occurrenceDate and userId supplied in the body", async () => {
      const { taskState } = configureFirestore();

      const res = await request(app).patch(url(occurrenceDate)).send({
        title: "Spoof attempt",
        seriesId: "other-series",
        occurrenceDate: "2026-12-31",
        userId: "attacker",
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        seriesId: "series-1",
        occurrenceDate,
        userId: "test-user-1",
      });
      expect([...taskState.keys()]).toEqual([`series-1_${occurrenceDate}`]);
      expect(taskState.get(`series-1_${occurrenceDate}`)).toMatchObject({
        seriesId: "series-1",
        occurrenceDate,
        userId: "test-user-1",
      });
    });

    it("returns 404 when the series does not exist", async () => {
      const { taskState } = configureFirestore({ seriesExists: false });

      const res = await request(app).patch(url(occurrenceDate)).send({ title: "Nope" });

      expect(res.status).toBe(404);
      expect(taskState.size).toBe(0);
    });

    it("returns 403 when the series belongs to another user", async () => {
      const { taskState } = configureFirestore({
        series: makeSeries({ userId: "someone-else" }),
      });

      const res = await request(app).patch(url(occurrenceDate)).send({ title: "Not yours" });

      expect(res.status).toBe(403);
      expect(taskState.size).toBe(0);
    });

    it("returns 410 for a deleted (excepted) occurrence", async () => {
      const { taskState } = configureFirestore({
        series: makeSeries({ exceptions: [occurrenceDate] }),
      });

      const res = await request(app).patch(url(occurrenceDate)).send({ title: "Too late" });

      expect(res.status).toBe(410);
      expect(res.body.message).toMatch(/deleted/i);
      expect(taskState.size).toBe(0);
    });

    it("returns 410 for an excepted date even if a materialized doc somehow exists", async () => {
      const existing = makeExistingTask(occurrenceDate);
      const { taskState } = configureFirestore({
        series: makeSeries({ exceptions: [occurrenceDate] }),
        task: existing,
      });

      const res = await request(app).patch(url(occurrenceDate)).send({ title: "Tombstoned" });

      expect(res.status).toBe(410);
      expect(taskState.get(`series-1_${occurrenceDate}`)).toEqual(existing);
    });

    it.each([
      [
        "after the segment ends",
        {
          segments: [
            { from: "2026-10-01", until: "2026-10-03", rule: { type: "daily", interval: 1 } },
          ],
        },
        "2026-10-20",
      ],
      ["before the series starts", {}, "2026-09-01"],
      ["after the series endDate", { endDate: "2026-10-05" }, "2026-10-08"],
      [
        "inside a pause window",
        { enabled: false, pauses: [{ from: "2026-10-03", until: null }] },
        "2026-10-04",
      ],
      [
        "off-pattern for an interval rule",
        {
          segments: [{ from: "2026-10-01", until: null, rule: { type: "daily", interval: 2 } }],
        },
        "2026-10-02",
      ],
    ])(
      "rejects a date that is not on the schedule and has no doc (%s)",
      async (_label, overrides, date) => {
        const { taskState } = configureFirestore({ series: makeSeries(overrides) });

        const res = await request(app).patch(url(date)).send({ title: "Not scheduled" });

        expect(res.status).toBe(400);
        expect(db.runTransaction).not.toHaveBeenCalled();
        expect(taskState.size).toBe(0);
      },
    );
  });

  describe("materialized docs the schedule no longer produces", () => {
    const endedSeries = () =>
      makeSeries({
        segments: [
          { from: "2026-10-01", until: "2026-10-03", rule: { type: "daily", interval: 1 } },
        ],
      });

    it("rejects a hidden future pending ('To Do') materialized document", async () => {
      const hiddenDate = "2026-10-10";
      const hiddenTask = {
        seriesId: "series-1",
        occurrenceDate: hiddenDate,
        userId: "test-user-1",
        title: "Hidden",
        status: "To Do",
      };
      configureFirestore({ series: endedSeries(), task: hiddenTask });

      const res = await request(app).patch(url(hiddenDate)).send({ title: "Should fail" });

      expect(res.status).toBe(400);
    });

    it("rejects a hidden future 'In Progress' materialized document", async () => {
      const hiddenDate = "2026-10-10";
      const hiddenTask = makeExistingTask(hiddenDate, { status: "In Progress" });
      const { taskState } = configureFirestore({ series: endedSeries(), task: hiddenTask });

      const res = await request(app).patch(url(hiddenDate)).send({ title: "Should fail" });

      expect(res.status).toBe(400);
      expect(taskState.get(`series-1_${hiddenDate}`)).toEqual(hiddenTask);
    });

    it("allows editing a past off-schedule materialized document", async () => {
      const pastDate = "2026-09-30";
      const pastTask = {
        seriesId: "series-1",
        occurrenceDate: pastDate,
        userId: "test-user-1",
        title: "Past occurrence",
        status: "Completed",
      };
      const series = makeSeries({
        segments: [{ from: "2026-10-01", until: null, rule: { type: "daily", interval: 1 } }],
      });
      configureFirestore({ series, task: pastTask });

      const res = await request(app).patch(url(pastDate)).send({ title: "Updated history" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Updated history");
    });

    it("lets the user un-complete a past off-schedule completed document", async () => {
      const pastDate = "2026-09-30";
      const pastTask = makeExistingTask(pastDate, { status: "Completed" });
      const series = makeSeries({
        segments: [{ from: "2026-10-01", until: null, rule: { type: "daily", interval: 1 } }],
      });
      const { taskState } = configureFirestore({ series, task: pastTask });

      const res = await request(app).patch(url(pastDate)).send({ status: "To Do" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("To Do");
      expect(taskState.get(`series-1_${pastDate}`).status).toBe("To Do");
    });

    it("allows editing a future off-schedule document that is completed", async () => {
      const futureDate = "2026-10-10";
      const futureTask = makeExistingTask(futureDate, { status: "Completed" });
      const { taskState } = configureFirestore({ series: endedSeries(), task: futureTask });

      const res = await request(app).patch(url(futureDate)).send({ title: "Still editable" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Still editable");
      expect(taskState.get(`series-1_${futureDate}`)).toMatchObject({
        status: "Completed",
        title: "Still editable",
      });
    });
  });
});
