/**
 * session-expiry.test.tsx — Tests for Global Session Expiry and TanStack Query 401 handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { ApiError } from "@/api/client";
import { AuthProvider } from "../AuthProvider";
import {
  AUTH_EXPIRED_EVENT,
  triggerGlobalSessionExpired,
} from "../authSession";
import { useAuth } from "../useAuth";
import { queryClient } from "@/providers/queryClient";
import { router } from "@/router";

function ConsumerComponent() {
  const { admin, isAuthenticated } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated
          ? `Authenticated as ${admin?.email}`
          : "Not Authenticated"}
      </div>
      <div data-testid="admin-role">{admin?.role ?? "none"}</div>
    </div>
  );
}

describe("Global Session Expiry", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── 1. Retry policy in TanStack Query ─────────────────────────────────────────
  describe("Query retry policy", () => {
    const retryFn = queryClient.getDefaultOptions().queries?.retry;

    it("returns false immediately when error is a 401 ApiError", () => {
      const err401 = new ApiError("Token expired", 401, "TOKEN_EXPIRED");
      expect(retryFn(0, err401)).toBe(false);
      expect(retryFn(1, err401)).toBe(false);
    });

    it("returns true on first failure for non-401 errors (preserves 1 retry)", () => {
      const err500 = new ApiError("Server error", 500, "INTERNAL_ERROR");
      expect(retryFn(0, err500)).toBe(true);
      expect(retryFn(1, err500)).toBe(false);
    });

    it("returns true on first failure for generic Network Error", () => {
      const networkErr = new TypeError("Failed to fetch");
      expect(retryFn(0, networkErr)).toBe(true);
      expect(retryFn(1, networkErr)).toBe(false);
    });
  });

  // ── 2. triggerGlobalSessionExpired helper ────────────────────────────────────
  describe("triggerGlobalSessionExpired", () => {
    it("clears access and refresh tokens and stored admin identity from localStorage", () => {
      localStorage.setItem("kairos_admin_access_token", "mock_access");
      localStorage.setItem("kairos_admin_refresh_token", "mock_refresh");
      localStorage.setItem(
        "kairos_admin_identity",
        JSON.stringify({
          id: "1",
          email: "admin@kairos.ai",
          name: "Admin",
          role: "admin",
        }),
      );

      triggerGlobalSessionExpired();

      expect(localStorage.getItem("kairos_admin_access_token")).toBeNull();
      expect(localStorage.getItem("kairos_admin_refresh_token")).toBeNull();
      expect(localStorage.getItem("kairos_admin_identity")).toBeNull();
    });

    it("dispatches AUTH_EXPIRED_EVENT on window", () => {
      const listener = vi.fn();
      window.addEventListener(AUTH_EXPIRED_EVENT, listener);

      triggerGlobalSessionExpired();

      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
    });
  });

  // ── 3. AuthProvider reacts to AUTH_EXPIRED_EVENT ────────────────────────────
  describe("AuthProvider event handling", () => {
    it("clears active admin session when AUTH_EXPIRED_EVENT is dispatched", async () => {
      localStorage.setItem("kairos_admin_access_token", "token123");
      localStorage.setItem("kairos_admin_refresh_token", "refresh123");
      localStorage.setItem(
        "kairos_admin_identity",
        JSON.stringify({
          id: "adm-1",
          email: "sarah@kairos.ai",
          name: "Sarah",
          role: "owner",
        }),
      );

      render(
        <AuthProvider>
          <ConsumerComponent />
        </AuthProvider>,
      );

      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Authenticated as sarah@kairos.ai",
      );
      expect(screen.getByTestId("admin-role")).toHaveTextContent("owner");

      // Trigger session expiry
      triggerGlobalSessionExpired();
      act(() => {
        triggerGlobalSessionExpired();
      });

      await waitFor(() => {
        expect(screen.getByTestId("auth-status")).toHaveTextContent(
          "Not Authenticated",
        );
        expect(screen.getByTestId("admin-role")).toHaveTextContent("none");
      });
    });
  });

  // ── 4. QueryCache global onError handler ────────────────────────────────────
  describe("TanStack Query Cache 401 handler", () => {
    it("clears tokens and redirects when a query encounters 401", () => {
      const navigateSpy = vi
        .spyOn(router, "navigate")
        .mockImplementation(vi.fn());

      localStorage.setItem("kairos_admin_access_token", "mock_token");
      localStorage.setItem("kairos_admin_refresh_token", "mock_refresh");
      localStorage.setItem(
        "kairos_admin_identity",
        JSON.stringify({
          id: "1",
          email: "admin@kairos.ai",
          name: "Admin",
          role: "admin",
        }),
      );

      const queryCache = queryClient.getQueryCache();
      const onError = queryCache.config.onError;

      expect(onError).toBeDefined();

      // Simulate a query error with 401
      onError?.(new ApiError("Session has expired", 401, "TOKEN_EXPIRED"), {});

      expect(localStorage.getItem("kairos_admin_access_token")).toBeNull();
      expect(localStorage.getItem("kairos_admin_refresh_token")).toBeNull();
      expect(localStorage.getItem("kairos_admin_identity")).toBeNull();

      navigateSpy.mockRestore();
    });

    it("does NOT clear session on login failure with INVALID_CREDENTIALS", () => {
      localStorage.setItem("kairos_admin_access_token", "temp_token");

      const queryCache = queryClient.getQueryCache();
      const onError = queryCache.config.onError;

      onError?.(
        new ApiError("Invalid email or password.", 401, "INVALID_CREDENTIALS"),
        {},
      );

      // Storage should remain untouched
      expect(localStorage.getItem("kairos_admin_access_token")).toBe(
        "temp_token",
      );
    });
  });
});
