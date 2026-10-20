import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app.js";
import { db } from "../shared/firebase.js";

// Use a test user instead of real Firebase authentication
vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req, res, next) => {
    req.user = { uid: "test-user-1" };
    next();
  },
}));

// Mock Firestore so the tests do not change real user data
vi.mock("../shared/firebase.js", () => ({
  db: { collection: vi.fn() },
}));

// Small example JPEG data for testing
const testPicture = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

// Test the existing timezone feature
describe("PATCH /api/me/timezone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves a valid timezone for the logged-in user", async () => {
    const setMock = vi.fn().mockResolvedValue();

    db.collection.mockReturnValue({
      doc: vi.fn().mockReturnValue({ set: setMock }),
    });

    const res = await request(app).patch("/api/me/timezone").send({ timezone: "Pacific/Auckland" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      timezone: "Pacific/Auckland",
    });

    expect(setMock).toHaveBeenCalledWith({ timezone: "Pacific/Auckland" }, { merge: true });
  });

  it.each([undefined, "Not/A_Timezone"])("rejects an invalid timezone %j", async timezone => {
    const res = await request(app).patch("/api/me/timezone").send({ timezone });

    expect(res.status).toBe(400);
  });
});

// Test the new profile picture feature
describe("Profile picture API", () => {
  let getMock;
  let setMock;
  let docMock;

  beforeEach(() => {
    // Clear old test results before each test
    vi.clearAllMocks();

    getMock = vi.fn();
    setMock = vi.fn().mockResolvedValue();

    // Fake Firestore user document
    docMock = vi.fn().mockReturnValue({
      get: getMock,
      set: setMock,
    });

    db.collection.mockReturnValue({
      doc: docMock,
    });
  });

  // Test 1: A new user should have no saved picture
  it("returns null when the user has no profile picture", async () => {
    getMock.mockResolvedValue({
      exists: false,
    });

    const res = await request(app).get("/api/me/profile-picture");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      profilePicture: null,
    });
  });

  // Test 2: The user can load their saved picture
  it("loads the saved profile picture", async () => {
    getMock.mockResolvedValue({
      exists: true,
      data: () => ({
        profilePicture: testPicture,
      }),
    });

    const res = await request(app).get("/api/me/profile-picture");

    expect(res.status).toBe(200);
    expect(res.body.profilePicture).toBe(testPicture);

    // Make sure we are loading the correct user's picture
    expect(docMock).toHaveBeenCalledWith("test-user-1");
  });

  // Test 3: The user can save a profile picture
  it("saves a valid profile picture", async () => {
    const res = await request(app).patch("/api/me/profile-picture").send({
      profilePicture: testPicture,
    });

    expect(res.status).toBe(200);
    expect(res.body.profilePicture).toBe(testPicture);

    // Check that Firestore saves the picture
    expect(setMock).toHaveBeenCalledWith({ profilePicture: testPicture }, { merge: true });
  });

  // Test 4: Unsupported image formats should be rejected
  it("rejects unsupported image formats", async () => {
    const res = await request(app).patch("/api/me/profile-picture").send({
      profilePicture: "data:image/png;base64,AAAA",
    });

    expect(res.status).toBe(400);

    // Invalid pictures should not be saved
    expect(setMock).not.toHaveBeenCalled();
  });

  // Test 5: Pictures that are too large should be rejected
  it("rejects an oversized profile picture", async () => {
    const oversizedPicture = "data:image/jpeg;base64," + "A".repeat(160000);

    const res = await request(app).patch("/api/me/profile-picture").send({
      profilePicture: oversizedPicture,
    });

    // Express rejects the large request with status 413
    expect(res.status).toBe(413);

    // The oversized picture should not be saved
    expect(setMock).not.toHaveBeenCalled();
  });

  // Test 6: The user must provide a picture when saving
  it("rejects missing profile picture data", async () => {
    const res = await request(app).patch("/api/me/profile-picture").send({});

    expect(res.status).toBe(400);
    expect(setMock).not.toHaveBeenCalled();
  });

  // Test 7: The user can remove their profile picture
  it("removes the profile picture", async () => {
    const res = await request(app).delete("/api/me/profile-picture");

    expect(res.status).toBe(200);
    expect(res.body.profilePicture).toBeNull();

    // Firestore should remove the saved picture
    expect(setMock).toHaveBeenCalledWith({ profilePicture: null }, { merge: true });
  });
});
