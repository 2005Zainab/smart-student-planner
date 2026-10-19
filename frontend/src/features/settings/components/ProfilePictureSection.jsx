import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/shared/auth-provider";

import {
  getProfilePicture,
  saveProfilePicture,
  deleteProfilePicture,
} from "../api/profile-picture-api";

// Maximum original picture size: 5 MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Picture formats users can upload
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Draw the cropped picture on a square canvas
function drawCrop(canvas, image, zoom, horizontal, vertical) {
  if (!canvas || !image) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const size = canvas.width;

  // Make sure the picture fills the square
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * zoom;

  const imageWidth = image.naturalWidth * scale;
  const imageHeight = image.naturalHeight * scale;

  // Calculate how much the picture can move
  const extraWidth = imageWidth - size;
  const extraHeight = imageHeight - size;

  const x = -extraWidth * (horizontal / 100);
  const y = -extraHeight * (vertical / 100);

  // Clear the old preview
  context.clearRect(0, 0, size, size);

  // Add a white background for transparent images
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);

  // Draw the selected crop
  context.drawImage(image, x, y, imageWidth, imageHeight);
}

// Resize and compress the picture before saving
function makeSmallPicture(previewCanvas) {
  const canvas = document.createElement("canvas");

  // Try a smaller image if the result is too large
  for (const size of [160, 128, 96]) {
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to process this picture.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);

    context.drawImage(previewCanvas, 0, 0, size, size);

    // Try different image quality levels
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const picture = canvas.toDataURL("image/jpeg", quality);

      // Keep the data small enough for the backend
      if (picture.startsWith("data:image/jpeg;base64,") && picture.length < 70000) {
        return picture;
      }
    }
  }

  throw new Error("The picture could not be made small enough.");
}

function ProfilePictureSection() {
  const { user } = useAuth();

  const previewRef = useRef(null);

  // Saved profile picture
  const [savedPicture, setSavedPicture] = useState(null);

  // Newly selected picture
  const [image, setImage] = useState(null);

  // Crop settings
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);

  // Loading and messages
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load the saved picture when the user opens Settings
  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;

    async function loadPicture() {
      try {
        const result = await getProfilePicture();

        if (!cancelled) {
          setSavedPicture(result.profilePicture ?? null);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load your profile picture.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPicture();

    // Ignore old requests if the user changes
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Update the crop preview when the image or sliders change
  useEffect(() => {
    drawCrop(previewRef.current, image, zoom, horizontal, vertical);
  }, [image, zoom, horizontal, vertical]);

  // Check the picture selected by the user
  function handleChoosePicture(event) {
    const file = event.target.files?.[0];

    setError("");
    setMessage("");

    if (!file) return;

    // Allow the same file to be selected again
    event.target.value = "";

    // Check image type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a JPG, PNG or WebP picture.");
      return;
    }

    // Check original image size
    if (file.size > MAX_FILE_SIZE) {
      setError("Your picture must be 5 MB or smaller.");
      return;
    }

    if (file.size === 0) {
      setError("This picture is empty. Please choose another.");
      return;
    }

    // Open the picture in the browser
    const objectUrl = URL.createObjectURL(file);
    const selectedImage = new Image();

    selectedImage.onload = () => {
      URL.revokeObjectURL(objectUrl);

      if (selectedImage.naturalWidth === 0 || selectedImage.naturalHeight === 0) {
        setError("This picture could not be opened.");
        return;
      }

      // Set the new image and reset crop controls
      setImage(selectedImage);
      setZoom(1);
      setHorizontal(50);
      setVertical(50);
    };

    selectedImage.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError("Unable to open this picture. Please try another.");
    };

    selectedImage.src = objectUrl;
  }

  // Save the cropped picture
  async function handleSave() {
    if (!image || !previewRef.current || isSaving) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      // Create a small JPEG from the crop preview
      const smallPicture = makeSmallPicture(previewRef.current);

      // Save it using our existing backend API
      await saveProfilePicture(smallPicture);

      // Update the displayed picture
      setSavedPicture(smallPicture);
      setImage(null);

      setMessage("Profile picture saved successfully!");
    } catch (err) {
      setError(err.message || "Unable to save your profile picture.");
    } finally {
      setIsSaving(false);
    }
  }

  // Remove the user's saved picture
  async function handleRemove() {
    if (isSaving) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await deleteProfilePicture();

      // Return to the default avatar
      setSavedPicture(null);
      setImage(null);

      setMessage("Profile picture removed successfully!");
    } catch {
      setError("Unable to remove your profile picture.");
    } finally {
      setIsSaving(false);
    }
  }

  // Cancel selecting a new picture
  function handleCancel() {
    setImage(null);
    setError("");
    setMessage("");
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="text-lg font-semibold">Profile Picture</h3>

      <p className="mt-1 text-sm text-muted-foreground">
        Add a picture to personalise your planner.
      </p>

      {/* Saved picture or default avatar */}
      <div className="mt-5 flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
          {savedPicture ? (
            <img
              src={savedPicture}
              alt="Your profile picture"
              className="h-full w-full object-cover"
            />
          ) : (
            <UserRound
              className="h-10 w-10 text-muted-foreground"
              aria-label="Default profile picture"
            />
          )}
        </div>

        <div className="space-y-1">
          <p className="font-medium">{user?.displayName || user?.email || "Student"}</p>

          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading picture..."
              : savedPicture
                ? "Your saved profile picture"
                : "Default profile picture"}
          </p>
        </div>
      </div>

      {/* Upload a new picture */}
      <div className="mt-5 space-y-2">
        <Label htmlFor="profile-picture-file">Choose a new picture</Label>

        <input
          id="profile-picture-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChoosePicture}
          disabled={isSaving}
          className="block w-full max-w-sm text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:font-medium"
        />

        <p className="text-xs text-muted-foreground">
          Supported formats: JPG, PNG and WebP. Maximum file size: 5 MB.
        </p>
      </div>

      {/* Show cropping tools after selecting an image */}
      {image && (
        <div className="mt-5 space-y-4 rounded-lg border p-4">
          <h4 className="font-medium">Crop your picture</h4>

          <p className="text-sm text-muted-foreground">
            Adjust the sliders to resize and position your picture before saving.
          </p>

          {/* Circular image preview */}
          <canvas
            ref={previewRef}
            width={200}
            height={200}
            aria-label="Profile picture crop preview"
            className="mx-auto h-48 w-48 rounded-full border"
          />

          {/* Zoom slider */}
          <div className="space-y-2">
            <Label htmlFor="picture-zoom">Zoom: {zoom.toFixed(1)}x</Label>

            <input
              id="picture-zoom"
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              disabled={isSaving}
              onChange={event => setZoom(Number(event.target.value))}
              className="w-full"
            />
          </div>

          {/* Horizontal position */}
          <div className="space-y-2">
            <Label htmlFor="picture-horizontal">Move left or right</Label>

            <input
              id="picture-horizontal"
              type="range"
              min="0"
              max="100"
              value={horizontal}
              disabled={isSaving}
              onChange={event => setHorizontal(Number(event.target.value))}
              className="w-full"
            />
          </div>

          {/* Vertical position */}
          <div className="space-y-2">
            <Label htmlFor="picture-vertical">Move up or down</Label>

            <input
              id="picture-vertical"
              type="range"
              min="0"
              max="100"
              value={vertical}
              disabled={isSaving}
              onChange={event => setVertical(Number(event.target.value))}
              className="w-full"
            />
          </div>

          {/* Save or cancel */}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Picture"}
            </Button>

            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Remove saved profile picture */}
      {savedPicture && !image && (
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          disabled={isSaving}
          onClick={handleRemove}
        >
          {isSaving ? "Removing..." : "Remove Picture"}
        </Button>
      )}

      {/* Error message */}
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Success message */}
      {message && (
        <p role="status" className="mt-4 text-sm text-green-600">
          {message}
        </p>
      )}
    </div>
  );
}

export { ProfilePictureSection };
