import { useEffect, useRef, useState, useId } from 'react';
import { MAIN_ORIGIN } from '../../routing/appRoutes';
import '../copilot/CopilotMenu.css';
import './ToolMenu.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function initials(name) {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  const first = value => {
    if (typeof Intl.Segmenter === 'function') {
      return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)][0]?.segment || '';
    }
    return Array.from(value)[0] || '';
  };
  return (parts.length > 1 ? first(parts[0]) + first(parts.at(-1)) : first(parts[0] || '')).toLocaleUpperCase();
}

/** One menu entry, as in the AI Copilot menu. */
export function MenuItem({ icon, iconSet = 'fa-solid', label, onClick, disabled, title, testId, external, current, count }) {
  return (
    <button
      type="button"
      className={`copilot-menu-item${current ? ' is-current' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-current={current ? 'true' : undefined}
      data-testid={testId}
    >
      <i className={`${iconSet} ${icon}`} aria-hidden="true"></i>
      <span className="copilot-menu-item-label">{label}</span>
      {count != null && <span className="copilot-menu-count">{count}</span>}
      {external && <i className="fa-solid fa-arrow-right copilot-menu-item-go" aria-hidden="true"></i>}
    </button>
  );
}

/** Tool settings. Help chat lives on the dashboard. */
export function MenuMore({ choose, onOpenSettings, testPrefix }) {
  return (
    <section className="copilot-menu-section" aria-label="More">
      <MenuItem icon="fa-gear" label="Settings" onClick={choose(onOpenSettings)} testId={`${testPrefix}-settings`} />
    </section>
  );
}

/** Account pages open separately so the current tool stays mounted. */
export function MenuAccount({ user, onLogout, busy = false, active = true, linkHref = path => MAIN_ORIGIN + path }) {
  const displayName = typeof user?.name === 'string' && !user.name.includes('@') ? user.name.trim() : '';
  const [expanded, setExpanded] = useState(false);
  const root = useRef(null), trigger = useRef(null), panelId = useId();
  const open = expanded && active;
  useEffect(() => { if (!active) setExpanded(false); }, [active]);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setExpanded(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const links = [
    ['Dashboard', '/workspace', 'fa-house'],
    ['Profile', '/workspace/profile', 'fa-user'],
    ['Credits & referrals', '/workspace/credits', 'fa-coins'],
    ['Plans & pricing', '/app/pricing', 'fa-tags']
  ];
  return (
    <div className="copilot-menu-account tool-account" data-testid="tool-identity" ref={root}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation(); setExpanded(false); trigger.current?.focus();
        }
      }}>
      {open && <nav className="tool-account-popover" id={panelId} aria-label="Account links" data-testid="tool-account-links">
        {links.map(([label, path, icon]) => <a key={path} href={linkHref(path)}
          onClick={() => setExpanded(false)}>
          <i className={'fa-solid ' + icon} aria-hidden="true"></i><span>{label}</span><span aria-hidden="true">→</span>
        </a>)}
        <button type="button" className="tool-account-logout" disabled={busy || !onLogout}
          onClick={() => { if (!busy) { setExpanded(false); onLogout?.(); } }}>
          <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>Log out
        </button>
        {busy && <p className="tool-account-hint">Finish your active session or transfer before logging out.</p>}
      </nav>}
      <button type="button" className="copilot-menu-user tool-account-trigger" ref={trigger}
        aria-label={'Account options for ' + (displayName || 'your account')} aria-expanded={open} aria-controls={open ? panelId : undefined}
        onClick={() => setExpanded(value => !value)}>
        <span className="copilot-menu-avatar" aria-hidden="true">{initials(displayName) || <i className="fa-solid fa-user"></i>}</span>
        <span className="copilot-menu-user-text">
          <span className="copilot-menu-user-name" dir="auto">{displayName || 'Your account'}</span>
        </span>
        <span className="tool-account-chevron" aria-hidden="true">{open ? '⌄' : '⌃'}</span>
      </button>
    </div>
  );
}

/**
 * A tool's menu with the AI Copilot menu's behaviour: a sidebar beside the
 * page on wide screens, a drawer over it on narrow ones (closed with Escape
 * or a tap outside it, focus kept inside while it is open and returned to
 * the menu button on Escape). Opening or closing it only shows or hides it.
 * `focusRef` is the part to focus when the menu is opened at a section
 * (`focus.at` changes); otherwise a drawer starts at its first item.
 */
export default function ToolMenu({
  id,
  label,
  open,
  drawer,
  onClose,
  toggleRef,
  focus,
  focusRef,
  className = 'copilot-menu',
  testId,
  footer,
  children
}) {
  const asideRef = useRef(null);
  const modal = drawer && open;
  const focusAt = focus?.at || 0;

  useEffect(() => {
    if (!modal) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        toggleRef?.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal, onClose, toggleRef]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      const target = focusAt ? focusRef?.current : null;
      if (target) {
        target.focus();
        target.scrollIntoView({ block: 'nearest' });
      } else if (drawer) {
        asideRef.current?.querySelector(FOCUSABLE)?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, drawer, focusAt, focusRef]);

  // Keep Tab inside an open drawer.
  const onKeyDown = (event) => {
    if (!modal || event.key !== 'Tab') return;
    const items = [...(asideRef.current?.querySelectorAll(FOCUSABLE) || [])].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !asideRef.current.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {modal && <div className="copilot-menu-backdrop" onClick={onClose} data-testid={`${testId}-backdrop`} aria-hidden="true"></div>}
      <aside
        id={id}
        ref={asideRef}
        className={`${className} tool-menu${open ? ' is-open' : ''}${drawer ? ' is-drawer' : ' is-docked'}`}
        aria-label={label}
        role={modal ? 'dialog' : undefined}
        aria-modal={modal ? 'true' : undefined}
        aria-hidden={open ? undefined : 'true'}
        inert={!open}
        onKeyDown={onKeyDown}
        data-testid={testId}
      >
        <div className="copilot-menu-scroll">{children}</div>
        {footer}
      </aside>
    </>
  );
}
