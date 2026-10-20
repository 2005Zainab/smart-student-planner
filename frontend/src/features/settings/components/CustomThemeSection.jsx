import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useTheme } from "@/theme/theme-provider";

// Default colours and settings for a new theme
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
  const {
    theme,
    setTheme,
    customThemes,
    saveCustomTheme,
    deleteCustomTheme,
    isLoading,
    loadError,
  } = useTheme();

  const [open, setOpen] = useState(false);
  const [newTheme, setNewTheme] = useState({ ...startingTheme });
  const [error, setError] = useState("");
  const [isReadingImage, setIsReadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingThemeId, setDeletingThemeId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  // Update a value when the user changes it
  const updateField = (field, value) => {
    setNewTheme(previous => ({
      ...previous,
      [field]: value,
    }));
  };

  // Open the form and reset the values
  const openThemeForm = () => {
    if (isLoading || loadError) return;

    setNewTheme({ ...startingTheme });
    setError("");
    setOpen(true);
  };

  // Read the background image selected by the user
  const handleImageChange = event => {
    const file = event.target.files?.[0];

    if (!file) return;

    // Only allow PNG, JPG and WebP images
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Please choose a PNG, JPG or WebP image.");
      event.target.value = "";
      return;
    }

    // Keep uploaded images small for Firestore storage
    if (file.size > 500 * 1024) {
      setError("Please choose an image smaller than 500 KB.");
      event.target.value = "";
      return;
    }

    setIsReadingImage(true);
    setError("");

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Could not read this image. Please try again.");
        setIsReadingImage(false);
        return;
      }

      updateField("backgroundImage", reader.result);
      setIsReadingImage(false);
    };

    reader.onerror = () => {
      setError("Could not read this image. Please try another one.");
      setIsReadingImage(false);
    };

    reader.readAsDataURL(file);
  };

  // Save the new theme in Firestore
  const handleSaveTheme = async event => {
    event.preventDefault();

    if (isSaving || isReadingImage || isLoading) return;

    setError("");

    const themeName = newTheme.label.trim();

    // Check the theme name
    if (!themeName) {
      setError("Please enter a name for your theme.");
      return;
    }

    if (themeName.length > 40) {
      setError("Theme name must be 40 characters or less.");
      return;
    }

    setIsSaving(true);

    try {
      // Wait until Firestore confirms the save
      const themeId = await saveCustomTheme({
        ...newTheme,
        label: themeName,
      });

      // Apply the newly saved theme
      setTheme(themeId);

      // Close the form only after a successful save
      setOpen(false);
      setNewTheme({ ...startingTheme });
    } catch (saveError) {
      console.error("Could not save custom theme:", saveError);

      setError(saveError.message || "Could not save your theme. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Ask the user before deleting a saved theme
  const handleDeleteTheme = async (themeId, themeName) => {
    if (deletingThemeId || isLoading) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${themeName}"?`);

    if (!confirmed) return;

    setDeleteError("");
    setDeletingThemeId(themeId);

    try {
      // Wait for Firestore before updating the interface
      await deleteCustomTheme(themeId);
    } catch (deleteFailure) {
      console.error("Could not delete custom theme:", deleteFailure);

      setDeleteError(deleteFailure.message || "Could not delete your theme. Please try again.");
    } finally {
      setDeletingThemeId(null);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Custom themes heading */}
      <div>
        <h4 className="font-semibold">My Custom Themes</h4>

        <p className="mt-1 text-sm text-muted-foreground">
          Create your own theme using your favourite colours, patterns or background images.
        </p>
      </div>

      {/* Show a message while loading themes */}
      {isLoading && <p className="text-sm text-muted-foreground">Loading your custom themes...</p>}

      {/* Show an error if themes could not be loaded */}
      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      )}

      {/* Create theme button */}
      <Button type="button" onClick={openThemeForm} disabled={isLoading || Boolean(loadError)}>
        + Create Custom Theme
      </Button>

      {/* Show themes saved in Firestore */}
      {!isLoading && !loadError && (
        <>
          {Object.keys(customThemes).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have not created any custom themes yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(customThemes).map(([id, savedTheme]) => (
                <div key={id} className="rounded-lg border p-3">
                  {/* Theme preview and name */}
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex size-12 items-center justify-center rounded-md border"
                      style={{
                        backgroundColor: savedTheme.background,
                        color: savedTheme.text,
                        backgroundImage: savedTheme.backgroundImage
                          ? `url("${savedTheme.backgroundImage}")`
                          : "none",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
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

                  {/* Apply and delete buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={theme === id ? "default" : "outline"}
                      onClick={() => setTheme(id)}
                      disabled={Boolean(deletingThemeId)}
                      className="flex-1"
                    >
                      {theme === id ? "Selected" : "Apply Theme"}
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      disabled={Boolean(deletingThemeId)}
                      onClick={() => handleDeleteTheme(id, savedTheme.label)}
                    >
                      {deletingThemeId === id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Show an error if deleting a theme fails */}
      {deleteError && (
        <p role="alert" className="text-sm text-destructive">
          {deleteError}
        </p>
      )}

      {/* Create theme pop-up */}
      <Dialog
        open={open}
        onOpenChange={value => {
          if (!isReadingImage && !isSaving) {
            setOpen(value);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogTitle>Create Custom Theme</DialogTitle>

          <DialogDescription>
            Choose the colours, patterns and background you want for your student planner.
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
                disabled={isSaving}
                onChange={event => updateField("label", event.target.value)}
              />
            </div>

            {/* Custom colour options */}
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
                      disabled={isSaving}
                      onChange={event => updateField(field, event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Background pattern */}
            <div className="space-y-2">
              <Label htmlFor="theme-pattern">Background pattern</Label>

              <select
                id="theme-pattern"
                value={newTheme.pattern}
                disabled={isSaving}
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
                disabled={isReadingImage || isSaving}
              />

              <p className="text-xs text-muted-foreground">PNG, JPG or WebP. Maximum 500 KB.</p>

              {/* Display an image preview */}
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
                    disabled={isSaving}
                    onClick={() => updateField("backgroundImage", "")}
                  >
                    Remove image
                  </Button>
                </div>
              )}
            </div>

            {/* Preview the theme colours */}
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

            {/* Error message */}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {/* Cancel and save buttons */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isReadingImage || isSaving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isReadingImage || isSaving || isLoading}>
                {isSaving ? "Saving..." : isReadingImage ? "Loading image..." : "Save Theme"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CustomThemeSection };
