import { useState, useRef, useEffect, useCallback } from "react";
import "./Dropdown.css";

/* ── Item types ── */

/* ── Props ── */

/* ── Component ── */

export function Dropdown({ trigger, items, align = "right", className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e) => {
      if (!containerRef.current?.contains(e.target)) close();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") {
        close();
        // Return focus to trigger
        containerRef.current?.querySelector("[data-dropdown-trigger]")?.focus();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, close]);

  // Focus first item when opened
  useEffect(() => {
    if (isOpen) {
      const firstItem = menuRef.current?.querySelector(
        'button:not(:disabled), a:not([aria-disabled="true"])',
      );
      firstItem?.focus();
    }
  }, [isOpen]);

  // Arrow-key navigation within menu
  const handleMenuKeyDown = (e) => {
    if (!menuRef.current) return;
    const focusable = Array.from(
      menuRef.current.querySelectorAll(
        'button:not(:disabled), a:not([aria-disabled="true"])',
      ),
    );
    const idx = focusable.indexOf(document.activeElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusable[(idx + 1) % focusable.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusable[(idx - 1 + focusable.length) % focusable.length]?.focus();
    }
  };

  return (
    <div
      className={`dropdown${className ? ` ${className}` : ""}`}
      ref={containerRef}
    >
      {/* Trigger wrapper */}
      <div
        onClick={toggle}
        data-dropdown-trigger=""
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {trigger}
      </div>

      {/* Menu */}
      {isOpen && (
        <div
          className={`dropdown__menu${align === "left" ? " dropdown__menu--left" : ""}`}
          ref={menuRef}
          role="menu"
          aria-label="Actions"
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((entry) => {
            if ("isDivider" in entry && entry.isDivider) {
              return (
                <div
                  key={entry.key}
                  className="dropdown__divider"
                  role="separator"
                />
              );
            }
            if ("isLabel" in entry && entry.isLabel) {
              return (
                <div
                  key={entry.key}
                  className="dropdown__label"
                  role="presentation"
                >
                  {entry.label}
                </div>
              );
            }
            const item = entry;
            const commonProps = {
              key: item.key,
              role: "menuitem",
              className: `dropdown__item${item.danger ? " dropdown__item--danger" : ""}`,
              onClick: () => {
                item.onClick?.();
                close();
              },
              "aria-disabled": item.disabled,
              tabIndex: 0,
            };

            if (item.href) {
              return (
                <a href={item.href} {...commonProps}>
                  {item.icon && <span aria-hidden="true">{item.icon}</span>}
                  {item.label}
                </a>
              );
            }

            return (
              <button type="button" disabled={item.disabled} {...commonProps}>
                {item.icon && <span aria-hidden="true">{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
