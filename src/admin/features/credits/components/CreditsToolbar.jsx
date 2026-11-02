import { Input, Select, Button } from "@/components";
import "./CreditsToolbar.css";

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

function IconDownload() {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function CreditsToolbar({
  search,
  onSearchChange,
  typeFilter,
  onTypeChange,
  total,
  onRefresh,
  onExport,
  isExporting,
}) {
  return (
    <div className="credits-toolbar">
      <div className="credits-toolbar__left">
        <Input
          placeholder="Search by user or reason..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<IconSearch />}
          aria-label="Search credits"
        />
        <Select
          value={typeFilter}
          onChange={(e) => onTypeChange(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All Types</option>
          <option value="referral_reward">Referral Reward</option>
          <option value="milestone_reward">Milestone Reward</option>
          <option value="admin_adjustment">Admin Adjustment</option>
          <option value="reversal">Reversal</option>
        </Select>
      </div>
      <div className="credits-toolbar__right">
        <span className="credits-toolbar__count">
          {total} entr{total !== 1 ? "ies" : "y"}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={onExport}
          isLoading={isExporting}
          leftIcon={<IconDownload />}
        >
          Export CSV
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          aria-label="Refresh"
        >
          ↻
        </Button>
      </div>
    </div>
  );
}
