/**
 * auditLogs.test.tsx — Comprehensive unit and integration tests for Phase 7 Audit Logs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuditLogsPage } from "@/pages/AuditLogsPage";
import * as auditLogsApi from "../api/auditLogsApi";
import { AuthContext } from "@/features/auth/AuthProvider";
import { sanitizeAuditMetadata } from "../utils/auditSanitizer";

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_AUDIT_LOGS = [
  {
    id: "log-1",
    actorId: "adm-100",
    action: "admin.user.created",
    targetId: "adm-200",
    sessionId: "sess-123",
    metadata: {
      email: "newadmin@kairos.ai",
      role: "admin",
      temporaryPasswordIssued: true,
      rawPassword: "SensitiveP@ssword123!",
    },
    createdAt: "2026-09-21T10:00:00.000Z",
  },
  {
    id: "log-2",
    actorId: "usr-50",
    action: "user.suspended",
    targetId: "usr-88",
    sessionId: null,
    metadata: {
      reason: "Terms of service violation",
      suspendedBy: "adm-100",
    },
    createdAt: "2026-09-21T09:30:00.000Z",
  },
  {
    id: "log-3",
    actorId: "adm-100",
    action: "settings.updated",
    targetId: "settings",
    sessionId: null,
    metadata: {
      maintenanceMode: true,
      maxSessionsPerUser: 5,
    },
    createdAt: "2026-09-21T08:15:00.000Z",
  },
];

const MOCK_LIST_RESPONSE = {
  ok: true,
  auditLogs: MOCK_AUDIT_LOGS,
  pagination: {
    page: 1,
    limit: 20,
    total: 3,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

function createMockAuth(role = "owner", adminId = "adm-1") {
  const admin = {
    id: adminId,
    email: "admin@kairos.ai",
    name: "Lead Admin",
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

function renderAuditLogsPage(role = "owner") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const authValue = createMockAuth(role);

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={["/audit-logs"]}>
          <AuditLogsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Audit Logs — Phase 7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auditLogsApi, "fetchAuditLogs").mockResolvedValue(
      MOCK_LIST_RESPONSE,
    );
  });

  // ── 1. Page Header & Rendering ──────────────────────────────────────────────
  it("renders page header, description, and total event count badge", async () => {
    renderAuditLogsPage("owner");

    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
    expect(
      screen.getByText(/Immutable operational event ledger/i),
    ).toBeInTheDocument();

    await screen.findByText("usr-88");
    expect(screen.getByText(/3 events recorded/i)).toBeInTheDocument();
  });

  // ── 2. Table Data Rendering ─────────────────────────────────────────────────
  it("renders table rows with action badges, actor ID, target ID, and timestamps", async () => {
    renderAuditLogsPage("owner");

    await screen.findByText("usr-88");
    expect(screen.getByText("Admin Created")).toBeInTheDocument();
    expect(screen.getByText("User Suspended")).toBeInTheDocument();
    expect(screen.getByText("Settings Updated")).toBeInTheDocument();

    expect(screen.getAllByText("adm-100").length).toBeGreaterThan(0);
  });

  // ── 3. Action Filter ────────────────────────────────────────────────────────
  it("filters by action and updates query params", async () => {
    const user = userEvent.setup();
    renderAuditLogsPage("owner");

    await screen.findByText("usr-88");

    const actionSelect = screen.getByLabelText(/Filter by action/i);
    await user.selectOptions(actionSelect, "admin.user.created");

    await waitFor(() => {
      expect(auditLogsApi.fetchAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ action: "admin.user.created" }),
      );
    });
  });

  // ── 4. Actor ID & Target ID Filter ──────────────────────────────────────────
  it("filters by Actor ID and Target ID on input change", async () => {
    const user = userEvent.setup();
    renderAuditLogsPage("owner");

    await screen.findByText("usr-88");

    const actorInput = screen.getByLabelText(/Filter by actor ID/i);
    await user.type(actorInput, "adm-100");

    await waitFor(() => {
      expect(auditLogsApi.fetchAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: "adm-100" }),
      );
    });

    const targetInput = screen.getByLabelText(/Filter by target ID/i);
    await user.type(targetInput, "adm-200");

    await waitFor(() => {
      expect(auditLogsApi.fetchAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: "adm-200" }),
      );
    });
  });

  // ── 5. Date Range Filtering ─────────────────────────────────────────────────
  it("applies date range filters when from/to dates are entered", async () => {
    renderAuditLogsPage("owner");

    await screen.findByText("usr-88");

    const fromDateInput = screen.getByLabelText(/Filter from date/i);
    fireEvent.change(fromDateInput, { target: { value: "2026-09-01" } });

    await waitFor(() => {
      expect(auditLogsApi.fetchAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ from: "2026-09-01" }),
      );
    });

    const toDateInput = screen.getByLabelText(/Filter to date/i);
    fireEvent.change(toDateInput, { target: { value: "2026-09-21" } });

    await waitFor(() => {
      expect(auditLogsApi.fetchAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ to: "2026-09-21" }),
      );
    });
  });

  // ── 6. Refresh Button ───────────────────────────────────────────────────────
  it("triggers query refetch when Refresh button is clicked", async () => {
    const user = userEvent.setup();
    renderAuditLogsPage("owner");

    await screen.findByText("usr-88");

    const refreshButton = screen.getByRole("button", { name: /Refresh/i });
    await user.click(refreshButton);

    expect(auditLogsApi.fetchAuditLogs).toHaveBeenCalledTimes(2);
  });

  // ── 7. Event Details Modal & Sensitive Data Sanitization ─────────────────────
  it("opens event details modal and renders sanitized metadata", async () => {
    const user = userEvent.setup();
    renderAuditLogsPage("owner");

    await screen.findByText("usr-88");

    // Click "View Event" on the first row (accessible name is aria-label "View details for event...")
    const viewButtons = screen.getAllByRole("button", {
      name: /View details/i,
    });
    await user.click(viewButtons[0]);

    // Verify modal appears
    await waitFor(() => {
      expect(screen.getByText("Audit Event Details")).toBeInTheDocument();
    });

    // Verify sanitized metadata: rawPassword must NOT appear in raw text, it must be [REDACTED]
    expect(screen.queryByText("SensitiveP@ssword123!")).not.toBeInTheDocument();
    expect(screen.getAllByText("[REDACTED]").length).toBeGreaterThanOrEqual(1);

    // Close modal
    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText("Audit Event Details")).not.toBeInTheDocument();
    });
  });

  // ── 8. Sanitizer Unit Verification ──────────────────────────────────────────
  it("sanitizes all credentials, secret keys, passwords, and tokens deeply", () => {
    const dirty = {
      user: {
        password: "superSecretPassword!",
        nestedToken: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      },
      client_secret: "sec_xyz789",
      apiKey: "krios_live_12345",
      normalField: "hello world",
      arrayField: [{ private_key: "RSA PRIVATE KEY" }, { normal: 42 }],
    };

    const cleaned = sanitizeAuditMetadata(dirty);
    const userObj = cleaned.user;
    const arrayItems = cleaned.arrayField;

    expect(userObj.password).toBe("[REDACTED]");
    expect(userObj.nestedToken).toBe("[REDACTED]");
    expect(cleaned.client_secret).toBe("[REDACTED]");
    expect(cleaned.apiKey).toBe("[REDACTED]");
    expect(cleaned.normalField).toBe("hello world");
    expect(arrayItems[0].private_key).toBe("[REDACTED]");
    expect(arrayItems[1].normal).toBe(42);
  });

  // ── 9. RBAC Guard: Access Restricted for viewer and ops ─────────────────────
  it("denies access to viewer and ops roles with Access Restricted alert", async () => {
    renderAuditLogsPage("viewer");

    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    expect(
      screen.getByText(/You do not have permission to view system Audit Logs/i),
    ).toBeInTheDocument();

    // API should not be called
    expect(auditLogsApi.fetchAuditLogs).not.toHaveBeenCalled();
  });

  it("denies access to ops role as well", async () => {
    renderAuditLogsPage("ops");

    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    expect(auditLogsApi.fetchAuditLogs).not.toHaveBeenCalled();
  });

  // ── 10. Allows access for admin role ────────────────────────────────────────
  it("allows access for admin role", async () => {
    renderAuditLogsPage("admin");

    await screen.findByText("usr-88");
    expect(auditLogsApi.fetchAuditLogs).toHaveBeenCalled();
  });

  // ── 11. Error State with Retry ──────────────────────────────────────────────
  it("renders ErrorState with retry button on API failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(auditLogsApi, "fetchAuditLogs").mockRejectedValueOnce(
      new Error("Failed to load audit logs from server"),
    );

    renderAuditLogsPage("owner");

    await waitFor(() => {
      expect(screen.getByText("Failed to load audit logs")).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to load audit logs from server/i),
      ).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /Try again/i });
    expect(retryBtn).toBeInTheDocument();

    // Fix the API mock for retry
    vi.spyOn(auditLogsApi, "fetchAuditLogs").mockResolvedValueOnce(
      MOCK_LIST_RESPONSE,
    );
    await user.click(retryBtn);

    await screen.findByText("usr-88");
  });

  // ── 12. Empty State ─────────────────────────────────────────────────────────
  it("renders EmptyState when no audit logs match query", async () => {
    vi.spyOn(auditLogsApi, "fetchAuditLogs").mockResolvedValueOnce({
      ok: true,
      auditLogs: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    renderAuditLogsPage("owner");

    await waitFor(() => {
      expect(screen.getByText("No audit events found")).toBeInTheDocument();
    });
  });
});
