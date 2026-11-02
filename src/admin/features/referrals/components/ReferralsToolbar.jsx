import { Input, Select, Button } from "@/components";
import "./ReferralsToolbar.css";

function IconSearch() {
  return (
    <svg
      width="16"
      height="16"
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

function IconRefresh() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

export function ReferralsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  total,
  onRefresh,
}) {
  return (
    <div className="referrals-toolbar">
      <div className="referrals-toolbar__left">
        <Input
          placeholder="Search referrals..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<IconSearch />}
          aria-label="Search referrals"
        />

        <Select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>
      <div className="referrals-toolbar__right">
        <span className="referrals-toolbar__count">
          {total} referral{total !== 1 ? "s" : ""}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          aria-label="Refresh"
        >
          <IconRefresh />
        </Button>
      </div>
    </div>
  );
}
