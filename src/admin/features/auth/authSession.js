/**
 * authSession.ts — Admin session storage and global expiration utilities.
 */

import { clearAllAuthTokens } from "@/api/client";

export const ADMIN_STORE_KEY = "kairos_admin_identity";
export const AUTH_EXPIRED_EVENT = "kairos:auth-expired";

export function readStoredAdmin() {
  try {
    const raw = localStorage.getItem(ADMIN_STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeStoredAdmin(admin) {
  try {
    localStorage.setItem(ADMIN_STORE_KEY, JSON.stringify(admin));
  } catch {
    // quota exceeded / private browsing — proceed anyway
  }
}

export function clearStoredAdmin() {
  localStorage.removeItem(ADMIN_STORE_KEY);
}

/**
 * Global helper to cleanly terminate session state across the application:
 * - Clears auth tokens from storage
 * - Clears admin identity
 * - Notifies AuthProvider to clear in-memory admin state
 */
export function triggerGlobalSessionExpired() {
  clearAllAuthTokens();
  clearStoredAdmin();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}
