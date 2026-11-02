import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "@/hooks";
import {
  useUsers,
  useSuspendUser,
  useDeleteUser,
  useExportUsers,
  UsersToolbar,
  UsersTable,
  UserDetailsModal,
  UserSuspendModal,
  UserDeleteModal,
} from "@/features/users";
import "./UsersPage.css";

export function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL parameters
  const initialSearch = searchParams.get("search") ?? "";
  const initialStatus = searchParams.get("status") || "";
  const initialPage = Math.max(
    1,
    parseInt(searchParams.get("page") || "1", 10),
  );
  const initialSortBy = searchParams.get("sortBy") || "createdAt";
  const initialOrder = searchParams.get("order") || "desc";

  const [searchInput, setSearchInput] = useState(initialSearch);
  const debouncedSearch = useDebounce(searchInput, 300);

  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [page, setPage] = useState(initialPage);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [order, setOrder] = useState(initialOrder);

  // Notification message banner
  const [toast, setToast] = useState(null);

  // Modals state
  const [selectedUserForDetail, setSelectedUserForDetail] = useState(null);
  const [selectedUserForSuspend, setSelectedUserForSuspend] = useState(null);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState(null);

  // Build query parameters
  const queryParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: statusFilter || undefined,
      page,
      limit: 10,
      sortBy,
      order,
    }),
    [debouncedSearch, statusFilter, page, sortBy, order],
  );

  // Sync to URL
  const updateUrl = useCallback(
    (newSearch, newStatus, newPage, newSortBy, newOrder) => {
      const next = new URLSearchParams();
      if (newSearch.trim()) next.set("search", newSearch.trim());
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
    useUsers(queryParams);

  // Mutations
  const suspendMutation = useSuspendUser();
  const deleteMutation = useDeleteUser();
  const exportMutation = useExportUsers();

  const handleSearchChange = (val) => {
    setSearchInput(val);
    setPage(1);
    updateUrl(val, statusFilter, 1, sortBy, order);
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    setPage(1);
    updateUrl(searchInput, val, 1, sortBy, order);
  };

  const handleSortChange = (newSortBy, newOrder) => {
    setSortBy(newSortBy);
    setOrder(newOrder);
    setPage(1);
    updateUrl(searchInput, statusFilter, 1, newSortBy, newOrder);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    updateUrl(searchInput, statusFilter, newPage, sortBy, order);
  };

  const handleConfirmSuspend = async () => {
    if (!selectedUserForSuspend) return;
    const isSuspending = selectedUserForSuspend.status === "active";
    try {
      await suspendMutation.mutateAsync({
        id: selectedUserForSuspend.id,
        reactivate: !isSuspending,
      });
      setToast({
        message: `User ${selectedUserForSuspend.email} has been ${isSuspending ? "suspended" : "reactivated"}.`,
        type: "success",
      });
      setSelectedUserForSuspend(null);
    } catch (err) {
      setToast({
        message: err?.message ?? "Failed to update user status.",
        type: "error",
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedUserForDelete) return;
    try {
      await deleteMutation.mutateAsync(selectedUserForDelete.id);
      setToast({
        message: `User ${selectedUserForDelete.email} was permanently deleted.`,
        type: "success",
      });
      setSelectedUserForDelete(null);
    } catch (err) {
      setToast({
        message: err?.message ?? "Failed to delete user.",
        type: "error",
      });
    }
  };

  const handleExportCsv = async () => {
    try {
      await exportMutation.mutateAsync({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
      });
      setToast({
        message: "Users CSV exported successfully.",
        type: "success",
      });
    } catch (err) {
      setToast({
        message: err?.message ?? "Failed to export CSV.",
        type: "error",
      });
    }
  };

  return (
    <div className="users-page">
      {/* Header */}
      <div className="users-page__header">
        <div>
          <h1 className="users-page__title">Platform Users</h1>
          <p className="users-page__subtitle">
            Manage registered candidates, account statuses, and review session
            telemetry.
          </p>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`users-page__alert users-page__alert--${toast.type}`}
          role="status"
        >
          <span>{toast.message}</span>
          <button
            className="users-page__alert-close"
            onClick={() => setToast(null)}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* Toolbar */}
      <UsersToolbar
        searchInput={searchInput}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        sortBy={sortBy}
        order={order}
        onSortChange={handleSortChange}
        totalUsers={data?.pagination?.total}
        isFetching={isFetching}
        onRefresh={() => refetch()}
        onExport={handleExportCsv}
        isExporting={exportMutation.isPending}
      />

      {/* Table */}
      <UsersTable
        users={data?.users ?? []}
        pagination={data?.pagination}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        sortBy={sortBy}
        order={order}
        onSortChange={handleSortChange}
        onPageChange={handlePageChange}
        onViewDetails={(u) => setSelectedUserForDetail(u)}
        onToggleSuspend={(u) => setSelectedUserForSuspend(u)}
        onDeleteUser={(u) => setSelectedUserForDelete(u)}
      />

      {/* Details Modal */}
      <UserDetailsModal
        user={selectedUserForDetail}
        isOpen={Boolean(selectedUserForDetail)}
        onClose={() => setSelectedUserForDetail(null)}
        onToggleSuspend={(u) => setSelectedUserForSuspend(u)}
        onDeleteUser={(u) => setSelectedUserForDelete(u)}
      />

      {/* Suspend Confirmation Modal */}
      <UserSuspendModal
        user={selectedUserForSuspend}
        isOpen={Boolean(selectedUserForSuspend)}
        isLoading={suspendMutation.isPending}
        onClose={() => setSelectedUserForSuspend(null)}
        onConfirm={handleConfirmSuspend}
      />

      {/* Delete Confirmation Modal */}
      <UserDeleteModal
        user={selectedUserForDelete}
        isOpen={Boolean(selectedUserForDelete)}
        isLoading={deleteMutation.isPending}
        onClose={() => setSelectedUserForDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
