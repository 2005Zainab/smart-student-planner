import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { hasException } from "./exceptions.js";
import {
  expandSegment,
  expandSeries,
  getNextOccurrence,
  getPriorityFromDueDate,
  matchesRule,
  shouldRenderMaterialized,
  validateRule,
} from "./recurrence.js";

const daily = (from, interval = 1, until = null) => ({
  from,
  until,
  rule: { type: "daily", interval },
});

const weekly = (from, weekdays, interval = 1, until = null) => ({
  from,
  until,
  rule: { type: "weekly", interval, weekdays },
});

const monthly = (from, rule, interval = 1, until = null) => ({
  from,
  until,
  rule: { type: "monthly", interval, ...rule },
});

const series = (segments, overrides = {}) => ({
  segments,
  pauses: [],
  exceptions: [],
  endDate: null,
  ...overrides,
});

describe("validateRule", () => {
  it("accepts and cleans each discriminated rule shape", () => {
    expect(validateRule({ type: "daily", interval: 2, weekdays: [1] })).toEqual({
      clean: { type: "daily", interval: 2 },
    });
    expect(validateRule({ type: "weekly", interval: 2, weekdays: [5, 1] })).toEqual({
      clean: { type: "weekly", interval: 2, weekdays: [1, 5] },
    });
    expect(validateRule({ type: "monthly", interval: 1, monthDay: 31 })).toEqual({
      clean: { type: "monthly", interval: 1, monthDay: 31 },
    });
    expect(validateRule({ type: "monthly", interval: 1, useLastDayOfMonth: true })).toEqual({
      clean: { type: "monthly", interval: 1, useLastDayOfMonth: true },
    });
  });

  it.each([
    [null, "Rule must be an object"],
    [{ type: "yearly", interval: 1 }, "Rule type"],
    [{ type: "daily", interval: 0 }, "interval"],
    [{ type: "daily", interval: 31 }, "interval"],
    [{ type: "weekly", interval: 1, weekdays: [] }, "weekdays"],
    [{ type: "weekly", interval: 1, weekdays: [1, 1] }, "weekdays"],
    [{ type: "weekly", interval: 1, weekdays: [0] }, "weekdays"],
    [{ type: "monthly", interval: 1 }, "exactly one"],
    [{ type: "monthly", interval: 1, monthDay: 3, useLastDayOfMonth: true }, "exactly one"],
    [{ type: "monthly", interval: 1, monthDay: 32 }, "monthDay"],
  ])("rejects %j", (rule, message) => {
    expect(validateRule(rule).errors[0]).toMatch(new RegExp(message, "i"));
  });
});

describe("matchesRule and expansion", () => {
  it("expands a weekly Monday schedule", () => {
    expect(expandSeries(series([weekly("2026-09-14", [1])]), "2026-09-14", "2026-10-05")).toEqual([
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
    ]);
  });

  it("matches ISO Sundays rather than JavaScript day zero", () => {
    const rule = { type: "weekly", interval: 1, weekdays: [7] };
    expect(matchesRule(rule, "2026-09-13", "2026-09-13")).toBe(true);
    expect(matchesRule(rule, "2026-09-13", "2026-09-12")).toBe(false);
    expect(
      expandSegment({ from: "2026-09-13", until: null, rule }, true, "2026-09-13", "2026-09-27"),
    ).toEqual(["2026-09-13", "2026-09-20", "2026-09-27"]);
  });

  it("expands a weekly multi-day schedule", () => {
    expect(
      expandSeries(series([weekly("2026-09-07", [1, 3, 5])]), "2026-09-01", "2026-09-30"),
    ).toEqual([
      "2026-09-07",
      "2026-09-09",
      "2026-09-11",
      "2026-09-14",
      "2026-09-16",
      "2026-09-18",
      "2026-09-21",
      "2026-09-23",
      "2026-09-25",
      "2026-09-28",
      "2026-09-30",
    ]);
  });

  it("expands daily rules and has zero interval phase at the anchor", () => {
    expect(expandSeries(series([daily("2026-09-14")]), "2026-09-14", "2026-09-15")).toEqual([
      "2026-09-14",
      "2026-09-15",
    ]);
    expect(
      matchesRule({ type: "weekly", interval: 2, weekdays: [1] }, "2026-09-14", "2026-09-14"),
    ).toBe(true);
  });

  it("forces the seed occurrence even when it is off-pattern", () => {
    expect(expandSeries(series([weekly("2026-09-16", [1])]), "2026-09-16", "2026-09-30")).toEqual([
      "2026-09-16",
      "2026-09-21",
      "2026-09-28",
    ]);
  });

  it("preserves rule history across segments", () => {
    expect(
      expandSeries(
        series([daily("2026-09-07", 1, "2026-09-14"), weekly("2026-09-15", [3])]),
        "2026-09-01",
        "2026-09-30",
      ),
    ).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
      "2026-09-16",
      "2026-09-23",
      "2026-09-30",
    ]);
  });

  it("applies end dates, pauses, and exceptions", () => {
    const recurringSeries = series([daily("2026-09-01")], {
      endDate: "2026-09-05",
      pauses: [{ from: "2026-09-03", until: "2026-09-03" }],
      exceptions: ["2026-09-02"],
    });
    expect(expandSeries(recurringSeries, "2026-09-01", "2026-09-10")).toEqual([
      "2026-09-01",
      "2026-09-04",
      "2026-09-05",
    ]);
    expect(hasException(recurringSeries, "2026-09-02")).toBe(true);
    expect(
      expandSeries({ ...recurringSeries, exceptions: ["2026-09-02"] }, "2026-09-01", "2026-09-10"),
    ).not.toContain("2026-09-02");
  });

  it("keeps interval phase through a pause and resume", () => {
    const paused = series([daily("2026-09-01", 2)], {
      pauses: [{ from: "2026-09-09", until: "2026-09-19" }],
    });
    expect(expandSeries(paused, "2026-09-09", "2026-09-21")).toEqual(["2026-09-21"]);
  });

  it("supports same-day pause/resume without an inverted pause", () => {
    const noPause = series([daily("2026-09-01")], { pauses: [] });
    expect(expandSeries(noPause, "2026-10-01", "2026-10-01")).toEqual(["2026-10-01"]);
    expect(
      series([daily("2026-09-01")], { pauses: [{ from: "2026-10-02", until: null }] }).pauses[0]
        .until,
    ).toBeNull();
  });

  it("handles weekly and monthly interval phases after a pause", () => {
    expect(
      expandSeries(
        series([weekly("2026-09-07", [1], 2)], {
          pauses: [{ from: "2026-09-21", until: "2026-09-30" }],
        }),
        "2026-09-21",
        "2026-10-12",
      ),
    ).toEqual(["2026-10-05"]);
    expect(
      expandSeries(
        series([monthly("2026-01-31", { monthDay: 31 }, 2)], {
          pauses: [{ from: "2026-03-01", until: "2026-03-31" }],
        }),
        "2026-03-01",
        "2026-05-31",
      ),
    ).toEqual(["2026-05-31"]);
  });

  it("handles monthly last-day and fixed-day rules", () => {
    expect(
      expandSeries(
        series([monthly("2026-01-31", { useLastDayOfMonth: true })]),
        "2026-01-01",
        "2026-04-30",
      ),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(
      expandSeries(series([monthly("2026-01-31", { monthDay: 31 })]), "2026-01-01", "2026-03-31"),
    ).toEqual(["2026-01-31", "2026-03-31"]);
  });
});

describe("materialized visibility", () => {
  const today = "2026-10-02";
  const baseSeries = series([daily("2026-01-01")]);

  it.each([
    ["past", "2026-10-01", "to do", false, true],
    ["past", "2026-10-01", "in progress", false, true],
    ["past", "2026-10-01", "completed", false, true],
    ["today", "2026-10-02", "to do", false, true],
    ["today", "2026-10-02", "in progress", false, true],
    ["today", "2026-10-02", "completed", false, true],
    ["future", "2026-10-03", "to do", false, false],
    ["future", "2026-10-03", "in progress", false, false],
    ["future", "2026-10-03", "completed", false, true],
    ["future", "2026-10-03", "completed", true, false],
    ["future", "2026-10-03", "to do", true, false],
  ])("renders %s %s excepted=%s as %s", (_label, date, status, excepted, expected) => {
    const currentSeries = excepted ? { ...baseSeries, exceptions: [date] } : baseSeries;
    expect(shouldRenderMaterialized({ occurrenceDate: date, status }, currentSeries, today)).toBe(
      expected,
    );
  });
});

describe("next occurrence and priority", () => {
  it("returns the first occurrence strictly after the supplied date", () => {
    const recurringSeries = series([daily("2026-10-01", 2)]);
    expect(getNextOccurrence(recurringSeries, "2026-10-01")).toBe("2026-10-03");
    expect(getNextOccurrence(recurringSeries, "2026-10-03")).toBe("2026-10-05");
  });

  it("uses explicit today for priority", () => {
    expect(getPriorityFromDueDate("2026-10-02", "2026-10-01")).toBe("High");
    expect(getPriorityFromDueDate("2026-10-08", "2026-10-01")).toBe("Medium");
    expect(getPriorityFromDueDate("2026-10-20", "2026-10-01")).toBe("Low");
    expect(getPriorityFromDueDate(null, "2026-10-01")).toBe("Low");
  });

  it("does not read a live clock", () => {
    const source = readFileSync(new URL("./recurrence.js", import.meta.url), "utf8");
    expect(source).not.toMatch(/new Date\s*\(/);
  });
});
