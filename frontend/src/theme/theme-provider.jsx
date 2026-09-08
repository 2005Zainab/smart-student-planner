import { createContext, useContext, useEffect, useState } from "react";
import { themes } from "./themes";

const THEME_STORAGE_KEY = "smart-student-planner-theme";
const ThemeContext = createContext(null);

function getInitialTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return savedTheme && themes[savedTheme] ? savedTheme : "light";
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const themeDefinition = themes[theme];
    const root = document.documentElement;

    root.dataset.theme = theme;
    root.classList.toggle("dark", themeDefinition.dark);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (nextTheme) => {
      if (themes[nextTheme]) setTheme(nextTheme);
    },
    themes,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider.");
  return context;
}

export { ThemeProvider, useTheme };
