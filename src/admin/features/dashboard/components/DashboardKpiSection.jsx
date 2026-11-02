import { StatCard, Skeleton, ErrorState } from "@/components";
import { formatStorageSize } from "@/utils";
import "./DashboardKpiSection.css";

function IconUsers() {
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconHardDrive() {
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
      <line x1="22" y1="12" x2="2" y2="12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="6" y1="16" x2="6.01" y2="16" />
      <line x1="10" y1="16" x2="10.01" y2="16" />
    </svg>
  );
}

function IconShare() {
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
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

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

export function DashboardKpiSection({
  data,
  isLoading,
  isError,
  error,
  onRetry,
}) {
  if (isLoading) {
    return (
      <div className="dashboard-kpi-grid" aria-label="Loading summary metrics">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card stat-card stat-card--loading">
            <div className="stat-card__header">
              <Skeleton width="45%" height={14} />
              <Skeleton
                width={32}
                height={32}
                className="stat-card__skeleton-icon"
              />
            </div>
            <Skeleton
              width="60%"
              height={32}
              className="stat-card__skeleton-val"
            />
            <Skeleton width="75%" height={12} />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Could not load summary metrics"
        message={error?.message ?? "Failed to retrieve platform summary data."}
        onRetry={onRetry}
      />
    );
  }

  const { users, referrals, storage } = data;
  const totalStorageBytes = storage?.totalBytes ?? 0;

  return (
    <div
      className="dashboard-kpi-grid"
      role="region"
      aria-label="Platform Summary KPIs"
    >
      <StatCard
        label="Total Users"
        value={users.total}
        meta="Registered platform users"
        icon={<IconUsers />}
        iconColor="accent"
      />

      <StatCard
        label="Active Users"
        value={users.active ?? 0}
        meta="Active in the last 30 days"
        icon={<IconActivity />}
        iconColor="success"
      />

      <StatCard
        label="Total Storage Used"
        value={formatStorageSize(totalStorageBytes)}
        meta="Total S3 media & recordings"
        icon={<IconHardDrive />}
        iconColor="info"
      />

      <StatCard
        label="Total Referrals"
        value={referrals?.total ?? 0}
        meta="Platform invite referrals"
        icon={<IconShare />}
        iconColor="warning"
      />
    </div>
  );
}
