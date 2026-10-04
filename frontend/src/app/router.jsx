import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthRoutes } from "./routes/auth-routes";
import { ProtectedRoutes } from "./routes/protected-routes";

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {AuthRoutes()}
        {ProtectedRoutes()}
        <Route path="*" element={<Navigate replace to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export { Router };
