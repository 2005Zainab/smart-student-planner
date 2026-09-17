import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateProfile,
} from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { toast } from "@/components/ui/toast";
import { useAuth } from "@/shared/auth-provider";

function SettingsPage() {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const changeUsername = async (event) => {
    event.preventDefault();
    setError("");

    if (!newUsername.trim()) {
      setError("Username cannot be empty");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    if (newUsername.trim() === user.displayName) {
      setError("Please enter a different username");
      return;
    }

    try {
      //Check the user's password before changing the username
      const credential = EmailAuthProvider.credential(
        user.email,
        password,
      );

      await reauthenticateWithCredential(
        user,
        credential,
      );

      //Update the display username in Firebase
      await updateProfile(user, {
        displayName: newUsername.trim(),
      });

      await user.reload();

      toast.add({
        title: "Successfully changed username",
        type: "success",
      });

      setOpen(false);
      setNewUsername("");
      setPassword("");
    } catch (err) {
      console.log(err);

      setError(
        "Unable to change username. Please check your password.",
      );
    }
  };

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold">
          Settings
        </h2>

        <p className="mt-1 text-muted-foreground">
          Manage your account settings.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold">
          Profile
        </h3>

        <div className="mt-4 space-y-1">
          <p className="text-sm text-muted-foreground">
            Username
          </p>

          <p className="font-medium">
            {user?.displayName || user?.email}
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

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent>
          <DialogTitle>
            Change username
          </DialogTitle>

          <DialogDescription>
            Enter a new username and your current password.
          </DialogDescription>

          <form
            className="space-y-4"
            onSubmit={changeUsername}
          >
            <div className="space-y-2">
              <Label htmlFor="new-username">
                New username
              </Label>

              <Input
                id="new-username"
                value={newUsername}
                onChange={(event) =>
                  setNewUsername(event.target.value)
                }
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="current-password">
                Current password
              </Label>

              <Input
                id="current-password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>

              <Button type="submit">
                Change username
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export { SettingsPage };