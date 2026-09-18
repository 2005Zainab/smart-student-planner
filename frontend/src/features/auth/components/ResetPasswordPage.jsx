import { useState } from "react";
import { useSearchParams, Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirmResetPassword } from "../hooks/use-confirm-reset-password";
import { getAuthErrorMessage } from "../utils/get-auth-error-message";

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const { error, isPending, confirm } = useConfirmResetPassword();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatchError, setMismatchError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMismatchError("");

    if (password !== confirmPassword) {
      setMismatchError("Passwords do not match.");
      return;
    }

    try {
      await confirm({ oobCode, newPassword: password });
      setSuccess(true);
    } catch {}
  }

  if (success) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Password changed</CardTitle>
            <CardDescription>
              Your password has successfully been changed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              to="/login"
            >
              Back to login
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Enter your new password below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                autoComplete="new-password"
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                autoComplete="new-password"
                id="confirm-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </div>
            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" /> Changing password...
                </>
              ) : (
                "Change password"
              )}
            </Button>
          </form>
          {mismatchError && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {mismatchError}
            </p>
          )}
          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {getAuthErrorMessage(error)}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export { ResetPasswordPage };