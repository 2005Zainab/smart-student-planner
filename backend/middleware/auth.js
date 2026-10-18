import { getAuth } from "firebase-admin/auth";
import { db } from "../shared/firebase.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token was provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  if (!idToken) {
    return res.status(401).json({ message: "No token was provided" });
  }

  try {
    req.user = await getAuth().verifyIdToken(idToken);

    const userDoc = await db.collection("users").doc(req.user.uid).get();
    const userData = userDoc.data();

    if (userData?.twoFactorEnabled) {
      const mfaCookie = req.cookies ? req.cookies.mfa_verified : null;

      if (mfaCookie !== "true") {
        return res
          .status(403)
          .json({ code: "auth/mfa-required", message: "Multi-factor authentication required" });
      }
    }
    next();
  } catch (err) {
    console.log(err.message);
    return res.status(401).json({ message: "Token is invalid or Expired" });
  }
}
