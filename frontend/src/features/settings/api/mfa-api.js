import { httpClient } from "../../../shared/http-client";

export async function generate2FA() {
  return httpClient("http://localhost:3000/api/mfa/generate", { method: "POST" });
}

export async function verify2FASetup(token) {
  return httpClient("http://localhost:3000/api/mfa/verify-setup", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function verify2FALogin(pin) {
  return httpClient("http://localhost:3000/api/mfa/login-verify", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}
