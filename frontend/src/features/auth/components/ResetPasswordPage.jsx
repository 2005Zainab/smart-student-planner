import { Link } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ResetPasswordPage() {
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

export { ResetPasswordPage };