import { useState, useCallback } from "react";

/**
 * Manages sidebar open/collapsed state.
 * - isOpen: used on mobile (slides in/out)
 * - isCollapsed: used on desktop (icon-only width)
 */
export function useSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const toggleCollapse = useCallback(() => setIsCollapsed((v) => !v), []);

  return { isOpen, isCollapsed, open, close, toggle, toggleCollapse };
}
