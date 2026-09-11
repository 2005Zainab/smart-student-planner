import { ThemeProvider } from "@/theme/theme-provider";
import { AuthProvider } from "@/shared/auth-provider";

function Provider({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AuthProvider>
  );
}

export { Provider };
