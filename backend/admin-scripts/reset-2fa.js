import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { readFileSync, existsSync } from "fs";

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

if (!getApps().length) {
  // Option A: If you have a local serviceAccountKey.json file
  if (existsSync("./serviceAccountKey.json")) {
    const serviceAccount = JSON.parse(readFileSync("./serviceAccountKey.json", "utf8"));
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
  } else {
    // Option B: Initialize using explicit project ID from .env
    initializeApp({ projectId });
  }
}

const auth = getAuth();
const db = getFirestore();

async function reset2FA(identifier) {
  try {
    let user;
    if (identifier.includes("@")) {
      user = await auth.getUserByEmail(identifier);
    } else {
      user = await auth.getUser(identifier);
    }

    console.log(`\nResetting 2FA state for user: ${user.email || user.uid}...`);

    // 1. Remove twoFactorEnabled from Firebase Auth Custom Claims
    const currentClaims = user.customClaims || {};
    const updatedClaims = { ...currentClaims };
    delete updatedClaims.twoFactorEnabled;

    await auth.setCustomUserClaims(user.uid, updatedClaims);
    console.log("  [1/3] Removed 2FA custom claim from Firebase Auth");

    // 2. Delete or reset the MFA document in Firestore
    const mfaRef = db.collection("users").doc(user.uid).collection("settings").doc("MFA");

    await mfaRef.delete();
    console.log("  [2/3] Deleted Firestore users/{uid}/settings/MFA document");

    // 3. Revoke active refresh tokens to force client ID token update
    await auth.revokeRefreshTokens(user.uid);
    console.log("  [3/3] Revoked refresh tokens (forced clean re-login)");

    console.log(`\n2FA successfully reset for ${user.email || user.uid}!`);
    console.log("Log out and log back in on the frontend to pick up the clean state.\n");
  } catch (error) {
    console.error("Failed to reset 2FA:", error.message);
  }
}

const target = process.argv[2];

if (!target) {
  console.log(`
Usage:
  node admin-scripts/reset-2fa.js <email-or-uid>
  `);
  process.exit(0);
}

reset2FA(target);
