/**
 * refresh.test.tsx — Token refresh logic tests (apiFetchWithRefresh).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetchWithRefresh, ApiError } from "../../../api/client";

// ── Mock global fetch ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Mock localStorage ─────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => {
      store[key] = val;
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

const ACCESS_KEY = "kairos_admin_access_token";
const REFRESH_KEY = "kairos_admin_refresh_token";

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(""),
  });
}

describe("apiFetchWithRefresh", () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.setItem(ACCESS_KEY, "old-access");
    localStorageMock.setItem(REFRESH_KEY, "old-refresh");
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it("returns successful response without refresh when no 401", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true, data: "hello" }));
    const result = await apiFetchWithRefresh("/some-endpoint");
    expect(result).toEqual({ ok: true, data: "hello" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("attempts refresh on 401 and retries the original request", async () => {
    const newAccess = "new-access-token";
    const newRefresh = "new-refresh-token";

    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          step: "done",
          accessToken: newAccess,
          refreshToken: newRefresh,
          admin: { id: "1", email: "a@b.com", name: "A", role: "admin" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: "retried-data" }));

    const onRefreshSuccess = vi.fn();
    const result = await apiFetchWithRefresh(
      "/protected",
      {},
      { onRefreshSuccess },
    );

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: true, data: "retried-data" });
    expect(localStorageMock.getItem(ACCESS_KEY)).toBe(newAccess);
    expect(localStorageMock.getItem(REFRESH_KEY)).toBe(newRefresh);
    expect(onRefreshSuccess).toHaveBeenCalled();
  });

  it("clears tokens and calls onRefreshFailure when refresh fails", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { message: "Refresh expired", code: "TOKEN_EXPIRED" } },
          401,
        ),
      );

    const onRefreshFailure = vi.fn();

    await expect(
      apiFetchWithRefresh("/protected", {}, { onRefreshFailure }),
    ).rejects.toThrow("Your session has expired");
    expect(localStorageMock.getItem(ACCESS_KEY)).toBeNull();
    expect(localStorageMock.getItem(REFRESH_KEY)).toBeNull();
    expect(onRefreshFailure).toHaveBeenCalled();
  });

  it("does not attempt refresh when no refresh token is stored", async () => {
    localStorageMock.removeItem(REFRESH_KEY);
    mockFetch.mockResolvedValue(
      jsonResponse(
        { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
        401,
      ),
    );

    const onRefreshFailure = vi.fn();
    await expect(
      apiFetchWithRefresh("/protected", {}, { onRefreshFailure }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(onRefreshFailure).toHaveBeenCalled();
  });

  it("does not trigger refresh for non-401 errors", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: { message: "Not found", code: "NOT_FOUND" } }, 404),
    );
    await expect(apiFetchWithRefresh("/missing")).rejects.toMatchObject({
      status: 404,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
