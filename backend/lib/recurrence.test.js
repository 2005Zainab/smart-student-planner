import { describe, expect, it } from "vitest";
import { getPriorityFromDueDate } from "./recurrence.js";

describe("getPriorityFromDueDate", () => {
  it("uses the explicit today date", () => {
    expect(getPriorityFromDueDate("2026-10-02", "2026-10-01")).toBe("High");
    expect(getPriorityFromDueDate("2026-10-08", "2026-10-01")).toBe("Medium");
    expect(getPriorityFromDueDate("2026-10-20", "2026-10-01")).toBe("Low");
  });

  it("treats missing due dates as low priority", () => {
    expect(getPriorityFromDueDate(null, "2026-10-01")).toBe("Low");
  });
});
