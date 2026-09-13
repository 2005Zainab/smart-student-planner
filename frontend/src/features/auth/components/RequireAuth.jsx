import { Navigate, Outlet } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/shared/auth-provider";

function RequireAuth() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Skeleton aria-label="Loading your session" className="h-8 w-32" />
      </main>
    );
  }

  if (!user) {
    return <Navigate replace to="/login" />;
  }

  return <Outlet />;
}

export { RequireAuth };
