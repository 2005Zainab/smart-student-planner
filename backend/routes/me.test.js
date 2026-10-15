import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("PATCH /api/me/timezone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a valid IANA timezone for the authenticated user", async () => {
    const setMock = vi.fn().mockResolvedValue();
    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({ set: setMock }),
    });

    const res = await request(app).patch("/api/me/timezone").send({ timezone: "Pacific/Auckland" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ timezone: "Pacific/Auckland" });
    expect(setMock).toHaveBeenCalledWith({ timezone: "Pacific/Auckland" }, { merge: true });
  });

  it.each([undefined, "Not/A_Timezone"])("rejects invalid timezone %j", async timezone => {
    const res = await request(app).patch("/api/me/timezone").send({ timezone });

    expect(res.status).toBe(400);
  });
});
