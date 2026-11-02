import { useLocation } from "react-router-dom";
import { ProfileDropdown } from "./ProfileDropdown";
import { NotificationPopover } from "./NotificationPopover";
import "./Topbar.css";

/* ── SVG icons ── */

function IconMenu() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/* ── Route → page title ── */

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/users": "Users",
  "/admin-users": "Admin Users",
  "/audit-logs": "Audit Logs",
  "/settings": "Settings",
  "/influencer/dashboard": "Creator Dashboard",
  "/influencer/referrals": "My Referrals",
  "/influencer/conversions": "My Conversions",
  "/influencer/payouts": "Payout History",
};

function getPageTitle(pathname, isPureInfluencer = false) {
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return title;
  }
  return isPureInfluencer ? "Creator Portal" : "Admin Panel";
}

/* ── Props ── */

/* ── Component ── */

export function Topbar({
  isCollapsed,
  onMenuOpen,
  adminName = "Admin",
  adminEmail = "",
  adminRole = "viewer",
  permissions,
  onLogout,
  notificationCount,
}) {
  const location = useLocation();
  const isPureInfluencer =
    adminRole === "viewer" &&
    Array.isArray(permissions) &&
    permissions.includes("influencer_dashboard:view") &&
    !permissions.includes("dashboard:read");

  const title = getPageTitle(location.pathname, isPureInfluencer);

  const displayRole = isPureInfluencer ? "Creator Partner" : adminRole;

  return (
    <header
      className={`topbar${isCollapsed ? " topbar--collapsed" : ""}`}
      role="banner"
    >
      {/* Mobile hamburger — reuses shared icon-btn class */}
      <button
        className="topbar__menu-btn icon-btn icon-btn--md"
        onClick={onMenuOpen}
        aria-label="Open navigation menu"
        type="button"
      >
        <IconMenu />
      </button>

      {/* Page title */}
      <div className="topbar__title-wrap">
        <h1 className="topbar__title">{title}</h1>
      </div>

      {/* Right actions */}
      <div className="topbar__actions" role="group" aria-label="Topbar actions">
        {/* Notification bell with desktop hover & accessible popover (admin only) */}
        {!isPureInfluencer && (
          <>
            <NotificationPopover notificationCount={notificationCount} />
            <div className="topbar__divider" aria-hidden="true" />
          </>
        )}

        {/* Profile dropdown */}
        <ProfileDropdown
          adminName={adminName}
          adminEmail={adminEmail}
          adminRole={displayRole}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
