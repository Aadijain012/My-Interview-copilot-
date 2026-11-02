import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ROLE_RANK, hasPermission } from "@/features/auth/rbac";
import { useIssueStats } from "@/features/issues/hooks/useIssues";
import "./Sidebar.css";

/* ── SVG icon primitives (inline, no library dependency) ── */

function IconDashboard() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconAdminUsers() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconAuditLogs() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconAlertOctagon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconGift() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function IconMegaphone() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 11l18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconCoins() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" />
      <path d="M18.09 10.37A7 7 0 1 1 10.37 18.09" />
      <line x1="8" y1="5" x2="8" y2="11" />
      <line x1="5" y1="8" x2="11" y2="8" />
    </svg>
  );
}

function IconDesktop() {
  return (
    <svg
      width="18"
      height="18"
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

function IconSubscriptions() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </svg>
  );
}

function IconChevronLeft() {
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
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight() {
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
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconShieldLock() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconHeartPulse() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function IconSupport() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/* ── Nav item definition ── */

const NAV_ITEMS = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: <IconDashboard />,
    permission: "dashboard:read",
  },
  {
    label: "Users",
    to: "/users",
    icon: <IconUsers />,
    permission: "users:read",
  },
  {
    label: "Issues & Reports",
    to: "/issues",
    icon: <IconSupport />,
    permission: "issues:read",
  },
  {
    label: "AI Analytics",
    to: "/analytics",
    icon: <IconActivity />,
    permission: "analytics:read",
  },
  {
    label: "System Health",
    to: "/system-health",
    icon: <IconHeartPulse />,
    permission: "system-health:read",
  },
  {
    label: "Admin Users",
    to: "/admin-users",
    icon: <IconAdminUsers />,
    permission: "admin-users:read",
    minRole: "admin",
  },
  {
    label: "Permissions",
    to: "/permissions",
    icon: <IconShieldLock />,
    permission: "permissions:read",
    minRole: "owner",
  },
  {
    label: "Error Logs",
    to: "/error-logs",
    icon: <IconAlertOctagon />,
    permission: "error-logs:read",
  },
  {
    label: "Audit Logs",
    to: "/audit-logs",
    icon: <IconAuditLogs />,
    permission: "audit-logs:read",
  },
  {
    label: "Subscriptions & Plans",
    to: "/subscriptions",
    icon: <IconSubscriptions />,
    permission: "settings:read",
  },
  {
    label: "Subscription Offers",
    to: "/offers",
    icon: <IconMegaphone />,
    permission: "offers:read",
  },
  {
    label: "Desktop App (EXE)",
    to: "/desktop-app",
    icon: <IconDesktop />,
    permission: "settings:read",
  },
  {
    label: "Settings",
    to: "/settings",
    icon: <IconSettings />,
    permission: "settings:read",
  },
  {
    label: "Credit Deduction",
    to: "/credit-deduction",
    icon: <IconCoins />,
    permission: "settings:read",
  },
  // ── Refer & Earn section ────────────────────────────────────────────────
  {
    label: "Referrals",
    to: "/referrals",
    icon: <IconGift />,
    permission: "referrals:read",
    section: "Refer & Earn",
  },
  {
    label: "Campaigns",
    to: "/referrals/campaigns",
    icon: <IconMegaphone />,
    permission: "campaigns:read",
    section: "Refer & Earn",
  },
  {
    label: "Funnel",
    to: "/referrals/funnel",
    icon: <IconBarChart />,
    permission: "referrals:read",
    section: "Refer & Earn",
  },
  {
    label: "Milestones",
    to: "/referrals/milestones",
    icon: <IconTarget />,
    permission: "milestones:read",
    section: "Refer & Earn",
  },
  {
    label: "Credits",
    to: "/referrals/credits",
    icon: <IconCoins />,
    permission: "credits:read",
    section: "Refer & Earn",
  },
  // ── Influencers section ─────────────────────────────────────────────────
  {
    label: "Influencer Management",
    to: "/influencers",
    icon: <IconStar />,
    permission: "influencers:view",
    section: "Influencers",
  },
  {
    label: "Influencer Dashboard",
    to: "/influencer/dashboard",
    icon: <IconBarChart />,
    permission: "influencer_dashboard:view",
    section: "Influencers",
  },
];

/* ── Props ── */

/* ── Component ── */

export function Sidebar({
  role = "viewer",
  permissions,
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse,
}) {
  const location = useLocation();

  const isPureInfluencer =
    role === "viewer" &&
    Array.isArray(permissions) &&
    permissions.includes("influencer_dashboard:view") &&
    !permissions.includes("dashboard:read");

  const adminObj = { role, permissions };
  const canReadIssues = !isPureInfluencer && hasPermission(adminObj, "issues:read");
  const { data: issueStats } = useIssueStats({ enabled: canReadIssues });
  const openIssuesCount = Number(issueStats?.open || 0) + Number(issueStats?.investigating || 0);

  const INFLUENCER_ITEMS = [
    {
      label: "Dashboard Overview",
      to: "/influencer/dashboard",
      icon: <IconDashboard />,
    },
    {
      label: "My Referrals",
      to: "/influencer/referrals",
      icon: <IconGift />,
    },
    {
      label: "My Conversions",
      to: "/influencer/conversions",
      icon: <IconTarget />,
    },
    {
      label: "Payout History",
      to: "/influencer/payouts",
      icon: <IconCoins />,
    },
  ];

  const visibleItems = isPureInfluencer
    ? INFLUENCER_ITEMS
    : NAV_ITEMS.filter((item) => {
        // Administrators manage influencers via Influencer Management;
        // they MUST NEVER see the personal Influencer Dashboard in their sidebar.
        if (item.to === "/influencer/dashboard") {
          return false;
        }

        if (item.permission && !hasPermission(adminObj, item.permission))
          return false;
        if (!item.minRole) return true;
        return ROLE_RANK[role] >= ROLE_RANK[item.minRole];
      });

  const sidebarClass = [
    "sidebar",
    isCollapsed && "sidebar--collapsed",
    isOpen && "sidebar--open",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${isOpen ? " sidebar-overlay--visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={sidebarClass} aria-label="Main navigation">
        {/* Brand */}
        <a
          href={isPureInfluencer ? "/influencer/dashboard" : "/"}
          className="sidebar__brand"
          tabIndex={0}
        >
          <div className="sidebar__brand-icon" aria-hidden="true">
            {isPureInfluencer ? "KP" : "KA"}
          </div>
          <div className="sidebar__brand-text">
            <div className="sidebar__brand-title">
              {isPureInfluencer ? "Kairos Partner" : "Kairos Admin"}
            </div>
            <div className="sidebar__brand-subtitle">
              {isPureInfluencer ? "Creator Portal" : "Interview Copilot"}
            </div>
          </div>
        </a>

        {/* Nav */}
        <nav className="sidebar__nav" aria-label="Primary navigation">
          <span className="sidebar__section-label">
            {isPureInfluencer ? "Partner Workspace" : "Menu"}
          </span>

          {visibleItems.map((item, idx) => {
            const isActive = isPureInfluencer
              ? (item.to === "/influencer/dashboard"
                  ? location.pathname === "/influencer/dashboard" || location.pathname === "/influencer"
                  : location.pathname.startsWith(item.to))
              : item.to === "/dashboard"
                ? location.pathname === "/dashboard"
                : item.to === "/referrals"
                  ? location.pathname === "/referrals"
                  : item.to === "/influencers"
                    ? location.pathname === "/influencers"
                    : location.pathname.startsWith(item.to);

            const prevItem = visibleItems[idx - 1];
            const showSectionLabel =
              !isPureInfluencer &&
              item.section &&
              (!prevItem || prevItem.section !== item.section);

            return (
              <React.Fragment key={item.to}>
                {showSectionLabel && (
                  <span className="sidebar__section-label">{item.section}</span>
                )}
                <NavLink
                  to={item.to}
                  className={`sidebar__nav-item${isActive ? " sidebar__nav-item--active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={onClose}
                  data-label={item.label}
                  title={isCollapsed ? (item.to === "/issues" && openIssuesCount > 0 ? `${item.label} (${openIssuesCount} active issues)` : item.label) : undefined}
                >
                  <span className="sidebar__nav-icon" style={{ position: "relative" }}>
                    {item.icon}
                    {item.to === "/issues" && openIssuesCount > 0 && (
                      <span className="sidebar__icon-dot sidebar__icon-dot--red" aria-label={`${openIssuesCount} active issues`} />
                    )}
                  </span>
                  <span className="sidebar__nav-label">{item.label}</span>
                  {item.to === "/issues" && openIssuesCount > 0 && (
                    <span className="sidebar__nav-badge sidebar__nav-badge--red" title={`${openIssuesCount} active issues`}>
                      {openIssuesCount}
                    </span>
                  )}
                </NavLink>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Footer: version info + collapse toggle */}
        <footer className="sidebar__footer">
          {/* Version / branding strip */}
          <div className="sidebar__footer-brand">
            <span className="sidebar__footer-version">v0.1.0-alpha</span>
          </div>

          {/* Collapse toggle */}
          <button
            className="sidebar__collapse-btn"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
            <span className="sidebar__collapse-label">Collapse</span>
          </button>
        </footer>
      </aside>
    </>
  );
}
