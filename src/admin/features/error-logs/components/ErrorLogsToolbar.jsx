import { Button } from "@/components";
import { usePermission } from "@/features/auth/rbac";

function IconRefresh({ spinning }) {
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
      style={{ animation: spinning ? "spin 1s linear infinite" : "none" }}
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

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

export function ErrorLogsToolbar({
  search,
  onSearchChange,
  severity,
  onSeverityChange,
  source,
  onSourceChange,
  resolved,
  onResolvedChange,
  status,
  onStatusChange,
  monitoringCount,
  totalCount,
  isFetching,
  onRefresh,
  onResetFilters,
  onTriggerTestError,
}) {
  const canWrite = usePermission("error-logs:write");

  const hasActiveFilters =
    search.trim() !== "" ||
    severity !== "all" ||
    source !== "all" ||
    resolved !== "all" ||
    status !== "all";

  return (
    <div className="error-logs-toolbar">
      {/* Top row: search + source segmented tabs + actions */}
      <div className="error-logs-toolbar__top">
        {/* Search Input */}
        <div className="error-logs-search-wrapper">
          <span className="error-logs-search-icon" aria-hidden="true">
            <IconSearch />
          </span>
          <input
            type="search"
            className="error-logs-search-input"
            placeholder="Search error message, endpoint, or error code..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search error logs"
          />

          {search && (
            <button
              type="button"
              className="error-logs-search-clear"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {/* Source Filter Buttons: [ All ] [ Frontend ] [ Backend ] */}
        <div
          className="error-logs-source-filters"
          role="group"
          aria-label="Filter error logs by source"
        >
          <button
            type="button"
            className={`error-logs-source-btn ${source === "all" ? "active" : ""}`}
            onClick={() => onSourceChange("all")}
            aria-pressed={source === "all"}
          >
            All
          </button>
          <button
            type="button"
            className={`error-logs-source-btn ${source === "frontend" ? "active" : ""}`}
            onClick={() => onSourceChange("frontend")}
            aria-pressed={source === "frontend"}
          >
            Frontend
          </button>
          <button
            type="button"
            className={`error-logs-source-btn ${source === "backend" ? "active" : ""}`}
            onClick={() => onSourceChange("backend")}
            aria-pressed={source === "backend"}
          >
            Backend
          </button>
        </div>

        {/* Actions right */}
        <div className="error-logs-toolbar__actions">
          {canWrite && onTriggerTestError && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onTriggerTestError}
              title="Generate a synthetic test error to verify error-logging pipeline"
            >
              + Test Error
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            title="Refresh logs"
            aria-label="Refresh error logs"
          >
            <IconRefresh spinning={isFetching} />
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              title="Reset all filters to defaults"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Filter selects row */}
      <div className="error-logs-toolbar__filters">
        {/* Severity */}
        <div className="error-logs-filter-group">
          <label
            htmlFor="error-filter-severity"
            className="error-logs-filter-label"
          >
            Severity:
          </label>
          <select
            id="error-filter-severity"
            className="error-logs-filter-select"
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
          </select>
        </div>

        {/* Status */}
        <div className="error-logs-filter-group">
          <label
            htmlFor="error-filter-status"
            className="error-logs-filter-label"
          >
            Status:
          </label>
          <select
            id="error-filter-status"
            className="error-logs-filter-select"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="monitoring">Monitoring</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* Dedicated Monitoring button */}
        <button
          type="button"
          className={`error-logs-monitoring-btn ${status === "monitoring" ? "active" : ""}`}
          onClick={() =>
            onStatusChange(status === "monitoring" ? "all" : "monitoring")
          }
          aria-pressed={status === "monitoring"}
        >
          <span className="error-logs-monitoring-dot" aria-hidden="true" />
          Monitoring
          {monitoringCount !== undefined && monitoringCount > 0 && (
            <span className="error-logs-monitoring-badge">
              {monitoringCount}
            </span>
          )}
        </button>

        {/* Resolution State (Legacy filter) */}
        <div className="error-logs-filter-group">
          <label
            htmlFor="error-filter-resolved"
            className="error-logs-filter-label"
          >
            Resolution:
          </label>
          <select
            id="error-filter-resolved"
            className="error-logs-filter-select"
            value={resolved}
            onChange={(e) => onResolvedChange(e.target.value)}
          >
            <option value="all">All</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
          </select>
        </div>

        {/* Total count badge */}
        {totalCount !== undefined && (
          <span
            className="error-logs-total-count text-muted text-sm"
            style={{ marginLeft: "auto" }}
          >
            {totalCount.toLocaleString()}{" "}
            {totalCount === 1 ? "error" : "errors"}
          </span>
        )}
      </div>
    </div>
  );
}
