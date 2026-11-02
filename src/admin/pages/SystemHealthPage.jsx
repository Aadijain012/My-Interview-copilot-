import { useSystemHealth } from "@/features/system-health";
import { Button, Skeleton, ErrorState } from "@/components";
import "./SystemHealthPage.css";

export function SystemHealthPage() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useSystemHealth(30000);

  const formatUptime = (seconds) => {
    if (!seconds) return "0s";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${days > 0 ? `${days}d ` : ""}${hours}h ${minutes}m ${secs}s`;
  };

  const overallStatus = data?.status || "HEALTHY";

  return (
    <div className="health-page">
      {/* Header */}
      <div className="health-page__header">
        <div>
          <h1 className="health-page__title">System Health & Telemetry</h1>
          <p className="health-page__subtitle">
            Live diagnostic reachability and latency checks across database,
            storage, auth, and AI pipelines.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {data?.lastChecked && (
            <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
              Checked: {new Date(data.lastChecked).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Pinging..." : "Refresh Status"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <Skeleton height={80} />
          <div className="health-grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={160} />
            ))}
          </div>
        </div>
      ) : isError ? (
        <ErrorState
          title="Diagnostics Check Failed"
          message={
            error?.message || "Unable to contact platform diagnostic gateway."
          }
          onRetry={() => refetch()}
        />
      ) : (
        <>
          {/* Banner */}
          <div
            className={`health-banner health-banner--${overallStatus.toLowerCase()}`}
          >
            <div>
              <h2 className="health-banner__title">
                {`Platform Status: ${overallStatus}`}
              </h2>
              <p className="health-banner__desc">
                {overallStatus === "HEALTHY"
                  ? "All core platform components and microservices are operating normally."
                  : overallStatus === "DEGRADED"
                    ? "One or more subsystem checks reported elevated latency or reduced capabilities."
                    : "Critical platform component outage detected. Investigate immediately."}
              </p>
            </div>
            <span
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                letterSpacing: "0.05em",
              }}
            >
              {overallStatus === "HEALTHY"
                ? "● ONLINE"
                : overallStatus === "DEGRADED"
                  ? "▲ WARN"
                  : "✖ DOWN"}
            </span>
          </div>

          {/* Subsystem Cards */}
          <div className="health-grid">
            {data?.services?.map((svc) => (
              <div key={svc.service} className="health-card">
                <div className="health-card__header">
                  <h3 className="health-card__name">{svc.service}</h3>
                  <span
                    className={`health-card__badge health-card__badge--${svc.status.toLowerCase()}`}
                  >
                    {svc.status}
                  </span>
                </div>
                <div>
                  <div className="health-card__latency">
                    {`${svc.responseTimeMs} ms latency`}
                  </div>
                </div>
                <p className="health-card__message">{svc.message}</p>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#94a3b8",
                    marginTop: "auto",
                  }}
                >
                  Last probed: {new Date(svc.lastChecked).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>

          {/* Node Process Metrics */}
          {data?.system && (
            <div className="health-system-info">
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                Server Host Runtime Environment
              </h3>
              <div className="health-system-grid">
                <div className="health-system-item">
                  <span className="health-system-item__label">
                    Platform & Arch
                  </span>
                  <span className="health-system-item__value">
                    {`${data.system.platform} (${data.system.arch})`}
                  </span>
                </div>
                <div className="health-system-item">
                  <span className="health-system-item__label">
                    Node Version
                  </span>
                  <span className="health-system-item__value">
                    {data.system.nodeVersion}
                  </span>
                </div>
                <div className="health-system-item">
                  <span className="health-system-item__label">
                    Server Uptime
                  </span>
                  <span className="health-system-item__value">
                    {formatUptime(data.system.uptimeSeconds)}
                  </span>
                </div>
                <div className="health-system-item">
                  <span className="health-system-item__label">
                    Telemetry Sync
                  </span>
                  <span className="health-system-item__value">
                    Active (30s Polling)
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
