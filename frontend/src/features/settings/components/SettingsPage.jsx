import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import { toast } from "@/components/ui/toast";
import { useAuth } from "@/shared/auth-provider";
import { getSettings, saveEmailReminders, savePasswordLessEnabled } from "../api/settings-api";
import { generate2FA, verify2FASetup } from "../api/mfa-api";
import { useTheme } from "@/theme/theme-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function SettingsPage() {
  const { user, refreshUser } = useAuth();

  const [open, setOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailReminders, setEmailReminders] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const [isPasswordLessEnabled, setIsPasswordLessEnabled] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [emailSent, setEmailSent] = useState(false);
  const { theme, setTheme, themes } = useTheme();

  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [is2FADialogOpen, setIs2FADialogOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaPin, setMfaPin] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [isMfaLoading, setIsMfaLoading] = useState(false);

  // load the user's settings.
  useEffect(() => {
    async function fetchSettings() {
      if (!user) return;

      try {
        const data = await getSettings();
        setEmailReminders(data.emailReminders === true);
        setIsPasswordLessEnabled(data.passwordLessEnabled === true);

        const tokenResult = await user.getIdTokenResult();
        setIs2FAEnabled(tokenResult.claims.twoFactorEnabled === true);
      } catch (err) {
        console.error("Failed to fetch user settings", err);
      } finally {
        setIsLoadingSettings(false);
      }
    }
    fetchSettings();
  }, [user]);

  const start2FAEnrollment = async () => {
    setIs2FADialogOpen(true);
    setIsMfaLoading(true);
    setMfaError("");
    setMfaPin("");

    try {
      const { qrCodeUrl, secret } = await generate2FA();
      setQrCodeUrl(qrCodeUrl);
      setMfaSecret(secret);
    } catch (err) {
      setMfaError("Failed to load QR code. Please try again.", err);
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleVerify2FA = async e => {
    e.preventDefault();
    setMfaError("");
    setIsMfaLoading(true);

    try {
      await verify2FASetup(mfaPin);

      await user.getIdToken(true);
      const tokenResult = await user.getIdTokenResult();
      setIs2FAEnabled(tokenResult.claims.twoFactorEnabled === true);

      toast.add({
        title: "Two-Factor Authentication enabled!",
        type: "success",
      });

      setIs2FADialogOpen(false);
    } catch {
      setMfaError("Invalid PIN. Please check your app and try again.");
    } finally {
      setIsMfaLoading(false);
    }
  };

  const changeUsername = async event => {
    event.preventDefault();
    setError("");

    const newUsernameTrimmed = newUsername.trim();

    if (!newUsernameTrimmed) {
      setError("Username cannot be empty");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    if (newUsernameTrimmed === user?.displayName) {
      setError("Please enter a different username");
      return;
    }

    setIsLoading(true);

    try {
      //Check the user's password before changing the username
      const credential = EmailAuthProvider.credential(user.email, password);

      await reauthenticateWithCredential(user, credential);

      //Update the display username in Firebase
      await updateProfile(user, {
        displayName: newUsernameTrimmed,
      });

      refreshUser();

      toast.add({
        title: "Successfully changed username",
        type: "success",
      });

      setOpen(false);
      setNewUsername("");
      setPassword("");
    } catch (err) {
      console.log(err);

      setError("Unable to change username. Please check your password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    setIsVerifying(true);
    try {
      await sendEmailVerification(user);
      setEmailSent(true);
      toast.add({
        title: "Verification email sent. Please check your inbox.",
        type: "success",
      });
    } catch {
      toast.add({
        title: "Failed to send verification email",
        type: "error",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const checkVerificationStatus = async () => {
    setIsVerifying(true);
    try {
      await user.reload();
      refreshUser();
    } catch (err) {
      console.error("Failed to reload user", err);
    } finally {
      setIsVerifying(false);
    }
  };

  const togglePasswordLess = async checked => {
    setIsPasswordLessEnabled(checked);
    try {
      await savePasswordLessEnabled(checked);

      toast.add({
        title: `Password-less sign-in: ${checked ? "enabled" : "disabled"}`,
        type: "success",
      });
    } catch {
      setIsPasswordLessEnabled(!checked);
      toast.add({
        title: "Failed to update preference",
        type: "error",
      });
    }
  };

  // Save the email reminders setting as soon as the checkbox is clicked
  const changeEmailReminders = async checked => {
    setEmailReminders(checked);

    try {
      await saveEmailReminders(checked);

      toast.add({
        title: `Email reminders: ${checked ? "enabled" : "disabled"}`,
        type: "success",
      });
    } catch (err) {
      console.log(err);

      // Put the checkbox back if saving failed
      setEmailReminders(!checked);

      toast.add({
        title: "Could not save your notification setting",
        type: "error",
      });
    }
  };

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>

        <p className="mt-1 text-muted-foreground">Manage your account settings.</p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold">Profile</h3>

        <div className="mt-4 space-y-1">
          <p className="text-sm text-muted-foreground">Username</p>

          <p className="font-medium">{user?.displayName || user?.email || "Loading..."}</p>
        </div>

        <Button
          className="mt-4"
          onClick={() => {
            setError("");
            setNewUsername(user?.displayName || "");
            setPassword("");
            setOpen(true);
          }}
        >
          Change username
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold">Sign-in Preferences</h3>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium">Password-less Sign-in</p>
            <p className="text-sm text-muted-foreground">
              Sign-in via a secure link sent to your email address instead of a password.
            </p>
          </div>

          {isLoadingSettings ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : user?.emailVerified ? (
            <Switch checked={isPasswordLessEnabled} onCheckedChange={togglePasswordLess} />
          ) : emailSent ? (
            <Button variant="outline" onClick={checkVerificationStatus} disabled={isVerifying}>
              {isVerifying ? "Checking..." : "I've verified my email"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleVerifyEmail} disabled={isVerifying}>
              {isVerifying ? "Sending..." : "Verify Email to Enable"}
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium">Two-Factor Authentication (TOTP)</p>
            <p className="text-sm text-muted-foreground">
              Secure your account with a code from an authenticator app.
            </p>
          </div>

          {isLoadingSettings ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : is2FAEnabled ? (
            <Button variant="outline" disabled>
              Enabled
            </Button>
          ) : (
            <Button onClick={start2FAEnrollment}>Enable 2FA</Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold">Notifications</h3>

        <div className="mt-4 flex items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium">Email Reminders</p>
            <p className="text-sm text-muted-foreground">Reminders will be sent to {user?.email}</p>
          </div>

          {isLoadingSettings ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <Switch checked={emailReminders} onCheckedChange={changeEmailReminders} />
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold">Customize</h3>
        <p className="mt-1 text-sm text-muted-foreground">Choose a theme for your Planner</p>

        <div className="mt-4 max-w-xs">
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger aria-label="Theme" className="w-full" id="theme-select">
              <SelectValue>{themes[theme].label}</SelectValue>
            </SelectTrigger>

            <SelectContent>
              {Object.entries(themes).map(([name, { label }]) => (
                <SelectItem key={name} value={name}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Change username</DialogTitle>

          <DialogDescription>Enter a new username and your current password.</DialogDescription>

          <form className="space-y-4" onSubmit={changeUsername}>
            <div className="space-y-2">
              <Label htmlFor="new-username">New username</Label>

              <Input
                id="new-username"
                autoComplete="username"
                value={newUsername}
                onChange={event => setNewUsername(event.target.value)}
                maxLength={50}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>

              <Input
                id="current-password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                disabled={isLoading}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={is2FADialogOpen} onOpenChange={setIs2FADialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Set up Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Scan this QR code with your authenticator app, then enter the 6 digit code below to
            verify it.
          </DialogDescription>

          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            {isMfaLoading && !qrCodeUrl ? (
              <p className="text-sm text-muted-foreground py-10">Generating secure code...</p>
            ) : (
              <>
                <div className="rounded-md border p-2 bg-white">
                  {qrCodeUrl && <img src={qrCodeUrl} alt="2FA QR Code" className="h-48 w-48" />}
                </div>
                <p className="text-xs text-muted-foreground break-all px-8 text-center">
                  If you can't scan the QR code, enter this secret manually: <br />
                  <strong className="font-mono text-foreground mt-1 block">{mfaSecret}</strong>
                </p>
              </>
            )}
          </div>

          <form className="space-y-4" onSubmit={handleVerify2FA}>
            <div className="space-y-2">
              <label htmlFor="mfa-pin">6-digit Authenticator Code</label>
              <Input
                id="mfa-pin"
                placeholder="000000"
                maxLength={6}
                value={mfaPin}
                onChange={e => setMfaPin(e.target.value.replace(/\D/g, ""))}
                disabled={isMfaLoading}
                className="text-center tracking-widest text-lg font-mono"
              />
            </div>

            {mfaError && <p className="text-sm text-destructive">{mfaError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIs2FADialogOpen(false)}
                disabled={isMfaLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isMfaLoading || mfaPin.length !== 6}>
                {isMfaLoading ? "Verifying..." : "Verify & Enable"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export { SettingsPage };
