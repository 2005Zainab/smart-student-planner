import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SettingsPage } from "./SettingsPage";
import { getSettings, saveEmailReminders } from "../api/settings-api";
import { generate2FA, verify2FASetup, disable2FA } from "../api/mfa-api";
import { EmailAuthProvider, reauthenticateWithCredential, updateProfile } from "firebase/auth";
import { toast } from "@/components/ui/toast";

// --- MOCKS ---

const mockUser = {
  uid: "test-uid-123",
  displayName: "Alex Student",
  email: "alex@example.com",
  emailVerified: true,
  getIdToken: vi.fn().mockResolvedValue("mock-id-token"),
  getIdTokenResult: vi.fn().mockResolvedValue({
    claims: { twoFactorEnabled: false },
  }),
  reload: vi.fn().mockResolvedValue(undefined),
};

const mockRefreshUser = vi.fn();

vi.mock("@/shared/auth-provider", () => ({
  useAuth: () => ({
    user: mockUser,
    refreshUser: mockRefreshUser,
  }),
}));

const mockSetTheme = vi.fn();
vi.mock("@/theme/theme-provider", () => ({
  useTheme: () => ({
    theme: "system",
    setTheme: mockSetTheme,
    themes: {
      system: { label: "System" },
      light: { label: "Light" },
      dark: { label: "Dark" },
    },
  }),
}));

vi.mock("../api/settings-api", () => ({
  getSettings: vi.fn(),
  saveEmailReminders: vi.fn(),
  savePasswordLessEnabled: vi.fn(),
}));

vi.mock("../api/mfa-api", () => ({
  generate2FA: vi.fn(),
  verify2FASetup: vi.fn(),
  disable2FA: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: vi.fn(() => "mock-credential") },
  reauthenticateWithCredential: vi.fn(),
  updateProfile: vi.fn(),
  sendEmailVerification: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({
  toast: { add: vi.fn() },
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSettings.mockResolvedValue({
      emailReminders: true,
      passwordLessEnabled: false,
    });

    mockUser.getIdTokenResult.mockResolvedValue({
      claims: { twoFactorEnabled: false },
    });
  });

  it("renders profile and initial settings loaded from the API", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("Alex Student")).toBeInTheDocument();
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    expect(screen.getByText("Two-Factor Authentication (TOTP)")).toBeInTheDocument();
  });

  it("changes the user's username after verifying password", async () => {
    reauthenticateWithCredential.mockResolvedValue();
    updateProfile.mockResolvedValue();

    render(<SettingsPage />);

    // Open change username dialog
    await userEvent.click(await screen.findByRole("button", { name: /change username/i }));

    const usernameInput = screen.getByLabelText(/new username/i);
    const passwordInput = screen.getByLabelText(/current password/i);

    await userEvent.clear(usernameInput);
    await userEvent.type(usernameInput, "NewAlexName");
    await userEvent.type(passwordInput, "MySecretPassword123");

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(EmailAuthProvider.credential).toHaveBeenCalledWith(
        "alex@example.com",
        "MySecretPassword123",
      );
      expect(reauthenticateWithCredential).toHaveBeenCalledWith(mockUser, "mock-credential");
      expect(updateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: "NewAlexName",
      });
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
    });
  });

  it("toggles the email reminders preference and calls saveEmailReminders", async () => {
    saveEmailReminders.mockResolvedValue({ success: true });

    render(<SettingsPage />);

    // Wait for settings to load
    const switches = await screen.findAllByRole("switch");
    const emailRemindersSwitch = switches[1]; // Second switch on page

    await userEvent.click(emailRemindersSwitch);

    await waitFor(() => {
      expect(saveEmailReminders).toHaveBeenCalledWith(false);
      expect(toast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringMatching(/disabled/i) }),
      );
    });
  });

  it("opens 2FA setup modal, displays QR code/secret, and verifies enrollment", async () => {
    generate2FA.mockResolvedValue({
      qrCodeUrl: "data:image/png;base64,fakeqrcode",
      secret: "JBSWY3DPEHPK3PXP",
    });
    verify2FASetup.mockResolvedValue({ message: "2FA enabled successfully" });

    render(<SettingsPage />);

    // Click Enable 2FA button
    const enableBtn = await screen.findByRole("button", { name: /enable 2fa/i });
    await userEvent.click(enableBtn);

    // Verify 2FA enrollment dialog opens and displays QR & Secret
    expect(generate2FA).toHaveBeenCalled();
    expect(await screen.findByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();

    // Enter 6-digit PIN code
    const pinInput = screen.getByLabelText(/6-digit authenticator code/i);
    await userEvent.type(pinInput, "123456");

    // Submit PIN
    await userEvent.click(screen.getByRole("button", { name: /verify & enable/i }));

    await waitFor(() => {
      expect(verify2FASetup).toHaveBeenCalledWith("123456");
      expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
      expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
    });
  });

  it("allows disabling 2FA when custom claims report it is enabled", async () => {
    mockUser.getIdTokenResult.mockResolvedValue({
      claims: { twoFactorEnabled: true },
    });
    disable2FA.mockResolvedValue({ message: "Disabled" });

    render(<SettingsPage />);

    const disableBtn = await screen.findByRole("button", { name: /disable 2fa/i });
    await userEvent.click(disableBtn);

    await waitFor(() => {
      expect(disable2FA).toHaveBeenCalled();
      expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
      expect(toast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringMatching(/disabled/i) }),
      );
    });
  });
});
