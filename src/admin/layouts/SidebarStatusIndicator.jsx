import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import "./SidebarStatusIndicator.css";

/* ── Inline SVG icons ── */

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

function IconCheckCircle() {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
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

function IconDatabase() {
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
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

export function SidebarStatusIndicator({ isCollapsed, onClose }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

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

  // Mobile / touch / click toggle
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
    if (!wrapRef.current?.contains(e.relatedTarget)) {
      setIsOpen(false);
    }
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleDocumentClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      clearTimer();
    };
  }, [isOpen, clearTimer]);

  return (
    <div
      className={`sidebar-status-wrap${isCollapsed ? " sidebar-status-wrap--collapsed" : ""}`}
      ref={wrapRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={`sidebar-status-btn${isOpen ? " sidebar-status-btn--active" : ""}`}
        onClick={handleClick}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="System Issues and Health Indicator: 0 Active Issues"
        title={isCollapsed ? "System Status & Issues (Operational)" : undefined}
      >
        <span className="sidebar-status-btn__icon">
          <IconActivity />
          <span className="sidebar-status-btn__dot" aria-hidden="true" />
        </span>
        <span className="sidebar-status-btn__label">Issues & Health</span>
        <span className="sidebar-status-btn__badge">0 Issues</span>
      </button>

      {isOpen && (
        <div
          className={`sidebar-status-popover${isCollapsed ? " sidebar-status-popover--docked-right" : ""}`}
          role="region"
          aria-label="Platform Health and System Issues"
        >
          <div className="sidebar-status-popover__header">
            <span className="sidebar-status-popover__title">
              System Issues & Health
            </span>
            <span className="sidebar-status-popover__pill">
              <span className="sidebar-status-popover__pill-dot" />
              Operational
            </span>
          </div>

          <div className="sidebar-status-popover__body">
            <div className="sidebar-status-popover__item">
              <span className="sidebar-status-popover__item-icon sidebar-status-popover__item-icon--success">
                <IconCheckCircle />
              </span>
              <div className="sidebar-status-popover__item-text">
                <div className="sidebar-status-popover__item-name">
                  Platform Services
                </div>
                <div className="sidebar-status-popover__item-detail">
                  0 active issues, all APIs healthy
                </div>
              </div>
            </div>

            <div className="sidebar-status-popover__item">
              <span className="sidebar-status-popover__item-icon sidebar-status-popover__item-icon--accent">
                <IconShield />
              </span>
              <div className="sidebar-status-popover__item-text">
                <div className="sidebar-status-popover__item-name">
                  Admin Authentication & 2FA
                </div>
                <div className="sidebar-status-popover__item-detail">
                  Mandatory TOTP enforced
                </div>
              </div>
            </div>

            <div className="sidebar-status-popover__item">
              <span className="sidebar-status-popover__item-icon sidebar-status-popover__item-icon--info">
                <IconDatabase />
              </span>
              <div className="sidebar-status-popover__item-text">
                <div className="sidebar-status-popover__item-name">
                  Prisma PostgreSQL Database
                </div>
                <div className="sidebar-status-popover__item-detail">
                  Connected, latency &lt; 5ms
                </div>
              </div>
            </div>
          </div>

          <div className="sidebar-status-popover__footer">
            <Link
              to="/audit-logs"
              className="sidebar-status-popover__link"
              onClick={() => {
                setIsOpen(false);
                onClose?.();
              }}
            >
              Open Audit Log Stream &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
