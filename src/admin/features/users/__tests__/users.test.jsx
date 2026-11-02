/**
 * users.test.tsx — Comprehensive unit and integration tests for Phase 5 Users Management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { UsersPage } from "@/pages/UsersPage";
import * as usersApi from "../api/usersApi";
import { AuthContext } from "@/features/auth/AuthProvider";

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_USERS = [
  {
    id: "usr-1",
    email: "alice@example.com",
    name: "Alice Candidate",
    status: "active",
    creditBalance: 120,
    aiUsage: 154,
    s3Storage: 156800000,
    createdAt: "2026-08-01T12:00:00.000Z",
    lastLoginAt: "2026-09-20T10:30:00.000Z",
  },
  {
    id: "usr-2",
    email: "bob@example.com",
    name: "Bob Engineer",
    status: "suspended",
    creditBalance: 0,
    aiUsage: 0,
    s3Storage: 0,
    createdAt: "2026-08-15T15:30:00.000Z",
    lastLoginAt: null,
  },
  {
    id: "usr-3",
    email: "charlie@example.com",
    name: null,
    status: "active",
    creditBalance: 45,
    aiUsage: 42,
    s3Storage: 45000000,
    createdAt: "2026-09-01T09:15:00.000Z",
    lastLoginAt: "2026-09-21T18:00:00.000Z",
  },
];

const MOCK_LIST_RESPONSE = {
  ok: true,
  users: MOCK_USERS,
  pagination: {
    page: 1,
    limit: 20,
    total: 3,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

const MOCK_DETAIL_USER = {
  id: "usr-1",
  email: "alice@example.com",
  name: "Alice Candidate",
  status: "active",
  creditBalance: 120,
  aiUsage: 154,
  s3Storage: 156800000,
  createdAt: "2026-08-01T12:00:00.000Z",
  lastLoginAt: "2026-09-20T10:30:00.000Z",
  sessionCount: 14,
};

const MOCK_DETAIL_RESPONSE = {
  ok: true,
  user: MOCK_DETAIL_USER,
};

function createMockAuth(role = "admin") {
  const admin = {
    id: "adm-123",
    email: "superadmin@kairos.ai",
    name: "Super Admin",
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

function renderUsersPage(role = "admin") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const authValue = createMockAuth(role);

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={["/users"]}>
          <UsersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Users Management — Phase 5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(usersApi, "fetchUsers").mockResolvedValue(MOCK_LIST_RESPONSE);
    vi.spyOn(usersApi, "fetchUserById").mockResolvedValue(MOCK_DETAIL_RESPONSE);
    vi.spyOn(usersApi, "suspendUser").mockResolvedValue({
      ok: true,
      message: "User suspended successfully.",
      user: { ...MOCK_USERS[0], status: "suspended" },
    });
    vi.spyOn(usersApi, "deleteUser").mockResolvedValue({
      ok: true,
      message: "User deleted successfully.",
      deletedId: "usr-1",
      deletedEmail: "alice@example.com",
    });
    vi.spyOn(usersApi, "exportUsersCsv").mockResolvedValue(
      "id,email,name,status,createdAt\nusr-1,alice@example.com,Alice,active,2026-08-01",
    );
  });

  // ── 1. Page Header & Toolbar Rendering ───────────────────────────────────────
  it("renders page header, title, description, and toolbar controls", async () => {
    renderUsersPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Platform Users" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Manage registered candidates, account statuses, and review session telemetry/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText("Search by name or email…"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Filter by status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Sort users" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh user list" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export users to CSV" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("3 users")).toBeInTheDocument();
    });
  });

  // ── 2. Users Table Data Display ─────────────────────────────────────────────
  it("displays user data rows with correct names, emails, badges, and dates", async () => {
    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Alice Candidate")).toBeInTheDocument();
    });

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("charlie@example.com")).toBeInTheDocument();
    expect(screen.getByText("No name")).toBeInTheDocument(); // charlie has no name

    // Status badges
    const activeBadges = screen.getAllByText("Active");
    const suspendedBadges = screen.getAllByText("Suspended");
    expect(activeBadges.length).toBeGreaterThanOrEqual(2);
    expect(suspendedBadges.length).toBeGreaterThanOrEqual(1);

    // Credits column and values
    expect(
      screen.getByRole("columnheader", { name: /credits/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();

    // AI Usage column and values
    expect(
      screen.getByRole("columnheader", { name: /ai usage/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("154")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();

    // S3 Storage column and values
    expect(
      screen.getByRole("columnheader", { name: /s3 storage/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("149.5 MB")).toBeInTheDocument();
    expect(screen.getByText("0 B")).toBeInTheDocument();
    expect(screen.getByText("42.9 MB")).toBeInTheDocument();

    // Last Login column and values
    expect(
      screen.getByRole("columnheader", { name: /last login/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument(); // Bob has null lastLoginAt
  });

  // ── 3. Empty State ──────────────────────────────────────────────────────────
  it("renders EmptyState when no users match search or filter", async () => {
    vi.spyOn(usersApi, "fetchUsers").mockResolvedValueOnce({
      ok: true,
      users: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText("No users found")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Try adjusting your search query or status filter/i),
    ).toBeInTheDocument();
  });

  // ── 4. Loading Skeleton State ───────────────────────────────────────────────
  it("renders loading skeleton while fetching", () => {
    // Return pending promise
    vi.spyOn(usersApi, "fetchUsers").mockImplementationOnce(
      () => new Promise(() => {}),
    );
    renderUsersPage();

    expect(screen.getByLabelText("Loading users")).toBeInTheDocument();
  });

  // ── 5. Error State with Retry ───────────────────────────────────────────────
  it("renders ErrorState with retry button on API failure", async () => {
    vi.spyOn(usersApi, "fetchUsers").mockRejectedValueOnce(
      new Error("Network error 500"),
    );
    const user = userEvent.setup();

    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Failed to load users")).toBeInTheDocument();
    });
    expect(screen.getByText("Network error 500")).toBeInTheDocument();

    // Retry
    vi.spyOn(usersApi, "fetchUsers").mockResolvedValueOnce(MOCK_LIST_RESPONSE);
    const retryBtn = screen.getByRole("button", { name: /try again/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("Alice Candidate")).toBeInTheDocument();
    });
  });

  // ── 6. Search Input & Debounce ──────────────────────────────────────────────
  it("debounces search input before triggering refetch", async () => {
    const user = userEvent.setup();
    renderUsersPage();

    await waitFor(() => {
      expect(usersApi.fetchUsers).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByPlaceholderText("Search by name or email…");
    await user.type(searchInput, "alice");

    // Debounce wait
    await waitFor(
      () => {
        expect(usersApi.fetchUsers).toHaveBeenCalledWith(
          expect.objectContaining({ search: "alice", page: 1 }),
        );
      },
      { timeout: 1000 },
    );
  });

  // ── 7. Status Filter ────────────────────────────────────────────────────────
  it("updates status filter and resets page to 1", async () => {
    const user = userEvent.setup();
    renderUsersPage();

    await waitFor(() => {
      expect(usersApi.fetchUsers).toHaveBeenCalledTimes(1);
    });

    const statusSelect = screen.getByRole("combobox", {
      name: "Filter by status",
    });
    await user.selectOptions(statusSelect, "suspended");

    await waitFor(() => {
      expect(usersApi.fetchUsers).toHaveBeenCalledWith(
        expect.objectContaining({ status: "suspended", page: 1 }),
      );
    });
  });

  // ── 8. Sorting ──────────────────────────────────────────────────────────────
  it("updates sorting when clicking table headers", async () => {
    const user = userEvent.setup();
    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Alice Candidate")).toBeInTheDocument();
    });

    // Click Email header to sort by email
    const emailHeader = screen.getByRole("columnheader", { name: /Email/i });
    await user.click(emailHeader);

    await waitFor(() => {
      expect(usersApi.fetchUsers).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "email", order: "asc" }),
      );
    });

    // Click AI Usage header to sort by aiUsage
    const aiUsageHeader = screen.getByRole("columnheader", {
      name: /AI Usage/i,
    });
    await user.click(aiUsageHeader);

    await waitFor(() => {
      expect(usersApi.fetchUsers).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "aiUsage", order: "asc" }),
      );
    });

    // Click S3 Storage header to sort by s3Storage
    const s3StorageHeader = screen.getByRole("columnheader", {
      name: /S3 Storage/i,
    });
    await user.click(s3StorageHeader);

    await waitFor(() => {
      expect(usersApi.fetchUsers).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "s3Storage", order: "asc" }),
      );
    });
  });

  // ── 9. User Details Modal with Session Count ────────────────────────────────
  it("opens user details modal and displays full profile with session count", async () => {
    const user = userEvent.setup();
    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Alice Candidate")).toBeInTheDocument();
    });

    const detailsBtn = screen.getByRole("button", {
      name: "View details for alice@example.com",
    });
    await user.click(detailsBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("User Profile Details")).toBeInTheDocument();
    });

    // Detail data fetched and displayed
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByText("Interview Sessions"),
      ).toBeInTheDocument();
      expect(within(dialog).getByText("S3 Storage")).toBeInTheDocument();
      expect(within(dialog).getByText("149.5 MB")).toBeInTheDocument();
      expect(within(dialog).getByText("usr-1")).toBeInTheDocument();
      expect(within(dialog).getByText("14")).toBeInTheDocument();
    });

    // Close modal
    const closeBtn = screen.getByRole("button", { name: "Close" });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // ── 10. Suspend User Modal & Flow ───────────────────────────────────────────
  it("opens suspend confirmation modal, executes mutation, and displays alert", async () => {
    const user = userEvent.setup();
    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Alice Candidate")).toBeInTheDocument();
    });

    // Alice is active, button is "Suspend"
    const suspendBtn = screen.getByRole("button", {
      name: "Suspend alice@example.com",
    });
    await user.click(suspendBtn);

    // Confirm dialog opens
    expect(screen.getByText("Suspend User Account")).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to suspend alice@example.com?/i),
    ).toBeInTheDocument();

    // Click confirm
    const confirmBtn = screen.getByRole("button", { name: "Suspend User" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(usersApi.suspendUser).toHaveBeenCalledWith("usr-1", false);
      expect(
        screen.getByText("User alice@example.com has been suspended."),
      ).toBeInTheDocument();
    });
  });

  // ── 11. Reactivate User Modal & Flow ─────────────────────────────────────────
  it("opens reactivate confirmation modal and executes reactivate mutation", async () => {
    const user = userEvent.setup();
    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Bob Engineer")).toBeInTheDocument();
    });

    // Bob is suspended, button is "Reactivate"
    const reactivateBtn = screen.getByRole("button", {
      name: "Reactivate bob@example.com",
    });
    await user.click(reactivateBtn);

    // Confirm dialog opens
    expect(screen.getByText("Reactivate User Account")).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to reactivate bob@example.com?/i),
    ).toBeInTheDocument();

    // Click confirm
    const confirmBtn = screen.getByRole("button", { name: "Reactivate User" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(usersApi.suspendUser).toHaveBeenCalledWith("usr-2", true);
      expect(
        screen.getByText("User bob@example.com has been reactivated."),
      ).toBeInTheDocument();
    });
  });

  // ── 12. Delete User Modal with Destructive Warning ──────────────────────────
  it("opens delete modal explaining permanent deletion, executes delete, and notifies", async () => {
    const user = userEvent.setup();
    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Alice Candidate")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", {
      name: "Delete alice@example.com",
    });
    await user.click(deleteBtn);

    // Verify warning message
    expect(screen.getByText("Permanently Delete User")).toBeInTheDocument();
    expect(
      screen.getByText(
        /All of the user's interview sessions, transcripts, audio recordings, and notes will be permanently erased/i,
      ),
    ).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", {
      name: "Permanently Delete",
    });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(usersApi.deleteUser).toHaveBeenCalledWith("usr-1");
      expect(
        screen.getByText("User alice@example.com was permanently deleted."),
      ).toBeInTheDocument();
    });
  });

  // ── 13. CSV Export ──────────────────────────────────────────────────────────
  it("triggers CSV export and initiates file download", async () => {
    const user = userEvent.setup();
    // Mock URL methods & anchor click
    window.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    window.URL.revokeObjectURL = vi.fn();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Alice Candidate")).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole("button", {
      name: "Export users to CSV",
    });
    await user.click(exportBtn);

    await waitFor(() => {
      expect(usersApi.exportUsersCsv).toHaveBeenCalled();
      expect(
        screen.getByText("Users CSV exported successfully."),
      ).toBeInTheDocument();
    });

    clickSpy.mockRestore();
  });

  // ── 14. RBAC Visibility Checks ──────────────────────────────────────────────
  describe("RBAC Permission Guard Visibility", () => {
    it("viewer: hides export, suspend, and delete buttons", async () => {
      renderUsersPage("viewer");

      await waitFor(() => {
        expect(screen.getByText("Alice Candidate")).toBeInTheDocument();
      });

      // Export CSV button must NOT be present
      expect(
        screen.queryByRole("button", { name: "Export users to CSV" }),
      ).not.toBeInTheDocument();

      // Suspend and Delete action buttons must NOT be present
      expect(
        screen.queryByRole("button", { name: /Suspend/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Delete/i }),
      ).not.toBeInTheDocument();

      // Details button IS present for viewer
      expect(
        screen.getByRole("button", {
          name: "View details for alice@example.com",
        }),
      ).toBeInTheDocument();
    });

    it("ops: allows export and suspend, but hides delete button", async () => {
      renderUsersPage("ops");

      await waitFor(() => {
        expect(screen.getByText("Alice Candidate")).toBeInTheDocument();
      });

      // Export CSV and Suspend are allowed
      expect(
        screen.getByRole("button", { name: "Export users to CSV" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Suspend alice@example.com" }),
      ).toBeInTheDocument();

      // Delete is forbidden for ops
      expect(
        screen.queryByRole("button", { name: "Delete alice@example.com" }),
      ).not.toBeInTheDocument();
    });

    it("admin & owner: have full access to details, suspend, delete, and export", async () => {
      renderUsersPage("admin");

      await waitFor(() => {
        expect(screen.getByText("Alice Candidate")).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", { name: "Export users to CSV" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Suspend alice@example.com" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Delete alice@example.com" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "View details for alice@example.com",
        }),
      ).toBeInTheDocument();
    });
  });
});
