import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { themes as defaultThemes } from "./themes";
import { useAuth } from "@/shared/auth-provider";

import {
  getCustomThemes,
  saveCustomThemeToFirestore,
  deleteCustomThemeFromFirestore,
} from "@/features/settings/api/custom-themes-api";

const THEME_STORAGE_KEY = "smart-student-planner-theme";

const ThemeContext = createContext(null);
const EMPTY_THEMES = {};

// Check whether an uploaded background image is valid
function isImageDataUrl(image) {
  return (
    typeof image === "string" &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)
  );
}

// Choose an uploaded image or background pattern
function getBackgroundPattern(pattern, image) {
  if (isImageDataUrl(image)) {
    return `url("${image}")`;
  }

  if (pattern === "dots") {
    return "radial-gradient(circle, var(--custom-pattern-colour) 1px, transparent 1px)";
  }

  if (pattern === "grid") {
    return [
      "linear-gradient(to right, var(--custom-pattern-colour) 1px, transparent 1px)",
      "linear-gradient(to bottom, var(--custom-pattern-colour) 1px, transparent 1px)",
    ].join(", ");
  }

  if (pattern === "stripes") {
    return "repeating-linear-gradient(45deg, var(--custom-pattern-colour) 0px, var(--custom-pattern-colour) 1px, transparent 1px, transparent 20px)";
  }

  return "none";
}

// Remember which theme was selected
function getLastSelectedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || "light";
  } catch {
    return "light";
  }
}

function ThemeProvider({ children }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.uid ?? null;

  // Store custom themes for the signed-in user
  const [savedThemes, setSavedThemes] = useState({
    userId: null,
    themes: {},
  });

  // Track Firestore loading and errors
  const [loadState, setLoadState] = useState({
    userId: null,
    error: null,
  });

  // Track the currently selected theme
  const [theme, setTheme] = useState(getLastSelectedTheme);

  // Only display themes belonging to the current user
  const customThemes = userId && savedThemes.userId === userId ? savedThemes.themes : EMPTY_THEMES;

  const isLoading = isAuthLoading || (Boolean(userId) && loadState.userId !== userId);

  const loadError = userId && loadState.userId === userId ? loadState.error : null;

  // Combine built-in themes with custom themes
  const themes = useMemo(
    () => ({
      ...defaultThemes,
      ...customThemes,
    }),
    [customThemes],
  );

  // Fall back to Light if the theme does not exist
  const currentTheme = Object.hasOwn(themes, theme) ? theme : "light";

  // Load custom themes from Firestore
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadThemes() {
      try {
        const result = await getCustomThemes();

        if (cancelled) return;

        setSavedThemes({
          userId,
          themes: result || {},
        });

        setLoadState({
          userId,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;

        console.error("Failed to load custom themes", error);

        setSavedThemes({
          userId,
          themes: {},
        });

        setLoadState({
          userId,
          error: "Could not load your custom themes. Please refresh and try again.",
        });
      }
    }

    loadThemes();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Apply the selected theme to the website
  useEffect(() => {
    const selectedTheme = themes[currentTheme];
    const root = document.documentElement;

    // Colours used by all app components
    const colourVariables = [
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--muted",
      "--muted-foreground",
      "--accent",
      "--accent-foreground",
      "--border",
      "--input",
      "--ring",
      "--sidebar",
      "--sidebar-foreground",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
      "--sidebar-accent",
      "--sidebar-accent-foreground",
      "--sidebar-border",
      "--sidebar-ring",
    ];

    // Remove previous custom colours
    colourVariables.forEach(variable => {
      root.style.removeProperty(variable);
    });

    // Remove previous background pattern or image
    root.style.removeProperty("--custom-theme-wallpaper");
    root.style.removeProperty("--custom-theme-wallpaper-size");
    root.style.removeProperty("--custom-theme-wallpaper-repeat");
    root.style.removeProperty("--custom-pattern-colour");

    delete root.dataset.customTheme;

    // Keep the original built-in themes working
    root.dataset.theme = selectedTheme.custom ? "light" : currentTheme;

    root.classList.toggle("dark", Boolean(selectedTheme.dark));

    // Apply custom colours and background
    if (selectedTheme.custom) {
      const background = selectedTheme.background;
      const foreground = selectedTheme.text;
      const primary = selectedTheme.primary;
      const primaryForeground = selectedTheme.primaryText;

      // Derive matching colours from the user's choices
      const surface = `color-mix(in srgb, ${background} 92%, ${foreground} 8%)`;
      const subtle = `color-mix(in srgb, ${background} 87%, ${foreground} 13%)`;
      const hover = `color-mix(in srgb, ${background} 78%, ${foreground} 22%)`;
      const mutedText = `color-mix(in srgb, ${foreground} 72%, ${background} 28%)`;
      const border = `color-mix(in srgb, ${foreground} 20%, ${background} 80%)`;

      const colours = {
        "--background": background,
        "--foreground": foreground,
        "--card": surface,
        "--card-foreground": foreground,
        "--popover": surface,
        "--popover-foreground": foreground,
        "--primary": primary,
        "--primary-foreground": primaryForeground,
        "--secondary": subtle,
        "--secondary-foreground": foreground,
        "--muted": subtle,
        "--muted-foreground": mutedText,
        "--accent": hover,
        "--accent-foreground": foreground,
        "--border": border,
        "--input": border,
        "--ring": primary,
        "--sidebar": surface,
        "--sidebar-foreground": foreground,
        "--sidebar-primary": primary,
        "--sidebar-primary-foreground": primaryForeground,
        "--sidebar-accent": hover,
        "--sidebar-accent-foreground": foreground,
        "--sidebar-border": border,
        "--sidebar-ring": primary,
      };

      Object.entries(colours).forEach(([variable, value]) => {
        if (value) {
          root.style.setProperty(variable, value);
        }
      });

      // Check whether an image is selected
      const hasImage = isImageDataUrl(selectedTheme.backgroundImage);

      root.dataset.customTheme = "true";

      // Apply the image or pattern
      root.style.setProperty(
        "--custom-theme-wallpaper",
        getBackgroundPattern(selectedTheme.pattern, selectedTheme.backgroundImage),
      );

      // Background images cover the screen
      // Patterns repeat across the screen
      root.style.setProperty("--custom-theme-wallpaper-size", hasImage ? "cover" : "24px 24px");

      root.style.setProperty("--custom-theme-wallpaper-repeat", hasImage ? "no-repeat" : "repeat");

      // Make patterns slightly transparent
      root.style.setProperty(
        "--custom-pattern-colour",
        "color-mix(in srgb, var(--foreground) 10%, transparent)",
      );
    }

    // Do not overwrite a saved theme choice
    // while Firestore is still loading
    if (!isLoading && !loadError) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
      } catch (error) {
        console.error("Failed to remember selected theme", error);
      }
    }
  }, [currentTheme, themes, isLoading, loadError]);

  // Create and save a custom theme in Firestore
  async function saveCustomTheme(newTheme) {
    if (!userId) {
      throw new Error("Please sign in before creating a theme.");
    }

    if (isLoading || loadError) {
      throw new Error("Themes are not ready. Please try again.");
    }

    // Generate a unique theme ID
    const id = `custom-${crypto.randomUUID()}`;

    const savedTheme = {
      ...newTheme,
      custom: true,
      dark: false,
    };

    // Wait until Firestore confirms the save
    const result = await saveCustomThemeToFirestore(id, savedTheme);

    // Update the screen only after a successful save
    setSavedThemes(previous => {
      if (previous.userId !== userId) {
        return previous;
      }

      return {
        userId,
        themes: {
          ...previous.themes,
          [id]: result,
        },
      };
    });

    // Select the newly saved theme
    setTheme(id);

    return id;
  }

  // Delete a saved custom theme from Firestore
  async function deleteCustomTheme(themeId) {
    if (!userId) {
      throw new Error("Please sign in before deleting a theme.");
    }

    if (isLoading || loadError) {
      throw new Error("Themes are not ready. Please try again.");
    }

    // Only allow saved custom themes to be deleted
    if (!Object.hasOwn(customThemes, themeId)) {
      return;
    }

    // Wait until Firestore confirms deletion
    await deleteCustomThemeFromFirestore(themeId);

    // Remove the deleted theme from the screen
    setSavedThemes(previous => {
      if (previous.userId !== userId) {
        return previous;
      }

      const updatedThemes = {
        ...previous.themes,
      };

      delete updatedThemes[themeId];

      return {
        userId,
        themes: updatedThemes,
      };
    });

    // Return to Light if the deleted theme was selected
    setTheme(previous => (previous === themeId ? "light" : previous));
  }

  // Change between built-in and custom themes
  function changeTheme(nextTheme) {
    if (Object.hasOwn(themes, nextTheme)) {
      setTheme(nextTheme);
    }
  }

  // Share theme settings with other components
  const value = {
    theme: currentTheme,
    setTheme: changeTheme,
    themes,
    customThemes,
    saveCustomTheme,
    deleteCustomTheme,
    isLoading,
    loadError,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Hook for accessing theme settings
function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}

export { ThemeProvider, useTheme };
