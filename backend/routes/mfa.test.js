import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
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

// Mock otplib's verify function
vi.mock("otplib", async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    verify: vi.fn(),
  };
});

// Mock Firestore
vi.mock("../shared/firebase.js", () => ({
  db: { collection: vi.fn() },
}));

describe("MFA Backend Routes", () => {
  let mfaDocMock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup nested Firestore collection/doc structure:
    // db.collection("users").doc(uid).collection("settings").doc("MFA")
    mfaDocMock = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(),
      update: vi.fn().mockResolvedValue(),
    };

    const settingsCollectionMock = {
      doc: vi.fn(docId => (docId === "MFA" ? mfaDocMock : {})),
    };

    const userDocMock = {
      collection: vi.fn(colName => (colName === "settings" ? settingsCollectionMock : {})),
    };

    db.collection.mockImplementation(colName => {
      if (colName === "users") {
        return {
          doc: vi.fn(() => userDocMock),
        };
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
    it("generates a secret and QR code URL, then saves tempTwoFactorSecret to Firestore", async () => {
      const res = await request(app).post("/api/mfa/generate");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("qrCodeUrl");
      expect(res.body).toHaveProperty("secret");
      expect(res.body.qrCodeUrl).toMatch(/^data:image\/png;base64,/);

      expect(mfaDocMock.set).toHaveBeenCalledWith(
        { tempTwoFactorSecret: res.body.secret },
        { merge: true },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/mfa/verify-setup
  // ---------------------------------------------------------------------------
  describe("POST /api/mfa/verify-setup", () => {
    it("returns 400 if generate was not called first (missing tempTwoFactorSecret)", async () => {
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

    it("enables 2FA, updates Firestore, and updates Firebase custom claims on valid PIN", async () => {
      mfaDocMock.get.mockResolvedValue({
        exists: true,
        data: () => ({ tempTwoFactorSecret: "TEMP_SECRET_123" }),
      });
      verify.mockResolvedValue({ valid: true });

      const res = await request(app).post("/api/mfa/verify-setup").send({ token: "123456" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/enabled successfully/i);

      // Verify Firestore update
      expect(mfaDocMock.set).toHaveBeenCalledWith(
        {
          twoFactorSecret: "TEMP_SECRET_123",
          twoFactorEnabled: true,
          tempTwoFactorSecret: null,
        },
        { merge: true },
      );

      // Verify Firebase custom claim set
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith("test-user-1", {
        role: "student",
        twoFactorEnabled: true,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/mfa/login-verify
  // ---------------------------------------------------------------------------
  describe("POST /api/mfa/login-verify", () => {
    it("returns 400 if 2FA is not enabled for the user", async () => {
      mfaDocMock.get.mockResolvedValue({
        exists: true,
        data: () => ({ twoFactorEnabled: false }),
      });

      const res = await request(app).post("/api/mfa/login-verify").send({ token: "123456" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/2FA is not enabled/i);
    });

    it("returns 401 if the login PIN code is invalid", async () => {
      mfaDocMock.get.mockResolvedValue({
        exists: true,
        data: () => ({
          twoFactorEnabled: true,
          twoFactorSecret: "SAVED_SECRET_123",
        }),
      });
      verify.mockResolvedValue({ valid: false });

      const res = await request(app).post("/api/mfa/login-verify").send({ token: "999999" });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid 2fa code/i);
    });

    it("verifies PIN and sets mfa_verified HTTP-only cookie on success", async () => {
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

      // Check HTTP-only cookie in response header
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/mfa_verified=true/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/mfa/disable
  // ---------------------------------------------------------------------------
  describe("POST /api/mfa/disable", () => {
    it("disables 2FA in Firestore, clears custom claim, and clears mfa_verified cookie", async () => {
      const res = await request(app).post("/api/mfa/disable");

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/disabled successfully/i);

      // Verify Firestore update
      expect(mfaDocMock.set).toHaveBeenCalledWith(
        {
          twoFactorSecret: null,
          twoFactorEnabled: false,
          tempTwoFactorSecret: null,
        },
        { merge: true },
      );

      // Verify custom claim updated to false
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith("test-user-1", {
        role: "student",
        twoFactorEnabled: false,
      });

      // Verify cookie cleared
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/mfa_verified=;/);
    });
  });
});
