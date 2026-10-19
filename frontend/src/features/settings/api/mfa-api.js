import { auth } from "../../../shared/auth";

export async function generate2FA() {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch("/api/mfa/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to generate 2FA");
  return res.json();
}

export async function verify2FASetup(pin) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch("/api/mfa/verify-setup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ token: pin }),
  });

  if (!res.ok) throw new Error("Invalid PIN");
  return res.json();
}
