import express from "express";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Update user document with their local timezone
router.patch("/timezone", requireAuth, async (req, res) => {
  const tz = req.body?.timezone;

  try {
    if (typeof tz !== "string") throw new Error("Invalid timezone");
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  } catch {
    return res.status(400).json({ message: "Invalid timezone" });
  }

  await db.collection("users").doc(req.user.uid).set({ timezone: tz }, { merge: true });

  res.json({ timezone: tz });
});

// Get the signed-in user's saved custom themes
router.get("/themes", requireAuth, async (req, res) => {
  try {
    const snapshot = await db
      .collection("users")
      .doc(req.user.uid)
      .collection("customThemes")
      .get();

    const themes = {};

    snapshot.forEach(doc => {
      themes[doc.id] = doc.data();
    });

    res.json({ themes });
  } catch (error) {
    console.error("Error loading themes:", error);
    res.status(500).json({ message: "Could not load custom themes." });
  }
});

// Create or update one custom theme
router.put("/themes/:themeId", requireAuth, async (req, res) => {
  try {
    const { themeId } = req.params;
    const theme = req.body;

    // Only allow custom theme IDs
    if (!/^custom-[a-zA-Z0-9-]{1,100}$/.test(themeId)) {
      return res.status(400).json({ message: "Invalid theme ID." });
    }

    // Check the name and colour values
    const colourFields = ["background", "text", "primary", "primaryText"];

    if (
      !theme ||
      typeof theme.label !== "string" ||
      !theme.label.trim() ||
      theme.label.length > 40 ||
      !colourFields.every(
        field => typeof theme[field] === "string" && /^#[0-9a-fA-F]{6}$/.test(theme[field]),
      )
    ) {
      return res.status(400).json({ message: "Invalid theme details." });
    }

    if (!["none", "dots", "grid", "stripes"].includes(theme.pattern)) {
      return res.status(400).json({ message: "Invalid background pattern." });
    }

    // Only allow small PNG, JPEG and WebP images
    const image = theme.backgroundImage || "";

    if (
      typeof image !== "string" ||
      image.length > 700000 ||
      (image && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))
    ) {
      return res.status(400).json({ message: "Invalid background image." });
    }

    // Save only the fields needed for a theme
    const savedTheme = {
      label: theme.label.trim(),
      background: theme.background,
      text: theme.text,
      primary: theme.primary,
      primaryText: theme.primaryText,
      pattern: theme.pattern,
      backgroundImage: image,
      custom: true,
      dark: false,
    };

    await db
      .collection("users")
      .doc(req.user.uid)
      .collection("customThemes")
      .doc(themeId)
      .set(savedTheme);

    res.json({ id: themeId, theme: savedTheme });
  } catch (error) {
    console.error("Error saving theme:", error);
    res.status(500).json({ message: "Could not save custom theme." });
  }
});

// Delete one of the signed-in user's custom themes
router.delete("/themes/:themeId", requireAuth, async (req, res) => {
  try {
    const { themeId } = req.params;

    if (!/^custom-[a-zA-Z0-9-]{1,100}$/.test(themeId)) {
      return res.status(400).json({ message: "Invalid theme ID." });
    }

    await db.collection("users").doc(req.user.uid).collection("customThemes").doc(themeId).delete();

    res.json({ message: "Custom theme deleted." });
  } catch (error) {
    console.error("Error deleting theme:", error);
    res.status(500).json({ message: "Could not delete custom theme." });
  }
});

export default router;
