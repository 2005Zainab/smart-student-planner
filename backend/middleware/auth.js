import { getAuth } from "firebase-admin/auth";
import jwt from "jsonwebtoken";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token was provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    req.user = await getAuth().verifyIdToken(idToken);

    const isMfaEndPoint =
      req.originalUrl.includes("/api/mfa/login-verify") ||
      req.originalUrl.includes("/api/mfa/verify-setup");

    if (req.user.twoFactorEnabled === true && !isMfaEndPoint) {
      const mfaCookie = req.cookies?.mfa_verified;

      if (!mfaCookie) {
        return res
          .status(403)
          .json({ code: "auth/mfa-required", message: "Multi-factor authentication required" });
      }

      try {
        const decoded = jwt.verify(mfaCookie, process.env.JWT_SECRET);

        if (decoded.uid !== req.user.uid || decoded.mfaVerified !== true) {
          return res
            .status(403)
            .json({ code: "auth/mfa-required", message: "MFA session invalid for this user" });
        }
      } catch (jwtErr) {
        return res
          .status(403)
          .json({ code: "auth/mfa-required", message: "MFA token expired or tampered", jwtErr });
      }
    }
    next();
  } catch (err) {
    console.log("Auth middleware error:", err.message);
    return res.status(401).json({ message: "Token is invalid or Expired" });
  }
}
