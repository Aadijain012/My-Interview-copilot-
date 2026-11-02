import {
  Table,
  Th,
  Td,
  Pagination,
  Badge,
  Button,
  SkeletonTable,
  EmptyState,
} from "@/components";
import { usePermission } from "@/features/auth/rbac";

function getStatusBadge(status, resolved) {
  const currentStatus = status || (resolved ? "resolved" : "open");
  switch (currentStatus) {
    case "resolved":
      return <Badge variant="success">Resolved</Badge>;
    case "monitoring":
      return <Badge variant="accent">Monitoring</Badge>;
    case "open":
    default:
      return <Badge variant="warning">Open</Badge>;
  }
}

function getSeverityBadge(severity) {
  switch (severity?.toLowerCase()) {
    case "critical":
      return <Badge variant="danger">CRITICAL</Badge>;
    case "error":
      return <Badge variant="danger">ERROR</Badge>;
    case "warning":
      return <Badge variant="warning">WARNING</Badge>;
    default:
      return (
        <Badge variant="default">{severity?.toUpperCase() || "UNKNOWN"}</Badge>
      );
  }
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return diffSec <= 5 ? "just now" : `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ErrorLogsTable({
  logs,
  pagination,
  isLoading,
  onPageChange,
  onSelectLog,
  onToggleResolve,
  onUpdateStatus,
  resolvingId,
}) {
  const canWrite = usePermission("error-logs:write");

  if (isLoading) {
    return <SkeletonTable rows={10} />;
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        title="No error logs found"
        description="No system or product errors match your selected filters. Either everything is running smoothly, or try loosening the filters."
      />
    );
  }

  return (
    <div className="error-logs-table-wrapper">
      <Table>
        <thead>
          <tr>
            <Th>Timestamp</Th>
            <Th>Severity</Th>
            <Th>Source</Th>
            <Th>Endpoint / Origin</Th>
            <Th>Message</Th>
            <Th>Status</Th>
            <Th style={{ textAlign: "right" }}>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const isItemResolving = resolvingId === log.id;
            const currentStatus =
              log.status || (log.resolved ? "resolved" : "open");
            return (
              <tr
                key={log.id}
                className={
                  log.severity === "critical" ? "row--critical" : undefined
                }
              >
                {/* Timestamp */}
                <Td style={{ whiteSpace: "nowrap" }}>
                  <div className="error-time-cell">
                    <span className="error-time-rel">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                    <span className="error-time-abs">
                      {new Date(log.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </Td>

                {/* Severity */}
                <Td>{getSeverityBadge(log.severity)}</Td>

                {/* Source */}
                <Td>
                  <span className="error-source-badge">{log.source}</span>
                </Td>

                {/* Endpoint */}
                <Td>
                  {log.endpoint ? (
                    <div className="error-endpoint-cell">
                      {log.method && (
                        <span className="error-method">{log.method}</span>
                      )}
                      <span className="error-endpoint" title={log.endpoint}>
                        {log.endpoint}
                      </span>
                      {log.statusCode && (
                        <span className="error-status-tag">
                          {log.statusCode}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>

                {/* Message preview */}
                <Td>
                  <div
                    className="error-message-cell"
                    onClick={() => onSelectLog(log)}
                    title="Click to view full details"
                  >
                    <span className="error-message-text">{log.message}</span>
                  </div>
                </Td>

                {/* Status */}
                <Td>{getStatusBadge(log.status, log.resolved)}</Td>

                {/* Actions */}
                <Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <div className="error-actions-group">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectLog(log)}
                    >
                      View
                    </Button>
                    {canWrite && onUpdateStatus && (
                      <>
                        {currentStatus !== "monitoring" &&
                          currentStatus !== "resolved" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isItemResolving}
                              onClick={() =>
                                onUpdateStatus(log.id, "monitoring")
                              }
                              title="Set error to monitoring state"
                            >
                              Save &amp; Monitor
                            </Button>
                          )}
                        {currentStatus !== "resolved" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isItemResolving}
                            onClick={() => onUpdateStatus(log.id, "resolved")}
                            title="Mark error as resolved"
                          >
                            Mark Resolved
                          </Button>
                        )}
                        {currentStatus === "resolved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isItemResolving}
                            onClick={() => onUpdateStatus(log.id, "open")}
                            title="Reopen error"
                          >
                            Reopen
                          </Button>
                        )}
                      </>
                    )}
                    {canWrite && !onUpdateStatus && onToggleResolve && (
                      <Button
                        variant={log.resolved ? "ghost" : "secondary"}
                        size="sm"
                        disabled={isItemResolving}
                        onClick={() => onToggleResolve(log.id, log.resolved)}
                        title={
                          log.resolved ? "Reopen error" : "Mark as resolved"
                        }
                      >
                        {isItemResolving
                          ? "..."
                          : log.resolved
                            ? "Reopen"
                            : "Resolve"}
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {pagination && (
        <div
          style={{
            padding: "var(--sp-3) var(--sp-4)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
