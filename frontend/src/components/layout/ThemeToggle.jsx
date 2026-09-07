import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <Button
      aria-label={isDark ? "Use light theme" : "Use dark theme"}
      onClick={() => setIsDark((dark) => !dark)}
      size="icon"
      variant="ghost"
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}

export { ThemeToggle };
