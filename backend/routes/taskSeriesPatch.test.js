import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app.js";
import { db } from "../shared/firebase.js";
import { expandSeries, shouldRenderMaterialized } from "../lib/recurrence.js";

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
const occurrenceUrl = date => `${seriesUrl}/occurrences/${date}`;

// Calendar reference for the dates used below (2026):
//   Sep 7 = Mon, Oct 1 = Thu, Oct 5 = Mon, Oct 7 = Wed, Oct 12 = Mon, Oct 14 = Wed.

const weeklyMonday = { type: "weekly", interval: 1, weekdays: [1] };

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
    segments: [{ from: "2026-09-07", until: null, rule: weeklyMonday }],
    enabled: true,
    pauses: [],
    exceptions: [],
    endDate: null,
    ...overrides,
  };
}

/**
 * In-memory Firestore stand-in. Unlike the occurrence test's version, series writes persist
 * (including dotted "template.title" paths) so tests can chain requests.
 *
 * Transactions run the callback once and apply buffered writes afterwards; there is
 * deliberately no conflict detection or retry. `updatedAt` is recorded in `committedWrites`
 * but not stored, because it is a server-timestamp sentinel.
 */
function configureFirestore({
  series = makeSeries(),
  seriesExists = true,
  tasks = [],
  userData = { timezone: "UTC" },
} = {}) {
  const state = { series: structuredClone(series) };
  const taskState = new Map(tasks.map(task => [`${task.seriesId}_${task.occurrenceDate}`, task]));
  const committedWrites = [];
  const seriesPath = "task_series/series-1";

  function setPath(target, dottedPath, value) {
    const keys = dottedPath.split(".");
    let node = target;
    for (const key of keys.slice(0, -1)) {
      node[key] ??= {};
      node = node[key];
    }
    node[keys.at(-1)] = value;
  }

  function snapshotFor(path) {
    if (path.startsWith("task_series/")) {
      const data = seriesExists ? structuredClone(state.series) : undefined;
      return { exists: seriesExists, id: "series-1", data: () => data };
    }
    const id = path.slice("tasks/".length);
    const data = taskState.has(id) ? structuredClone(taskState.get(id)) : undefined;
    return { exists: data !== undefined, id, data: () => data };
  }

  function applyWrite({ path, type, data, options }) {
    committedWrites.push({ path, type, data });
    if (path.startsWith("task_series/")) {
      for (const [key, value] of Object.entries(data)) {
        if (key !== "updatedAt") setPath(state.series, key, structuredClone(value));
      }
      return;
    }
    const id = path.slice("tasks/".length);
    const current = taskState.get(id) ?? {};
    taskState.set(id, type === "update" || options?.merge ? { ...current, ...data } : data);
  }

  const seriesRef = {
    id: "series-1",
    path: seriesPath,
    get: vi.fn(async () => snapshotFor(seriesPath)),
    update: vi.fn(async data => applyWrite({ path: seriesPath, type: "update", data })),
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
    if (collectionName === "task_series") return { doc: vi.fn().mockReturnValue(seriesRef) };
    if (collectionName === "tasks") return { doc: vi.fn().mockImplementation(taskRefFor) };
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
    seriesWrites: () => committedWrites.filter(write => write.path.startsWith("task_series/")),
    taskWrites: () => committedWrites.filter(write => write.path.startsWith("tasks/")),
  };
}

const patchSeries = body => request(app).patch(seriesUrl).send(body);

// Pins the server clock to noon UTC on `dateStr`; the default test user is on UTC, so this
// is also the user's "today".
function setToday(dateStr) {
  vi.setSystemTime(new Date(`${dateStr}T12:00:00.000Z`));
}

function expectSegmentInvariants(segments) {
  expect(segments.filter(segment => segment.until === null)).toHaveLength(1);
  expect(new Set(segments.map(segment => segment.from)).size).toBe(segments.length);
  for (const segment of segments) {
    if (segment.until !== null) expect(segment.from <= segment.until).toBe(true);
  }
  const froms = segments.map(segment => segment.from);
  expect([...froms].sort()).toEqual(froms);
}

describe("PATCH /api/task-series/:seriesId (rule, endDate and template branches)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fake only Date so supertest's real I/O is unaffected.
    vi.useFakeTimers({ toFake: ["Date"] });
    setToday("2026-10-01");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("intent dispatch", () => {
    it("rejects an empty body", async () => {
      const { seriesWrites } = configureFirestore();

      const res = await patchSeries({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no supported fields/i);
      expect(seriesWrites()).toEqual([]);
    });

    it.each([
      ["status", { status: "Completed" }],
      ["dueDate", { dueDate: "2026-10-08" }],
      ["status alongside a template field", { title: "X", status: "To Do" }],
    ])("rejects occurrence-level %s on a series", async (_label, body) => {
      const { seriesWrites } = configureFirestore();

      const res = await patchSeries(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/occurrence-level/i);
      expect(seriesWrites()).toEqual([]);
    });

    it("rejects mixing recurrence fields with template fields, writing nothing", async () => {
      const { seriesWrites } = configureFirestore();

      const res = await patchSeries({ rule: { type: "daily", interval: 1 }, title: "Mixed" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/separate requests/i);
      expect(seriesWrites()).toEqual([]);
    });

    it("rejects endDate mixed with template fields", async () => {
      const { seriesWrites } = configureFirestore();

      const res = await patchSeries({ endDate: "2026-12-01", description: "Mixed" });

      expect(res.status).toBe(400);
      expect(seriesWrites()).toEqual([]);
    });

    it("keeps rejecting enabled combined with a rule", async () => {
      const { seriesWrites } = configureFirestore();

      const res = await patchSeries({ enabled: false, rule: { type: "daily", interval: 1 } });

      expect(res.status).toBe(400);
      expect(seriesWrites()).toEqual([]);
    });

    it("returns 404 for a missing series and 403 for another user's series", async () => {
      configureFirestore({ seriesExists: false });
      const missing = await patchSeries({ endDate: "2026-12-01" });
      expect(missing.status).toBe(404);

      const { seriesWrites } = configureFirestore({
        series: makeSeries({ userId: "someone-else" }),
      });
      const foreign = await patchSeries({ title: "Not yours" });
      expect(foreign.status).toBe(403);
      expect(seriesWrites()).toEqual([]);
    });

    it("ignores a client-supplied `today`; the server-derived date is used", async () => {
      const { getSeries } = configureFirestore();

      const res = await patchSeries({ rule: { type: "daily", interval: 1 }, today: "2030-01-01" });

      expect(res.status).toBe(200);
      const segments = getSeries().segments;
      expect(segments.at(-1).from).toBe("2026-10-01");
      expect(segments[0].until).toBe("2026-09-30");
    });
  });

  describe("rule change (effective today)", () => {
    it("closes the open segment at yesterday and starts a new one today, producing today (daily)", async () => {
      const { getSeries, seriesWrites } = configureFirestore();

      const res = await patchSeries({ rule: { type: "daily", interval: 1 } });

      expect(res.status).toBe(200);
      const stored = getSeries();
      expect(stored.segments).toEqual([
        { from: "2026-09-07", until: "2026-09-30", rule: weeklyMonday },
        { from: "2026-10-01", until: null, rule: { type: "daily", interval: 1 } },
      ]);
      expectSegmentInvariants(stored.segments);
      expect(expandSeries(stored, "2026-10-01", "2026-10-03")).toEqual([
        "2026-10-01",
        "2026-10-02",
        "2026-10-03",
      ]);
      expect(res.body).toMatchObject({ id: "series-1", segments: stored.segments });
      expect(seriesWrites()).toHaveLength(1);
      expect(Object.keys(seriesWrites()[0].data).sort()).toEqual(["segments", "updatedAt"]);
    });

    it("drops today's untouched occurrence when the new weekly rule excludes today", async () => {
      // Under the old rule (Mondays) today, Thursday, is not an occurrence either, so use a
      // series whose old rule DID produce Thursday.
      const series = makeSeries({
        segments: [
          { from: "2026-09-07", until: null, rule: { type: "weekly", interval: 1, weekdays: [4] } },
        ],
      });
      const { getSeries } = configureFirestore({ series });
      expect(expandSeries(series, "2026-10-01", "2026-10-01")).toEqual(["2026-10-01"]);

      const res = await patchSeries({ rule: weeklyMonday });

      expect(res.status).toBe(200);
      const stored = getSeries();
      expect(expandSeries(stored, "2026-10-01", "2026-10-01")).toEqual([]);
      expect(expandSeries(stored, "2026-10-01", "2026-10-06")).toEqual(["2026-10-05"]);
    });

    it("re-anchors interval math on today when the pattern changes", async () => {
      const { getSeries } = configureFirestore();

      await patchSeries({ rule: { type: "daily", interval: 2 } });

      expect(expandSeries(getSeries(), "2026-10-01", "2026-10-07")).toEqual([
        "2026-10-01",
        "2026-10-03",
        "2026-10-05",
        "2026-10-07",
      ]);
    });

    it("rewrites the open segment in place on a same-day second change", async () => {
      const { getSeries } = configureFirestore();

      const first = await patchSeries({ rule: { type: "daily", interval: 1 } });
      const second = await patchSeries({
        rule: { type: "weekly", interval: 1, weekdays: [3] },
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const { segments } = getSeries();
      expect(segments).toHaveLength(2);
      expectSegmentInvariants(segments);
      expect(segments[0]).toMatchObject({ from: "2026-09-07", until: "2026-09-30" });
      expect(segments[1]).toEqual({
        from: "2026-10-01",
        until: null,
        rule: { type: "weekly", interval: 1, weekdays: [3] },
      });
    });

    it("keeps the seed date and rewrites segments[0] in place before the first occurrence", async () => {
      const series = makeSeries({
        segments: [{ from: "2026-10-05", until: null, rule: weeklyMonday }],
      });
      const { getSeries } = configureFirestore({ series });

      const res = await patchSeries({ rule: { type: "weekly", interval: 1, weekdays: [3] } });

      expect(res.status).toBe(200);
      const stored = getSeries();
      expect(stored.segments).toEqual([
        { from: "2026-10-05", until: null, rule: { type: "weekly", interval: 1, weekdays: [3] } },
      ]);
      // Seed forcing: 10-05 (a Monday) is still the first occurrence, then Wednesdays.
      expect(expandSeries(stored, "2026-10-01", "2026-10-14")).toEqual([
        "2026-10-05",
        "2026-10-07",
        "2026-10-14",
      ]);
    });

    it("never touches pauses or enabled, so a paused series stays paused", async () => {
      const pauses = [{ from: "2026-10-02", until: null }];
      const { getSeries, seriesWrites } = configureFirestore({
        series: makeSeries({ enabled: false, pauses }),
      });

      const res = await patchSeries({ rule: { type: "daily", interval: 1 } });

      expect(res.status).toBe(200);
      const stored = getSeries();
      expect(stored.enabled).toBe(false);
      expect(stored.pauses).toEqual(pauses);
      expect(Object.keys(seriesWrites()[0].data)).not.toContain("pauses");
      expect(Object.keys(seriesWrites()[0].data)).not.toContain("enabled");
    });

    it("leaves exceptions untouched, so deleted occurrences stay deleted", async () => {
      const { getSeries } = configureFirestore({
        series: makeSeries({ exceptions: ["2026-10-02"] }),
      });

      await patchSeries({ rule: { type: "daily", interval: 1 } });

      const stored = getSeries();
      expect(stored.exceptions).toEqual(["2026-10-02"]);
      expect(expandSeries(stored, "2026-10-01", "2026-10-03")).toEqual([
        "2026-10-01",
        "2026-10-03",
      ]);
    });

    it("hides a future pending materialized doc the new rule excludes, but keeps it stored", async () => {
      const hiddenDate = "2026-10-12"; // Monday: on the old rule, off the new one
      const doc = {
        seriesId: "series-1",
        occurrenceDate: hiddenDate,
        userId: "test-user-1",
        title: "Edited",
        status: "To Do",
        dueDate: hiddenDate,
      };
      const { getSeries, taskState, taskWrites } = configureFirestore({ tasks: [doc] });

      const res = await patchSeries({ rule: { type: "weekly", interval: 1, weekdays: [3] } });

      expect(res.status).toBe(200);
      const stored = getSeries();
      expect(expandSeries(stored, hiddenDate, hiddenDate)).toEqual([]);
      expect(shouldRenderMaterialized(doc, stored, "2026-10-01")).toBe(false);
      expect(taskState.get(`series-1_${hiddenDate}`)).toEqual(doc); // kept, untouched
      expect(taskWrites()).toEqual([]);

      const edit = await request(app).patch(occurrenceUrl(hiddenDate)).send({ title: "Nope" });
      expect(edit.status).toBe(400);
    });

    it("keeps a completed materialized doc visible after a rule change excludes its date", async () => {
      // Future date (Thursday, 2026-10-08) so visibility comes from the "completed" branch of
      // shouldRenderMaterialized, not from the "date <= today" branch.
      const doc = {
        seriesId: "series-1",
        occurrenceDate: "2026-10-08",
        userId: "test-user-1",
        title: "Done early",
        status: "Completed",
        dueDate: "2026-10-08",
      };
      const series = makeSeries({
        segments: [
          { from: "2026-09-07", until: null, rule: { type: "weekly", interval: 1, weekdays: [4] } },
        ],
      });
      const { getSeries, taskState } = configureFirestore({ series, tasks: [doc] });

      await patchSeries({ rule: weeklyMonday });

      const stored = getSeries();
      expect(expandSeries(stored, "2026-10-08", "2026-10-08")).toEqual([]);
      expect(shouldRenderMaterialized(doc, stored, "2026-10-01")).toBe(true);
      expect(taskState.get("series-1_2026-10-08")).toEqual(doc);
      // The same doc, still pending, would be hidden.
      expect(shouldRenderMaterialized({ ...doc, status: "To Do" }, stored, "2026-10-01")).toBe(
        false,
      );
    });

    describe("unchanged rule is a no-op", () => {
      const biweekly = { type: "weekly", interval: 2, weekdays: [1, 3] };
      const biweeklySeries = () =>
        makeSeries({ segments: [{ from: "2026-09-07", until: null, rule: biweekly }] });

      it("returns 200 without writing, so interval phase is not re-anchored", async () => {
        setToday("2026-10-12");
        const { getSeries, seriesWrites } = configureFirestore({ series: biweeklySeries() });
        const before = getSeries();

        const res = await patchSeries({ rule: biweekly });

        expect(res.status).toBe(200);
        expect(seriesWrites()).toEqual([]);
        expect(getSeries()).toEqual(before);
        expect(res.body.segments).toEqual(before.segments);
      });

      it("treats weekdays in a different order as unchanged", async () => {
        setToday("2026-10-12");
        const { seriesWrites } = configureFirestore({ series: biweeklySeries() });

        const res = await patchSeries({ rule: { type: "weekly", interval: 2, weekdays: [3, 1] } });

        expect(res.status).toBe(200);
        expect(seriesWrites()).toEqual([]);
      });

      it("still applies a changed endDate sent alongside the unchanged rule", async () => {
        setToday("2026-10-12");
        const { getSeries, seriesWrites } = configureFirestore({ series: biweeklySeries() });

        const res = await patchSeries({ rule: biweekly, endDate: "2026-12-31" });

        expect(res.status).toBe(200);
        const stored = getSeries();
        expect(stored.endDate).toBe("2026-12-31");
        expect(stored.segments).toHaveLength(1);
        expect(Object.keys(seriesWrites()[0].data).sort()).toEqual(["endDate", "updatedAt"]);
      });

      it("is also a no-op when the open segment would have been rewritten in place", async () => {
        const series = makeSeries({
          segments: [{ from: "2026-10-05", until: null, rule: weeklyMonday }],
        });
        const { seriesWrites } = configureFirestore({ series });

        const res = await patchSeries({ rule: weeklyMonday });

        expect(res.status).toBe(200);
        expect(seriesWrites()).toEqual([]);
      });
    });

    describe("weekly weekdays default", () => {
      it("defaults to today's ISO weekday when a new segment is created", async () => {
        const { getSeries } = configureFirestore();

        const res = await patchSeries({ rule: { type: "weekly", interval: 1 } });

        expect(res.status).toBe(200);
        // 2026-10-01 is a Thursday = ISO 4.
        expect(getSeries().segments.at(-1).rule).toEqual({
          type: "weekly",
          interval: 1,
          weekdays: [4],
        });
      });

      it("defaults to the open segment's own `from` weekday on an in-place rewrite", async () => {
        const series = makeSeries({
          segments: [{ from: "2026-10-07", until: null, rule: weeklyMonday }], // Wednesday
        });
        const { getSeries } = configureFirestore({ series });

        const res = await patchSeries({ rule: { type: "weekly", interval: 2 } });

        expect(res.status).toBe(200);
        expect(getSeries().segments).toEqual([
          { from: "2026-10-07", until: null, rule: { type: "weekly", interval: 2, weekdays: [3] } },
        ]);
      });

      it("maps a Sunday anchor to ISO 7, not 0", async () => {
        setToday("2026-10-04"); // Sunday
        const { getSeries } = configureFirestore();

        await patchSeries({ rule: { type: "weekly", interval: 1 } });

        expect(getSeries().segments.at(-1).rule.weekdays).toEqual([7]);
      });

      it("does not default weekdays that were supplied explicitly", async () => {
        const { getSeries } = configureFirestore();

        await patchSeries({ rule: { type: "weekly", interval: 1, weekdays: [2, 5] } });

        expect(getSeries().segments.at(-1).rule.weekdays).toEqual([2, 5]);
      });

      it("does not invent a default for a monthly rule", async () => {
        const { seriesWrites } = configureFirestore();

        const res = await patchSeries({ rule: { type: "monthly", interval: 1 } });

        expect(res.status).toBe(400);
        expect(seriesWrites()).toEqual([]);
      });
    });

    describe("rule validation", () => {
      it.each([
        ["an interval of 0", { type: "daily", interval: 0 }],
        ["an unknown type", { type: "yearly", interval: 1 }],
        ["an empty weekdays list", { type: "weekly", interval: 1, weekdays: [] }],
        ["a 0-based weekday", { type: "weekly", interval: 1, weekdays: [0] }],
        [
          "both monthDay and useLastDayOfMonth",
          { type: "monthly", interval: 1, monthDay: 5, useLastDayOfMonth: true },
        ],
      ])("rejects %s without writing", async (_label, rule) => {
        const { seriesWrites } = configureFirestore();

        const res = await patchSeries({ rule });

        expect(res.status).toBe(400);
        expect(seriesWrites()).toEqual([]);
      });

      it.each([
        ["a string", "daily"],
        ["null", null],
        ["an array", [{ type: "daily", interval: 1 }]],
      ])("rejects a rule that is %s", async (_label, rule) => {
        const { seriesWrites } = configureFirestore();

        const res = await patchSeries({ rule });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/rule must be an object/i);
        expect(seriesWrites()).toEqual([]);
      });
    });

    describe("ended series", () => {
      const endedSeries = () => makeSeries({ endDate: "2026-09-20" });

      it("rejects a rule change when today is after the stored endDate (test 11)", async () => {
        const { seriesWrites } = configureFirestore({ series: endedSeries() });

        const res = await patchSeries({ rule: { type: "daily", interval: 1 } });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("This series has already ended");
        expect(seriesWrites()).toEqual([]);
      });

      it("allows a rule change together with a new endDate that lifts the end", async () => {
        const { getSeries } = configureFirestore({ series: endedSeries() });

        const res = await patchSeries({
          rule: { type: "daily", interval: 1 },
          endDate: "2026-12-31",
        });

        expect(res.status).toBe(200);
        const stored = getSeries();
        expect(stored.endDate).toBe("2026-12-31");
        expect(stored.segments.at(-1)).toMatchObject({ from: "2026-10-01", until: null });
      });

      it("allows a rule change together with clearing the endDate", async () => {
        const { getSeries } = configureFirestore({ series: endedSeries() });

        const res = await patchSeries({ rule: { type: "daily", interval: 1 }, endDate: null });

        expect(res.status).toBe(200);
        expect(getSeries().endDate).toBeNull();
      });

      it("rejects the whole request when rule is combined with an endDate before today", async () => {
        const { seriesWrites, getSeries } = configureFirestore({ series: makeSeries() });
        const before = getSeries();

        const res = await patchSeries({
          rule: { type: "daily", interval: 1 },
          endDate: "2026-09-25",
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/before today/i);
        expect(seriesWrites()).toEqual([]);
        expect(getSeries()).toEqual(before); // neither half applied
      });
    });

    it("applies rule and endDate in one write", async () => {
      const { getSeries, seriesWrites } = configureFirestore();

      const res = await patchSeries({
        rule: { type: "daily", interval: 1 },
        endDate: "2026-10-31",
      });

      expect(res.status).toBe(200);
      expect(seriesWrites()).toHaveLength(1);
      expect(Object.keys(seriesWrites()[0].data).sort()).toEqual([
        "endDate",
        "segments",
        "updatedAt",
      ]);
      expect(getSeries().endDate).toBe("2026-10-31");
      expect(res.body.endDate).toBe("2026-10-31");
    });
  });

  describe("endDate", () => {
    it("sets an endDate on or after the first due date", async () => {
      const { getSeries, seriesWrites } = configureFirestore();

      const res = await patchSeries({ endDate: "2026-12-31" });

      expect(res.status).toBe(200);
      expect(res.body.endDate).toBe("2026-12-31");
      expect(getSeries().endDate).toBe("2026-12-31");
      expect(Object.keys(seriesWrites()[0].data).sort()).toEqual(["endDate", "updatedAt"]);
    });

    it("accepts an endDate equal to the first due date", async () => {
      configureFirestore();

      const res = await patchSeries({ endDate: "2026-09-07" });

      expect(res.status).toBe(200);
    });

    it("rejects an endDate before the first due date", async () => {
      const { seriesWrites } = configureFirestore();

      const res = await patchSeries({ endDate: "2026-09-06" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/before the first due date/i);
      expect(seriesWrites()).toEqual([]);
    });

    it("clears the endDate with null", async () => {
      const { getSeries } = configureFirestore({ series: makeSeries({ endDate: "2026-12-31" }) });

      const res = await patchSeries({ endDate: null });

      expect(res.status).toBe(200);
      expect(getSeries().endDate).toBeNull();
    });

    it("allows an endDate in the past, which ends the series immediately", async () => {
      setToday("2026-10-12");
      const { getSeries } = configureFirestore();

      const res = await patchSeries({ endDate: "2026-10-05" });

      expect(res.status).toBe(200);
      const stored = getSeries();
      expect(stored.endDate).toBe("2026-10-05");
      expect(expandSeries(stored, "2026-10-01", "2026-10-31")).toEqual(["2026-10-05"]);
    });

    it("is reversible: clearing a past endDate restores the schedule", async () => {
      setToday("2026-10-12");
      const { getSeries } = configureFirestore();

      await patchSeries({ endDate: "2026-10-05" });
      await patchSeries({ endDate: null });

      expect(expandSeries(getSeries(), "2026-10-06", "2026-10-13")).toEqual(["2026-10-12"]);
    });

    it("can extend a series whose endDate has already passed", async () => {
      const { getSeries } = configureFirestore({ series: makeSeries({ endDate: "2026-09-20" }) });

      const res = await patchSeries({ endDate: "2026-12-31" });

      expect(res.status).toBe(200);
      expect(getSeries().endDate).toBe("2026-12-31");
    });

    it("is a no-op when the endDate is unchanged", async () => {
      const { seriesWrites } = configureFirestore({
        series: makeSeries({ endDate: "2026-12-31" }),
      });

      const res = await patchSeries({ endDate: "2026-12-31" });

      expect(res.status).toBe(200);
      expect(seriesWrites()).toEqual([]);
    });

    it("treats null as a no-op when no endDate is stored", async () => {
      const { seriesWrites } = configureFirestore();

      const res = await patchSeries({ endDate: null });

      expect(res.status).toBe(200);
      expect(seriesWrites()).toEqual([]);
    });

    it.each([
      ["a malformed date", "2026-13-45"],
      ["a non-date string", "next week"],
      ["a number", 20261231],
    ])("rejects %s", async (_label, endDate) => {
      const { seriesWrites } = configureFirestore();

      const res = await patchSeries({ endDate });

      expect(res.status).toBe(400);
      expect(seriesWrites()).toEqual([]);
    });

    it("does not touch segments, pauses or enabled", async () => {
      const pauses = [{ from: "2026-10-02", until: null }];
      const { getSeries, seriesWrites } = configureFirestore({
        series: makeSeries({ enabled: false, pauses }),
      });
      const before = getSeries();

      await patchSeries({ endDate: "2026-12-31" });

      const stored = getSeries();
      expect(stored.segments).toEqual(before.segments);
      expect(stored.pauses).toEqual(pauses);
      expect(stored.enabled).toBe(false);
      expect(Object.keys(seriesWrites()[0].data)).toEqual(["endDate", "updatedAt"]);
    });
  });

  describe("template edit (apply to future occurrences)", () => {
    it("updates the supplied template fields using dotted paths and returns the merged series", async () => {
      const { getSeries, seriesWrites } = configureFirestore();

      const res = await patchSeries({ title: "New title", subject: "Science" });

      expect(res.status).toBe(200);
      expect(Object.keys(seriesWrites()[0].data).sort()).toEqual([
        "template.subject",
        "template.title",
        "updatedAt",
      ]);
      expect(getSeries().template).toEqual({
        ...makeSeries().template,
        title: "New title",
        subject: "Science",
      });
      expect(res.body.template).toMatchObject({
        title: "New title",
        subject: "Science",
        description: "Template description",
        time: "09:00",
      });
    });

    it("never stores status or dueDate on the template", async () => {
      const { getSeries } = configureFirestore();

      await patchSeries({ title: "Clean" });

      expect(getSeries().template).not.toHaveProperty("status");
      expect(getSeries().template).not.toHaveProperty("dueDate");
    });

    it("does not touch segments, pauses, enabled, exceptions or endDate", async () => {
      const { getSeries } = configureFirestore({
        series: makeSeries({ exceptions: ["2026-10-05"], endDate: "2026-12-31" }),
      });
      const before = getSeries();

      await patchSeries({ description: "Changed" });

      const stored = getSeries();
      for (const key of ["segments", "pauses", "enabled", "exceptions", "endDate"]) {
        expect(stored[key]).toEqual(before[key]);
      }
    });

    it("stores template checklist items as seed text only", async () => {
      const { getSeries } = configureFirestore();

      const res = await patchSeries({
        checklist: [{ text: "First" }, { text: "Second", completed: true }],
      });

      expect(res.status).toBe(200);
      expect(getSeries().template.checklist).toEqual([{ text: "First" }, { text: "Second" }]);
    });

    it("accepts an empty checklist", async () => {
      const { getSeries } = configureFirestore();

      const res = await patchSeries({ checklist: [] });

      expect(res.status).toBe(200);
      expect(getSeries().template.checklist).toEqual([]);
    });

    it("normalizes a blank time to null", async () => {
      const { getSeries } = configureFirestore();

      const res = await patchSeries({ time: "  " });

      expect(res.status).toBe(200);
      expect(getSeries().template.time).toBeNull();
    });

    it.each([
      ["an empty title", { title: "   " }],
      ["an out-of-range time", { time: "25:99" }],
      ["a non-array checklist", { checklist: "milk" }],
    ])("rejects %s without writing", async (_label, body) => {
      const { seriesWrites } = configureFirestore();

      const res = await patchSeries(body);

      expect(res.status).toBe(400);
      expect(seriesWrites()).toEqual([]);
    });

    describe("reminder pair", () => {
      it("sets both fields together", async () => {
        const { getSeries } = configureFirestore();

        const res = await patchSeries({ reminderOffsetDays: 2, reminderTime: "07:30" });

        expect(res.status).toBe(200);
        expect(getSeries().template).toMatchObject({
          reminderOffsetDays: 2,
          reminderTime: "07:30",
        });
      });

      it("accepts an offset of 0", async () => {
        const { getSeries } = configureFirestore();

        const res = await patchSeries({ reminderOffsetDays: 0, reminderTime: "07:30" });

        expect(res.status).toBe(200);
        expect(getSeries().template.reminderOffsetDays).toBe(0);
      });

      it("clears the reminder only when both are explicitly null", async () => {
        const { getSeries } = configureFirestore();

        const res = await patchSeries({ reminderOffsetDays: null, reminderTime: null });

        expect(res.status).toBe(200);
        expect(getSeries().template).toMatchObject({
          reminderOffsetDays: null,
          reminderTime: null,
        });
      });

      it.each([
        ["only reminderTime", { reminderTime: "07:30" }],
        ["only reminderOffsetDays", { reminderOffsetDays: 1 }],
        ["only reminderOffsetDays: null", { reminderOffsetDays: null }],
        ["only reminderTime: null", { reminderTime: null }],
        ["an offset with a null time", { reminderOffsetDays: 1, reminderTime: null }],
        ["a time with a null offset", { reminderOffsetDays: null, reminderTime: "07:30" }],
      ])("rejects %s, leaving the stored reminder untouched", async (_label, body) => {
        const { getSeries, seriesWrites } = configureFirestore();

        const res = await patchSeries(body);

        expect(res.status).toBe(400);
        expect(seriesWrites()).toEqual([]);
        expect(getSeries().template).toMatchObject({
          reminderOffsetDays: 1,
          reminderTime: "08:00",
        });
      });

      it.each([
        ["a negative offset", { reminderOffsetDays: -1, reminderTime: "07:30" }],
        ["a fractional offset", { reminderOffsetDays: 1.5, reminderTime: "07:30" }],
        ["a malformed time", { reminderOffsetDays: 1, reminderTime: "7pm" }],
      ])("rejects %s", async (_label, body) => {
        const { seriesWrites } = configureFirestore();

        const res = await patchSeries(body);

        expect(res.status).toBe(400);
        expect(seriesWrites()).toEqual([]);
      });

      it("can be combined with other template fields", async () => {
        const { getSeries } = configureFirestore();

        const res = await patchSeries({
          title: "Both",
          reminderOffsetDays: 3,
          reminderTime: "06:00",
        });

        expect(res.status).toBe(200);
        expect(getSeries().template).toMatchObject({
          title: "Both",
          reminderOffsetDays: 3,
          reminderTime: "06:00",
        });
      });
    });

    describe("interaction with materialized occurrences (test 20, 18b)", () => {
      const storedDoc = {
        seriesId: "series-1",
        occurrenceDate: "2026-10-12",
        userId: "test-user-1",
        title: "Occurrence-specific title",
        description: "Occurrence description",
        subject: "Art",
        time: null,
        checklist: [],
        status: "In Progress",
        dueDate: "2026-10-12",
        reminderDate: null,
        reminderTime: null,
      };

      it("leaves an already-materialized occurrence's stored fields unchanged", async () => {
        const { taskState, taskWrites } = configureFirestore({ tasks: [storedDoc] });

        const res = await patchSeries({ title: "Changed template", subject: "Music" });

        expect(res.status).toBe(200);
        expect(taskWrites()).toEqual([]);
        expect(taskState.get("series-1_2026-10-12")).toEqual(storedDoc);
      });

      it("is not reapplied to the materialized occurrence by a later occurrence edit", async () => {
        const { taskState } = configureFirestore({ tasks: [storedDoc] });

        await patchSeries({ title: "Changed template" });
        const edit = await request(app)
          .patch(occurrenceUrl("2026-10-12"))
          .send({ description: "Y" });

        expect(edit.status).toBe(200);
        expect(taskState.get("series-1_2026-10-12")).toMatchObject({
          title: "Occurrence-specific title",
          description: "Y",
          status: "In Progress",
        });
      });

      it("is used when a not-yet-materialized occurrence is first edited", async () => {
        const { taskState } = configureFirestore();

        await patchSeries({ title: "Changed template" });
        const edit = await request(app)
          .patch(occurrenceUrl("2026-10-12"))
          .send({ description: "Z" });

        expect(edit.status).toBe(200);
        expect(taskState.get("series-1_2026-10-12")).toMatchObject({
          title: "Changed template",
          description: "Z",
          status: "To Do",
        });
      });
    });
  });
});
