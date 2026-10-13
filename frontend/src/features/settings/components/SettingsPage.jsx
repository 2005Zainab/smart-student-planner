import { useEffect, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updateProfile } from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import { toast } from "@/components/ui/toast";
import { useAuth } from "@/shared/auth-provider";
import { getSettings, saveEmailReminders } from "../api/settings-api";

function SettingsPage() {
  const { user, refreshUser } = useAuth();

  const [open, setOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailReminders, setEmailReminders] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Load the saved email reminders setting
  useEffect(() => {
    getSettings()
      .then(settings => setEmailReminders(settings.emailReminders === true))
      .catch(err => console.log(err))
      .finally(() => setIsLoadingSettings(false));
  }, []);

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

  // Save the email reminders setting as soon as the checkbox is clicked
  const changeEmailReminders = async checked => {
    setEmailReminders(checked);

    try {
      await saveEmailReminders(checked);
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
        <h3 className="text-lg font-semibold">Notifications</h3>

        <div className="mt-4 flex items-center gap-3">
          <Checkbox
            id="email-reminders"
            checked={emailReminders}
            disabled={isLoadingSettings}
            onCheckedChange={changeEmailReminders}
          />

          <Label htmlFor="email-reminders">Email me my reminders</Label>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Reminders will be sent to {user?.email}.
        </p>
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
    </main>
  );
}

export { SettingsPage };
