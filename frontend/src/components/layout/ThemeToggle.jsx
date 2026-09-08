import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/theme/theme-provider";

function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      aria-label={isDark ? "Use light theme" : "Use dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      size="icon"
      variant="ghost"
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}

export { ThemeToggle };
