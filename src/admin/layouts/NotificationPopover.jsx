import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useNotificationsQuery,
  useUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from "@/features/notifications/hooks/useNotificationQueries";
import "./NotificationPopover.css";

/* ── Inline SVG icons ── */

function IconBell() {
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
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconCheckCheck() {
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
      <path d="M18 6L7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </svg>
  );
}

function IconGift() {
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
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect width="20" height="5" x="2" y="7" />
      <line x1="12" x2="12" y1="22" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function IconUser() {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconShield() {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconMegaphone() {
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
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

function IconActivity() {
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
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconInboxEmpty() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CategoryIcon({ category }) {
  switch (category) {
    case "referral":
      return <IconGift />;
    case "user":
      return <IconUser />;
    case "admin_security":
      return <IconShield />;
    case "campaign":
      return <IconMegaphone />;
    case "system":
    default:
      return <IconActivity />;
  }
}

function PriorityIndicator({ priority }) {
  let title = "Normal priority";
  let className = "notification-item__priority-dot--medium";

  if (priority === "critical") {
    title = "Critical priority";
    className = "notification-item__priority-dot--critical";
  } else if (priority === "high") {
    title = "High priority";
    className = "notification-item__priority-dot--high";
  } else if (priority === "low") {
    title = "Low priority";
    className = "notification-item__priority-dot--low";
  }

  return (
    <span
      className={`notification-item__priority-dot ${className}`}
      title={title}
    />
  );
}

export function NotificationPopover({ notificationCount, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const containerRef = useRef(null);
  const timerRef = useRef(null);

  // Live queries
  const { data: unreadData } = useUnreadNotificationCountQuery();
  const liveUnreadCount = unreadData?.unreadCount ?? 0;

  // Effective unread count: prioritize explicit prop if provided, else live query
  const effectiveCount =
    notificationCount !== undefined ? notificationCount : liveUnreadCount;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const queryParams = useMemo(() => {
    const p = { page, limit: pageSize };
    if (activeTab === "unread") {
      p.isRead = false;
    }
    return p;
  }, [activeTab, page, pageSize]);

  const { data: notifData, isLoading } = useNotificationsQuery(queryParams);
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();

  const notifications = notifData?.data ?? [];
  const totalPages = notifData?.meta?.totalPages ?? 1;

  // Clear hover timeout
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const lastMouseEnterRef = useRef(0);

  // Desktop hover: open immediately on mouse enter
  const handleMouseEnter = useCallback(() => {
    clearTimer();
    lastMouseEnterRef.current = Date.now();
    setIsOpen(true);
  }, [clearTimer]);

  // Desktop hover: close after 200ms grace period on mouse leave
  const handleMouseLeave = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  }, [clearTimer]);

  // Toggle on click
  const handleClick = useCallback(() => {
    clearTimer();
    if (Date.now() - lastMouseEnterRef.current < 400) {
      setIsOpen(true);
    } else {
      setIsOpen((prev) => !prev);
    }
  }, [clearTimer]);

  // Keyboard accessibility
  const handleFocus = useCallback(() => {
    clearTimer();
    setIsOpen(true);
  }, [clearTimer]);

  const handleBlur = useCallback((e) => {
    if (!containerRef.current?.contains(e.relatedTarget)) {
      setIsOpen(false);
    }
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleDocumentClick = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      clearTimer();
    };
  }, [isOpen, clearTimer]);

  const handleNotificationClick = (item) => {
    if (!item.isRead && !markReadMutation.isPending) {
      markReadMutation.mutate(item.id);
    }
  };

  const handleMarkAllRead = () => {
    if (effectiveCount > 0 && !markAllReadMutation.isPending) {
      markAllReadMutation.mutate();
    }
  };

  return (
    <div
      className={`notification-popover-wrap ${className}`}
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={`icon-btn icon-btn--md notification-popover__trigger${isOpen ? " notification-popover__trigger--active" : ""}`}
        onClick={handleClick}
        aria-label={
          effectiveCount > 0
            ? `${effectiveCount} unread notification${effectiveCount > 1 ? "s" : ""}`
            : "Notifications"
        }
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <IconBell />
        {effectiveCount > 0 && (
          <span className="icon-btn__badge" aria-hidden="true">
            {effectiveCount > 99 ? "99+" : effectiveCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notification-popover"
          role="region"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="notification-popover__header">
            <div className="notification-popover__title-group">
              <div className="notification-popover__title-left">
                <span className="notification-popover__title">
                  Notifications
                </span>
                {effectiveCount > 0 && (
                  <span className="notification-popover__count-pill">
                    {effectiveCount} new
                  </span>
                )}
              </div>

              {effectiveCount > 0 && (
                <button
                  type="button"
                  className="notification-popover__mark-all-btn"
                  onClick={handleMarkAllRead}
                  disabled={markAllReadMutation.isPending}
                  title="Mark all as read"
                >
                  <IconCheckCheck />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="notification-popover__tabs">
            <button
              type="button"
              className={`notification-popover__tab ${activeTab === "all" ? "notification-popover__tab--active" : ""}`}
              onClick={() => handleTabChange("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`notification-popover__tab ${activeTab === "unread" ? "notification-popover__tab--active" : ""}`}
              onClick={() => handleTabChange("unread")}
            >
              Unread {effectiveCount > 0 ? `(${effectiveCount})` : ""}
            </button>
          </div>

          {/* Content list */}
          <div className="notification-popover__content">
            {isLoading ? (
              <div className="notification-popover__loading">
                <div className="notification-popover__spinner" />
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-popover__empty">
                <IconInboxEmpty />
                <span className="notification-popover__empty-title">
                  All caught up!
                </span>
                <span className="notification-popover__empty-desc">
                  {activeTab === "unread"
                    ? "No unread notifications right now."
                    : "No notifications in your inbox."}
                </span>
              </div>
            ) : (
              <div className="notification-popover__list">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`notification-popover__item ${!item.isRead ? "notification-popover__item--unread" : ""}`}
                    onClick={() => handleNotificationClick(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleNotificationClick(item);
                      }
                    }}
                  >
                    <span
                      className={`notification-popover__item-icon notification-popover__item-icon--${item.category}`}
                    >
                      <CategoryIcon category={item.category} />
                    </span>

                    <div className="notification-popover__item-body">
                      <div className="notification-popover__item-header">
                        <span className="notification-popover__item-title">
                          {item.title}
                        </span>
                        <PriorityIndicator priority={item.priority} />
                      </div>

                      <div className="notification-popover__item-desc">
                        {item.message}
                      </div>

                      <div className="notification-popover__item-meta">
                        <span className="notification-popover__item-time">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        {!item.isRead && (
                          <span
                            className="notification-popover__unread-dot"
                            title="Unread"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div
              className="notification-popover__pagination"
              role="navigation"
              aria-label="Notifications pagination"
            >
              <button
                type="button"
                className="notification-popover__page-btn"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                &larr; Prev
              </button>
              <span className="notification-popover__page-info">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="notification-popover__page-btn"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                Next &rarr;
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="notification-popover__footer">
            <Link
              to="/audit-logs"
              className="notification-popover__action-link"
              onClick={() => setIsOpen(false)}
            >
              View Full Audit Logs &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
