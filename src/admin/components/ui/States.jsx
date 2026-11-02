import { Button } from "./Button";
import "./States.css";

/* ── Spinner ── */

export function Spinner({ size = "md", className = "", label = "Loading…" }) {
  return (
    <span
      className={`spinner spinner--${size}${className ? ` ${className}` : ""}`}
      role="status"
      aria-label={label}
    />
  );
}

/* ── Page Loader ── */

export function PageLoader({ text = "Loading…" }) {
  return (
    <div className="page-loader">
      <Spinner size="md" />
      <span className="page-loader__text">{text}</span>
    </div>
  );
}

/* ── Skeleton ── */

export function Skeleton({
  width = "100%",
  height = 16,
  className = "",
  "aria-label": ariaLabel,
}) {
  return (
    <span
      className={`skeleton${className ? ` ${className}` : ""}`}
      style={{ width, height }}
      role="status"
      aria-label={ariaLabel ?? "Loading content"}
      aria-busy="true"
    />
  );
}

/* ── Skeleton Table Rows ── */

export function SkeletonTable({ rows = 5, columns = [40, 160, 120, 80, 60] }) {
  return (
    <div
      className="skeleton-table"
      role="status"
      aria-label="Loading table data"
    >
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="skeleton-row">
          {columns.map((w, colIdx) => (
            <Skeleton key={colIdx} width={w} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Empty State ── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}) {
  return (
    <div
      className={`empty-state${className ? ` ${className}` : ""}`}
      aria-live="polite"
    >
      {icon && (
        <div className="empty-state__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}

/* ── Error State ── */

function IconAlertCircle() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
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

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className = "",
}) {
  return (
    <div
      className={`error-state${className ? ` ${className}` : ""}`}
      role="alert"
    >
      <span className="error-state__icon">
        <IconAlertCircle />
      </span>
      <h3 className="error-state__title">{title}</h3>
      {message && <p className="error-state__message">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
