import { useEffect, useState } from "react";
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
import { useLogin } from "../hooks/use-login";
import { getAuthErrorMessage } from "../utils/get-auth-error-message";

import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import { auth } from "../../../shared/auth";

function LoginPage() {
  const navigate = useNavigate();
  const { error, isPending, login } = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLinkPending, setIsLinkPending] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkError, setLinkError] = useState("");

  (useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let storedEmail = window.localStorage.getItem("emailForSignIn");

      if (!storedEmail) {
        storedEmail = window.prompt(
          "Please confirm your email address to sign in:",
        );
      }

      if (storedEmail) {
        signInWithEmailLink(auth, storedEmail, window.location.href)
          .then(() => {
            window.localStorage.removeItem("emailForSignIn");
            navigate("/dashboard");
          })
          .catch((err) => {
            setLinkError(getAuthErrorMessage(err));
          });
      }
    }
  }),
    [navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch {
      /* empty */
    }
  }

  async function handlePasswordLess() {
    setLinkError("");
    if (!email) {
      setLinkError("Please enter your email address first.");
      return;
    }

    setIsLinkPending(true);

    const actionCodeSettings = {
      url: window.location.origin + "/login",
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
      setLinkSent(true);
    } catch (err) {
      setLinkError(getAuthErrorMessage(err));
    } finally {
      setIsLinkPending(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Sign in to continue planning your studies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkSent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm font-medium text-low-priority">
                Password-less sign-in link sent! Check your email inbox.
              </p>
              <button variant="outline" onClick={() => setLinkSent(false)}>
                Back to login
              </button>
            </div>
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
                <Label htmlFor="password">
                  Password (Optional for password-less sign-in)
                </Label>
                <Input
                  autoComplete="current-password"
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button className="w-full" disabled={isPending || isLinkPending} type="submit">
                  {isPending ? (
                    <>
                      <Spinner data-icon="inline-start" /> Signing in...
                    </>
                  ) : (
                    "Sign in with Password"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={isPending || isLinkPending}
                  onClick={handlePasswordLess}
                >
                  {isLinkPending
                    ? "Sending link..."
                    : "Send me password-less sign-in link"}
                </Button>
              </div>

              <p className="text-center text-sm">
                <Link
                  className="font-medium text-foreground underline underline-offset-4"
                  to="/forgot-password"
                >
                  Forgot password?
                </Link>
              </p>
            </form>
          )}
            <p className="mt-3 text-sm text-destructive" role="alert">
              {linkError || getAuthErrorMessage(error)}
            </p>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              to="/register"
            >
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export { LoginPage };
