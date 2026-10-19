import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { themes as defaultThemes } from "./themes";

// Keys used to save theme settings in the browser
const THEME_STORAGE_KEY = "smart-student-planner-theme";
const CUSTOM_THEMES_KEY = "smart-student-planner-custom-themes";

const ThemeContext = createContext(null);

// Load custom themes that the user previously saved
function getSavedCustomThemes() {
  try {
    const saved = localStorage.getItem(CUSTOM_THEMES_KEY);
    const parsed = saved ? JSON.parse(saved) : {};

    // Make sure the saved data is an object
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }

    return {};
  } catch {
    // Return an empty object if there is a problem loading themes
    return {};
  }
}

function ThemeProvider({ children }) {
  const [customThemes, setCustomThemes] = useState(getSavedCustomThemes);

  // Get the last selected theme, or use Light by default
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || "light");

  // Combine the existing themes with the user's custom themes
  const themes = useMemo(
    () => ({
      ...defaultThemes,
      ...customThemes,
    }),
    [customThemes],
  );

  // If the selected theme does not exist, use Light
  const currentTheme = themes[theme] ? theme : "light";

  // Apply the selected theme to the website
  useEffect(() => {
    const selectedTheme = themes[currentTheme];
    const root = document.documentElement;

    // These colours may be changed by a custom theme
    const colourVariables = [
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--primary",
      "--primary-foreground",
      "--sidebar",
      "--sidebar-foreground",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
    ];

    // Remove colours from the previous custom theme
    // This allows the existing themes to work normally
    colourVariables.forEach(variable => {
      root.style.removeProperty(variable);
    });

    // Use the normal styling for existing themes
    // Custom themes start with the Light theme styling
    root.dataset.theme = selectedTheme.custom ? "light" : currentTheme;

    // Keep dark mode working for existing dark themes
    root.classList.toggle("dark", selectedTheme.dark);

    // Apply the user's chosen colours for a custom theme
    if (selectedTheme.custom) {
      const colours = {
        "--background": selectedTheme.background,
        "--foreground": selectedTheme.text,
        "--card": selectedTheme.background,
        "--card-foreground": selectedTheme.text,
        "--primary": selectedTheme.primary,
        "--primary-foreground": selectedTheme.primaryText,
        "--sidebar": selectedTheme.background,
        "--sidebar-foreground": selectedTheme.text,
        "--sidebar-primary": selectedTheme.primary,
        "--sidebar-primary-foreground": selectedTheme.primaryText,
      };

      // Update the website colours
      Object.entries(colours).forEach(([variable, value]) => {
        if (value) {
          root.style.setProperty(variable, value);
        }
      });
    }

    // Remember which theme the user selected
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  }, [currentTheme, themes]);

  // Save custom themes whenever they change
  useEffect(() => {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(customThemes));
  }, [customThemes]);

  // Create and save a new custom theme
  function saveCustomTheme(newTheme) {
    // Give each custom theme a unique ID
    const id = `custom-${crypto.randomUUID()}`;

    const savedTheme = {
      ...newTheme,
      custom: true,
      dark: false,
    };

    // Add the new custom theme without removing existing ones
    setCustomThemes(previous => ({
      ...previous,
      [id]: savedTheme,
    }));

    return id;
  }

  // Change the currently selected theme
  function changeTheme(nextTheme) {
    // Only allow themes that exist
    if (themes[nextTheme]) {
      setTheme(nextTheme);
    }
  }

  // Make the theme functions available to other components
  const value = {
    theme: currentTheme,
    setTheme: changeTheme,
    themes,
    customThemes,
    saveCustomTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Hook used by components to access the theme settings
function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}

export { ThemeProvider, useTheme };
