import { Badge, StatusBadge } from "@/components";

export function PermissionUserHeader({ data, isSelf, isOwnerUser }) {
  const { admin, isCustom, effectivePermissions } = data;
  const initials = (admin.name || admin.email).slice(0, 2).toUpperCase();

  return (
    <div className="perm-user-header">
      <div className="perm-user-header__profile">
        <div className="perm-user-header__avatar">{initials}</div>
        <div className="perm-user-header__info">
          <div className="perm-user-header__name-row">
            <h2 className="perm-user-header__name">{admin.name}</h2>
            <Badge
              variant={
                admin.role === "owner"
                  ? "accent"
                  : admin.role === "admin"
                    ? "info"
                    : "default"
              }
            >
              {admin.role.toUpperCase()}
            </Badge>
            <StatusBadge status={admin.status} />
            {isCustom ? (
              <Badge variant="warning">Custom Permissions</Badge>
            ) : (
              <Badge variant="default">Default Role Policy</Badge>
            )}
          </div>
          <div className="perm-user-header__email">{admin.email}</div>
          <div className="perm-user-header__meta">
            <span>
              {effectivePermissions.length} active permissions granted
            </span>
            <span className="perm-user-header__dot">•</span>
            <span>
              Created {new Date(admin.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {isOwnerUser && (
        <div className="perm-banner perm-banner--info" role="status">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>Owner Account:</strong> Owner administrators have immutable
            superadmin access. Permissions cannot be restricted.
          </div>
        </div>
      )}

      {isSelf && !isOwnerUser && (
        <div className="perm-banner perm-banner--warning" role="status">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <strong>Self Account:</strong> Anti-privilege escalation rules
            prevent administrators from modifying their own permissions.
          </div>
        </div>
      )}

      <div className="perm-user-header__audit-note">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>
          All permission updates are enforced in real time and logged to Audit
          Logs with actor identity and timestamp.
        </span>
      </div>
    </div>
  );
}
