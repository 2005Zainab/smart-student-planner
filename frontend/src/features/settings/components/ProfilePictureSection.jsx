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

// Maximum original picture size is 5 MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Picture formats students can upload
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Draw the cropped picture inside the preview
function drawCrop(canvas, image, zoom, horizontal, vertical) {
  if (!canvas || !image) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const size = canvas.width;

  // Make sure the image fills the crop area
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * zoom;

  const imageWidth = image.naturalWidth * scale;
  const imageHeight = image.naturalHeight * scale;

  // Calculate how far the image can move
  const extraWidth = imageWidth - size;
  const extraHeight = imageHeight - size;

  const x = -extraWidth * (horizontal / 100);
  const y = -extraHeight * (vertical / 100);

  // Clear the previous preview
  context.clearRect(0, 0, size, size);

  // White background for transparent pictures
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);

  // Draw the cropped picture
  context.drawImage(image, x, y, imageWidth, imageHeight);
}

// Make the cropped picture small enough to save
function makeSmallPicture(previewCanvas) {
  const canvas = document.createElement("canvas");

  // Try different sizes
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

    // Try different image qualities
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const picture = canvas.toDataURL("image/jpeg", quality);

      // Keep it within the backend limit
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
  const imageRequestRef = useRef(0);

  // Saved profile picture
  const [savedPicture, setSavedPicture] = useState(null);

  // Newly selected picture
  const [image, setImage] = useState(null);

  // Picture crop settings
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);

  // Loading and messages
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load the saved profile picture for this user
  useEffect(() => {
    let cancelled = false;

    if (!user?.uid) {
      return;
    }

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

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Update the picture preview when sliders move
  useEffect(() => {
    drawCrop(previewRef.current, image, zoom, horizontal, vertical);
  }, [image, zoom, horizontal, vertical]);

  // Choose and check a new picture
  function handleChoosePicture(event) {
    const file = event.target.files?.[0];

    setError("");
    setMessage("");

    if (!file) return;

    // Allow choosing the same file again
    event.target.value = "";

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a JPG, PNG or WebP picture.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Your picture must be 5 MB or smaller.");
      return;
    }

    if (file.size === 0) {
      setError("This picture is empty. Please choose another.");
      return;
    }

    const requestId = ++imageRequestRef.current;

    // Open the selected image
    const objectUrl = URL.createObjectURL(file);
    const selectedImage = new Image();

    selectedImage.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Ignore an older image if another one was selected
      if (requestId !== imageRequestRef.current) return;

      if (selectedImage.naturalWidth === 0 || selectedImage.naturalHeight === 0) {
        setError("This picture could not be opened.");
        return;
      }

      // Show new picture and reset the sliders
      setImage(selectedImage);
      setZoom(1);
      setHorizontal(50);
      setVertical(50);
    };

    selectedImage.onerror = () => {
      URL.revokeObjectURL(objectUrl);

      if (requestId !== imageRequestRef.current) return;

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
      // Compress the cropped image
      const smallPicture = makeSmallPicture(previewRef.current);

      // Wait until the backend saves it successfully
      await saveProfilePicture(smallPicture);

      // Show the new saved picture
      setSavedPicture(smallPicture);
      setImage(null);

      // Tell the sidebar to reload the profile picture
      window.dispatchEvent(new Event("profile-picture-updated"));

      setMessage("Profile picture saved successfully!");
    } catch (err) {
      setError(err.message || "Unable to save your profile picture.");
    } finally {
      setIsSaving(false);
    }
  }

  // Remove the saved picture
  async function handleRemove() {
    if (isSaving) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      // Delete it from the backend
      await deleteProfilePicture();

      setSavedPicture(null);
      setImage(null);

      // Tell the sidebar to show the default avatar
      window.dispatchEvent(new Event("profile-picture-updated"));

      setMessage("Profile picture removed successfully!");
    } catch (err) {
      setError(err.message || "Unable to remove your profile picture.");
    } finally {
      setIsSaving(false);
    }
  }

  // Cancel cropping the selected picture
  function handleCancel() {
    imageRequestRef.current += 1;
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

      {/* Choose a new picture */}
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

      {/* Crop picture after choosing an image */}
      {image && (
        <div className="mt-5 space-y-4 rounded-lg border p-4">
          <h4 className="font-medium">Crop your picture</h4>

          <p className="text-sm text-muted-foreground">
            Use the sliders to zoom and move the picture.
          </p>

          {/* Picture crop preview */}
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
              className="w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
            />
          </div>

          {/* Move image left or right */}
          <div className="space-y-2">
            <Label htmlFor="picture-horizontal">Move left or right: {horizontal}%</Label>

            <input
              id="picture-horizontal"
              type="range"
              min="0"
              max="100"
              step="1"
              value={horizontal}
              disabled={isSaving}
              onChange={event => setHorizontal(Number(event.target.value))}
              className="w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
            />
          </div>

          {/* Move image up or down */}
          <div className="space-y-2">
            <Label htmlFor="picture-vertical">Move up or down: {vertical}%</Label>

            <input
              id="picture-vertical"
              type="range"
              min="0"
              max="100"
              step="1"
              value={vertical}
              disabled={isSaving}
              onChange={event => setVertical(Number(event.target.value))}
              className="w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
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

      {/* Remove saved picture */}
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
