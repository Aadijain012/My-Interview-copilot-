/**
 * totp-verify.test.tsx — TotpVerifyPage tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TotpVerifyPage } from "../../../pages/TotpVerifyPage";
import { AuthContext } from "../AuthProvider";
import { ApiError } from "../../../api/client";
import * as authApi from "../authApi";

vi.mock("../authApi", () => ({
  setupTotp: vi.fn(),
  confirmTotpSetup: vi.fn(),
  verifyTotpLogin: vi.fn(),
  loginWithCredentials: vi.fn(),
  refreshAccessToken: vi.fn(),
  logoutAdmin: vi.fn(),
}));

function makeCtx(overrides = {}) {
  return {
    admin: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setFullAuth: vi.fn(),
    handleRefreshSuccess: vi.fn(),
    handleRefreshFailure: vi.fn(),
    ...overrides,
  };
}

function renderVerify(tempToken = "temp-xyz") {
  const ctx = makeCtx();
  render(
    <MemoryRouter
      initialEntries={[{ pathname: "/totp/verify", state: { tempToken } }]}
    >
      <AuthContext.Provider value={ctx}>
        <Routes>
          <Route path="/totp/verify" element={<TotpVerifyPage />} />
          <Route path="/login" element={<div>Login</div>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return { ctx };
}

describe("TotpVerifyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading and code input", () => {
    renderVerify();
    expect(screen.getByText("Two-factor verification")).toBeInTheDocument();
    expect(screen.getByLabelText("Authenticator code")).toBeInTheDocument();
  });

  it("redirects to /login when no tempToken in state", async () => {
    renderVerify(null);
    expect(await screen.findByText("Login")).toBeInTheDocument();
  });

  it("shows field error on empty submit", async () => {
    const user = userEvent.setup();
    renderVerify();
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    // Field error is "Enter the 6-digit code..." (in role=alert span)
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter the 6-digit code from your authenticator app.",
    );
  });

  it("shows format error for code shorter than 6 digits", async () => {
    const user = userEvent.setup();
    renderVerify();
    // Type only 4 digits — passes the non-empty check but fails the 6-digit check
    await user.type(screen.getByLabelText("Authenticator code"), "1234");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The code must be exactly 6 digits.",
    );
  });

  it("calls verifyTotpLogin and navigates to dashboard on success", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.verifyTotpLogin).mockResolvedValue({
      step: "done",
      accessToken: "acc",
      refreshToken: "ref",
      admin: { id: "1", email: "a@b.com", name: "Admin", role: "admin" },
    });
    const { ctx } = renderVerify();
    await user.type(screen.getByLabelText("Authenticator code"), "123456");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() => expect(ctx.setFullAuth).toHaveBeenCalled());
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("shows INVALID_TOTP error", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.verifyTotpLogin).mockRejectedValue(
      new ApiError("Invalid TOTP", 400, "INVALID_TOTP"),
    );
    renderVerify();
    await user.type(screen.getByLabelText("Authenticator code"), "999999");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    expect(
      await screen.findByText(
        "Incorrect code. Please check your authenticator app and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("shows expired session error on 401", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.verifyTotpLogin).mockRejectedValue(
      new ApiError("Expired", 401, "TOKEN_EXPIRED"),
    );
    renderVerify();
    await user.type(screen.getByLabelText("Authenticator code"), "111111");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    expect(
      await screen.findByText(
        "Your sign-in session has expired. You will be redirected to the sign-in page.",
      ),
    ).toBeInTheDocument();
  });
});
