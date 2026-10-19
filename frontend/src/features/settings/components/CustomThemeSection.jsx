import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useTheme } from "@/theme/theme-provider";

// Default values when creating a new theme
const startingTheme = {
  label: "",
  background: "#f5f3ff",
  text: "#25213a",
  primary: "#7655c7",
  primaryText: "#ffffff",
  pattern: "none",
  backgroundImage: "",
};

function CustomThemeSection() {
  const { theme, setTheme, customThemes, saveCustomTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const [newTheme, setNewTheme] = useState({ ...startingTheme });
  const [error, setError] = useState("");
  const [isReadingImage, setIsReadingImage] = useState(false);

  // Update a field when the user changes it
  const updateField = (field, value) => {
    setNewTheme(previous => ({
      ...previous,
      [field]: value,
    }));
  };

  // Reset the form when opening it
  const openThemeForm = () => {
    setNewTheme({ ...startingTheme });
    setError("");
    setOpen(true);
  };

  // Let the user choose an optional background image
  const handleImageChange = event => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Please choose a PNG, JPG or WebP image.");
      return;
    }

    // Keep images small because themes are stored in the browser
    if (file.size > 500 * 1024) {
      setError("Please choose an image smaller than 500 KB.");
      return;
    }

    setIsReadingImage(true);
    setError("");

    const reader = new FileReader();

    reader.onload = () => {
      updateField("backgroundImage", reader.result);
      setIsReadingImage(false);
    };

    reader.onerror = () => {
      setError("Could not read this image. Please try another one.");
      setIsReadingImage(false);
    };

    reader.readAsDataURL(file);
  };

  // Save the custom theme
  const handleSaveTheme = event => {
    event.preventDefault();
    setError("");

    const themeName = newTheme.label.trim();

    // Make sure the theme has a name
    if (!themeName) {
      setError("Please enter a name for your theme.");
      return;
    }

    if (themeName.length > 40) {
      setError("Theme name must be 40 characters or less.");
      return;
    }

    try {
      const themeId = saveCustomTheme({
        ...newTheme,
        label: themeName,
      });

      // Apply the new theme after saving it
      setTheme(themeId);

      setOpen(false);
      setNewTheme({ ...startingTheme });
    } catch {
      setError("Could not save your theme. Please try again.");
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h4 className="font-semibold">My Custom Themes</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your own theme using your favourite colours.
        </p>
      </div>

      <Button type="button" onClick={openThemeForm}>
        + Create Custom Theme
      </Button>

      {/* Show themes the user has already created */}
      {Object.keys(customThemes).length === 0 ? (
        <p className="text-sm text-muted-foreground">You have not created any custom themes yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(customThemes).map(([id, savedTheme]) => (
            <div key={id} className="rounded-lg border p-3">
              <div className="mb-3 flex items-center gap-3">
                {/* Small preview of the saved colours */}
                <div
                  className="flex size-12 items-center justify-center rounded-md border"
                  style={{
                    backgroundColor: savedTheme.background,
                    color: savedTheme.text,
                  }}
                >
                  <div
                    className="size-5 rounded-full"
                    style={{
                      backgroundColor: savedTheme.primary,
                    }}
                  />
                </div>

                <div>
                  <p className="font-medium">{savedTheme.label}</p>
                  <p className="text-xs text-muted-foreground">Custom theme</p>
                </div>
              </div>

              <Button
                type="button"
                variant={theme === id ? "default" : "outline"}
                onClick={() => setTheme(id)}
                className="w-full"
              >
                {theme === id ? "Selected" : "Apply Theme"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Pop-up for creating a custom theme */}
      <Dialog
        open={open}
        onOpenChange={value => {
          if (!isReadingImage) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogTitle>Create Custom Theme</DialogTitle>

          <DialogDescription>
            Choose the colours and background you want for your planner.
          </DialogDescription>

          <form onSubmit={handleSaveTheme} className="space-y-5">
            {/* Theme name */}
            <div className="space-y-2">
              <Label htmlFor="custom-theme-name">Theme name</Label>
              <Input
                id="custom-theme-name"
                placeholder="e.g. My Purple Theme"
                value={newTheme.label}
                maxLength={40}
                onChange={event => updateField("label", event.target.value)}
              />
            </div>

            {/* Colour choices */}
            <div className="space-y-3">
              <p className="font-medium">Choose your colours</p>

              {[
                ["background", "Background colour"],
                ["text", "Text colour"],
                ["primary", "Button colour"],
                ["primaryText", "Button text colour"],
              ].map(([field, label]) => (
                <div key={field} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`theme-${field}`}>{label}</Label>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{newTheme[field]}</span>

                    <input
                      id={`theme-${field}`}
                      type="color"
                      value={newTheme[field]}
                      onChange={event => updateField(field, event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Background patterns */}
            <div className="space-y-2">
              <Label htmlFor="theme-pattern">Background pattern</Label>

              <select
                id="theme-pattern"
                value={newTheme.pattern}
                onChange={event => updateField("pattern", event.target.value)}
                className="w-full rounded-md border bg-background p-2"
              >
                <option value="none">No pattern</option>
                <option value="dots">Dots</option>
                <option value="grid">Grid</option>
                <option value="stripes">Stripes</option>
              </select>
            </div>

            {/* Optional background image */}
            <div className="space-y-2">
              <Label htmlFor="theme-image">Background image (optional)</Label>

              <Input
                id="theme-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                disabled={isReadingImage}
              />

              <p className="text-xs text-muted-foreground">PNG, JPG or WebP. Maximum 500 KB.</p>

              {newTheme.backgroundImage && (
                <div className="space-y-2">
                  <img
                    src={newTheme.backgroundImage}
                    alt="Custom theme background preview"
                    className="h-28 w-full rounded-md border object-cover"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateField("backgroundImage", "")}
                  >
                    Remove image
                  </Button>
                </div>
              )}
            </div>

            {/* Simple theme preview */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Preview</p>

              <div
                className="space-y-3 rounded-lg border p-4"
                style={{
                  backgroundColor: newTheme.background,
                  color: newTheme.text,
                }}
              >
                <p className="font-semibold">{newTheme.label || "My Custom Theme"}</p>

                <p className="text-sm">This is how your colours will look together.</p>

                <div
                  className="inline-block rounded-md px-4 py-2 text-sm"
                  style={{
                    backgroundColor: newTheme.primary,
                    color: newTheme.primaryText,
                  }}
                >
                  Example Button
                </div>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {/* Save or cancel */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isReadingImage}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isReadingImage}>
                {isReadingImage ? "Loading image..." : "Save Theme"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CustomThemeSection };
