import { Route } from "react-router";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { RegisterPage } from "@/features/auth/components/RegisterPage";
import { ForgotPasswordPage } from "@/features/auth/components/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/components/ResetPasswordPage";

function AuthRoutes() {
  return (
    <>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </>
  );
}

export { AuthRoutes };
