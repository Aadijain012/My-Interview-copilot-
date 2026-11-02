// ─────────────────────────────────────────────────────────────────────────────
// Typed API error - carries the machine-readable code from the backend
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Token storage helpers
// IMPORTANT: tokens are never logged here. Keep it that way.
// ─────────────────────────────────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = "kairos_admin_access_token";
const REFRESH_TOKEN_KEY = "kairos_admin_refresh_token";

export function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeAccessToken(token) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearStoredAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeRefreshToken(token) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearStoredRefreshToken() {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Clears both access and refresh tokens. Called on logout / invalid session. */
export function clearAllAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// API base URL — read once at module load. Never throw here (causes blank page).
// ─────────────────────────────────────────────────────────────────────────────

const configuredAdminApiUrl =
  ((import.meta.env.VITE_API_BASE_URL) ?? '').replace(/\/$/, '') ||
  (import.meta.env.VITE_API_URL ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, '')}/api/admin` : '');

const API_BASE_URL =
  configuredAdminApiUrl ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? (window.location.port === '4000' ? '/api/admin' : 'http://localhost:4000/api/admin')
    : '/api/admin');

// ─────────────────────────────────────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed fetch wrapper for the Kairos Admin API.
 *
 * - Attaches Content-Type: application/json for requests with a body.
 * - Attaches Authorization: Bearer <token> for protected endpoints.
 * - Parses the response JSON and throws a typed ApiError on non-2xx.
 * - Never logs tokens or sensitive response bodies.
 */
export async function apiFetch(path, options = {}) {
  const { data, public: isPublic = false, bearerToken, ...rest } = options;

  const headers = new Headers(rest.headers);

  if (data !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (!isPublic) {
    const token = bearerToken ?? getStoredAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...rest,
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  let body;
  if (isJson) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  if (!response.ok) {
    const apiBody = isJson ? body : null;
    const errorMessage =
      apiBody?.error?.message ?? (typeof body === 'string' && body.length < 200 ? body : "An unexpected error occurred.");
    const errorCode = apiBody?.error?.code ?? "UNKNOWN_ERROR";
    throw new ApiError(errorMessage, response.status, errorCode);
  }

  return body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Refresh-aware fetch wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flag to prevent concurrent refresh attempts triggering multiple refresh
 * requests simultaneously. A single in-flight promise is shared.
 */
let refreshPromise = null;

/**
 * apiFetchWithRefresh — wraps apiFetch with silent token refresh on 401.
 *
 * Flow:
 *   1. Call apiFetch with the stored access token.
 *   2. On ApiError 401: attempt to refresh the access token once.
 *   3. If refresh succeeds: store new tokens, call the storeTokensFn callback
 *      (so AuthProvider stays in sync), retry the original request.
 *   4. If refresh fails (expired/revoked refresh token): clear all tokens,
 *      call the clearAuthFn callback (so AuthProvider signs the user out),
 *      re-throw so the caller can redirect to /login.
 *
 * The optional storeTokensFn/clearAuthFn params decouple token storage from
 * the AuthProvider — AuthProvider wires these during its mount.
 */
export async function apiFetchWithRefresh(path, options = {}, callbacks) {
  try {
    return await apiFetch(path, options);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    // 401 — attempt a silent token refresh (once, shared across concurrent calls)
    const storedRefreshToken = getStoredRefreshToken();
    if (!storedRefreshToken) {
      // No refresh token at all — clear state and surface the error
      clearAllAuthTokens();
      callbacks?.onRefreshFailure?.();
      throw err;
    }

    try {
      if (!refreshPromise) {
        refreshPromise = apiFetch("/auth/refresh", {
          method: "POST",
          data: { refreshToken: storedRefreshToken },
          public: true,
        }).finally(() => {
          refreshPromise = null;
        });
      }

      const refreshed = await refreshPromise;
      storeAccessToken(refreshed.accessToken);
      storeRefreshToken(refreshed.refreshToken);
      callbacks?.onRefreshSuccess?.(refreshed);

      // Retry the original request with the new access token
      return await apiFetch(path, options);
    } catch {
      // Refresh failed — session is over
      clearAllAuthTokens();
      callbacks?.onRefreshFailure?.();
      throw new ApiError(
        "Your session has expired. Please sign in again.",
        401,
        "SESSION_EXPIRED",
      );
    }
  }
}
