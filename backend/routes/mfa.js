import express from "express";
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from "otplib";
import QRCode from "qrcode";
import { db } from "../shared/firebase.js";
import { requireAuth } from "../middleware/auth.js";
import { getAuth } from "firebase-admin/auth";

const router = express.Router();

const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
});

// generates the secret key used for 2fa and makes a qr code url for it.
router.post("/generate", requireAuth, async (req, res) => {
  const email = req.user.email;
  const secret = totp.generateSecret();
  const otpauthurl = totp.generateURI({
    issuer: "Smart Student Planner",
    accountName: email,
    secret: secret,
  });

  try {
    const qrCodeUrl = await QRCode.toDataURL(otpauthurl);

    await db.collection("users").doc(req.user.uid).update({ tempTwoFactorSecret: secret });

    res.json({ qrCodeUrl, secret });
  } catch (err) {
    res.status(500).json({ message: "Failed to generate QR code", err });
  }
});

// verify the pin received and enable 2fa
router.post("/verify-setup", requireAuth, async (req, res) => {
  const { token } = req.body;

  const userDoc = await db.collection("users").doc(req.user.uid).get();
  const { tempTwoFactorSecret } = userDoc.data();

  if (!tempTwoFactorSecret) {
    return res.status(400).json({ message: "2FA generation must be called first" });
  }

  const isValid = totp.verify({ token, secret: tempTwoFactorSecret });

  if (isValid) {
    await db.collection("users").doc(req.user.uid).update({
      twoFactorSecret: tempTwoFactorSecret,
      twoFactorEnabled: true,
      tempTwoFactorSecret: null,
    });

    const userRecord = await getAuth.getUser(req.user.uid);
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
  const { token } = req.body;

  const userDoc = await db.collection("users").doc(req.user.uid).get();
  const { twoFactorSecret, twoFactorEnabled } = userDoc.data();

  if (!twoFactorEnabled) {
    return res.status(400).json({ message: "2FA is not enabled" });
  }

  const isValid = totp.verify({ token, secret: twoFactorSecret });

  if (isValid) {
    res.cookie("mfa_verified", "true", { httpOnly: true, secure: true });
    res.status(200).json({ message: "Login successful" });
  } else {
    res.status(401).json({ message: "Invalid 2FA code" });
  }
});

export default router;
