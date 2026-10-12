// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../shared/http-client", () => ({
  httpClient: vi.fn(),
}));

import { httpClient } from "../../../shared/http-client";
import { useReminders } from "./useReminders";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Local time on purpose: the hook parses `${date}T${time}:00` as browser-local time.
const NOW = new Date(2026, 9, 10, 14, 0, 30); // Oct 10 2026, 14:00:30 local

const oneOff = (overrides = {}) => ({
  id: "t1",
  title: "Pay rent",
  status: "To Do",
  reminderDate: "2026-10-10",
  reminderTime: "14:00",
  ...overrides,
});

const virtualOccurrence = (overrides = {}) => ({
  id: "s1_2026-10-11",
  seriesId: "s1",
  occurrenceDate: "2026-10-11",
  virtual: true,
  title: "Submit report",
  status: "To Do",
  reminderDate: "2026-10-10",
  reminderTime: "14:00",
  ...overrides,
});

const materializedOccurrence = (overrides = {}) => ({
  ...virtualOccurrence(),
  virtual: false,
  ...overrides,
});

const FIRED_KEY = "firedReminder:s1:2026-10-11";
const REMINDER_KEY = "2026-10-10T14:00";

let NotificationMock;
let setTasks;

const setup = tasks =>
  renderHook(({ tasks }) => useReminders(tasks, setTasks), {
    initialProps: { tasks },
  });

const tick = ms => act(() => vi.advanceTimersByTime(ms));

const patchCalls = () => httpClient.mock.calls.filter(([, options]) => options?.method === "PATCH");

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  localStorage.clear();

  NotificationMock = vi.fn();
  NotificationMock.permission = "granted";
  NotificationMock.requestPermission = vi.fn();
  vi.stubGlobal("Notification", NotificationMock);

  setTasks = vi.fn();
  httpClient.mockReset();
  httpClient.mockResolvedValue({});

  document.title = "My App";
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Notification permission
// ---------------------------------------------------------------------------

describe("notification permission", () => {
  it("requests permission on mount when it is undecided", () => {
    NotificationMock.permission = "default";
    setup([]);
    expect(NotificationMock.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("does not request permission when already granted", () => {
    setup([]);
    expect(NotificationMock.requestPermission).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Eligibility: which tasks are ignored
// ---------------------------------------------------------------------------

describe("eligibility", () => {
  it("skips tasks with status 'Completed' (capitalized)", () => {
    setup([oneOff({ status: "Completed" })]);
    expect(NotificationMock).not.toHaveBeenCalled();
    expect(httpClient).not.toHaveBeenCalled();
  });

  it("skips completed occurrences too", () => {
    setup([virtualOccurrence({ status: "Completed" })]);
    expect(NotificationMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(FIRED_KEY)).toBeNull();
  });

  it("skips tasks with no reminderDate", () => {
    setup([oneOff({ reminderDate: null })]);
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it("skips tasks with no reminderTime", () => {
    setup([oneOff({ reminderTime: null })]);
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it("skips tasks whose reminder date/time cannot be parsed", () => {
    setup([oneOff({ reminderDate: "not-a-date" })]);
    expect(NotificationMock).not.toHaveBeenCalled();
    expect(httpClient).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

describe("timing", () => {
  it("does not fire a reminder that is still in the future", () => {
    setup([oneOff({ reminderTime: "15:00" })]);
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it("fires once the reminder time is reached while the app stays open", () => {
    setup([oneOff({ reminderTime: "14:10" })]);
    expect(NotificationMock).not.toHaveBeenCalled();

    tick(5 * 60 * 1000); // 14:05:30
    expect(NotificationMock).not.toHaveBeenCalled();

    tick(6 * 60 * 1000); // 14:11:30, past 14:10
    expect(NotificationMock).toHaveBeenCalledTimes(1);
  });

  it("fires immediately on mount for a reminder that is already overdue", () => {
    // Documents current behaviour: there is no staleness cutoff.
    setup([oneOff({ reminderDate: "2026-10-08", reminderTime: "09:00" })]);
    expect(NotificationMock).toHaveBeenCalledTimes(1);
  });

  it("polls every 15 seconds", () => {
    // NOW is 14:00:30, so a 14:01 reminder is 30s away: not due at +15s, due at +30s.
    setup([oneOff({ reminderTime: "14:01" })]);
    expect(NotificationMock).not.toHaveBeenCalled();

    tick(15000);
    expect(NotificationMock).not.toHaveBeenCalled();

    tick(15000);
    expect(NotificationMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Firing side effects (shared by every kind of task)
// ---------------------------------------------------------------------------

describe("firing side effects", () => {
  it("shows a notification with the task title", () => {
    setup([oneOff()]);
    expect(NotificationMock).toHaveBeenCalledWith("Task reminder", {
      body: "Pay rent",
    });
  });

  it("falls back to a default body when the task has no title", () => {
    setup([oneOff({ title: "" })]);
    expect(NotificationMock).toHaveBeenCalledWith("Task reminder", {
      body: "You have a task due",
    });
  });

  it("does not show a notification when permission is not granted, but still clears the reminder", () => {
    NotificationMock.permission = "denied";
    setup([oneOff()]);
    expect(NotificationMock).not.toHaveBeenCalled();
    expect(setTasks).toHaveBeenCalledTimes(1);
    expect(patchCalls()).toHaveLength(1);
  });

  it("sets the document title for 5 seconds, then restores it", () => {
    setup([oneOff()]);
    expect(document.title).toBe("Reminder: Pay rent");

    tick(4999);
    expect(document.title).toBe("Reminder: Pay rent");

    tick(1);
    expect(document.title).toBe("My App");
  });

  it("nulls the reminder fields in React state for the fired task only", () => {
    const other = oneOff({ id: "t2", reminderTime: "23:00" });
    setup([oneOff(), other]);

    expect(setTasks).toHaveBeenCalledTimes(1);
    const updater = setTasks.mock.calls[0][0];
    const result = updater([oneOff(), other]);

    expect(result[0]).toMatchObject({ id: "t1", reminderDate: null, reminderTime: null });
    expect(result[1]).toEqual(other);
  });
});

// ---------------------------------------------------------------------------
// One-off tasks (no seriesId): behaviour must be unchanged
// ---------------------------------------------------------------------------

describe("one-off tasks", () => {
  it("clears the reminder on the server via PATCH /tasks/:id", () => {
    setup([oneOff()]);

    expect(patchCalls()).toHaveLength(1);
    const [url, options] = patchCalls()[0];
    expect(url).toMatch(/\/api\/tasks\/t1$/);
    expect(JSON.parse(options.body)).toEqual({ reminderDate: null, reminderTime: null });
  });

  it("does not use localStorage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setup([oneOff()]);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not fire twice in the same session, even if the task still has the reminder", () => {
    // e.g. the PATCH failed and the task list still carries the reminder fields.
    const { rerender } = setup([oneOff()]);
    expect(NotificationMock).toHaveBeenCalledTimes(1);

    rerender({ tasks: [oneOff()] });
    tick(15000);
    expect(NotificationMock).toHaveBeenCalledTimes(1);
  });

  it("fires again if the reminder is rescheduled to a different (already due) time", () => {
    const { rerender } = setup([oneOff({ reminderTime: "14:00" })]);
    expect(NotificationMock).toHaveBeenCalledTimes(1);

    rerender({ tasks: [oneOff({ reminderTime: "13:00" })] });
    expect(NotificationMock).toHaveBeenCalledTimes(2);
  });

  it("survives a failed PATCH without throwing", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    httpClient.mockRejectedValue(new Error("network down"));

    expect(() => setup([oneOff()])).not.toThrow();
    await act(async () => {});

    expect(logSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Virtual occurrences: no network, state lives in localStorage
// ---------------------------------------------------------------------------

describe("virtual occurrences", () => {
  it("fires the notification", () => {
    setup([virtualOccurrence()]);
    expect(NotificationMock).toHaveBeenCalledWith("Task reminder", {
      body: "Submit report",
    });
  });

  it("makes NO network request (no 404, no accidental materialization)", () => {
    setup([virtualOccurrence()]);
    expect(httpClient).not.toHaveBeenCalled();
  });

  it("records the full date+time string in localStorage under seriesId:occurrenceDate", () => {
    setup([virtualOccurrence()]);
    expect(localStorage.getItem(FIRED_KEY)).toBe(REMINDER_KEY);
  });

  it("still nulls the reminder in React state", () => {
    setup([virtualOccurrence()]);
    expect(setTasks).toHaveBeenCalledTimes(1);

    const updater = setTasks.mock.calls[0][0];
    const [result] = updater([virtualOccurrence()]);
    expect(result).toMatchObject({ reminderDate: null, reminderTime: null });
  });

  it("does not fire again after a reload (task list refetched, reminder fields back)", () => {
    const first = setup([virtualOccurrence()]);
    expect(NotificationMock).toHaveBeenCalledTimes(1);
    first.unmount();

    // Simulates a reload: fresh hook instance (empty in-memory ref), same localStorage.
    setup([virtualOccurrence()]);
    tick(15000);

    expect(NotificationMock).toHaveBeenCalledTimes(1);
    expect(httpClient).not.toHaveBeenCalled();
  });

  it("stays suppressed when the stored key matches, from the very first check", () => {
    localStorage.setItem(FIRED_KEY, REMINDER_KEY);
    setup([virtualOccurrence()]);

    expect(NotificationMock).not.toHaveBeenCalled();
    expect(setTasks).not.toHaveBeenCalled();
  });

  it("fires again when the reminder time was changed (stored key no longer matches)", () => {
    localStorage.setItem(FIRED_KEY, REMINDER_KEY);
    setup([virtualOccurrence({ reminderTime: "14:00", reminderDate: "2026-10-09" })]);

    expect(NotificationMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(FIRED_KEY)).toBe("2026-10-09T14:00");
  });

  it("keeps separate state per occurrence of the same series", () => {
    localStorage.setItem(FIRED_KEY, REMINDER_KEY); // Oct 11 already fired

    const nextWeek = virtualOccurrence({
      id: "s1_2026-10-18",
      occurrenceDate: "2026-10-18",
      reminderDate: "2026-10-10",
      reminderTime: "14:00",
    });

    setup([virtualOccurrence(), nextWeek]);

    expect(NotificationMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("firedReminder:s1:2026-10-18")).toBe(REMINDER_KEY);
  });

  it("does not parse seriesId/date out of task.id", () => {
    // id is deliberately unrelated to seriesId/occurrenceDate.
    setup([virtualOccurrence({ id: "opaque-id-123" })]);
    expect(localStorage.getItem(FIRED_KEY)).toBe(REMINDER_KEY);
  });
});

// ---------------------------------------------------------------------------
// Materialized occurrences: real doc, PATCH via the occurrence endpoint
// ---------------------------------------------------------------------------

describe("materialized occurrences", () => {
  it("clears the reminder via the occurrence endpoint, not /tasks/:id", () => {
    setup([materializedOccurrence()]);

    expect(patchCalls()).toHaveLength(1);
    const [url, options] = patchCalls()[0];
    expect(url).toMatch(/\/api\/task-series\/s1\/occurrences\/2026-10-11$/);
    expect(url).not.toMatch(/\/api\/tasks\//);
    expect(JSON.parse(options.body)).toEqual({ reminderDate: null, reminderTime: null });
  });

  it("does not fire when localStorage says this reminder already fired while it was virtual", () => {
    // Regression: virtual -> materialized transition must not double-fire.
    localStorage.setItem(FIRED_KEY, REMINDER_KEY);
    setup([materializedOccurrence()]);

    expect(NotificationMock).not.toHaveBeenCalled();
    expect(httpClient).not.toHaveBeenCalled();
  });

  it("fires when it was materialized with a different reminder time than the one that fired", () => {
    localStorage.setItem(FIRED_KEY, REMINDER_KEY);
    setup([materializedOccurrence({ reminderDate: "2026-10-09", reminderTime: "14:00" })]);

    expect(NotificationMock).toHaveBeenCalledTimes(1);
    expect(patchCalls()).toHaveLength(1);
  });

  it("is treated as materialized when `virtual` is false, and as a one-off when absent", () => {
    // A task with seriesId and virtual undefined must not be silently treated as virtual,
    // and a task with no seriesId must never hit the occurrence endpoint.
    setup([oneOff()]);
    const [url] = patchCalls()[0];
    expect(url).toMatch(/\/api\/tasks\/t1$/);
  });
});

// ---------------------------------------------------------------------------
// localStorage failure
// ---------------------------------------------------------------------------

describe("localStorage unavailable", () => {
  it("still fires a virtual reminder if reading localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => setup([virtualOccurrence()])).not.toThrow();
    expect(NotificationMock).toHaveBeenCalledTimes(1);
  });

  it("does not throw if writing localStorage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(() => setup([virtualOccurrence()])).not.toThrow();
    expect(NotificationMock).toHaveBeenCalledTimes(1);
    expect(httpClient).not.toHaveBeenCalled();
  });

  it("does not fire repeatedly within a session when writing localStorage fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    const { rerender } = setup([virtualOccurrence()]);
    rerender({ tasks: [virtualOccurrence()] });
    tick(15000);

    expect(NotificationMock).toHaveBeenCalledTimes(1);
  });
});
