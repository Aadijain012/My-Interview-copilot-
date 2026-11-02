import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components";
import { formatRelativeTime, formatDateTime } from "@/utils";
import "./RecentActivitySection.css";

function getActionBadgeVariant(action) {
  const lower = action.toLowerCase();
  if (
    lower.includes("delete") ||
    lower.includes("suspend") ||
    lower.includes("fail")
  ) {
    return "danger";
  }
  if (
    lower.includes("create") ||
    lower.includes("confirm") ||
    lower.includes("success")
  ) {
    return "success";
  }
  if (
    lower.includes("update") ||
    lower.includes("change") ||
    lower.includes("warning")
  ) {
    return "warning";
  }
  if (lower.includes("login") || lower.includes("auth")) {
    return "accent";
  }
  return "info";
}

function formatActionTitle(action) {
  // Convert dotted strings like "admin.user.created" to "Admin User Created"
  return action
    .split(/[._-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function RecentActivitySection({
  data,
  isLoading,
  isError,
  error,
  onRetry,
}) {
  if (isLoading) {
    return (
      <Card className="recent-activity-card">
        <CardHeader
          title="Recent Platform Activity"
          subtitle="Loading audit feed…"
        />
        <CardBody>
          <div className="activity-list-skeleton">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="activity-item-skeleton">
                <Skeleton
                  width={12}
                  height={12}
                  className="activity-item-skeleton__dot"
                />
                <div style={{ flex: 1 }}>
                  <Skeleton width="40%" height={14} />
                  <div style={{ marginTop: 4 }}>
                    <Skeleton width="70%" height={12} />
                  </div>
                </div>
                <Skeleton width={60} height={12} />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="recent-activity-card">
        <CardHeader title="Recent Platform Activity" />
        <CardBody>
          <ErrorState
            title="Failed to load recent activity"
            message={error?.message ?? "Unable to retrieve audit events."}
            onRetry={onRetry}
          />
        </CardBody>
      </Card>
    );
  }

  const hasEvents = data && data.length > 0;

  return (
    <Card className="recent-activity-card">
      <CardHeader
        title="Recent Platform Activity"
        subtitle="Latest audit log events across the application"
      />

      <CardBody flush>
        {!hasEvents ? (
          <EmptyState
            title="No recent activity recorded"
            description="Audit events will appear here as users and admins interact with the system."
          />
        ) : (
          <ul
            className="activity-list"
            role="feed"
            aria-label="Recent activity events"
          >
            {(data || []).slice(0, 10).map((item) => {
              const badgeVariant = getActionBadgeVariant(item.action);
              const actionLabel = formatActionTitle(item.action);
              const metaEntries = Object.entries(item.metadata || {})
                .filter(
                  ([k, v]) =>
                    v !== undefined &&
                    v !== null &&
                    k !== "password" &&
                    k !== "passwordHash",
                )
                .slice(0, 3);

              return (
                <li key={item.id} className="activity-item" tabIndex={0}>
                  <div className="activity-item__indicator">
                    <span
                      className={`activity-item__dot activity-item__dot--${badgeVariant}`}
                    />
                  </div>
                  <div className="activity-item__main">
                    <div className="activity-item__header">
                      <span className="activity-item__title">
                        {actionLabel}
                      </span>
                      <Badge variant={badgeVariant}>{item.action}</Badge>
                    </div>

                    <div className="activity-item__details">
                      {(item.actorName || item.actorId) && (
                        <span className="activity-item__tag">
                          Actor:{" "}
                          <strong>{item.actorName || item.actorId}</strong>
                        </span>
                      )}
                      {item.sessionId && (
                        <span className="activity-item__tag">
                          Session: <code>{item.sessionId}</code>
                        </span>
                      )}
                      {metaEntries.map(([k, v]) => (
                        <span key={k} className="activity-item__tag">
                          {k}:{" "}
                          <code>
                            {typeof v === "object"
                              ? JSON.stringify(v)
                              : String(v)}
                          </code>
                        </span>
                      ))}
                    </div>
                  </div>

                  <time
                    dateTime={item.createdAt}
                    title={formatDateTime(item.createdAt)}
                    className="activity-item__time"
                  >
                    {formatRelativeTime(item.createdAt)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
