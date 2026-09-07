import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./components/pages/LoginPage";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate replace to="/login" />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={null} />
          <Route path="/tasks" element={null} />
          <Route path="/calendar" element={null} />
        </Route>
        <Route path="*" element={<Navigate replace to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
