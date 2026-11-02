import { StatCard } from "@/components";

function IconActivity() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconBug() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="8" height="14" x="8" y="6" rx="4" />
      <path d="m19 7-3 2" />
      <path d="m5 7 3 2" />
      <path d="m19 19-3-2" />
      <path d="m5 19 3-2" />
      <path d="M20 13h-4" />
      <path d="M4 13h4" />
      <path d="m10 4 1 2" />
      <path d="m14 4-1 2" />
    </svg>
  );
}

export function ErrorLogsStatsCards({
  stats,
  isLoading,
  onSelectMonitoring,
  activeStatus,
}) {
  return (
    <div className="error-logs-stats-grid">
      <StatCard
        label="Total Logged Errors"
        value={isLoading ? "..." : (stats?.totalErrors ?? 0).toLocaleString()}
        icon={<IconBug />}
        iconColor="info"
        meta="Cumulative across all services"
      />

      <StatCard
        label="Critical Failures"
        value={
          isLoading ? "..." : (stats?.criticalErrors ?? 0).toLocaleString()
        }
        icon={<IconAlertTriangle />}
        iconColor="danger"
        meta="Severe unhandled exceptions & outages"
      />

      <StatCard
        label="Unresolved Issues"
        value={
          isLoading ? "..." : (stats?.unresolvedErrors ?? 0).toLocaleString()
        }
        icon={<IconAlertCircle />}
        iconColor="warning"
        meta="Pending developer / admin resolution"
      />

      <div
        onClick={onSelectMonitoring}
        style={{ cursor: onSelectMonitoring ? "pointer" : "default" }}
        title="Click to view all monitored errors"
      >
        <StatCard
          label="Total Errors Monitoring"
          value={
            isLoading ? "..." : (stats?.monitoringErrors ?? 0).toLocaleString()
          }
          icon={<IconActivity />}
          iconColor="accent"
          meta="Actively tracked under observation"
          className={
            activeStatus === "monitoring" ? "stat-card--active-filter" : ""
          }
        />
      </div>
      <StatCard
        label="Errors Today (24h)"
        value={isLoading ? "..." : (stats?.todayErrors ?? 0).toLocaleString()}
        icon={<IconClock />}
        iconColor="accent"
        meta="Recorded since midnight"
      />
    </div>
  );
}
