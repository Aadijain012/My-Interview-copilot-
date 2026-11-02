import "./Badge.css";

export function Badge({
  variant = "default",
  dot = false,
  children,
  className = "",
}) {
  return (
    <span
      className={`badge badge--${variant}${className ? ` ${className}` : ""}`}
    >
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ── Convenience: status badge for active/suspended ── */

export function StatusBadge({ status }) {
  return (
    <Badge variant={status === "active" ? "success" : "danger"} dot>
      {status === "active" ? "Active" : "Suspended"}
    </Badge>
  );
}

/* ── Convenience: role badge ── */

const ROLE_VARIANTS = {
  owner: "accent",
  admin: "info",
  ops: "warning",
  viewer: "default",
};

export function RoleBadge({ role }) {
  return (
    <Badge variant={ROLE_VARIANTS[role]}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>
  );
}
