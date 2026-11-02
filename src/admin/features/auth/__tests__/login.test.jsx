/**
 * login.test.tsx — LoginPage unit tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "../../../pages/LoginPage";
import { AuthContext } from "../AuthProvider";
import { ApiError } from "../../../api/client";

function makeAuthCtx(overrides = {}) {
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

function renderLogin(authCtx = {}) {
  const ctx = makeAuthCtx(authCtx);
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthContext.Provider value={ctx}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route path="/totp/setup" element={<div>TOTP Setup</div>} />
          <Route path="/totp/verify" element={<div>TOTP Verify</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return ctx;
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields and submit button", () => {
    renderLogin();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    // Use id to avoid matching "Show password" aria-label
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("shows field-level errors on empty submit", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
  });

  it("shows email format error for invalid email", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Email address"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
  });

  it("calls login() with trimmed email and password", async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ step: "done" });
    renderLogin({ login });
    await user.type(
      screen.getByLabelText("Email address"),
      "admin@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith("admin@example.com", "secret123"),
    );
  });

  it("shows INVALID_CREDENTIALS error message", async () => {
    const user = userEvent.setup();
    const login = vi
      .fn()
      .mockRejectedValue(
        new ApiError("Invalid credentials.", 401, "INVALID_CREDENTIALS"),
      );
    renderLogin({ login });
    await user.type(
      screen.getByLabelText("Email address"),
      "admin@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(
      await screen.findByText("Incorrect email or password. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows RATE_LIMITED error message", async () => {
    const user = userEvent.setup();
    const login = vi
      .fn()
      .mockRejectedValue(
        new ApiError("Too many attempts.", 429, "RATE_LIMITED"),
      );
    renderLogin({ login });
    await user.type(
      screen.getByLabelText("Email address"),
      "admin@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(
      await screen.findByText(/too many sign-in attempts/i),
    ).toBeInTheDocument();
  });

  it("shows network error message on TypeError", async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    renderLogin({ login });
    await user.type(
      screen.getByLabelText("Email address"),
      "admin@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(
      await screen.findByText(
        "Could not reach the server. Check your network connection.",
      ),
    ).toBeInTheDocument();
  });

  it("navigates to /dashboard when step=done", async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ step: "done" });
    renderLogin({ login });
    await user.type(
      screen.getByLabelText("Email address"),
      "admin@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("navigates to /totp/setup when step=totp_setup", async () => {
    const user = userEvent.setup();
    const login = vi
      .fn()
      .mockResolvedValue({ step: "totp_setup", tempToken: "temp-abc" });
    renderLogin({ login });
    await user.type(
      screen.getByLabelText("Email address"),
      "admin@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("TOTP Setup")).toBeInTheDocument();
  });

  it("navigates to /totp/verify when step=totp_required", async () => {
    const user = userEvent.setup();
    const login = vi
      .fn()
      .mockResolvedValue({ step: "totp_required", tempToken: "temp-xyz" });
    renderLogin({ login });
    await user.type(
      screen.getByLabelText("Email address"),
      "admin@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("TOTP Verify")).toBeInTheDocument();
  });

  it("disables submit button while loading", async () => {
    const user = userEvent.setup();
    let settle;
    const login = vi.fn().mockImplementation(
      () =>
        new Promise((r) => {
          settle = () => r({ step: "done" });
        }),
    );
    renderLogin({ login });
    await user.type(
      screen.getByLabelText("Email address"),
      "admin@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    // While promise is pending the button should be disabled
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    settle();
  });
});
