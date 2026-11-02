import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "@/hooks";
import { usePermission } from "@/features/auth/rbac";
import { ErrorState } from "@/components";
import {
  useAdminUsers,
  useCreateAdminUser,
  useUpdateAdminUser,
  useSuspendAdminUser,
  useDeleteAdminUser,
  AdminUsersToolbar,
  AdminUsersTable,
  AdminUserDetailsModal,
  CreateAdminUserModal,
  EditAdminUserModal,
  AdminSuspendModal,
  AdminDeleteModal,
} from "@/features/admin-users";
import "./AdminUsersPage.css";

export function AdminUsersPage() {
  const hasReadPermission = usePermission("admin-users:read");

  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial URL parameters
  const initialSearch = searchParams.get("search") ?? "";
  const initialRole = searchParams.get("role") || "";
  const initialStatus = searchParams.get("status") || "";
  const initialPage = Math.max(
    1,
    parseInt(searchParams.get("page") || "1", 10),
  );
  const initialSortBy = searchParams.get("sortBy") || "createdAt";
  const initialOrder = searchParams.get("order") || "desc";

  const [searchInput, setSearchInput] = useState(initialSearch);
  const debouncedSearch = useDebounce(searchInput, 300);

  const [roleFilter, setRoleFilter] = useState(initialRole);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [page, setPage] = useState(initialPage);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [order, setOrder] = useState(initialOrder);

  // Notification message banner
  const [toast, setToast] = useState(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAdminForDetail, setSelectedAdminForDetail] = useState(null);
  const [selectedAdminForEdit, setSelectedAdminForEdit] = useState(null);
  const [selectedAdminForSuspend, setSelectedAdminForSuspend] = useState(null);
  const [selectedAdminForDelete, setSelectedAdminForDelete] = useState(null);

  // Build query parameters
  const queryParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      role: roleFilter || undefined,
      status: statusFilter || undefined,
      page,
      limit: 10,
      sortBy,
      order,
    }),
    [debouncedSearch, roleFilter, statusFilter, page, sortBy, order],
  );

  // Sync to URL
  const updateUrl = useCallback(
    (newSearch, newRole, newStatus, newPage, newSortBy, newOrder) => {
      const next = new URLSearchParams();
      if (newSearch.trim()) next.set("search", newSearch.trim());
      if (newRole) next.set("role", newRole);
      if (newStatus) next.set("status", newStatus);
      if (newPage > 1) next.set("page", String(newPage));
      if (newSortBy !== "createdAt") next.set("sortBy", newSortBy);
      if (newOrder !== "desc") next.set("order", newOrder);
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );

  // Query hook
  const { data, isLoading, isError, error, isFetching, refetch } =
    useAdminUsers(queryParams, hasReadPermission);

  // Mutations
  const createMutation = useCreateAdminUser();
  const updateMutation = useUpdateAdminUser();
  const suspendMutation = useSuspendAdminUser();
  const deleteMutation = useDeleteAdminUser();

  if (!hasReadPermission) {
    return (
      <div className="admin-users-page">
        <ErrorState
          title="Access Restricted"
          message="You do not have permission to view or manage Admin Users. Contact a platform Owner to request access."
        />
      </div>
    );
  }

  const handleSearchChange = (val) => {
    setSearchInput(val);
    setPage(1);
    updateUrl(val, roleFilter, statusFilter, 1, sortBy, order);
  };

  const handleRoleChange = (val) => {
    setRoleFilter(val);
    setPage(1);
    updateUrl(searchInput, val, statusFilter, 1, sortBy, order);
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    setPage(1);
    updateUrl(searchInput, roleFilter, val, 1, sortBy, order);
  };

  const handleSortChange = (newSortBy, newOrder) => {
    setSortBy(newSortBy);
    setOrder(newOrder);
    setPage(1);
    updateUrl(searchInput, roleFilter, statusFilter, 1, newSortBy, newOrder);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    updateUrl(searchInput, roleFilter, statusFilter, newPage, sortBy, order);
  };

  const handleCreateSubmit = async (input) => {
    await createMutation.mutateAsync(input);
    setToast({
      message: `Admin user ${input.email} created successfully.`,
      type: "success",
    });
  };

  const handleEditSubmit = async (id, input) => {
    await updateMutation.mutateAsync({ id, input });
    setToast({
      message: "Admin user updated successfully.",
      type: "success",
    });
  };

  const handleConfirmSuspend = async () => {
    if (!selectedAdminForSuspend) return;
    const isSuspending = selectedAdminForSuspend.status === "active";
    try {
      await suspendMutation.mutateAsync({
        id: selectedAdminForSuspend.id,
        reactivate: !isSuspending,
      });
      setToast({
        message: `Admin user ${selectedAdminForSuspend.email} has been ${isSuspending ? "suspended" : "reactivated"}.`,
        type: "success",
      });
      setSelectedAdminForSuspend(null);
    } catch (err) {
      setToast({
        message: err?.message ?? "Failed to update admin status.",
        type: "error",
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedAdminForDelete) return;
    try {
      await deleteMutation.mutateAsync(selectedAdminForDelete.id);
      setToast({
        message: `Admin user ${selectedAdminForDelete.email} was permanently deleted.`,
        type: "success",
      });
      setSelectedAdminForDelete(null);
    } catch (err) {
      setToast({
        message: err?.message ?? "Failed to delete admin user.",
        type: "error",
      });
    }
  };

  return (
    <div className="admin-users-page">
      {/* Page Header */}
      <div className="admin-users-page__header">
        <div>
          <h1 className="admin-users-page__title">Admin Users</h1>
          <p className="admin-users-page__subtitle">
            Manage administrative personnel, assign roles, enforce onboarding
            security, and maintain team access.
          </p>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`admin-users-page__alert admin-users-page__alert--${toast.type}`}
          role="status"
        >
          <span>{toast.message}</span>
          <button
            className="admin-users-page__alert-close"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Toolbar */}
      <AdminUsersToolbar
        searchInput={searchInput}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        roleFilter={roleFilter}
        onRoleChange={handleRoleChange}
        sortBy={sortBy}
        order={order}
        onSortChange={handleSortChange}
        totalCount={data?.pagination?.total}
        isFetching={isFetching}
        onRefresh={() => refetch()}
        onCreateAdmin={() => setIsCreateModalOpen(true)}
      />

      {/* Table */}
      <AdminUsersTable
        adminUsers={data?.adminUsers ?? []}
        pagination={data?.pagination}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        sortBy={sortBy}
        order={order}
        onSortChange={handleSortChange}
        onPageChange={handlePageChange}
        onViewDetails={(a) => setSelectedAdminForDetail(a)}
        onEditAdmin={(a) => setSelectedAdminForEdit(a)}
        onToggleSuspend={(a) => setSelectedAdminForSuspend(a)}
        onDeleteAdmin={(a) => setSelectedAdminForDelete(a)}
      />

      {/* Details Modal */}
      <AdminUserDetailsModal
        admin={selectedAdminForDetail}
        isOpen={Boolean(selectedAdminForDetail)}
        onClose={() => setSelectedAdminForDetail(null)}
        onEdit={(a) => setSelectedAdminForEdit(a)}
      />

      {/* Create Modal */}
      <CreateAdminUserModal
        isOpen={isCreateModalOpen}
        isLoading={createMutation.isPending}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
      />

      {/* Edit Modal */}
      <EditAdminUserModal
        admin={selectedAdminForEdit}
        isOpen={Boolean(selectedAdminForEdit)}
        isLoading={updateMutation.isPending}
        onClose={() => setSelectedAdminForEdit(null)}
        onSubmit={handleEditSubmit}
      />

      {/* Suspend Confirmation Modal */}
      <AdminSuspendModal
        admin={selectedAdminForSuspend}
        isOpen={Boolean(selectedAdminForSuspend)}
        isLoading={suspendMutation.isPending}
        onClose={() => setSelectedAdminForSuspend(null)}
        onConfirm={handleConfirmSuspend}
      />

      {/* Delete Confirmation Modal */}
      <AdminDeleteModal
        admin={selectedAdminForDelete}
        isOpen={Boolean(selectedAdminForDelete)}
        isLoading={deleteMutation.isPending}
        onClose={() => setSelectedAdminForDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
