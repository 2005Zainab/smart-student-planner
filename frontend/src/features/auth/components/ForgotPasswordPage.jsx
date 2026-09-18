import { useState } from "react";
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
import { Link } from "react-router";
import { useResetPassword } from "../hooks/use-reset-password";
import { getAuthErrorMessage } from "../utils/get-auth-error-message";

function ForgotPasswordPage() {
  const { error, isPending, reset } = useResetPassword();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await reset({ email });
      setSubmitted(true);
    } catch {}
  }
  
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>
            Enter your email and we'll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <p className="text-sm text-muted-foreground">
              Check your email for a link to reset your password.
            </p>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  autoComplete="email"
                  id="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
              <Button className="w-full" disabled={isPending} type="submit">
                {isPending ? (
                  <>
                    <Spinner data-icon="inline-start" /> Sending...
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          )}
          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {getAuthErrorMessage(error)}
            </p>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              to="/login"
            >
              Back to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export { ForgotPasswordPage };