import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./components/pages/LoginPage";

function App() {
  if (window.location.pathname === "/login") {
    return <LoginPage />;
  }

  return <AppShell />;
}

export default App;
