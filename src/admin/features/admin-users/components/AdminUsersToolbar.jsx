import { Input, Select, Button } from "@/components";
import { usePermission } from "@/features/auth/rbac";
import "./AdminUsersToolbar.css";

function IconSearch() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconRefresh({ isSpinning }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={isSpinning ? "admin-toolbar__spin" : undefined}
      aria-hidden="true"
    >
      <path d="M23 4v6h-6" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function AdminUsersToolbar({
  searchInput,
  onSearchChange,
  statusFilter,
  onStatusChange,
  roleFilter,
  onRoleChange,
  sortBy,
  order,
  onSortChange,
  totalCount,
  isFetching,
  onRefresh,
  onCreateAdmin,
}) {
  const canCreate = usePermission("admin-users:create");

  return (
    <div
      className="admin-toolbar"
      role="search"
      aria-label="Admin user search and filters"
    >
      <div className="admin-toolbar__left">
        <div className="admin-toolbar__search">
          <Input
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            leftIcon={<IconSearch />}
            aria-label="Search admin users"
          />
        </div>

        <div className="admin-toolbar__filter">
          <Select
            value={roleFilter}
            onChange={(e) => onRoleChange(e.target.value)}
            aria-label="Filter by role"
          >
            <option value="">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="ops">Ops</option>
            <option value="viewer">Viewer</option>
          </Select>
        </div>

        <div className="admin-toolbar__filter">
          <Select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>

        <div className="admin-toolbar__sort">
          <Select
            value={`${sortBy}_${order}`}
            onChange={(e) => {
              const [sb, ord] = e.target.value.split("_");
              onSortChange(sb, ord);
            }}
            aria-label="Sort admin users"
          >
            <option value="createdAt_desc">Newest First</option>
            <option value="createdAt_asc">Oldest First</option>
            <option value="email_asc">Email (A–Z)</option>
            <option value="email_desc">Email (Z–A)</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="role_desc">Role (Highest)</option>
            <option value="role_asc">Role (Lowest)</option>
          </Select>
        </div>
      </div>

      <div className="admin-toolbar__right">
        {totalCount !== undefined && (
          <span className="admin-toolbar__count">
            {totalCount.toLocaleString()}{" "}
            {totalCount === 1 ? "admin" : "admins"}
          </span>
        )}

        <Button
          variant="secondary"
          size="md"
          onClick={onRefresh}
          disabled={isFetching}
          leftIcon={<IconRefresh isSpinning={isFetching} />}
          aria-label="Refresh admin users"
        >
          Refresh
        </Button>

        {canCreate && (
          <Button
            variant="primary"
            size="md"
            onClick={onCreateAdmin}
            leftIcon={<IconPlus />}
            aria-label="Create new admin user"
          >
            Create Admin
          </Button>
        )}
      </div>
    </div>
  );
}
