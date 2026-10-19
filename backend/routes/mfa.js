import express from "express";
import { generateSecret, verify, generateURI } from "otplib";
import QRCode from "qrcode";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";
import { getAuth } from "firebase-admin/auth";

const router = express.Router();

// generates the secret key used for 2fa and makes a qr code url for it.
router.post("/generate", requireAuth, async (req, res) => {
  const email = req.user.email;
  const appName = "Smart Student Planner";
  const secret = generateSecret();
  const otpauthurl = generateURI({
    issuer: appName,
    label: email,
    secret: secret,
  });

  try {
    const qrCodeUrl = await QRCode.toDataURL(otpauthurl);

    await db
      .collection("users")
      .doc(req.user.uid)
      .collection("settings")
      .doc("MFA")
      .set({ tempTwoFactorSecret: secret }, { merge: true });

    res.json({ qrCodeUrl, secret });
  } catch (err) {
    res.status(500).json({ message: "Failed to generate QR code", err });
  }
});

// verify the pin received and enable 2fa
router.post("/verify-setup", requireAuth, async (req, res) => {
  const { token } = req.body;

  const userDoc = await db
    .collection("users")
    .doc(req.user.uid)
    .collection("settings")
    .doc("MFA")
    .get();
  const { tempTwoFactorSecret } = userDoc.data() || {};

  if (!tempTwoFactorSecret) {
    return res.status(400).json({ message: "2FA generation must be called first" });
  }

  const result = await verify({ token, secret: tempTwoFactorSecret });

  if (result.valid) {
    await db.collection("users").doc(req.user.uid).collection("settings").doc("MFA").set(
      {
        twoFactorSecret: tempTwoFactorSecret,
        twoFactorEnabled: true,
        tempTwoFactorSecret: null,
      },
      { merge: true },
    );

    const userRecord = await getAuth().getUser(req.user.uid);
    const currentClaims = userRecord.customClaims || {};

    await getAuth().setCustomUserClaims(req.user.uid, {
      ...currentClaims,
      twoFactorEnabled: true,
    });

    res.status(200).json({ message: "2FA enabled successfully" });
  } else {
    res.status(401).json({ message: "Invalid PIN code" });
  }
});

// verifies the pin from the user and responds with the mfa cookie if it is correct
router.post("/login-verify", requireAuth, async (req, res) => {
  const { pin } = req.body;

  const userDoc = await db
    .collection("users")
    .doc(req.user.uid)
    .collection("settings")
    .doc("MFA")
    .get();
  const { twoFactorSecret, twoFactorEnabled } = userDoc.data() || {};

  if (!twoFactorEnabled || !twoFactorSecret) {
    return res.status(400).json({ message: "2FA is not enabled" });
  }

  const result = await verify({ pin, secret: twoFactorSecret });

  if (result.valid) {
    res.cookie("mfa_verified", "true", { httpOnly: true, secure: true });
    res.status(200).json({ message: "Login successful" });
  } else {
    res.status(401).json({ message: "Invalid 2FA code" });
  }
});

export default router;
