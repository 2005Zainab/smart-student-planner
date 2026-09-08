import { ThemeProvider } from "@/theme/theme-provider";

function Provider({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

export { Provider };
