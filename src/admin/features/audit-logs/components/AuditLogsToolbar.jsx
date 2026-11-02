import { Input, Select, Button } from "@/components";
import "./AuditLogsToolbar.css";

const COMMON_ACTIONS = [
  { value: "", label: "All Actions" },
  { value: "admin.user.created", label: "Admin Created" },
  { value: "admin.user.updated", label: "Admin Updated" },
  { value: "admin.user.suspended", label: "Admin Suspended" },
  { value: "admin.user.deleted", label: "Admin Deleted" },
  { value: "settings.updated", label: "Settings Updated" },
  { value: "user.suspended", label: "User Suspended" },
  { value: "user.deleted", label: "User Deleted" },
];

export function AuditLogsToolbar({
  actionFilter,
  onActionChange,
  actorFilter,
  onActorChange,
  targetFilter,
  onTargetChange,
  fromFilter,
  onFromChange,
  toFilter,
  onToChange,
  totalCount,
  isFetching,
  onRefresh,
  onResetFilters,
}) {
  const hasActiveFilters = Boolean(
    actionFilter || actorFilter || targetFilter || fromFilter || toFilter,
  );

  return (
    <div
      className="audit-toolbar"
      role="search"
      aria-label="Audit log search and filters"
    >
      <div className="audit-toolbar__grid">
        {/* Action Select Filter */}
        <div className="audit-toolbar__field">
          <label htmlFor="audit-filter-action" className="audit-toolbar__label">
            Action
          </label>
          <Select
            id="audit-filter-action"
            aria-label="Filter by action"
            value={actionFilter}
            onChange={(e) => onActionChange(e.target.value)}
          >
            {COMMON_ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Actor ID Filter */}
        <div className="audit-toolbar__field">
          <label htmlFor="audit-filter-actor" className="audit-toolbar__label">
            Actor ID
          </label>
          <Input
            id="audit-filter-actor"
            aria-label="Filter by actor ID"
            value={actorFilter}
            onChange={(e) => onActorChange(e.target.value)}
            placeholder="e.g. adm-1"
          />
        </div>

        {/* Target ID Filter */}
        <div className="audit-toolbar__field">
          <label htmlFor="audit-filter-target" className="audit-toolbar__label">
            Target ID
          </label>
          <Input
            id="audit-filter-target"
            aria-label="Filter by target ID"
            value={targetFilter}
            onChange={(e) => onTargetChange(e.target.value)}
            placeholder="e.g. usr-123"
          />
        </div>

        {/* Date From */}
        <div className="audit-toolbar__field">
          <label htmlFor="audit-filter-from" className="audit-toolbar__label">
            From Date
          </label>
          <Input
            id="audit-filter-from"
            type="date"
            aria-label="Filter from date"
            value={fromFilter}
            onChange={(e) => onFromChange(e.target.value)}
          />
        </div>

        {/* Date To */}
        <div className="audit-toolbar__field">
          <label htmlFor="audit-filter-to" className="audit-toolbar__label">
            To Date
          </label>
          <Input
            id="audit-filter-to"
            type="date"
            aria-label="Filter to date"
            value={toFilter}
            onChange={(e) => onToChange(e.target.value)}
          />
        </div>
      </div>

      <div className="audit-toolbar__actions">
        <div className="audit-toolbar__left">
          {totalCount !== undefined && (
            <span className="audit-toolbar__count" aria-live="polite">
              {totalCount} {totalCount === 1 ? "event" : "events"} recorded
            </span>
          )}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onResetFilters}>
              Clear Filters
            </Button>
          )}
        </div>

        <div className="audit-toolbar__right">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            isLoading={isFetching}
            leftIcon={
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
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            }
          >
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
