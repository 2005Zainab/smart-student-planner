import { ThemeProvider } from "@/theme/theme-provider";
import { AuthProvider } from "@/shared/auth-provider";
import { Toaster } from "@/components/ui/toast";

function Provider({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Toaster>{children}</Toaster>
        </ThemeProvider>
    </AuthProvider>
  );
}

export { Provider };
