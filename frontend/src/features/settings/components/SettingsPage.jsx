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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { toast } from "@/components/ui/toast";
import { useAuth } from "@/shared/auth-provider";
import { httpClient } from "@/shared/http-client";

function SettingsPage() {
  const { user, refreshUser } = useAuth();

  const [open, setOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isPasswordLessEnabled, setIsPasswordLessEnabled] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      if (!user) return;

      try {
        const data = await httpClient(
          "http://localhost:3000/api/user/settings",
          { method: "GET" },
        );
        setIsPasswordLessEnabled(data.passwordLessEnabled || false);
      } catch (err) {
        console.error("Failed to fetch user settings", err);
      } finally {
        setSettingsLoading(false);
      }
    }
    fetchSettings();
  }, [user]);

  const changeUsername = async (event) => {
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

  const handelVerifyEmail = async () => {
    setIsVerifying(true);
    try {
      await sendEmailVerification(user);
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
      setIsVerifying(true);
    }
  };

  const togglePasswordLess = async (checked) => {
    setIsPasswordLessEnabled(checked);
    try {
      await httpClient("http://localhost:3000/api/users/settings", {
        method: "PATCH",
        body: JSON.stringify({ passwordLessEnabled: checked }),
      });

      toast.add({
        title: 'Password-less sign-in ${checked ? "enabled" : "disabled"}',
        type: "",
      });
    } catch {
      setIsPasswordLessEnabled(!checked);
      toast.add({
        title: "Failed to update preference",
        type: "error",
      });
    }
  };

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>

        <p className="mt-1 text-muted-foreground">
          Manage your account settings.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold">Profile</h3>

        <div className="mt-4 space-y-1">
          <p className="text-sm text-muted-foreground">Username</p>

          <p className="font-medium">
            {user?.displayName || user?.email || "Loading..."}
          </p>
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

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium">Password-less Sign-in</p>
            <p className="text-sm text-muted-foreground">
              Sign-in via a secure link sent to your email address instead of a
              password.
            </p>
          </div>

          {settingsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : user?.emailVerified ? (
            <Switch
              checked={isPasswordLessEnabled}
              onCheckedChange={togglePasswordLess}
            />
          ) : (
            <Button
              variant="secondary"
              onClick={handelVerifyEmail}
              disabled={isVerifying}
            >
              {isVerifying ? "Sending..." : "Verify Email to Enable"}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Change username</DialogTitle>

          <DialogDescription>
            Enter a new username and your current password.
          </DialogDescription>

          <form className="space-y-4" onSubmit={changeUsername}>
            <div className="space-y-2">
              <Label htmlFor="new-username">New username</Label>

              <Input
                id="new-username"
                autoComplete="username"
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
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
    </main>
  );
}

export { SettingsPage };
