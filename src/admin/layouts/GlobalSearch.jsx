import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./GlobalSearch.css";

/* ── Icons ── */

function IconSearch({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/* ── Quick-nav items (foundation — real search wired in later phases) ── */

function IconDash() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const SEARCH_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <IconDash />,
    to: "/dashboard",
    section: "Navigation",
  },
  {
    id: "users",
    label: "Users",
    icon: <IconUsers />,
    to: "/users",
    section: "Navigation",
  },
  {
    id: "admin-users",
    label: "Admin Users",
    icon: <IconShield />,
    to: "/admin-users",
    section: "Navigation",
  },
  {
    id: "audit-logs",
    label: "Audit Logs",
    icon: <IconFile />,
    to: "/audit-logs",
    section: "Navigation",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <IconGear />,
    to: "/settings",
    section: "Navigation",
  },
];

/* ── Palette ── */

function SearchPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [focusedIdx, setFocusedIdx] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const filtered = query.trim()
    ? SEARCH_ITEMS.filter((i) =>
        i.label.toLowerCase().includes(query.toLowerCase()),
      )
    : SEARCH_ITEMS;

  // When the palette opens: focus the input (DOM-only side-effect — no setState)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    (item) => {
      navigate(item.to);
      onClose();
    },
    [navigate, onClose],
  );

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[focusedIdx]) {
      handleSelect(filtered[focusedIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const sections = [...new Set(filtered.map((i) => i.section))];

  return (
    <div
      className="search-palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="search-palette" onKeyDown={handleKeyDown}>
        {/* Input */}
        <div className="search-palette__input-row">
          <span className="search-palette__icon">
            <IconSearch />
          </span>
          <input
            ref={inputRef}
            className="search-palette__input"
            placeholder="Search pages, users, settings…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocusedIdx(0);
            }}
            aria-label="Search"
            autoComplete="off"
          />

          <kbd className="search-kbd search-palette__esc">Esc</kbd>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="search-palette__hint">No results for "{query}"</div>
        ) : (
          <div
            className="search-palette__results"
            role="listbox"
            aria-label="Search results"
          >
            {sections.map((section) => (
              <div key={section}>
                <div className="search-palette__section-label">{section}</div>
                {filtered
                  .filter((i) => i.section === section)
                  .map((item, sectionIdx) => {
                    const globalIdx = filtered.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        className={`search-palette__item${globalIdx === focusedIdx ? " search-palette__item--focused" : ""}`}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setFocusedIdx(sectionIdx)}
                        role="option"
                        aria-selected={globalIdx === focusedIdx}
                      >
                        <span className="search-palette__item-icon">
                          {item.icon}
                        </span>
                        {item.label}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="search-palette__footer" aria-hidden="true">
          <span className="search-palette__footer-hint">
            <kbd className="search-kbd">↑↓</kbd> navigate
          </span>
          <span className="search-palette__footer-hint">
            <kbd className="search-kbd">↵</kbd> open
          </span>
          <span className="search-palette__footer-hint">
            <kbd className="search-kbd">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Trigger button ── */

export function GlobalSearch({ className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Ctrl+K / ⌘+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        className={`search-trigger${className ? ` ${className}` : ""}`}
        onClick={open}
        aria-label="Search (Ctrl+K)"
        title="Search (Ctrl+K)"
        type="button"
      >
        <IconSearch size={15} />
        <span className="search-trigger__text">Search…</span>
        <kbd className="search-kbd" aria-hidden="true">
          Ctrl K
        </kbd>
      </button>

      <SearchPalette isOpen={isOpen} onClose={close} />
    </>
  );
}
