import { Input, Select, Button } from "@/components";
import { usePermission } from "@/features/auth/rbac";
import "./UsersToolbar.css";

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
      className={isSpinning ? "users-toolbar__spin" : undefined}
      aria-hidden="true"
    >
      <path d="M23 4v6h-6" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function IconDownload() {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function UsersToolbar({
  searchInput,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortBy,
  order,
  onSortChange,
  totalUsers,
  isFetching,
  onRefresh,
  onExport,
  isExporting,
}) {
  const canExport = usePermission("users:export");

  return (
    <div
      className="users-toolbar"
      role="search"
      aria-label="User search and filters"
    >
      <div className="users-toolbar__left">
        <div className="users-toolbar__search">
          <Input
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            leftIcon={<IconSearch />}
            aria-label="Search users"
          />
        </div>

        <div className="users-toolbar__filter">
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

        <div className="users-toolbar__sort">
          <Select
            value={`${sortBy}_${order}`}
            onChange={(e) => {
              const [sb, ord] = e.target.value.split("_");
              onSortChange(sb, ord);
            }}
            aria-label="Sort users"
          >
            <option value="createdAt_desc">Newest First</option>
            <option value="createdAt_asc">Oldest First</option>
            <option value="lastLoginAt_desc">Last Login (Recent First)</option>
            <option value="lastLoginAt_asc">Last Login (Oldest First)</option>
            <option value="aiUsage_desc">AI Usage (High–Low)</option>
            <option value="aiUsage_asc">AI Usage (Low–High)</option>
            <option value="s3Storage_desc">S3 Storage (High–Low)</option>
            <option value="s3Storage_asc">S3 Storage (Low–High)</option>
            <option value="creditBalance_desc">Credits (High–Low)</option>
            <option value="creditBalance_asc">Credits (Low–High)</option>
            <option value="email_asc">Email (A–Z)</option>
            <option value="email_desc">Email (Z–A)</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
          </Select>
        </div>
      </div>

      <div className="users-toolbar__right">
        {totalUsers !== undefined && (
          <span className="users-toolbar__count">
            {totalUsers.toLocaleString()} {totalUsers === 1 ? "user" : "users"}
          </span>
        )}

        <Button
          variant="secondary"
          size="md"
          onClick={onRefresh}
          disabled={isFetching}
          leftIcon={<IconRefresh isSpinning={isFetching} />}
          aria-label="Refresh user list"
        >
          Refresh
        </Button>

        {canExport && (
          <Button
            variant="secondary"
            size="md"
            onClick={onExport}
            isLoading={isExporting}
            leftIcon={<IconDownload />}
            aria-label="Export users to CSV"
          >
            Export CSV
          </Button>
        )}
      </div>
    </div>
  );
}
