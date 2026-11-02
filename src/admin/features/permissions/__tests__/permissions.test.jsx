import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { PermissionsPage } from "@/pages/PermissionsPage";
import * as permissionsApi from "../api/permissionsApi";
import { AuthContext } from "@/features/auth/AuthProvider";

const MOCK_ADMINS = [
  {
    id: "ops-1",
    name: "Ops Alice",
    email: "alice@test.com",
    role: "ops",
    status: "active",
    isCustom: true,
    permissionsCount: 10,
    createdAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "ow-1",
    name: "Owner User",
    email: "owner@test.com",
    role: "owner",
    status: "active",
    isCustom: false,
    permissionsCount: 26,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "adm-1",
    name: "Admin Bob",
    email: "bob@test.com",
    role: "admin",
    status: "active",
    isCustom: false,
    permissionsCount: 18,
    createdAt: "2026-02-01T00:00:00.000Z",
  },
];

const MOCK_PERM_DATA_OPS = {
  admin: {
    id: "ops-1",
    name: "Ops Alice",
    email: "alice@test.com",
    role: "ops",
    status: "active",
    createdAt: "2026-03-01T00:00:00.000Z",
  },
  effectivePermissions: ["dashboard:read", "users:read", "users:export"],
  defaultPermissions: ["dashboard:read", "users:read"],
  isCustom: true,
  sections: [
    {
      id: "dashboard",
      label: "Dashboard",
      description: "Platform overview and telemetry",
      actions: {
        view: "dashboard:read",
        create: null,
        edit: null,
        delete: null,
        export: null,
      },
    },
    {
      id: "users",
      label: "Users",
      description: "Candidate user accounts and storage",
      actions: {
        view: "users:read",
        create: null,
        edit: "users:suspend",
        delete: "users:delete",
        export: "users:export",
      },
    },
  ],
};

function renderWithProviders(role = "owner", currentAdminId = "ow-1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  const authValue = {
    admin: {
      id: currentAdminId,
      email: `${role}@test.com`,
      name: `Test ${role}`,
      role,
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setFullAuth: vi.fn(),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <PermissionsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("PermissionsPage Feature Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(permissionsApi, "fetchManageableAdmins").mockResolvedValue(
      MOCK_ADMINS,
    );
    vi.spyOn(permissionsApi, "fetchAdminPermissions").mockResolvedValue(
      MOCK_PERM_DATA_OPS,
    );
    vi.spyOn(permissionsApi, "updateAdminPermissions").mockResolvedValue({
      effectivePermissions: [
        "dashboard:read",
        "users:read",
        "users:export",
        "users:delete",
      ],
      isCustom: true,
    });
    vi.spyOn(permissionsApi, "resetAdminPermissions").mockResolvedValue({
      effectivePermissions: ["dashboard:read", "users:read"],
      isCustom: false,
    });
  });

  it("restricts access for non-owner administrators without permissions:read", () => {
    renderWithProviders("viewer");
    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
  });

  it("renders page header and list of administrators", async () => {
    renderWithProviders("owner");

    expect(screen.getByText("Permissions Management")).toBeInTheDocument();
    expect(
      screen.getByText(/Configure and enforce granular action permissions/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Ops Alice")).toBeInTheDocument();
      expect(screen.getByText("bob@test.com")).toBeInTheDocument();
    });
  });

  it("renders permission matrix table with section headers and cells", async () => {
    renderWithProviders("owner");

    await waitFor(() => {
      expect(screen.getByText("Section")).toBeInTheDocument();
      expect(screen.getByText("View / Access")).toBeInTheDocument();
      expect(screen.getByText("Create / Add")).toBeInTheDocument();
      expect(screen.getByText("Edit / Modify")).toBeInTheDocument();
      expect(screen.getByText("Delete / Remove")).toBeInTheDocument();
      expect(screen.getByText("Export / Download")).toBeInTheDocument();
      expect(
        screen.getByText("Platform overview and telemetry"),
      ).toBeInTheDocument();
    });
  });

  it("toggles permission checkbox and enables Save button", async () => {
    renderWithProviders("owner");

    const saveBtn = await screen.findByRole("button", {
      name: /Save Permissions/i,
    });
    expect(saveBtn).toBeDisabled();

    // Toggle Delete / Remove permission for Users (users:delete)
    const deleteCheckbox = screen.getByLabelText(/users:delete/i);
    expect(deleteCheckbox).not.toBeChecked();

    fireEvent.click(deleteCheckbox);
    expect(deleteCheckbox).toBeChecked();

    // Save should now be enabled
    expect(saveBtn).not.toBeDisabled();
    expect(
      screen.getByText(/1 modification pending save/i),
    ).toBeInTheDocument();
  });

  it("clicking Cancel reverts changes and disables Save button", async () => {
    renderWithProviders("owner");

    await screen.findByRole("button", { name: /Save Permissions/i });

    const deleteCheckbox = screen.getByLabelText(/users:delete/i);
    fireEvent.click(deleteCheckbox);

    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    expect(cancelBtn).not.toBeDisabled();

    fireEvent.click(cancelBtn);

    expect(deleteCheckbox).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: /Save Permissions/i }),
    ).toBeDisabled();
  });

  it("saves updated permissions when clicking Save Permissions", async () => {
    renderWithProviders("owner");

    const saveBtn = await screen.findByRole("button", {
      name: /Save Permissions/i,
    });

    const deleteCheckbox = screen.getByLabelText(/users:delete/i);
    fireEvent.click(deleteCheckbox);

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(permissionsApi.updateAdminPermissions).toHaveBeenCalledWith(
        "ops-1",
        expect.objectContaining({
          permissions: expect.arrayContaining(["users:delete"]),
        }),
      );
      expect(
        screen.getByText(/Permissions saved and enforced successfully/i),
      ).toBeInTheDocument();
    });
  });

  it("opens confirm dialog and resets permissions on Reset to Default", async () => {
    renderWithProviders("owner");

    const resetBtn = await screen.findByRole("button", {
      name: /Reset to Default/i,
    });
    expect(resetBtn).not.toBeDisabled();

    fireEvent.click(resetBtn);

    expect(
      await screen.findByText(/Reset to Default Permissions\?/i),
    ).toBeInTheDocument();

    const confirmResetBtn = screen.getAllByRole("button", {
      name: /Reset to Default/i,
    })[1];
    fireEvent.click(confirmResetBtn);

    await waitFor(() => {
      expect(permissionsApi.resetAdminPermissions).toHaveBeenCalledWith(
        "ops-1",
      );
      expect(
        screen.getByText(/Permissions reset to role default policy/i),
      ).toBeInTheDocument();
    });
  });
});
