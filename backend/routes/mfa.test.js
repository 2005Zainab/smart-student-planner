const TEST_JWT_SECRET = "test-secret-key-12345";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import { db } from "../shared/firebase.js";
import { verify } from "otplib";

// Mock auth middleware
vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req, res, next) => {
    req.user = { uid: "test-user-1", email: "test@example.com" };
    next();
  },
}));

// Mock firebase-admin/auth
const mockGetUser = vi.fn();
const mockSetCustomUserClaims = vi.fn();

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUser: mockGetUser,
    setCustomUserClaims: mockSetCustomUserClaims,
  }),
}));

// Mock otplib
vi.mock("otplib", () => ({
  generateSecret: vi.fn().mockReturnValue("MOCK_SECRET_123"),
  generateURI: vi.fn().mockReturnValue("otpauth://totp/Smart%20Student%20Planner:test@example.com"),
  verify: vi.fn(),
}));

// Mock qrcode
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mockqrcode"),
  },
}));

// Mock Firestore
vi.mock("../shared/firebase.js", () => ({
  db: { collection: vi.fn() },
}));

describe("MFA Backend Routes", () => {
  let mfaDocMock;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    // Setup Firestore mock hierarchy:
    // db.collection("users").doc(uid).collection("settings").doc("MFA")
    mfaDocMock = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(),
    };

    const settingsCollectionMock = {
      doc: vi.fn(docId => (docId === "MFA" ? mfaDocMock : {})),
    };

    const userDocMock = {
      collection: vi.fn(colName => (colName === "settings" ? settingsCollectionMock : {})),
    };

    db.collection.mockImplementation(colName => {
      if (colName === "users") {
        return { doc: vi.fn(() => userDocMock) };
      }
      return {};
    });

    mockGetUser.mockResolvedValue({
      customClaims: { role: "student" },
    });
    mockSetCustomUserClaims.mockResolvedValue();
  });

  // ---------------------------------------------------------------------------
  // POST /api/mfa/generate
  // ---------------------------------------------------------------------------
  describe("POST /api/mfa/generate", () => {
    it("generates a secret key, QR code data URL, and saves tempTwoFactorSecret", async () => {
      const res = await request(app).post("/api/mfa/generate");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        qrCodeUrl: "data:image/png;base64,mockqrcode",
        secret: "MOCK_SECRET_123",
      });

      expect(mfaDocMock.set).toHaveBeenCalledWith(
        { tempTwoFactorSecret: "MOCK_SECRET_123" },
        { merge: true },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/mfa/verify-setup
  // ---------------------------------------------------------------------------
  describe("POST /api/mfa/verify-setup", () => {
    it("returns 400 if tempTwoFactorSecret is missing in Firestore", async () => {
      mfaDocMock.get.mockResolvedValue({
        exists: true,
        data: () => ({}),
      });

      const res = await request(app).post("/api/mfa/verify-setup").send({ token: "123456" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/generation must be called first/i);
    });

    it("returns 401 if the provided 2FA PIN is invalid", async () => {
      mfaDocMock.get.mockResolvedValue({
        exists: true,
        data: () => ({ tempTwoFactorSecret: "TEMP_SECRET_123" }),
      });
      verify.mockResolvedValue({ valid: false });

      const res = await request(app).post("/api/mfa/verify-setup").send({ token: "000000" });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid pin/i);
    });

    it("enables 2FA, updates custom claims, and sets signed JWT cookie on valid PIN", async () => {
      mfaDocMock.get.mockResolvedValue({
        exists: true,
        data: () => ({ tempTwoFactorSecret: "TEMP_SECRET_123" }),
      });
      verify.mockResolvedValue({ valid: true });

      const res = await request(app).post("/api/mfa/verify-setup").send({ token: "123456" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/enabled successfully/i);

      // Verify Firestore state update
      expect(mfaDocMock.set).toHaveBeenCalledWith(
        {
          twoFactorSecret: "TEMP_SECRET_123",
          twoFactorEnabled: true,
          tempTwoFactorSecret: null,
        },
        { merge: true },
      );

      // Verify custom claims updated in Firebase Auth
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith("test-user-1", {
        role: "student",
        twoFactorEnabled: true,
      });

      // Verify signed JWT cookie attached to response
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();

      const mfaCookieStr = cookies.find(c => c.startsWith("mfa_verified="));
      expect(mfaCookieStr).toBeDefined();

      const rawToken = mfaCookieStr.split("mfa_verified=")[1].split(";")[0];
      const decoded = jwt.verify(rawToken, TEST_JWT_SECRET);
      expect(decoded.uid).toBe("test-user-1");
      expect(decoded.mfaVerified).toBe(true);
    });

    // NEW TEST CASE HERE:
    it("returns 500 if an internal server error occurs during verification", async () => {
      // Simulate a database connection failure or timeout
      mfaDocMock.get.mockRejectedValue(new Error("Simulated Firestore connection failure"));

      const res = await request(app).post("/api/mfa/verify-setup").send({ token: "123456" });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("An internal server error occurred while verifying 2FA.");
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/mfa/login-verify
  // ---------------------------------------------------------------------------
  describe("POST /api/mfa/login-verify", () => {
    it("returns 400 if token is missing in request body", async () => {
      const res = await request(app).post("/api/mfa/login-verify").send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/token is required/i);
    });

    it("returns 400 if 2FA is not enabled for the user", async () => {
      mfaDocMock.get.mockResolvedValue({
        exists: true,
        data: () => ({ twoFactorEnabled: false }),
      });

      const res = await request(app).post("/api/mfa/login-verify").send({ token: "123456" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not enabled/i);
    });

    it("returns 400 if twoFactorSecret is missing in user document", async () => {
      mfaDocMock.get.mockResolvedValue({
        exists: true,
        data: () => ({ twoFactorEnabled: true, twoFactorSecret: null }),
      });

      const res = await request(app).post("/api/mfa/login-verify").send({ token: "123456" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/secret not found/i);
    });

    it("verifies PIN code and sets signed mfa_verified JWT cookie on success", async () => {
      mfaDocMock.get.mockResolvedValue({
        exists: true,
        data: () => ({
          twoFactorEnabled: true,
          twoFactorSecret: "SAVED_SECRET_123",
        }),
      });
      verify.mockResolvedValue({ valid: true });

      const res = await request(app).post("/api/mfa/login-verify").send({ token: "123456" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/login successful/i);

      // Verify signed JWT cookie attached to response
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();

      const mfaCookieStr = cookies.find(c => c.startsWith("mfa_verified="));
      expect(mfaCookieStr).toBeDefined();

      const rawToken = mfaCookieStr.split("mfa_verified=")[1].split(";")[0];
      const decoded = jwt.verify(rawToken, TEST_JWT_SECRET);
      expect(decoded.uid).toBe("test-user-1");
      expect(decoded.mfaVerified).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/mfa/disable
  // ---------------------------------------------------------------------------
  describe("POST /api/mfa/disable", () => {
    it("resets Firestore, sets twoFactorEnabled: false in custom claims, and clears mfa_verified cookie", async () => {
      const res = await request(app).post("/api/mfa/disable");

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/disabled successfully/i);

      // Verify Firestore document update
      expect(mfaDocMock.set).toHaveBeenCalledWith(
        {
          twoFactorSecret: null,
          twoFactorEnabled: false,
          tempTwoFactorSecret: null,
        },
        { merge: true },
      );

      // Verify custom claims updated in Firebase Auth to false
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith("test-user-1", {
        role: "student",
        twoFactorEnabled: false,
      });

      // Verify mfa_verified cookie is cleared
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const clearCookieStr = cookies.find(c => c.startsWith("mfa_verified="));
      expect(clearCookieStr).toMatch(/mfa_verified=;/);
    });
  });
});
