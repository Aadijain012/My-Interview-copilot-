import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components";
import { formatDuration } from "@/utils";
import "./SessionOverviewSection.css";

export function SessionOverviewSection({
  data,
  isLoading,
  isError,
  error,
  onRetry,
}) {
  if (isLoading) {
    return (
      <Card className="session-overview-card">
        <CardHeader
          title="Session Overview"
          subtitle="Loading session metrics…"
        />
        <CardBody>
          <div className="session-overview-skeleton">
            <div className="session-overview-skeleton__row">
              <Skeleton width="48%" height={64} />
              <Skeleton width="48%" height={64} />
            </div>
            <Skeleton width="100%" height={24} />
            <Skeleton width="100%" height={24} />
            <Skeleton width="100%" height={24} />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="session-overview-card">
        <CardHeader title="Session Overview" />
        <CardBody>
          <ErrorState
            title="Failed to load sessions"
            message={error?.message ?? "Unable to fetch session analytics."}
            onRetry={onRetry}
          />
        </CardBody>
      </Card>
    );
  }

  const { totalInRange, avgDurationSeconds, topTechs } = data;
  const hasTechs = topTechs && topTechs.length > 0;

  return (
    <Card className="session-overview-card">
      <CardHeader
        title="Session Overview"
        subtitle="Interview copilot volume & tech distribution"
      />

      <CardBody>
        {/* Top metrics split */}
        <div className="session-overview-stats">
          <div className="session-stat-box">
            <span className="session-stat-box__label">Total in Range</span>
            <strong className="session-stat-box__value">
              {totalInRange.toLocaleString()}
            </strong>
            <span className="session-stat-box__hint">Interview sessions</span>
          </div>
          <div className="session-stat-box">
            <span className="session-stat-box__label">Avg Duration</span>
            <strong className="session-stat-box__value">
              {formatDuration(avgDurationSeconds)}
            </strong>
            <span className="session-stat-box__hint">
              Per completed session
            </span>
          </div>
        </div>

        {/* Top technologies distribution */}
        <div className="session-tech-section">
          <h4 className="session-tech-title">Top Technologies</h4>
          {!hasTechs ? (
            <EmptyState
              title="No session technologies recorded"
              description="No interview sessions have been conducted in this range."
            />
          ) : (
            <div className="session-tech-list">
              {topTechs.map((item) => {
                const percentage =
                  totalInRange > 0
                    ? Math.round((item.count / totalInRange) * 100)
                    : 0;
                return (
                  <div key={item.tech} className="session-tech-item">
                    <div className="session-tech-item__meta">
                      <span className="session-tech-item__name">
                        {item.tech || "Interview"}
                      </span>
                      <div className="session-tech-item__counts">
                        <span className="session-tech-item__pct">
                          {percentage}%
                        </span>
                        <Badge variant="default">{item.count}</Badge>
                      </div>
                    </div>
                    <div className="session-tech-bar">
                      <div
                        className="session-tech-bar__fill"
                        style={{ width: `${Math.max(percentage, 3)}%` }}
                        aria-valuenow={percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        role="progressbar"
                        aria-label={`${item.tech || "Interview"} ${percentage}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
