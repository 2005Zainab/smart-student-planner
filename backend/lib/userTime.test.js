import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../shared/firebase.js";
import { getUserToday } from "./userTime.js";

vi.mock("../shared/firebase.js", () => ({
  db: { collection: vi.fn() },
}));

describe("getUserToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T23:30:00.000Z"));
  });

  it("uses the stored IANA timezone", async () => {
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ timezone: "Pacific/Auckland" }),
        }),
      }),
    });

    await expect(getUserToday("user-1")).resolves.toBe("2026-10-02");
  });

  it("defaults a missing timezone to UTC", async () => {
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      }),
    });

    await expect(getUserToday("user-1")).resolves.toBe("2026-10-01");
  });

  it("defaults an invalid stored timezone to UTC", async () => {
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ timezone: "Not/A_Timezone" }),
        }),
      }),
    });

    await expect(getUserToday("user-1")).resolves.toBe("2026-10-01");
  });
});
