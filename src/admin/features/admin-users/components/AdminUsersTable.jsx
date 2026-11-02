import {
  Table,
  Th,
  Td,
  Pagination,
  RoleBadge,
  StatusBadge,
  Button,
  Skeleton,
  EmptyState,
  ErrorState,
} from "@/components";
import { formatDate } from "@/utils";
import { useAuth } from "@/features/auth/useAuth";
import { usePermission, ROLE_RANK } from "@/features/auth/rbac";
import { OnboardingBadge } from "./OnboardingBadge";
import "./AdminUsersTable.css";

function IconEye() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconUserX() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="18" y1="8" x2="23" y2="13" />
      <line x1="23" y1="8" x2="18" y2="13" />
    </svg>
  );
}

function IconUserCheck() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function AdminUsersTable({
  adminUsers,
  pagination,
  isLoading,
  isError,
  error,
  onRetry,
  sortBy,
  order,
  onSortChange,
  onPageChange,
  onViewDetails,
  onEditAdmin,
  onToggleSuspend,
  onDeleteAdmin,
}) {
  const { admin: currentAdmin } = useAuth();
  const actorRole = currentAdmin?.role ?? "viewer";

  const canUpdate = usePermission("admin-users:update");
  const canSuspend = usePermission("admin-users:suspend");
  const canDelete = usePermission("admin-users:delete");

  const handleHeaderSort = (column) => {
    if (sortBy === column) {
      onSortChange(column, order === "asc" ? "desc" : "asc");
    } else {
      onSortChange(column, "asc");
    }
  };

  if (isLoading) {
    return (
      <div
        className="admin-table-card"
        aria-busy="true"
        aria-label="Loading admin users"
      >
        <Table aria-label="Admin users loading">
          <thead>
            <tr>
              <Th>Admin</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Onboarding</Th>
              <Th>Created</Th>
              <Th style={{ textAlign: "right" }}>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td>
                  <Skeleton width="120px" height="20px" />
                </Td>
                <Td>
                  <Skeleton width="160px" height="20px" />
                </Td>
                <Td>
                  <Skeleton width="70px" height="20px" />
                </Td>
                <Td>
                  <Skeleton width="70px" height="20px" />
                </Td>
                <Td>
                  <Skeleton width="100px" height="20px" />
                </Td>
                <Td>
                  <Skeleton width="90px" height="20px" />
                </Td>
                <Td style={{ textAlign: "right" }}>
                  <Skeleton width="120px" height="28px" />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="admin-table-card">
        <ErrorState
          title="Failed to load admin users"
          message={
            error?.message ??
            "An unexpected error occurred while fetching admin users."
          }
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (adminUsers.length === 0) {
    return (
      <div className="admin-table-card">
        <EmptyState
          title="No admin users found"
          description="Try adjusting your search query, role filter, or status filter."
        />
      </div>
    );
  }

  return (
    <div className="admin-table-card">
      <Table aria-label="Internal Administration Team">
        <thead>
          <tr>
            <Th
              sortable
              sortDir={sortBy === "name" ? order : null}
              onSort={() => handleHeaderSort("name")}
            >
              Admin
            </Th>
            <Th
              sortable
              sortDir={sortBy === "email" ? order : null}
              onSort={() => handleHeaderSort("email")}
            >
              Email
            </Th>
            <Th
              sortable
              sortDir={sortBy === "role" ? order : null}
              onSort={() => handleHeaderSort("role")}
            >
              Role
            </Th>
            <Th
              sortable
              sortDir={sortBy === "status" ? order : null}
              onSort={() => handleHeaderSort("status")}
            >
              Status
            </Th>
            <Th>Security / Onboarding</Th>
            <Th
              sortable
              sortDir={sortBy === "createdAt" ? order : null}
              onSort={() => handleHeaderSort("createdAt")}
            >
              Created Date
            </Th>
            <Th style={{ textAlign: "right" }}>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {adminUsers.map((u) => {
            const isHigherRank = ROLE_RANK[actorRole] < ROLE_RANK[u.role];
            const isSelf = currentAdmin?.id === u.id;

            return (
              <tr key={u.id} className="admin-table__row">
                <Td primary>
                  <div className="admin-table__user-info">
                    <div className="admin-table__avatar" aria-hidden="true">
                      {(u.name?.[0] || u.email[0]).toUpperCase()}
                    </div>
                    <span className="admin-table__user-name">
                      {u.name || (
                        <span className="admin-table__no-name">No name</span>
                      )}
                      {isSelf && (
                        <span className="admin-table__self-tag">(You)</span>
                      )}
                    </span>
                  </div>
                </Td>
                <Td mono>{u.email}</Td>
                <Td>
                  <RoleBadge role={u.role} />
                </Td>
                <Td>
                  <StatusBadge status={u.status} />
                </Td>
                <Td>
                  <OnboardingBadge
                    mustChangePassword={u.mustChangePassword}
                    totpEnabled={u.totpEnabled}
                  />
                </Td>
                <Td>
                  {formatDate(u.createdAt, "en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Td>
                <Td style={{ textAlign: "right" }}>
                  <div className="admin-table__actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(u)}
                      title="View admin details"
                      aria-label={`View details for ${u.email}`}
                      leftIcon={<IconEye />}
                    >
                      Details
                    </Button>

                    {canUpdate && !isHigherRank && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditAdmin(u)}
                        title="Edit admin profile or role"
                        aria-label={`Edit ${u.email}`}
                        leftIcon={<IconEdit />}
                      >
                        Edit
                      </Button>
                    )}

                    {canSuspend && !isHigherRank && !isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleSuspend(u)}
                        title={
                          u.status === "active"
                            ? "Suspend admin"
                            : "Reactivate admin"
                        }
                        aria-label={`${u.status === "active" ? "Suspend" : "Reactivate"} ${u.email}`}
                        leftIcon={
                          u.status === "active" ? (
                            <IconUserX />
                          ) : (
                            <IconUserCheck />
                          )
                        }
                      >
                        {u.status === "active" ? "Suspend" : "Reactivate"}
                      </Button>
                    )}

                    {canDelete && !isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteAdmin(u)}
                        title="Permanently delete admin"
                        aria-label={`Delete ${u.email}`}
                        className="admin-table__btn-delete"
                        leftIcon={<IconTrash />}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {pagination && (
        <div className="admin-table__pagination">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
