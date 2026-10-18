import { getAuth } from "firebase-admin/auth";

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

    if (req.user.twoFactorEnabled === true) {
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
