import { getAuth } from "firebase-admin/auth";

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
      const mfaCookie = req.cookies ? req.cookies.mfa_verified : null;

      if (mfaCookie !== "true") {
        return res
          .status(403)
          .json({ code: "auth/mfa-required", message: "Multi-factor authentication required" });
      }
    }
    next();
  } catch (err) {
    console.log("Auth middleware error:", err.message);
    return res.status(401).json({ message: "Token is invalid or Expired" });
  }
}
