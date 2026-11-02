/**
 * adminUsers.test.tsx — Comprehensive unit and integration tests for Phase 6 Admin Users Management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import * as adminUsersApi from "../api/adminUsersApi";
import { AuthContext } from "@/features/auth/AuthProvider";

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_ADMINS = [
  {
    id: "adm-1",
    name: "Sarah Owner",
    email: "sarah@kairos.ai",
    role: "owner",
    status: "active",
    totpEnabled: true,
    mustChangePassword: false,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "adm-2",
    name: "David Admin",
    email: "david@kairos.ai",
    role: "admin",
    status: "active",
    totpEnabled: false,
    mustChangePassword: true, // Needs initial password change
    createdAt: "2026-08-10T14:30:00.000Z",
    updatedAt: "2026-08-10T14:30:00.000Z",
  },
  {
    id: "adm-3",
    name: "Elena Ops",
    email: "elena@kairos.ai",
    role: "ops",
    status: "suspended",
    totpEnabled: false, // TOTP pending
    mustChangePassword: false,
    createdAt: "2026-08-20T08:15:00.000Z",
    updatedAt: "2026-08-20T08:15:00.000Z",
  },
];

const MOCK_LIST_RESPONSE = {
  ok: true,
  adminUsers: MOCK_ADMINS,
  pagination: {
    page: 1,
    limit: 20,
    total: 3,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

const MOCK_DETAIL_RESPONSE = {
  ok: true,
  admin: MOCK_ADMINS[1], // David Admin
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

function renderAdminUsersPage(role = "owner", adminId = "adm-1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const authValue = createMockAuth(role, adminId);

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={["/admin-users"]}>
          <AdminUsersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Admin Users Management — Phase 6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(adminUsersApi, "fetchAdminUsers").mockResolvedValue(
      MOCK_LIST_RESPONSE,
    );
    vi.spyOn(adminUsersApi, "fetchAdminUserById").mockResolvedValue(
      MOCK_DETAIL_RESPONSE,
    );
    vi.spyOn(adminUsersApi, "createAdminUser").mockResolvedValue({
      ok: true,
      admin: {
        id: "adm-4",
        name: "New Officer",
        email: "new@kairos.ai",
        role: "ops",
        status: "active",
        totpEnabled: false,
        mustChangePassword: true,
        createdAt: "2026-09-21T12:00:00.000Z",
        updatedAt: "2026-09-21T12:00:00.000Z",
      },
    });
    vi.spyOn(adminUsersApi, "updateAdminUser").mockResolvedValue({
      ok: true,
      admin: {
        ...MOCK_ADMINS[1],
        name: "David Updated",
      },
    });
    vi.spyOn(adminUsersApi, "suspendAdminUser").mockResolvedValue({
      ok: true,
      message: "Admin user suspended successfully.",
      admin: {
        ...MOCK_ADMINS[1],
        status: "suspended",
      },
    });
    vi.spyOn(adminUsersApi, "deleteAdminUser").mockResolvedValue({
      ok: true,
      message: "Admin user deleted successfully.",
      deletedId: "adm-2",
      deletedEmail: "david@kairos.ai",
    });
  });

  // ── 1. Page Header & Toolbar Rendering ───────────────────────────────────────
  it("renders page header, description, toolbar controls, and admin count", async () => {
    renderAdminUsersPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Admin Users" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Manage administrative personnel, assign roles, enforce onboarding security/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText("Search by name or email…"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Filter by role" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Filter by status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Sort admin users" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh admin users" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create new admin user" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("3 admins")).toBeInTheDocument();
    });
  });

  // ── 2. Table Data & Onboarding Badges Display ────────────────────────────────
  it("displays admin rows with roles, statuses, and correct onboarding security badges", async () => {
    renderAdminUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Sarah Owner")).toBeInTheDocument();
    });

    expect(screen.getByText("sarah@kairos.ai")).toBeInTheDocument();
    expect(screen.getByText("david@kairos.ai")).toBeInTheDocument();
    expect(screen.getByText("elena@kairos.ai")).toBeInTheDocument();

    // Semantic onboarding badges
    expect(screen.getByText("Onboarded")).toBeInTheDocument(); // Sarah
    expect(screen.getByText("Password Change Req.")).toBeInTheDocument(); // David
    expect(screen.getByText("TOTP Pending")).toBeInTheDocument(); // Elena

    // Self tag for logged-in admin (Sarah)
    expect(screen.getByText("(You)")).toBeInTheDocument();
  });

  // ── 3. Loading Skeleton State ───────────────────────────────────────────────
  it("renders loading skeleton while fetching", () => {
    vi.spyOn(adminUsersApi, "fetchAdminUsers").mockImplementationOnce(
      () => new Promise(() => {}),
    );
    renderAdminUsersPage();

    expect(screen.getByLabelText("Loading admin users")).toBeInTheDocument();
  });

  // ── 4. Empty State ──────────────────────────────────────────────────────────
  it("renders EmptyState when no admin users match filter", async () => {
    vi.spyOn(adminUsersApi, "fetchAdminUsers").mockResolvedValueOnce({
      ok: true,
      adminUsers: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    renderAdminUsersPage();

    await waitFor(() => {
      expect(screen.getByText("No admin users found")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        /Try adjusting your search query, role filter, or status filter/i,
      ),
    ).toBeInTheDocument();
  });

  // ── 5. Error State with Retry ───────────────────────────────────────────────
  it("renders ErrorState with retry button on API failure", async () => {
    vi.spyOn(adminUsersApi, "fetchAdminUsers").mockRejectedValueOnce(
      new Error("Server error 500"),
    );
    const user = userEvent.setup();

    renderAdminUsersPage();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load admin users"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Server error 500")).toBeInTheDocument();

    // Retry
    vi.spyOn(adminUsersApi, "fetchAdminUsers").mockResolvedValueOnce(
      MOCK_LIST_RESPONSE,
    );
    const retryBtn = screen.getByRole("button", { name: /try again/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("Sarah Owner")).toBeInTheDocument();
    });
  });

  // ── 6. Search Input & Debounce ──────────────────────────────────────────────
  it("debounces search input before triggering API query", async () => {
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => {
      expect(adminUsersApi.fetchAdminUsers).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByPlaceholderText("Search by name or email…");
    await user.type(searchInput, "david");

    await waitFor(
      () => {
        expect(adminUsersApi.fetchAdminUsers).toHaveBeenCalledWith(
          expect.objectContaining({ search: "david", page: 1 }),
        );
      },
      { timeout: 1000 },
    );
  });

  // ── 7. Role and Status Filter ───────────────────────────────────────────────
  it("filters by role and status and updates query", async () => {
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => {
      expect(adminUsersApi.fetchAdminUsers).toHaveBeenCalledTimes(1);
    });

    const roleSelect = screen.getByRole("combobox", { name: "Filter by role" });
    await user.selectOptions(roleSelect, "admin");

    await waitFor(() => {
      expect(adminUsersApi.fetchAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({ role: "admin", page: 1 }),
      );
    });

    const statusSelect = screen.getByRole("combobox", {
      name: "Filter by status",
    });
    await user.selectOptions(statusSelect, "active");

    await waitFor(() => {
      expect(adminUsersApi.fetchAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({ role: "admin", status: "active", page: 1 }),
      );
    });
  });

  // ── 8. Sorting ──────────────────────────────────────────────────────────────
  it("updates sorting when clicking sortable column headers", async () => {
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Sarah Owner")).toBeInTheDocument();
    });

    const emailHeader = screen.getByRole("columnheader", { name: /Email/i });
    await user.click(emailHeader);

    await waitFor(() => {
      expect(adminUsersApi.fetchAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "email", order: "asc" }),
      );
    });
  });

  // ── 9. Admin Details Modal ──────────────────────────────────────────────────
  it("opens admin details modal displaying profile and onboarding state", async () => {
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => {
      expect(screen.getByText("David Admin")).toBeInTheDocument();
    });

    const detailsBtn = screen.getByRole("button", {
      name: "View details for david@kairos.ai",
    });
    await user.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Admin User Details")).toBeInTheDocument();
    });

    expect(screen.getByText("adm-2")).toBeInTheDocument();
    expect(
      screen.getAllByText("david@kairos.ai").length,
    ).toBeGreaterThanOrEqual(1);

    const closeBtn = screen.getByRole("button", { name: "Close" });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // ── 10. Create Admin Modal Flow & Temporary Password Banner ─────────────────
  it("creates admin user and displays secure one-time temporary password banner", async () => {
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Sarah Owner")).toBeInTheDocument();
    });

    const createBtn = screen.getByRole("button", {
      name: "Create new admin user",
    });
    await user.click(createBtn);

    expect(screen.getByText("Create New Admin User")).toBeInTheDocument();

    // Fill form
    const emailInput = screen.getByPlaceholderText("sarah@kairos.ai");
    fireEvent.change(emailInput, { target: { value: "new@kairos.ai" } });

    // Click generate password
    const generateBtn = screen.getByRole("button", { name: "Generate" });
    await user.click(generateBtn);

    // Submit
    const submitBtn = screen.getByRole("button", { name: "Create Account" });
    await user.click(submitBtn);

    // Verify one-time copy banner is shown
    await waitFor(() => {
      expect(screen.getByText("Admin User Created")).toBeInTheDocument();
      expect(
        screen.getByText(/Please securely share this temporary password/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Copy temporary password" }),
      ).toBeInTheDocument();
    });

    expect(adminUsersApi.createAdminUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@kairos.ai",
        role: "viewer",
      }),
    );

    // Click Done to close
    const doneBtn = screen.getByRole("button", { name: "Done" });
    await user.click(doneBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // ── 10b. Continuous Typing Without Focus Stealing ───────────────────────────
  it("allows continuous typing in Create Admin form inputs without losing focus", async () => {
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Sarah Owner")).toBeInTheDocument();
    });

    const createBtn = screen.getByRole("button", {
      name: "Create new admin user",
    });
    await user.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText("Create New Admin User")).toBeInTheDocument();
    });

    // Find inputs
    const nameInput = screen.getByPlaceholderText("e.g. Sarah Jenkins");
    const emailInput = screen.getByPlaceholderText("sarah@kairos.ai");
    const pwdInput = screen.getByPlaceholderText(
      "Enter or generate temporary password…",
    );

    // Continuous typing in Name field
    await user.click(nameInput);
    expect(document.activeElement).toBe(nameInput);
    await user.type(nameInput, "Alexander Hamilton");
    expect(nameInput).toHaveValue("Alexander Hamilton");
    expect(document.activeElement).toBe(nameInput);

    // Continuous typing in Email field
    await user.click(emailInput);
    expect(document.activeElement).toBe(emailInput);
    await user.type(emailInput, "alexander@kairos.ai");
    expect(emailInput).toHaveValue("alexander@kairos.ai");
    expect(document.activeElement).toBe(emailInput);

    // Continuous typing in Password field
    await user.click(pwdInput);
    expect(document.activeElement).toBe(pwdInput);
    await user.type(pwdInput, "SuperSecret123!");
    expect(pwdInput).toHaveValue("SuperSecret123!");
    expect(document.activeElement).toBe(pwdInput);
  });

  // ── 11. Role Restrictions in Create Modal ────────────────────────────────────
  it("restricts role options in Create Modal based on actor rank", async () => {
    const user = userEvent.setup();
    // Render as 'admin' role (not owner)
    renderAdminUsersPage("admin", "adm-2");

    await waitFor(() => {
      expect(screen.getByText("David Admin")).toBeInTheDocument();
    });

    const createBtn = screen.getByRole("button", {
      name: "Create new admin user",
    });
    await user.click(createBtn);

    // Role options should NOT include 'owner'
    const roleSelect = screen.getByRole("combobox", { name: /Admin Role/i });
    expect(roleSelect).not.toHaveTextContent("OWNER");
    expect(roleSelect).toHaveTextContent("ADMIN");
    expect(roleSelect).toHaveTextContent("OPS");
    expect(roleSelect).toHaveTextContent("VIEWER");
  });

  it("allows owner actor to assign owner role in Create Modal", async () => {
    const user = userEvent.setup();
    // Render as 'owner' role
    renderAdminUsersPage("owner", "adm-1");

    await waitFor(() => {
      expect(screen.getByText("Sarah Owner")).toBeInTheDocument();
    });

    const createBtn = screen.getByRole("button", {
      name: "Create new admin user",
    });
    await user.click(createBtn);

    const roleSelect = screen.getByRole("combobox", { name: /Admin Role/i });
    expect(roleSelect).toHaveTextContent("OWNER");
    expect(roleSelect).toHaveTextContent("ADMIN");
    expect(roleSelect).toHaveTextContent("OPS");
    expect(roleSelect).toHaveTextContent("VIEWER");
  });

  // ── 12. Edit Admin Modal Flow ────────────────────────────────────────────────
  it("opens edit modal and updates admin account fields", async () => {
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => {
      expect(screen.getByText("David Admin")).toBeInTheDocument();
    });

    const editBtn = screen.getByRole("button", {
      name: "Edit david@kairos.ai",
    });
    await user.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText("Edit Admin Account")).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue("David Admin");
    await user.clear(nameInput);
    await user.type(nameInput, "David Updated");

    const saveBtn = screen.getByRole("button", { name: "Save Changes" });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(adminUsersApi.updateAdminUser).toHaveBeenCalledWith(
        "adm-2",
        expect.objectContaining({ name: "David Updated" }),
      );
      expect(
        screen.getByText("Admin user updated successfully."),
      ).toBeInTheDocument();
    });
  });

  // ── 13. Suspend Admin User Flow ──────────────────────────────────────────────
  it("opens suspend confirmation modal and executes suspend mutation", async () => {
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => {
      expect(screen.getByText("David Admin")).toBeInTheDocument();
    });

    const suspendBtn = screen.getByRole("button", {
      name: "Suspend david@kairos.ai",
    });
    await user.click(suspendBtn);

    expect(screen.getByText("Suspend Admin User")).toBeInTheDocument();
    expect(
      screen.getByText(
        /All active refresh tokens will be revoked immediately/i,
      ),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Suspend Admin" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(adminUsersApi.suspendAdminUser).toHaveBeenCalledWith(
        "adm-2",
        false,
      );
      expect(
        screen.getByText("Admin user david@kairos.ai has been suspended."),
      ).toBeInTheDocument();
    });
  });

  // ── 14. Reactivate Admin User Flow ───────────────────────────────────────────
  it("opens reactivate confirmation modal and executes reactivate mutation", async () => {
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Elena Ops")).toBeInTheDocument();
    });

    const reactivateBtn = screen.getByRole("button", {
      name: "Reactivate elena@kairos.ai",
    });
    await user.click(reactivateBtn);

    expect(screen.getByText("Reactivate Admin User")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Reactivate Admin" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(adminUsersApi.suspendAdminUser).toHaveBeenCalledWith(
        "adm-3",
        true,
      );
      expect(
        screen.getByText("Admin user elena@kairos.ai has been reactivated."),
      ).toBeInTheDocument();
    });
  });

  // ── 15. Delete Admin User Flow ───────────────────────────────────────────────
  it("opens delete confirmation modal and executes delete mutation", async () => {
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => {
      expect(screen.getByText("David Admin")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", {
      name: "Delete david@kairos.ai",
    });
    await user.click(deleteBtn);

    expect(
      screen.getByText("Permanently Delete Admin User"),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", {
      name: "Permanently Delete",
    });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(adminUsersApi.deleteAdminUser).toHaveBeenCalledWith("adm-2");
      expect(
        screen.getByText("Admin user david@kairos.ai was permanently deleted."),
      ).toBeInTheDocument();
    });
  });

  // ── 16. RBAC Permissions Matrix ─────────────────────────────────────────────
  describe("RBAC & Privilege Escalation Guards", () => {
    it("viewer & ops: denied access to /admin-users page", () => {
      renderAdminUsersPage("ops");

      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
      expect(
        screen.getByText(
          /You do not have permission to view or manage Admin Users/i,
        ),
      ).toBeInTheDocument();
    });

    it("admin role: can create/edit/suspend admins at or below rank, but cannot delete anyone", async () => {
      renderAdminUsersPage("admin", "adm-2");

      await waitFor(() => {
        expect(screen.getByText("David Admin")).toBeInTheDocument();
      });

      // Admin CAN create admin users
      expect(
        screen.getByRole("button", { name: "Create new admin user" }),
      ).toBeInTheDocument();

      // Admin CANNOT delete anyone (delete button is strictly owner-only)
      expect(
        screen.queryByRole("button", { name: /Delete/i }),
      ).not.toBeInTheDocument();

      // Admin CANNOT edit or suspend an OWNER (Sarah Owner is higher rank)
      expect(
        screen.queryByRole("button", { name: "Edit sarah@kairos.ai" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Suspend sarah@kairos.ai" }),
      ).not.toBeInTheDocument();

      // Admin CAN edit an Ops user (Elena Ops is lower rank)
      expect(
        screen.getByRole("button", { name: "Edit elena@kairos.ai" }),
      ).toBeInTheDocument();
    });

    it("owner role: has full access to edit, suspend, and delete", async () => {
      renderAdminUsersPage("owner", "adm-1");

      await waitFor(() => {
        expect(screen.getByText("David Admin")).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", { name: "Create new admin user" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Edit david@kairos.ai" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Suspend david@kairos.ai" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Delete david@kairos.ai" }),
      ).toBeInTheDocument();
    });
  });

  // ── 17. Security Credential Non-Exposure ─────────────────────────────────────
  it("never renders password hashes, tokens, or TOTP secrets in the DOM", async () => {
    renderAdminUsersPage();

    await waitFor(() => {
      expect(screen.getByText("Sarah Owner")).toBeInTheDocument();
    });

    const bodyText = document.body.innerHTML;
    expect(bodyText).not.toContain("passwordHash");
    expect(bodyText).not.toContain("totpSecret");
    expect(bodyText).not.toContain("refreshToken");
    expect(bodyText).not.toContain("bcrypt");
  });
});
