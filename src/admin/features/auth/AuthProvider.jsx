/**
 * AuthProvider.tsx — Single source of authentication truth for the admin panel.
 *
 * Responsibilities:
 *   - Hydrates auth state from localStorage on mount (no flash of unauthenticated content).
 *   - Exposes: admin, isAuthenticated, isLoading, login, logout, setFullAuth.
 *   - Wires refresh callbacks into apiFetchWithRefresh so 401s are handled
 *     transparently across the entire app.
 *   - Never logs tokens, passwords, or any secret material.
 *
 * State machine:
 *   isLoading=true    → still reading localStorage (brief, synchronous)
 *   isAuthenticated=false, admin=null → not logged in
 *   isAuthenticated=true, admin=<data> → fully authenticated
 *
 * Tokens are stored in localStorage; admin identity info is stored there too
 * (solely for convenience — never used for authorization decisions on the server).
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clearAllAuthTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  storeAccessToken,
  storeRefreshToken,
} from "@/api/client";
import { logoutAdmin, loginWithCredentials } from "./authApi";

import {
  readStoredAdmin,
  writeStoredAdmin,
  clearStoredAdmin,
  AUTH_EXPIRED_EVENT,
} from "./authSession";

// ── Context shape ─────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components -- AuthContext must be accessible from useAuth.ts
export const AuthContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  // Synchronous hydration — both reads happen before first render
  const [admin, setAdmin] = useState(() => {
    const storedAdmin = readStoredAdmin();
    const hasAccessToken = Boolean(getStoredAccessToken());
    const hasRefreshToken = Boolean(getStoredRefreshToken());
    // Only hydrate if we have all three pieces
    return storedAdmin && hasAccessToken && hasRefreshToken
      ? storedAdmin
      : null;
  });
  // Both localStorage reads above are synchronous — hydration completes before first render.
  // isLoading remains false throughout; it's kept in the API for future async hydration patterns.
  const [isLoading] = useState(false);

  const isAuthenticated = admin !== null;

  // Listen for global auth expiration events (e.g. triggered by 401 handlers)
  useEffect(() => {
    const handleAuthExpired = () => {
      setAdmin(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, []);

  // ── setFullAuth — stores tokens + admin and updates state ─────────────────

  const setFullAuth = useCallback((result) => {
    storeAccessToken(result.accessToken);
    storeRefreshToken(result.refreshToken);
    writeStoredAdmin(result.admin);
    setAdmin(result.admin);
  }, []);

  // ── handleRefreshSuccess / handleRefreshFailure ───────────────────────────

  const handleRefreshSuccess = useCallback((result) => {
    // Tokens already stored by apiFetchWithRefresh — just sync admin identity
    writeStoredAdmin(result.admin);
    setAdmin(result.admin);
  }, []);

  const handleRefreshFailure = useCallback(() => {
    clearAllAuthTokens();
    clearStoredAdmin();
    setAdmin(null);
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────

  const login = useCallback(
    async (email, password) => {
      const result = await loginWithCredentials(email, password);

      if (result.step === "done") {
        setFullAuth(result);
        return { step: "done", admin: result.admin };
      }

      // tempToken is held in memory only — not persisted
      return { step: result.step, tempToken: result.tempToken };
    },
    [setFullAuth],
  );

  // ── logout ────────────────────────────────────────────────────────────────

  const isLoggingOut = useRef(false);

  const logout = useCallback(async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;

    const refreshToken = getStoredRefreshToken();

    // Clear local state first — user is signed out regardless of network
    clearAllAuthTokens();
    clearStoredAdmin();
    setAdmin(null);

    // Best-effort server-side revocation (swallows errors)
    if (refreshToken) {
      await logoutAdmin(refreshToken);
    }

    isLoggingOut.current = false;
  }, []);

  // ── Context value (stable reference) ─────────────────────────────────────

  const value = useMemo(
    () => ({
      admin,
      isAuthenticated,
      isLoading,
      login,
      logout,
      setFullAuth,
      handleRefreshSuccess,
      handleRefreshFailure,
    }),
    [
      admin,
      isAuthenticated,
      isLoading,
      login,
      logout,
      setFullAuth,
      handleRefreshSuccess,
      handleRefreshFailure,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
