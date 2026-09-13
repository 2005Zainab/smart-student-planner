import { useState } from "react";
import { useRegister } from "../hooks/use-register";
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
import { Link, useNavigate } from "react-router";
import { getAuthErrorMessage } from "../utils/get-auth-error-message";

function RegisterPage() {
  const navigate = useNavigate();
  const { register, isPending, error } = useRegister();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    try {
      await register({ email, password });
      navigate("/dashboard");
    } catch {}
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Start organizing your studies with Smart Student Planner.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                autoComplete="new-password"
                id="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </div>
            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" /> Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
          {formError && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
          {error && !formError && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {getAuthErrorMessage(
                error,
                "We could not create your account. Check your details and try again.",
              )}
            </p>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              to="/login"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export { RegisterPage };
