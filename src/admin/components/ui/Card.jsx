import "./Card.css";

/* ── Card ── */

export function Card({
  variant = "default",
  className = "",
  children,
  onClick,
  tabIndex,
  "aria-label": ariaLabel,
}) {
  const cls = ["card", variant !== "default" && `card--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  if (onClick) {
    return (
      <div
        className={cls}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        role="button"
        tabIndex={tabIndex ?? 0}
        aria-label={ariaLabel}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={cls} aria-label={ariaLabel}>
      {children}
    </div>
  );
}

/* ── Card sub-sections ── */

export function CardHeader({ title, subtitle, actions, className = "" }) {
  return (
    <div className={`card__header${className ? ` ${className}` : ""}`}>
      <div>
        <div className="card__title">{title}</div>
        {subtitle && <div className="card__subtitle">{subtitle}</div>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}

export function CardBody({ flush = false, className = "", children }) {
  return (
    <div
      className={`card__body${flush ? " card__body--flush" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children }) {
  return (
    <div className={`card__footer${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

/* ── Stat Card ── */

export function StatCard({
  label,
  value,
  meta,
  icon,
  iconColor = "accent",
  className = "",
}) {
  return (
    <div className={`card stat-card${className ? ` ${className}` : ""}`}>
      <div className="stat-card__header">
        <div className="stat-card__label">{label}</div>
        {icon && (
          <div
            className={`stat-card__icon stat-card__icon--${iconColor}`}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
      <div className="stat-card__value">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {meta && <div className="stat-card__meta">{meta}</div>}
    </div>
  );
}
