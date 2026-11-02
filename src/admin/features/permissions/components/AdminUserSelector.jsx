import { useState, useMemo } from "react";
import { Badge, Input } from "@/components";

export function AdminUserSelector({
  users,
  selectedUserId,
  onSelectUser,
  isLoading,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase().trim();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, search]);

  return (
    <aside className="perm-selector">
      <div className="perm-selector__header">
        <h3 className="perm-selector__title">Administrators</h3>
        <span className="perm-selector__count">{users.length}</span>
      </div>

      <div className="perm-selector__search">
        <Input
          type="search"
          placeholder="Filter by name, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search administrators"
        />
      </div>

      <div
        className="perm-selector__list"
        role="listbox"
        aria-label="Administrator accounts"
      >
        {isLoading ? (
          <div className="perm-selector__loading">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="perm-selector__skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="perm-selector__empty">
            <p>No administrators found</p>
          </div>
        ) : (
          filtered.map((u) => {
            const isSelected = u.id === selectedUserId;
            const initials = (u.name || u.email).slice(0, 2).toUpperCase();

            return (
              <button
                key={u.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelectUser(u.id)}
                className={`perm-user-item ${isSelected ? "perm-user-item--active" : ""}`}
              >
                <div className="perm-user-item__avatar">{initials}</div>
                <div className="perm-user-item__body">
                  <div className="perm-user-item__top">
                    <span className="perm-user-item__name">{u.name}</span>
                    <Badge
                      variant={
                        u.role === "owner"
                          ? "accent"
                          : u.role === "admin"
                            ? "info"
                            : "default"
                      }
                    >
                      {u.role}
                    </Badge>
                  </div>
                  <div className="perm-user-item__email">{u.email}</div>
                  <div className="perm-user-item__bottom">
                    <span className="perm-user-item__meta">
                      {u.isCustom ? (
                        <span className="perm-tag perm-tag--custom">
                          Custom Policy
                        </span>
                      ) : (
                        <span className="perm-tag perm-tag--default">
                          Default Role
                        </span>
                      )}
                    </span>
                    <span className="perm-user-item__perms-count">
                      {u.permissionsCount} perms
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
