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

const seriesUrl = "/api/task-series/series-1";

function makeSeries(overrides = {}) {
  return {
    userId: "test-user-1",
    template: {
      title: "Template title",
      description: "Template description",
      subject: "Math",
      time: "09:00",
      checklist: [{ text: "Read chapter" }],
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

function makeMaterialized(date, overrides = {}) {
  return {
    seriesId: "series-1",
    occurrenceDate: date,
    userId: "test-user-1",
    title: "Stored title",
    description: "Stored description",
    subject: "Science",
    time: null,
    checklist: [],
    status: "To Do",
    dueDate: date,
    reminderDate: null,
    reminderTime: null,
    ...overrides,
  };
}

function matchesFilter(data, { field, op, value }) {
  const actual = data[field];
  switch (op) {
    case "==":
      return actual === value;
    case ">=":
      return actual >= value;
    case "<=":
      return actual <= value;
    case ">":
      return actual > value;
    case "<":
      return actual < value;
    default:
      throw new Error(`Unsupported where operator in test mock: ${op}`);
  }
}

/**
 * Stateful in-memory Firestore stand-in. Unlike the occurrence tests, series state is
 * mutable and persists across requests, so pause -> resume round trips can run through
 * the real routes. Transactions run the callback once and apply buffered writes after;
 * there is deliberately no conflict detection or retry.
 */
function configureFirestore({
  series = makeSeries(),
  seriesExists = true,
  tasks = [],
  userData = { timezone: "UTC" },
} = {}) {
  const state = { series: seriesExists ? structuredClone(series) : null };
  const taskState = new Map(tasks.map(t => [`${t.seriesId}_${t.occurrenceDate}`, t]));
  const committedWrites = [];
  const seriesPath = "task_series/series-1";

  function snapshotFor(path) {
    if (path.startsWith("task_series/")) {
      const data = state.series ? structuredClone(state.series) : undefined;
      return { exists: Boolean(state.series), id: "series-1", data: () => data };
    }
    const id = path.slice("tasks/".length);
    const data = taskState.has(id) ? structuredClone(taskState.get(id)) : undefined;
    return { exists: data !== undefined, id, data: () => data };
  }

  function applyWrite({ path, type, data, options }) {
    committedWrites.push({ path, type, data });
    if (path.startsWith("task_series/")) {
      // FieldValue.serverTimestamp() sentinels aren't meaningful in this in-memory store.
      const stored = { ...data };
      delete stored.updatedAt;
      const merge = type === "update" || options?.merge;
      state.series = merge ? { ...state.series, ...stored } : stored;
      return;
    }
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

  function entriesFor(collectionName) {
    if (collectionName === "task_series") {
      return state.series ? [{ id: "series-1", data: state.series }] : [];
    }
    return [...taskState].map(([id, data]) => ({ id, data }));
  }

  function makeQuery(collectionName, filters = []) {
    const query = {
      where: (field, op, value) => makeQuery(collectionName, [...filters, { field, op, value }]),
      orderBy: () => query,
      limit: () => query,
      get: async () => {
        const docs = entriesFor(collectionName)
          .filter(entry => filters.every(f => matchesFilter(entry.data, f)))
          .map(entry => ({
            id: entry.id,
            exists: true,
            data: () => structuredClone(entry.data),
            ref: { id: entry.id, path: `${collectionName}/${entry.id}` },
          }));
        return {
          docs,
          size: docs.length,
          empty: docs.length === 0,
          forEach: cb => docs.forEach(cb),
        };
      },
    };
    return query;
  }

  db.collection.mockImplementation(collectionName => {
    if (collectionName === "users") {
      return {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => userData }),
        }),
      };
    }
    if (collectionName === "task_series") {
      return Object.assign(makeQuery("task_series"), {
        doc: vi.fn().mockReturnValue(seriesRef),
      });
    }
    if (collectionName === "tasks") {
      return Object.assign(makeQuery("tasks"), { doc: vi.fn().mockImplementation(taskRefFor) });
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
    getSeries: () => structuredClone(state.series),
    seriesWrites: () => committedWrites.filter(w => w.path.startsWith("task_series/")),
  };
}

/** §3 invariants for pauses, asserted after every mutation. */
function expectPauseInvariants(series) {
  const { pauses, enabled } = series;
  for (const pause of pauses) {
    if (pause.until !== null) expect(pause.from <= pause.until).toBe(true);
  }
  const open = pauses.filter(p => p.until === null);
  expect(open.length).toBeLessThanOrEqual(1);
  expect(open.length === 1).toBe(enabled === false);
  const froms = pauses.map(p => p.from);
  expect(froms).toEqual([...froms].sort());
}

function setNow(iso) {
  vi.setSystemTime(new Date(iso));
}

const pause = (body = {}) =>
  request(app)
    .patch(seriesUrl)
    .send({ enabled: false, ...body });
const resume = (body = {}) =>
  request(app)
    .patch(seriesUrl)
    .send({ enabled: true, ...body });

async function calendarDates(from, to) {
  const res = await request(app).get("/api/tasks/calendar").query({ from, to });
  expect(res.status).toBe(200);
  return res.body
    .filter(o => o.seriesId === "series-1")
    .map(o => o.dueDate)
    .sort();
}

describe("PATCH /api/task-series/:seriesId — pause and resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fake only Date so supertest's real I/O is unaffected.
    vi.useFakeTimers({ toFake: ["Date"] });
    setNow("2026-10-02T12:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("pause (effective tomorrow)", () => {
    it("opens a pause starting tomorrow and sets enabled to false", async () => {
      const { getSeries } = configureFirestore();

      const res = await pause();

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(res.body.pauses).toEqual([{ from: "2026-10-03", until: null }]);
      const stored = getSeries();
      expect(stored.enabled).toBe(false);
      expect(stored.pauses).toEqual([{ from: "2026-10-03", until: null }]);
      expectPauseInvariants(stored);
    });

    it("never touches segments, exceptions, template or endDate", async () => {
      const series = makeSeries({
        segments: [
          { from: "2026-09-07", until: "2026-09-14", rule: { type: "daily", interval: 2 } },
          { from: "2026-09-15", until: null, rule: { type: "weekly", interval: 1, weekdays: [3] } },
        ],
        exceptions: ["2026-09-30"],
        endDate: "2026-12-31",
      });
      const { getSeries } = configureFirestore({ series });

      const res = await pause();

      expect(res.status).toBe(200);
      const stored = getSeries();
      expect(stored.segments).toEqual(series.segments);
      expect(stored.exceptions).toEqual(series.exceptions);
      expect(stored.template).toEqual(series.template);
      expect(stored.endDate).toBe("2026-12-31");
    });

    it("keeps today's occurrence but removes tomorrow's and later", async () => {
      configureFirestore();

      await pause();
      const dates = await calendarDates("2026-10-01", "2026-10-05");

      expect(dates).toEqual(["2026-10-01", "2026-10-02"]);
    });

    it("is a no-op when the series is already paused", async () => {
      const series = makeSeries({
        enabled: false,
        pauses: [{ from: "2026-09-20", until: null }],
      });
      const { getSeries } = configureFirestore({ series });

      const res = await pause();

      expect(res.status).toBe(200);
      expect(getSeries().pauses).toEqual([{ from: "2026-09-20", until: null }]);
      expect(getSeries().enabled).toBe(false);
    });

    it("appends after earlier closed pauses and keeps pauses sorted", async () => {
      const series = makeSeries({ pauses: [{ from: "2026-09-10", until: "2026-09-12" }] });
      const { getSeries } = configureFirestore({ series });

      const res = await pause();

      expect(res.status).toBe(200);
      expect(getSeries().pauses).toEqual([
        { from: "2026-09-10", until: "2026-09-12" },
        { from: "2026-10-03", until: null },
      ]);
      expectPauseInvariants(getSeries());
    });

    it("uses the user's timezone to decide what 'tomorrow' is", async () => {
      // 2026-10-02T12:00Z is 2026-10-03 01:00 in Auckland, so tomorrow there is 10-04.
      configureFirestore({ userData: { timezone: "Pacific/Auckland" } });
      const auckland = await pause();
      expect(auckland.body.pauses).toEqual([{ from: "2026-10-04", until: null }]);

      configureFirestore({ userData: { timezone: "UTC" } });
      const utc = await pause();
      expect(utc.body.pauses).toEqual([{ from: "2026-10-03", until: null }]);
    });

    it("defaults to UTC when the user has no stored timezone", async () => {
      configureFirestore({ userData: {} });

      const res = await pause();

      expect(res.body.pauses).toEqual([{ from: "2026-10-03", until: null }]);
    });

    describe("guard: nothing visible would remain", () => {
      const futureStart = (overrides = {}) =>
        makeSeries({
          segments: [{ from: "2026-10-10", until: null, rule: { type: "daily", interval: 1 } }],
          ...overrides,
        });

      it("rejects pausing a series whose first occurrence is still in the future", async () => {
        const { getSeries, seriesWrites } = configureFirestore({ series: futureStart() });

        const res = await pause();

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/occurrence on or before today/i);
        expect(seriesWrites()).toEqual([]);
        expect(getSeries().enabled).toBe(true);
        expect(getSeries().pauses).toEqual([]);
      });

      it("rejects pausing when every occurrence up to today has been deleted", async () => {
        const series = makeSeries({ exceptions: ["2026-10-01", "2026-10-02"] });
        const { seriesWrites } = configureFirestore({ series });

        const res = await pause();

        expect(res.status).toBe(400);
        expect(seriesWrites()).toEqual([]);
      });

      it("allows pausing on the day of the first occurrence", async () => {
        const series = makeSeries({
          segments: [{ from: "2026-10-02", until: null, rule: { type: "daily", interval: 1 } }],
        });
        const { getSeries } = configureFirestore({ series });

        const res = await pause();

        expect(res.status).toBe(200);
        expect(getSeries().pauses).toEqual([{ from: "2026-10-03", until: null }]);
      });

      it("uses the user's timezone for the check", async () => {
        // 2026-10-02T12:00Z is already 2026-10-03 in Auckland, so a series starting on
        // 10-03 has its first occurrence "today" there but not in UTC.
        const series = makeSeries({
          segments: [{ from: "2026-10-03", until: null, rule: { type: "daily", interval: 1 } }],
        });
        configureFirestore({ series, userData: { timezone: "Pacific/Auckland" } });
        const auckland = await pause();
        expect(auckland.status).toBe(200);

        configureFirestore({ series, userData: { timezone: "UTC" } });
        const utc = await pause();
        expect(utc.status).toBe(400);
      });

      it("treats pausing an already-paused series as a no-op, not an error", async () => {
        const series = futureStart({
          enabled: false,
          pauses: [{ from: "2026-10-03", until: null }],
        });
        const { getSeries } = configureFirestore({ series });

        const res = await pause();

        expect(res.status).toBe(200);
        expect(getSeries().pauses).toEqual([{ from: "2026-10-03", until: null }]);
      });

      it("does not affect resuming a paused future-start series", async () => {
        const series = futureStart({
          enabled: false,
          pauses: [{ from: "2026-10-03", until: null }],
        });
        const { getSeries } = configureFirestore({ series });

        const res = await resume();

        expect(res.status).toBe(200);
        expect(getSeries().enabled).toBe(true);
        expect(getSeries().pauses).toEqual([]);
      });
    });
  });

  describe("resume (effective today)", () => {
    it("closes the open pause at the day before today and re-enables the series", async () => {
      const series = makeSeries({
        enabled: false,
        pauses: [{ from: "2026-09-25", until: null }],
      });
      const { getSeries } = configureFirestore({ series });

      const res = await resume();

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
      expect(getSeries().pauses).toEqual([{ from: "2026-09-25", until: "2026-10-01" }]);
      expect(getSeries().enabled).toBe(true);
      expectPauseInvariants(getSeries());
    });

    it("makes today's occurrence reappear immediately", async () => {
      // Server today is 2026-10-02. Resume closes the pause at 10-01, so 10-01 stays
      // suppressed while today (10-02) and later come back.
      const series = makeSeries({
        enabled: false,
        pauses: [{ from: "2026-10-01", until: null }],
      });
      configureFirestore({ series });

      const before = await calendarDates("2026-10-01", "2026-10-03");
      await resume();
      const after = await calendarDates("2026-10-01", "2026-10-03");

      expect(before).toEqual([]);
      expect(after).toEqual(["2026-10-02", "2026-10-03"]);
    });

    it("does not backfill the paused window", async () => {
      const series = makeSeries({
        segments: [{ from: "2026-09-20", until: null, rule: { type: "daily", interval: 1 } }],
        enabled: false,
        pauses: [{ from: "2026-09-25", until: null }],
      });
      configureFirestore({ series });

      await resume();
      const dates = await calendarDates("2026-09-20", "2026-10-02");

      // Server today is 2026-10-02, so the pause is closed at 10-01 (inclusive).
      expect(dates).toContain("2026-09-24");
      for (let day = 25; day <= 30; day++) {
        expect(dates).not.toContain(`2026-09-${day}`);
      }
      expect(dates).not.toContain("2026-10-01");
      expect(dates).toContain("2026-10-02");
    });

    it("is a no-op when no pause is open", async () => {
      const { getSeries } = configureFirestore();

      const res = await resume();

      expect(res.status).toBe(200);
      expect(getSeries().pauses).toEqual([]);
      expect(getSeries().enabled).toBe(true);
    });

    it("never touches segments, exceptions or template", async () => {
      const series = makeSeries({
        segments: [{ from: "2026-09-01", until: null, rule: { type: "daily", interval: 2 } }],
        exceptions: ["2026-09-03"],
        enabled: false,
        pauses: [{ from: "2026-09-09", until: null }],
      });
      const { getSeries } = configureFirestore({ series });

      await resume();

      expect(getSeries().segments).toEqual(series.segments);
      expect(getSeries().exceptions).toEqual(series.exceptions);
      expect(getSeries().template).toEqual(series.template);
    });

    it("keeps earlier closed pauses intact when closing the open one", async () => {
      const series = makeSeries({
        enabled: false,
        pauses: [
          { from: "2026-09-05", until: "2026-09-08" },
          { from: "2026-09-25", until: null },
        ],
      });
      const { getSeries } = configureFirestore({ series });

      await resume();

      expect(getSeries().pauses).toEqual([
        { from: "2026-09-05", until: "2026-09-08" },
        { from: "2026-09-25", until: "2026-10-01" },
      ]);
    });
  });

  describe("no inverted or junk pause entries", () => {
    it("same-day pause then resume leaves no pause entry", async () => {
      const { getSeries } = configureFirestore();

      const paused = await pause();
      expect(paused.body.pauses).toEqual([{ from: "2026-10-03", until: null }]);

      const resumed = await resume();

      expect(resumed.status).toBe(200);
      expect(getSeries().pauses).toEqual([]);
      expect(getSeries().enabled).toBe(true);
      expectPauseInvariants(getSeries());
      // Today's occurrence is unaffected.
      expect(await calendarDates("2026-10-02", "2026-10-02")).toEqual(["2026-10-02"]);
    });

    it("pause yesterday, resume today deletes the entry and today still generates", async () => {
      // The series must already have occurrences on or before the pause day (09-30),
      // otherwise the pause guard rejects the request.
      const series = makeSeries({
        segments: [{ from: "2026-09-01", until: null, rule: { type: "daily", interval: 1 } }],
      });
      const { getSeries } = configureFirestore({ series });

      setNow("2026-09-30T12:00:00.000Z");
      const paused = await pause();
      expect(paused.body.pauses).toEqual([{ from: "2026-10-01", until: null }]);

      setNow("2026-10-01T12:00:00.000Z");
      const resumed = await resume();

      expect(resumed.status).toBe(200);
      expect(getSeries().pauses).toEqual([]);
      expect(getSeries().enabled).toBe(true);
      expect(await calendarDates("2026-10-01", "2026-10-01")).toEqual(["2026-10-01"]);
    });

    it("repeated same-day pause/resume cycles never accumulate entries", async () => {
      const { getSeries } = configureFirestore();

      for (let cycle = 0; cycle < 4; cycle++) {
        const paused = await pause();
        expect(paused.status).toBe(200);
        expect(getSeries().pauses).toHaveLength(1);
        expectPauseInvariants(getSeries());

        const resumed = await resume();
        expect(resumed.status).toBe(200);
        expect(getSeries().pauses).toEqual([]);
        expectPauseInvariants(getSeries());
      }

      // Ending on a pause leaves exactly one open entry.
      await pause();
      expect(getSeries().pauses).toEqual([{ from: "2026-10-03", until: null }]);
      expectPauseInvariants(getSeries());
    });

    it("keeps a pause whose window is non-empty (resume two days after pausing)", async () => {
      const { getSeries } = configureFirestore();

      await pause(); // from 2026-10-03
      setNow("2026-10-05T12:00:00.000Z");
      await resume(); // closeAt 2026-10-04 >= from

      expect(getSeries().pauses).toEqual([{ from: "2026-10-03", until: "2026-10-04" }]);
      expectPauseInvariants(getSeries());
    });
  });

  describe("end date handling", () => {
    const pausedBeforeEnd = () =>
      makeSeries({
        segments: [{ from: "2026-09-01", until: null, rule: { type: "daily", interval: 1 } }],
        endDate: "2026-09-20",
        enabled: false,
        pauses: [{ from: "2026-09-10", until: null }],
      });

    it("rejects resume when today is after the end date and writes nothing", async () => {
      const { getSeries, seriesWrites } = configureFirestore({ series: pausedBeforeEnd() });
      setNow("2026-09-25T12:00:00.000Z");

      const res = await resume();

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("This series has already ended");
      expect(seriesWrites()).toEqual([]);
      expect(getSeries().enabled).toBe(false);
      expect(getSeries().pauses).toEqual([{ from: "2026-09-10", until: null }]);
    });

    it("allows resume on the end date itself", async () => {
      const { getSeries } = configureFirestore({ series: pausedBeforeEnd() });
      setNow("2026-09-20T12:00:00.000Z");

      const res = await resume();

      expect(res.status).toBe(200);
      expect(getSeries().enabled).toBe(true);
      expect(getSeries().pauses).toEqual([{ from: "2026-09-10", until: "2026-09-19" }]);
    });

    it("still allows pausing a series that has passed its end date", async () => {
      const series = makeSeries({
        segments: [{ from: "2026-09-01", until: null, rule: { type: "daily", interval: 1 } }],
        endDate: "2026-09-20",
      });
      configureFirestore({ series });
      setNow("2026-09-25T12:00:00.000Z");

      const res = await pause();

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
    });
  });

  describe("ownership", () => {
    it("returns 404 when the series does not exist", async () => {
      const { seriesWrites } = configureFirestore({ seriesExists: false });

      const res = await pause();

      expect(res.status).toBe(404);
      expect(seriesWrites()).toEqual([]);
    });

    it("returns 403 when the series belongs to another user", async () => {
      const { seriesWrites } = configureFirestore({
        series: makeSeries({ userId: "someone-else" }),
      });

      const res = await pause();

      expect(res.status).toBe(403);
      expect(seriesWrites()).toEqual([]);
    });

    it("returns 403 for resume on another user's series", async () => {
      const { seriesWrites } = configureFirestore({
        series: makeSeries({
          userId: "someone-else",
          enabled: false,
          pauses: [{ from: "2026-09-25", until: null }],
        }),
      });

      const res = await resume();

      expect(res.status).toBe(403);
      expect(seriesWrites()).toEqual([]);
    });
  });

  describe("client-supplied 'today' is ignored (25)", () => {
    it("pause uses the server-derived date regardless of body.today", async () => {
      const { getSeries } = configureFirestore();

      const res = await pause({ today: "2030-01-01" });

      expect(res.status).toBe(200);
      expect(getSeries().pauses).toEqual([{ from: "2026-10-03", until: null }]);
    });

    it("resume uses the server-derived date regardless of body.today", async () => {
      const series = makeSeries({
        enabled: false,
        pauses: [{ from: "2026-09-25", until: null }],
      });
      const { getSeries } = configureFirestore({ series });

      const res = await resume({ today: "2020-01-01" });

      expect(res.status).toBe(200);
      expect(getSeries().pauses).toEqual([{ from: "2026-09-25", until: "2026-10-01" }]);
    });

    it("resume end-date check uses the server date, not body.today", async () => {
      const series = makeSeries({
        endDate: "2026-09-20",
        enabled: false,
        pauses: [{ from: "2026-09-10", until: null }],
      });
      configureFirestore({ series });

      // Server today is 2026-10-02, after the end date; a past client date must not help.
      const res = await resume({ today: "2026-09-15" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("This series has already ended");
    });

    it("ignores a today query parameter too", async () => {
      const { getSeries } = configureFirestore();

      const res = await request(app)
        .patch(`${seriesUrl}?today=2030-01-01`)
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(getSeries().pauses).toEqual([{ from: "2026-10-03", until: null }]);
    });
  });

  describe("interval phase survives pause/resume (9, 19)", () => {
    it("daily interval 2: no occurrences in the pause window, phase unchanged after resume", async () => {
      // Seed 2026-09-01 -> odd dates only.
      const series = makeSeries({
        segments: [{ from: "2026-09-01", until: null, rule: { type: "daily", interval: 2 } }],
      });
      const { getSeries } = configureFirestore({ series });

      setNow("2026-09-08T12:00:00.000Z");
      const paused = await pause(); // from 2026-09-09
      expect(paused.body.pauses).toEqual([{ from: "2026-09-09", until: null }]);

      setNow("2026-09-20T12:00:00.000Z");
      const resumed = await resume(); // until 2026-09-19
      expect(resumed.body.pauses).toEqual([{ from: "2026-09-09", until: "2026-09-19" }]);

      const dates = await calendarDates("2026-09-01", "2026-09-30");
      expect(dates).toEqual([
        "2026-09-01",
        "2026-09-03",
        "2026-09-05",
        "2026-09-07",
        // 09-09 .. 09-19 paused; 09-20 is even so off-pattern, not paused.
        "2026-09-21",
        "2026-09-23",
        "2026-09-25",
        "2026-09-27",
        "2026-09-29",
      ]);
      expect(getSeries().segments).toEqual(series.segments);
      expectPauseInvariants(getSeries());
    });

    it("weekly interval 2: resume on an on-pattern day includes that day", async () => {
      // Anchor Monday 2026-09-07; on-pattern Mondays: 09-07, 09-21, 10-05.
      const series = makeSeries({
        segments: [
          {
            from: "2026-09-07",
            until: null,
            rule: { type: "weekly", interval: 2, weekdays: [1] },
          },
        ],
        enabled: false,
        pauses: [{ from: "2026-09-14", until: null }],
      });
      const { getSeries } = configureFirestore({ series });

      setNow("2026-09-21T12:00:00.000Z"); // a Monday
      const resumed = await resume();
      expect(resumed.body.pauses).toEqual([{ from: "2026-09-14", until: "2026-09-20" }]);

      const dates = await calendarDates("2026-09-01", "2026-10-10");
      expect(dates).toEqual(["2026-09-07", "2026-09-21", "2026-10-05"]);
      expect(getSeries().segments).toEqual(series.segments);
    });

    it("weekly interval 2: an on-pattern date inside the window is suppressed", async () => {
      const series = makeSeries({
        segments: [
          {
            from: "2026-09-07",
            until: null,
            rule: { type: "weekly", interval: 2, weekdays: [1] },
          },
        ],
        enabled: false,
        pauses: [{ from: "2026-09-14", until: null }],
      });
      configureFirestore({ series });

      setNow("2026-09-22T12:00:00.000Z"); // Tuesday after the 09-21 Monday
      await resume();

      const dates = await calendarDates("2026-09-01", "2026-10-10");
      expect(dates).toEqual(["2026-09-07", "2026-10-05"]);
    });

    it("monthly interval 2: resume on an on-pattern day includes it, phase is kept", async () => {
      // Anchor 2026-01-15, every 2 months on the 15th: Jan, Mar, May, Jul, Sep, Nov.
      const series = makeSeries({
        segments: [
          { from: "2026-01-15", until: null, rule: { type: "monthly", interval: 2, monthDay: 15 } },
        ],
        enabled: false,
        pauses: [{ from: "2026-02-01", until: null }],
      });
      const { getSeries } = configureFirestore({ series });

      setNow("2026-05-15T12:00:00.000Z");
      const resumed = await resume();
      expect(resumed.body.pauses).toEqual([{ from: "2026-02-01", until: "2026-05-14" }]);

      const dates = await calendarDates("2026-01-01", "2026-12-31");
      expect(dates).toEqual([
        "2026-01-15",
        // 2026-03-15 suppressed by the pause
        "2026-05-15",
        "2026-07-15",
        "2026-09-15",
        "2026-11-15",
      ]);
      expect(getSeries().segments).toEqual(series.segments);
    });

    it("full pause -> resume round trip over the paused month (19)", async () => {
      const series = makeSeries({
        segments: [{ from: "2026-09-01", until: null, rule: { type: "daily", interval: 1 } }],
      });
      configureFirestore({ series });

      setNow("2026-09-10T12:00:00.000Z");
      expect((await pause()).status).toBe(200); // from 09-11
      expect(await calendarDates("2026-09-08", "2026-09-14")).toEqual([
        "2026-09-08",
        "2026-09-09",
        "2026-09-10",
      ]);

      setNow("2026-09-14T12:00:00.000Z");
      expect((await resume()).status).toBe(200); // until 09-13
      expect(await calendarDates("2026-09-08", "2026-09-16")).toEqual([
        "2026-09-08",
        "2026-09-09",
        "2026-09-10",
        // 09-11 .. 09-13 stay paused: no backfill
        "2026-09-14",
        "2026-09-15",
        "2026-09-16",
      ]);
    });
  });

  describe("future materialized docs during a pause", () => {
    const futureDate = "2026-10-10";
    const editedFuture = () =>
      makeMaterialized(futureDate, { title: "Customised title", status: "To Do" });

    it("hides a future pending edited occurrence while paused but keeps it stored", async () => {
      const { taskState } = configureFirestore({ tasks: [editedFuture()] });

      const paused = await pause(); // from 2026-10-03
      expect(paused.status).toBe(200);

      const list = await request(app).get("/api/tasks");
      expect(list.status).toBe(200);
      expect(list.body.map(o => o.id)).not.toContain(`series-1_${futureDate}`);

      expect(await calendarDates("2026-10-08", "2026-10-12")).toEqual([]);

      expect(taskState.get(`series-1_${futureDate}`)).toEqual(editedFuture());
    });

    it("shows it again with its edit intact after resume once the date is scheduled", async () => {
      configureFirestore({ tasks: [editedFuture()] });

      await pause(); // from 2026-10-03
      setNow("2026-10-05T12:00:00.000Z");
      const resumed = await resume(); // until 2026-10-04
      expect(resumed.status).toBe(200);

      const list = await request(app).get("/api/tasks");
      const doc = list.body.find(o => o.id === `series-1_${futureDate}`);
      expect(doc).toBeDefined();
      expect(doc.title).toBe("Customised title");

      const calendar = await request(app)
        .get("/api/tasks/calendar")
        .query({ from: "2026-10-10", to: "2026-10-10" });
      const calendarDoc = calendar.body.find(o => o.id === `series-1_${futureDate}`);
      expect(calendarDoc).toBeDefined();
      expect(calendarDoc.title).toBe("Customised title");
    });

    it("keeps a completed future occurrence visible during a pause", async () => {
      configureFirestore({
        tasks: [makeMaterialized(futureDate, { title: "Done early", status: "Completed" })],
      });

      await pause();

      const list = await request(app).get("/api/tasks");
      const doc = list.body.find(o => o.id === `series-1_${futureDate}`);
      expect(doc).toBeDefined();
      expect(doc.status).toBe("Completed");
    });

    it("keeps a past materialized occurrence visible inside a pause window", async () => {
      // 09-26 is off-schedule (inside a closed pause) but in the past, so history stays.
      const series = makeSeries({
        segments: [{ from: "2026-09-20", until: null, rule: { type: "daily", interval: 1 } }],
        pauses: [{ from: "2026-09-25", until: "2026-09-28" }],
      });
      configureFirestore({
        series,
        tasks: [makeMaterialized("2026-09-26", { title: "History", status: "In Progress" })],
      });

      const list = await request(app).get("/api/tasks");
      const ids = list.body.map(o => o.id);
      expect(ids).toContain("series-1_2026-09-26");
      expect(ids).not.toContain("series-1_2026-09-27");

      const calendar = await request(app)
        .get("/api/tasks/calendar")
        .query({ from: "2026-09-25", to: "2026-09-28" });
      const calendarIds = calendar.body.map(o => o.id);
      expect(calendarIds).toContain("series-1_2026-09-26");
      expect(calendarIds).not.toContain("series-1_2026-09-27");
    });
  });
});
