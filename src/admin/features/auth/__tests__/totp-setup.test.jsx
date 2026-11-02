/**
 * totp-setup.test.tsx — TotpSetupPage tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TotpSetupPage } from "../../../pages/TotpSetupPage";
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

function renderSetup(tempToken = "temp-token-123") {
  const ctx = makeCtx();
  render(
    <MemoryRouter
      initialEntries={[{ pathname: "/totp/setup", state: { tempToken } }]}
    >
      <AuthContext.Provider value={ctx}>
        <Routes>
          <Route path="/totp/setup" element={<TotpSetupPage />} />
          <Route path="/login" element={<div>Login</div>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return { ctx };
}

describe("TotpSetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when no tempToken in state", async () => {
    vi.mocked(authApi.setupTotp).mockResolvedValue({
      secret: "SECRET",
      otpAuthUrl: "otpauth://totp/test",
    });
    renderSetup(null);
    expect(await screen.findByText("Login")).toBeInTheDocument();
  });

  it("calls setupTotp with tempToken and shows QR image", async () => {
    vi.mocked(authApi.setupTotp).mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      otpAuthUrl: "otpauth://totp/Kairos",
    });
    renderSetup();
    expect(
      await screen.findByAltText(
        "Scan this QR code with your authenticator app",
      ),
    ).toBeInTheDocument();
    expect(authApi.setupTotp).toHaveBeenCalledWith("temp-token-123");
  });

  it("shows the secret code after toggling", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.setupTotp).mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      otpAuthUrl: "otpauth://totp/Kairos",
    });
    renderSetup();
    await screen.findByAltText("Scan this QR code with your authenticator app");
    // The toggle button contains "Can't scan?" text
    const toggleBtn = screen.getByRole("button", { name: /can.t scan/i });
    await user.click(toggleBtn);
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
  });

  it("shows error when setupTotp fails", async () => {
    vi.mocked(authApi.setupTotp).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    renderSetup();
    expect(
      await screen.findByText(
        "Could not reach the server. Check your connection.",
      ),
    ).toBeInTheDocument();
  });

  it("shows field error when code is empty", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.setupTotp).mockResolvedValue({
      secret: "SECRET",
      otpAuthUrl: "otpauth://totp/Kairos",
    });
    renderSetup();
    await screen.findByAltText("Scan this QR code with your authenticator app");
    await user.click(
      screen.getByRole("button", { name: /verify and enable/i }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter the 6-digit code from your authenticator app.",
    );
  });

  it("calls confirmTotpSetup and navigates to /dashboard on success", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.setupTotp).mockResolvedValue({
      secret: "SECRET",
      otpAuthUrl: "otpauth://totp/Kairos",
    });
    vi.mocked(authApi.confirmTotpSetup).mockResolvedValue({
      step: "done",
      accessToken: "acc",
      refreshToken: "ref",
      admin: { id: "1", email: "a@b.com", name: "Admin", role: "admin" },
    });
    const { ctx } = renderSetup();
    await screen.findByAltText("Scan this QR code with your authenticator app");
    await user.type(screen.getByLabelText("Authentication code"), "123456");
    await user.click(
      screen.getByRole("button", { name: /verify and enable/i }),
    );
    await waitFor(() => expect(ctx.setFullAuth).toHaveBeenCalled());
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("shows INVALID_TOTP error on wrong code", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.setupTotp).mockResolvedValue({
      secret: "SECRET",
      otpAuthUrl: "otpauth://totp/Kairos",
    });
    vi.mocked(authApi.confirmTotpSetup).mockRejectedValue(
      new ApiError("Invalid TOTP", 400, "INVALID_TOTP"),
    );
    renderSetup();
    await screen.findByAltText("Scan this QR code with your authenticator app");
    await user.type(screen.getByLabelText("Authentication code"), "999999");
    await user.click(
      screen.getByRole("button", { name: /verify and enable/i }),
    );
    expect(
      await screen.findByText(
        "Incorrect code. Make sure you entered the 6-digit code from your authenticator app.",
      ),
    ).toBeInTheDocument();
  });
});
