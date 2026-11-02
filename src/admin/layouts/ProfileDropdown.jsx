import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "@/providers/useTheme";
import { ChangePasswordModal } from "./ChangePasswordModal";
import "./ProfileDropdown.css";

/* ── SVG icons ── */

function IconChevronDown() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function IconKey() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}
function IconLogOut() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function IconSun() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function IconMonitor() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

/* ── Helper ── */

function getInitials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/* ── Props ── */

/* ── Component ── */

export function ProfileDropdown({
  adminName,
  adminEmail = "",
  adminRole,
  onLogout,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const wrapRef = useRef(null);
  const { theme, setTheme } = useTheme();
  const initials = getInitials(adminName);

  const close = useCallback(() => setIsOpen(false), []);

  // Close on outside click / Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) close();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, close]);

  const THEMES = [
    { id: "light", icon: <IconSun />, label: "Light theme" },
    { id: "dark", icon: <IconMoon />, label: "Dark theme" },
    { id: "system", icon: <IconMonitor />, label: "System theme" },
  ];

  const handleMenuAction = (action) => {
    action?.();
    close();
  };

  return (
    <div className="profile-dropdown-wrap" ref={wrapRef}>
      {/* Trigger */}
      <button
        className={`profile-trigger${isOpen ? " profile-trigger--open" : ""}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Account menu for ${adminName}`}
        type="button"
      >
        <div className="profile-trigger__avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="profile-trigger__info">
          <span className="profile-trigger__name">{adminName}</span>
          <span className="profile-trigger__role">{adminRole}</span>
        </div>
        <span className="profile-trigger__chevron" aria-hidden="true">
          <IconChevronDown />
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="profile-menu" role="menu" aria-label="Account options">
          {/* Identity header */}
          <div className="profile-menu__header">
            <div className="profile-menu__avatar-lg" aria-hidden="true">
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="profile-menu__name">{adminName}</div>
              {adminEmail && (
                <div className="profile-menu__email">{adminEmail}</div>
              )}
            </div>
          </div>

          {/* Account section */}
          <div className="profile-menu__section">
            <button
              className="profile-menu__item"
              role="menuitem"
              onClick={() => {
                close();
                setIsChangePasswordOpen(true);
              }}
              type="button"
            >
              <span className="profile-menu__item-icon">
                <IconKey />
              </span>
              Change Password
            </button>
          </div>

          <div className="profile-menu__divider" role="separator" />

          {/* Theme section */}
          <div className="profile-menu__section">
            <div className="profile-menu__item" style={{ cursor: "default" }}>
              <span className="profile-menu__item-icon" aria-hidden="true">
                <IconSun />
              </span>
              Theme
              <div
                className="profile-menu__item-right theme-selector"
                role="group"
                aria-label="Select theme"
              >
                {THEMES.map(({ id, icon, label }) => (
                  <button
                    key={id}
                    className={`theme-option${theme === id ? " theme-option--active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTheme(id);
                    }}
                    aria-label={label}
                    aria-pressed={theme === id}
                    title={label}
                    type="button"
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="profile-menu__divider" role="separator" />

          {/* Logout */}
          <div className="profile-menu__section">
            <button
              className="profile-menu__item profile-menu__item--danger"
              role="menuitem"
              onClick={() => handleMenuAction(onLogout)}
              type="button"
            >
              <span className="profile-menu__item-icon">
                <IconLogOut />
              </span>
              Sign out
            </button>
          </div>
        </div>
      )}

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}
