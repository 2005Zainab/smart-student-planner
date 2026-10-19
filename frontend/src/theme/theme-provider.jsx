import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { themes as defaultThemes } from "./themes";

// Save theme settings in the browser
const THEME_STORAGE_KEY = "smart-student-planner-theme";
const CUSTOM_THEMES_KEY = "smart-student-planner-custom-themes";

const ThemeContext = createContext(null);

// Load the custom themes saved by the user
function getSavedCustomThemes() {
  try {
    const saved = localStorage.getItem(CUSTOM_THEMES_KEY);
    const parsed = saved ? JSON.parse(saved) : {};

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }

    return {};
  } catch {
    return {};
  }
}

// Check whether the user uploaded a valid image data URL
function isImageDataUrl(image) {
  return (
    typeof image === "string" &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)
  );
}

// Get the background pattern or uploaded image
function getBackgroundPattern(pattern, image) {
  // Use the uploaded image first if one exists
  if (isImageDataUrl(image)) {
    return `url("${image}")`;
  }

  // Dots pattern
  if (pattern === "dots") {
    return "radial-gradient(circle, var(--custom-pattern-colour) 1px, transparent 1px)";
  }

  // Grid pattern
  if (pattern === "grid") {
    return [
      "linear-gradient(to right, var(--custom-pattern-colour) 1px, transparent 1px)",
      "linear-gradient(to bottom, var(--custom-pattern-colour) 1px, transparent 1px)",
    ].join(", ");
  }

  // Stripes pattern
  if (pattern === "stripes") {
    return "repeating-linear-gradient(45deg, var(--custom-pattern-colour) 0px, var(--custom-pattern-colour) 1px, transparent 1px, transparent 20px)";
  }

  return "none";
}

function ThemeProvider({ children }) {
  const [customThemes, setCustomThemes] = useState(getSavedCustomThemes);

  // Remember the last selected theme
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || "light");

  // Combine existing themes with saved custom themes
  const themes = useMemo(
    () => ({
      ...defaultThemes,
      ...customThemes,
    }),
    [customThemes],
  );

  // Use the Light theme if the selected theme no longer exists
  const currentTheme = themes[theme] ? theme : "light";

  // Apply the selected theme to the whole website
  useEffect(() => {
    const selectedTheme = themes[currentTheme];
    const root = document.documentElement;

    // List of colours that custom themes can change
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

    // Remove the previous custom theme colours
    colourVariables.forEach(variable => {
      root.style.removeProperty(variable);
    });

    // Remove any previous custom background
    root.style.removeProperty("--custom-theme-wallpaper");
    root.style.removeProperty("--custom-theme-wallpaper-size");
    root.style.removeProperty("--custom-theme-wallpaper-repeat");
    root.style.removeProperty("--custom-pattern-colour");

    delete root.dataset.customTheme;

    // Keep the original built-in themes working
    root.dataset.theme = selectedTheme.custom ? "light" : currentTheme;
    root.classList.toggle("dark", selectedTheme.dark);

    // Apply custom theme styling
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

      // Apply the custom colours
      Object.entries(colours).forEach(([variable, value]) => {
        if (value) {
          root.style.setProperty(variable, value);
        }
      });

      // Check whether the theme has an uploaded image
      const hasImage = isImageDataUrl(selectedTheme.backgroundImage);

      // Choose the pattern or image
      const wallpaper = getBackgroundPattern(selectedTheme.pattern, selectedTheme.backgroundImage);

      root.dataset.customTheme = "true";

      root.style.setProperty("--custom-theme-wallpaper", wallpaper);

      // Set different background sizes for images and patterns
      root.style.setProperty("--custom-theme-wallpaper-size", hasImage ? "cover" : "24px 24px");

      root.style.setProperty("--custom-theme-wallpaper-repeat", hasImage ? "no-repeat" : "repeat");

      // Make pattern lines slightly transparent
      root.style.setProperty(
        "--custom-pattern-colour",
        "color-mix(in srgb, var(--foreground) 10%, transparent)",
      );
    }

    // Save the currently selected theme
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  }, [currentTheme, themes]);

  // Save custom themes whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(customThemes));
    } catch (error) {
      console.error("Could not save custom themes", error);
    }
  }, [customThemes]);

  // Create a new custom theme
  function saveCustomTheme(newTheme) {
    const id = `custom-${crypto.randomUUID()}`;

    const savedTheme = {
      ...newTheme,
      custom: true,
      dark: false,
    };

    // Add the new theme to the saved custom themes
    setCustomThemes(previous => ({
      ...previous,
      [id]: savedTheme,
    }));

    return id;
  }

  // Delete a custom theme
  function deleteCustomTheme(themeId) {
    // Only allow custom themes to be deleted
    if (!Object.hasOwn(customThemes, themeId)) {
      return;
    }

    // If the deleted theme is selected, change back to Light
    if (currentTheme === themeId) {
      setTheme("light");
    }

    // Remove the selected theme without deleting the others
    setCustomThemes(previous => {
      const updatedThemes = { ...previous };
      delete updatedThemes[themeId];

      return updatedThemes;
    });
  }

  // Change to another existing theme
  function changeTheme(nextTheme) {
    if (themes[nextTheme]) {
      setTheme(nextTheme);
    }
  }

  // Allow other components to use the theme settings
  const value = {
    theme: currentTheme,
    setTheme: changeTheme,
    themes,
    customThemes,
    saveCustomTheme,
    deleteCustomTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Hook used to access themes in other components
function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}

export { ThemeProvider, useTheme };
