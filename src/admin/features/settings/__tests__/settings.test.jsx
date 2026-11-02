/**
 * settings.test.tsx — Comprehensive unit and integration tests for Phase 8 Admin Settings.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SettingsPage } from "@/pages/SettingsPage";
import * as settingsApi from "../api/settingsApi";
import * as adminUsersApi from "@/features/admin-users/api/adminUsersApi";
import { AuthContext } from "@/features/auth/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_SYSTEM_SETTINGS = {
  ok: true,
  settings: {
    server: {
      port: 3001,
      publicApiUrl: "https://api.kairos.ai",
      corsOrigins: ["https://admin.kairos.ai", "https://app.kairos.ai"],
      jwtExpiresIn: "15m",
      adminJwtExpiresIn: "8h",
    },
    runtime: {
      maintenanceMode: false,
      allowNewRegistrations: true,
      maxSessionsPerUser: 5,
    },
  },
};

function createMockAuth(role = "owner", adminId = "adm-1") {
  const admin = {
    id: adminId,
    email: "sarah@kairos.ai",
    name: "Sarah Owner",
    role,
  };
  return {
    admin,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setFullAuth: vi.fn(),
    handleRefreshSuccess: vi.fn(),
    handleRefreshFailure: vi.fn(),
  };
}

function renderSettingsPage(role = "owner", adminId = "adm-1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const authValue = createMockAuth(role, adminId);

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={["/settings"]}>
            <SettingsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("Admin Settings — Phase 8", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(settingsApi, "fetchSettings").mockResolvedValue(
      MOCK_SYSTEM_SETTINGS,
    );
    vi.spyOn(settingsApi, "updateSettings").mockImplementation(
      async (payload) => {
        const resp = {
          ok: true,
          message: "Runtime configuration updated successfully.",
          settings: {
            ...MOCK_SYSTEM_SETTINGS.settings,
            runtime: {
              ...MOCK_SYSTEM_SETTINGS.settings.runtime,
              ...payload,
            },
          },
          applied: payload,
        };
        return resp;
      },
    );
    vi.spyOn(adminUsersApi, "updateAdminUser").mockResolvedValue({
      ok: true,
      admin: {
        id: "adm-1",
        name: "Sarah Updated",
        email: "sarah.updated@kairos.ai",
        role: "owner",
        status: "active",
        totpEnabled: true,
        mustChangePassword: false,
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-09-21T12:00:00.000Z",
      },
    });
  });

  // ── 1. Page Header & Rendering ──────────────────────────────────────────────
  it("renders page header, description, and settings sections", async () => {
    renderSettingsPage("owner");

    expect(screen.getByText("Platform Settings")).toBeInTheDocument();
    expect(
      screen.getByText(/Configure administrative preferences/i),
    ).toBeInTheDocument();

    // Sections should be rendered
    await waitFor(() => {
      expect(screen.getByText("Administrator Account")).toBeInTheDocument();
      expect(
        screen.getByText("Security & Authentication Posture"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Appearance & Interface Theme"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Platform Runtime Configuration"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Server & Environment Configuration"),
      ).toBeInTheDocument();
    });
  });

  // ── 2. Account Profile Update ───────────────────────────────────────────────
  it("updates administrator account profile name and email via updateAdminUser", async () => {
    const user = userEvent.setup();
    renderSettingsPage("owner");

    await waitFor(() => {
      expect(screen.getByDisplayValue("Sarah Owner")).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Full Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Sarah Updated");

    const saveBtn = screen.getByRole("button", {
      name: /Save Account Changes/i,
    });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(adminUsersApi.updateAdminUser).toHaveBeenCalledWith("adm-1", {
        name: "Sarah Updated",
        email: "sarah@kairos.ai",
      });
      expect(
        screen.getByText(/Account profile updated successfully/i),
      ).toBeInTheDocument();
    });
  });

  // ── 3. Appearance & Theme Selection ─────────────────────────────────────────
  it("allows switching theme modes (Light, Dark, System)", async () => {
    const user = userEvent.setup();
    renderSettingsPage("owner");

    await waitFor(() => {
      expect(
        screen.getByText("Appearance & Interface Theme"),
      ).toBeInTheDocument();
    });

    const darkRadio = screen.getByRole("radio", { name: /^Dark\b/i });
    await user.click(darkRadio);

    expect(darkRadio).toHaveAttribute("aria-checked", "true");
  });

  // ── 4. Security Posture Information ─────────────────────────────────────────
  it("displays security posture information including TOTP/2FA status", async () => {
    renderSettingsPage("owner");

    await waitFor(() => {
      expect(
        screen.getByText("Two-Factor Authentication (TOTP)"),
      ).toBeInTheDocument();
      expect(screen.getByText("Enforced & Active")).toBeInTheDocument();
      expect(
        screen.getByText("Admin Access Token Lifetime"),
      ).toBeInTheDocument();
      expect(screen.getAllByText("8h").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 5. Platform Runtime Configuration (Owner Write Access) ──────────────────
  it("updates runtime configuration when saved by Owner", async () => {
    const user = userEvent.setup();
    renderSettingsPage("owner");

    await waitFor(() => {
      expect(
        screen.getByText("Platform Runtime Configuration"),
      ).toBeInTheDocument();
    });

    // Toggle maintenance mode checkbox
    const maintCheckbox = screen.getByLabelText(/System maintenance mode/i);
    await user.click(maintCheckbox);

    // Modify max sessions
    const sessionsInput = screen.getByLabelText(
      /Max concurrent sessions per user/i,
    );
    await user.clear(sessionsInput);
    await user.type(sessionsInput, "10");

    const saveRuntimeBtn = screen.getByRole("button", {
      name: /Apply Runtime Settings/i,
    });
    await user.click(saveRuntimeBtn);

    await waitFor(() => {
      expect(settingsApi.updateSettings).toHaveBeenCalledWith({
        maintenanceMode: true,
        allowNewRegistrations: true,
        maxSessionsPerUser: 10,
      });
      expect(
        screen.getByText(
          /Platform runtime configuration updated successfully/i,
        ),
      ).toBeInTheDocument();
    });
  });

  // ── 6. Owner-Only Write Guard (Admin Role is Read-Only for Runtime) ─────────
  it("disables runtime controls and shows warning for non-owner admin role", async () => {
    renderSettingsPage("admin");

    await waitFor(() => {
      expect(
        screen.getByText("Platform Runtime Configuration"),
      ).toBeInTheDocument();
    });

    // Warning alert should appear
    expect(
      screen.getByText(
        /Runtime platform configuration is restricted to Platform Owners/i,
      ),
    ).toBeInTheDocument();

    // Controls should be disabled
    const maintCheckbox = screen.getByLabelText(/System maintenance mode/i);
    expect(maintCheckbox).toBeDisabled();

    const sessionsInput = screen.getByLabelText(
      /Max concurrent sessions per user/i,
    );
    expect(sessionsInput).toBeDisabled();

    const regCheckbox = screen.getByLabelText(/Accept new user registrations/i);
    expect(regCheckbox).toBeDisabled();

    // Save button should not be present
    expect(
      screen.queryByRole("button", { name: /Apply Runtime Settings/i }),
    ).not.toBeInTheDocument();
  });

  // ── 7. Read-Only Server Telemetry ───────────────────────────────────────────
  it("renders read-only server and environment telemetry data correctly", async () => {
    renderSettingsPage("owner");

    await waitFor(() => {
      expect(
        screen.getByText("Server & Environment Configuration"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("3001")).toBeInTheDocument();
    expect(screen.getByText("https://api.kairos.ai")).toBeInTheDocument();
    expect(screen.getByText("15m")).toBeInTheDocument();
    expect(screen.getAllByText("8h").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("https://admin.kairos.ai, https://app.kairos.ai"),
    ).toBeInTheDocument();
  });

  // ── 8. RBAC Guard: Access Restricted for viewer and ops ─────────────────────
  it("denies access to viewer role with Access Restricted alert", async () => {
    renderSettingsPage("viewer");

    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    expect(
      screen.getByText(
        /You do not have permission to view or manage Platform Settings/i,
      ),
    ).toBeInTheDocument();

    expect(settingsApi.fetchSettings).not.toHaveBeenCalled();
  });

  it("denies access to ops role with Access Restricted alert", async () => {
    renderSettingsPage("ops");

    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    expect(settingsApi.fetchSettings).not.toHaveBeenCalled();
  });

  // ── 9. Error State with Retry ──────────────────────────────────────────────
  it("renders ErrorState with retry button when system settings fail to load", async () => {
    const user = userEvent.setup();
    vi.spyOn(settingsApi, "fetchSettings").mockRejectedValueOnce(
      new Error("Database connectivity failure"),
    );

    renderSettingsPage("owner");

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load platform settings"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Database connectivity failure/i),
      ).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /Try again/i });
    expect(retryBtn).toBeInTheDocument();

    // Mock successful response for retry
    vi.spyOn(settingsApi, "fetchSettings").mockResolvedValueOnce(
      MOCK_SYSTEM_SETTINGS,
    );
    await user.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Server & Environment Configuration"),
      ).toBeInTheDocument();
    });
  });
});
