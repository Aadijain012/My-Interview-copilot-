import {
  Table,
  Th,
  Td,
  Pagination,
  Badge,
  StatusBadge,
  Button,
  Skeleton,
  EmptyState,
  ErrorState,
} from "@/components";
import { formatDate, formatStorageSize } from "@/utils";
import { usePermission } from "@/features/auth/rbac";
import "./UsersTable.css";

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

function getPlanBadgeVariant(planName) {
  if (planName === "Pro+") return "accent";
  if (planName === "Pro") return "info";
  return "default";
}

export function UsersTable({
  users = [],
  pagination,
  sortBy,
  order,
  onSort,
  onPageChange,
  onViewDetails,
  onToggleSuspend,
  onDeleteUser,
  isLoading,
  isError,
  error,
  onRetry,
}) {
  const canSuspend = usePermission("users:suspend");
  const canDelete = usePermission("users:delete");

  const handleHeaderSort = (column) => {
    if (!onSort) return;
    if (sortBy === column) {
      onSort(column, order === "asc" ? "desc" : "asc");
    } else {
      onSort(column, "asc");
    }
  };

  if (isLoading) {
    return (
      <div className="users-table-card" aria-busy="true">
        <Table aria-label="Loading users…">
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Plan</Th>
              <Th>Referral Code</Th>
              <Th>Credits</Th>
              <Th>AI Usage</Th>
              <Th>S3 Storage</Th>
              <Th>Last Login</Th>
              <Th>Joined Date</Th>
              <Th style={{ textAlign: "right" }}>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, idx) => (
              <tr key={idx}>
                <Td>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    <Skeleton width={32} height={32} />
                    <Skeleton width="120px" height={16} />
                  </div>
                </Td>
                <Td>
                  <Skeleton width="160px" height={16} />
                </Td>
                <Td>
                  <Skeleton width="60px" height={22} />
                </Td>
                <Td>
                  <Skeleton width="70px" height={22} />
                </Td>
                <Td>
                  <Skeleton width="80px" height={16} />
                </Td>
                <Td>
                  <Skeleton width="50px" height={16} />
                </Td>
                <Td>
                  <Skeleton width="60px" height={16} />
                </Td>
                <Td>
                  <Skeleton width="70px" height={16} />
                </Td>
                <Td>
                  <Skeleton width="90px" height={16} />
                </Td>
                <Td>
                  <Skeleton width="90px" height={16} />
                </Td>
                <Td style={{ textAlign: "right" }}>
                  <Skeleton width="110px" height={28} />
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
      <div className="users-table-card">
        <ErrorState
          title="Failed to load users"
          message={
            error?.message ??
            "An unexpected error occurred while fetching users."
          }
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="users-table-card">
        <EmptyState
          title="No users found"
          description="Try adjusting your search query or status filter."
        />
      </div>
    );
  }

  return (
    <div className="users-table-card">
      <Table aria-label="Registered Platform Users">
        <thead>
          <tr>
            <Th
              sortable
              sortDir={sortBy === "name" ? order : null}
              onSort={() => handleHeaderSort("name")}
            >
              User
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
              sortDir={sortBy === "status" ? order : null}
              onSort={() => handleHeaderSort("status")}
            >
              Status
            </Th>
            <Th>Plan</Th>
            <Th>Referral Code</Th>
            <Th
              sortable
              sortDir={sortBy === "creditBalance" ? order : null}
              onSort={() => handleHeaderSort("creditBalance")}
            >
              Credits
            </Th>
            <Th
              sortable
              sortDir={sortBy === "aiUsage" ? order : null}
              onSort={() => handleHeaderSort("aiUsage")}
            >
              AI Usage
            </Th>
            <Th
              sortable
              sortDir={sortBy === "s3Storage" ? order : null}
              onSort={() => handleHeaderSort("s3Storage")}
            >
              S3 Storage
            </Th>
            <Th
              sortable
              sortDir={sortBy === "lastLoginAt" ? order : null}
              onSort={() => handleHeaderSort("lastLoginAt")}
            >
              Last Login
            </Th>
            <Th
              sortable
              sortDir={sortBy === "createdAt" ? order : null}
              onSort={() => handleHeaderSort("createdAt")}
            >
              Joined Date
            </Th>
            <Th style={{ textAlign: "right" }}>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="users-table__row">
              <Td primary>
                <div className="users-table__user-info">
                  <div className="users-table__avatar" aria-hidden="true">
                    {(u.name?.[0] || u.email[0]).toUpperCase()}
                  </div>
                  <span className="users-table__user-name">
                    {u.name || (
                      <span className="users-table__no-name">No name</span>
                    )}
                  </span>
                </div>
              </Td>
              <Td mono>{u.email}</Td>
              <Td>
                <StatusBadge status={u.status} />
              </Td>
              <Td>
                <Badge variant={getPlanBadgeVariant(u.subscriptionPlan?.name)}>
                  {u.subscriptionPlan?.name || "Free"}
                </Badge>
              </Td>
              <Td mono>
                {u.referralCode ? (
                  <span className="users-table__ref-code">
                    {u.referralCode}
                  </span>
                ) : (
                  <span className="users-table__no-name">—</span>
                )}
              </Td>
              <Td>
                <span className="users-table__credit-badge">
                  <span className="users-table__credit-val">
                    {(u.creditBalance ?? 0).toLocaleString()}
                  </span>
                  <span className="users-table__credit-unit">cr</span>
                </span>
              </Td>
              <Td>
                <span className="users-table__usage-badge">
                  <span className="users-table__usage-val">
                    {(u.aiUsage ?? 0).toLocaleString()}
                  </span>
                  <span className="users-table__usage-unit">reqs</span>
                </span>
                {u.sessionCount !== undefined && (
                  <div className="users-table__session-count-sub">
                    {u.sessionCount} {u.sessionCount === 1 ? 'session' : 'sessions'}
                  </div>
                )}
              </Td>
              <Td>
                <span className="users-table__storage-badge">
                  <span className="users-table__storage-val">
                    {formatStorageSize(u.s3Storage)}
                  </span>
                </span>
              </Td>
              <Td>
                {u.lastLoginAt ? (
                  <span title={new Date(u.lastLoginAt).toLocaleString()}>
                    {formatDate(u.lastLoginAt, "en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                ) : (
                  <span className="users-table__no-name">Never</span>
                )}
              </Td>
              <Td>
                {formatDate(u.createdAt, "en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Td>
              <Td style={{ textAlign: "right" }}>
                <div className="users-table__actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(u)}
                    title="View user details"
                    aria-label={`View details for ${u.email}`}
                    leftIcon={<IconEye />}
                  >
                    Details
                  </Button>

                  {canSuspend && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleSuspend(u)}
                      title={
                        u.status === "active"
                          ? "Suspend user"
                          : "Reactivate user"
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

                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteUser(u)}
                      title="Permanently delete user"
                      aria-label={`Delete ${u.email}`}
                      className="users-table__btn-delete"
                      leftIcon={<IconTrash />}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {pagination && (
        <div className="users-table__pagination">
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
