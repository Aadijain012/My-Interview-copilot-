/**
 * authApi.ts — All admin authentication API calls.
 *
 * Each function maps to exactly one backend endpoint.
 * Tokens are NEVER logged here or anywhere in this module.
 *
 * Backend base: VITE_API_BASE_URL (e.g. http://localhost:4000/api/admin)
 *
 * Endpoint contracts:
 *   POST /auth/login          → LoginResponse
 *   POST /auth/totp/setup     → TotpSetupResponse   (Bearer: tempToken)
 *   POST /auth/totp/confirm   → FullAuthResponse     (Bearer: tempToken)
 *   POST /auth/totp/verify    → FullAuthResponse     (Bearer: tempToken)
 *   POST /auth/refresh        → FullAuthResponse     (public, body: refreshToken)
 *   POST /auth/logout         → { ok: true }         (public, body: refreshToken)
 */

import { apiFetch, apiFetchWithRefresh } from "@/api/client";

/** POST /auth/login */
export async function loginWithCredentials(email, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    data: { email, password },
    public: true,
  });
}

/**
 * POST /auth/change-password
 * Called with the short-lived password-change tempToken as bearer.
 * Used during mandatory first-login password change flow.
 */
export async function changePassword(tempToken, newPassword) {
  return apiFetch("/auth/change-password", {
    method: "POST",
    data: { newPassword },
    bearerToken: tempToken,
  });
}

/**
 * PATCH /auth/password
 * Called with active admin session to update current password.
 */
export async function updateCurrentPassword(currentPassword, newPassword) {
  return apiFetchWithRefresh("/auth/password", {
    method: "PATCH",
    data: { currentPassword, newPassword },
  });
}

/**
 * POST /auth/totp/setup
 * Called with the short-lived TOTP step JWT (tempToken) as bearer.
 * Returns the TOTP secret + otpAuthUrl (for QR code display).
 */
export async function setupTotp(tempToken) {
  return apiFetch("/auth/totp/setup", {
    method: "POST",
    bearerToken: tempToken,
  });
}

/**
 * POST /auth/totp/confirm
 * Called with tempToken as bearer + the 6-digit code from the authenticator app.
 * Completes first-time TOTP enrollment.
 */
export async function confirmTotpSetup(tempToken, totpCode) {
  return apiFetch("/auth/totp/confirm", {
    method: "POST",
    data: { totpCode },
    bearerToken: tempToken,
  });
}

/**
 * POST /auth/totp/verify
 * Called with tempToken as bearer + the 6-digit code.
 * Completes the TOTP verification step for subsequent logins.
 */
export async function verifyTotpLogin(tempToken, totpCode) {
  return apiFetch("/auth/totp/verify", {
    method: "POST",
    data: { totpCode },
    bearerToken: tempToken,
  });
}

/**
 * POST /auth/refresh
 * Called with the raw refresh token from localStorage.
 * Returns new access + refresh tokens (rotation).
 */
export async function refreshAccessToken(refreshToken) {
  return apiFetch("/auth/refresh", {
    method: "POST",
    data: { refreshToken },
    public: true,
  });
}

/**
 * POST /auth/logout
 * Revokes the refresh token server-side.
 * Best-effort — errors are swallowed so local state is always cleared.
 */
export async function logoutAdmin(refreshToken) {
  try {
    await apiFetch("/auth/logout", {
      method: "POST",
      data: { refreshToken },
      public: true,
    });
  } catch {
    // Swallow — local state cleared regardless (server-side revocation is best-effort)
  }
}
