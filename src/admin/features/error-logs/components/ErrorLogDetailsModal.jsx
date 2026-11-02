import { useState } from "react";
import { Modal, Badge, Button } from "@/components";
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

function getSeverityBadgeVariant(severity) {
  switch (severity) {
    case "critical":
      return "danger";
    case "error":
      return "danger";
    case "warning":
      return "warning";
    default:
      return "default";
  }
}

export function ErrorLogDetailsModal({
  errorLog,
  isOpen,
  onClose,
  onToggleResolve,
  onUpdateStatus,
  isResolving = false,
}) {
  const [copied, setCopied] = useState(null);
  const canWrite = usePermission("error-logs:write");

  if (!errorLog) return null;

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const formattedDate = new Date(errorLog.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Error Details & Stack Trace"
      size="lg"
    >
      <div className="error-detail">
        {/* Header badges */}
        <div className="error-detail__tags">
          <Badge variant={getSeverityBadgeVariant(errorLog.severity)}>
            {errorLog.severity.toUpperCase()}
          </Badge>
          <Badge variant="default">{errorLog.source}</Badge>
          {getStatusBadge(errorLog.status, errorLog.resolved)}
          <span className="error-detail__timestamp">{formattedDate}</span>
        </div>

        {/* Error message */}
        <div className="error-detail__section">
          <div className="error-detail__section-header">
            <h4>Error Message</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(errorLog.message, "message")}
            >
              {copied === "message" ? "Copied!" : "Copy Message"}
            </Button>
          </div>
          <div className="error-detail__message-box">
            <code>{errorLog.message}</code>
          </div>
        </div>

        {/* HTTP / Context metadata */}
        <div className="error-detail__section">
          <h4>Execution Context</h4>
          <div className="error-detail__meta-grid">
            <div className="error-detail__meta-item">
              <span className="meta-label">HTTP Endpoint</span>
              <span className="meta-value">
                {errorLog.method && <strong>{errorLog.method} </strong>}
                {errorLog.endpoint || "—"}
              </span>
            </div>
            <div className="error-detail__meta-item">
              <span className="meta-label">Status Code</span>
              <span className="meta-value">
                {errorLog.statusCode ? (
                  <span
                    className={
                      errorLog.statusCode >= 500
                        ? "status-code--err"
                        : "status-code--warn"
                    }
                  >
                    {errorLog.statusCode}
                  </span>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="error-detail__meta-item">
              <span className="meta-label">User ID</span>
              <span className="meta-value">
                {errorLog.userId || "Anonymous / None"}
              </span>
            </div>
            <div className="error-detail__meta-item">
              <span className="meta-label">Admin ID</span>
              <span className="meta-value">{errorLog.adminId || "None"}</span>
            </div>
            <div className="error-detail__meta-item">
              <span className="meta-label">Error ID</span>
              <span className="meta-value meta-mono">{errorLog.id}</span>
            </div>
            <div className="error-detail__meta-item">
              <span className="meta-label">Resolution Status</span>
              <span className="meta-value">
                {errorLog.resolved ? (
                  <>
                    Resolved by {errorLog.resolvedBy || "Admin"} at{" "}
                    {new Date(errorLog.resolvedAt || "").toLocaleString()}
                  </>
                ) : (
                  "Unresolved"
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Stack Trace */}
        {errorLog.stackTrace ? (
          <div className="error-detail__section">
            <div className="error-detail__section-header">
              <h4>Stack Trace</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  copyToClipboard(errorLog.stackTrace || "", "stack")
                }
              >
                {copied === "stack" ? "Copied!" : "Copy Stack Trace"}
              </Button>
            </div>
            <pre className="error-detail__stack-box">
              <code>{errorLog.stackTrace}</code>
            </pre>
          </div>
        ) : (
          <div className="error-detail__section">
            <h4>Stack Trace</h4>
            <p className="error-detail__empty-note">
              No stack trace was recorded for this error.
            </p>
          </div>
        )}

        {/* Custom Metadata if present */}
        {errorLog.metadata && Object.keys(errorLog.metadata).length > 0 && (
          <div className="error-detail__section">
            <div className="error-detail__section-header">
              <h4>Sanitized Metadata</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(errorLog.metadata, null, 2),
                    "meta",
                  )
                }
              >
                {copied === "meta" ? "Copied!" : "Copy JSON"}
              </Button>
            </div>
            <pre className="error-detail__metadata-box">
              <code>{JSON.stringify(errorLog.metadata, null, 2)}</code>
            </pre>
          </div>
        )}

        {/* Footer Actions */}
        <div className="error-detail__footer">
          {canWrite && onUpdateStatus && (
            <>
              {errorLog.status !== "monitoring" && !errorLog.resolved && (
                <Button
                  variant="secondary"
                  onClick={() => onUpdateStatus(errorLog.id, "monitoring")}
                  disabled={isResolving}
                  title="Move error into active monitoring"
                >
                  Save &amp; Monitor
                </Button>
              )}
              {!errorLog.resolved && (
                <Button
                  variant="primary"
                  onClick={() => onUpdateStatus(errorLog.id, "resolved")}
                  disabled={isResolving}
                  title="Mark error as resolved"
                >
                  Mark Resolved
                </Button>
              )}
              {errorLog.resolved && (
                <Button
                  variant="secondary"
                  onClick={() => onUpdateStatus(errorLog.id, "open")}
                  disabled={isResolving}
                  title="Reopen error"
                >
                  Reopen
                </Button>
              )}
            </>
          )}
          {canWrite && !onUpdateStatus && onToggleResolve && (
            <Button
              variant={errorLog.resolved ? "secondary" : "primary"}
              onClick={() => onToggleResolve(errorLog.id, errorLog.resolved)}
              disabled={isResolving}
            >
              {isResolving
                ? "Updating..."
                : errorLog.resolved
                  ? "Mark as Unresolved"
                  : "Mark as Resolved"}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
