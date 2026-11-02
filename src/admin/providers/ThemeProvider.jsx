import { createContext, useEffect, useMemo, useState } from "react";

/* ── Types ── */

/* ── Context (not exported — accessed only via useTheme hook) ── */

// Exported as a named const so useTheme.ts can import it without triggering
// react-refresh/only-export-components (the context object itself is not a component).
// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext(null);

const STORAGE_KEY = "kairos_admin_theme";

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved) {
  document.documentElement.setAttribute("data-theme", resolved);
}

/* ── Provider ── */

export function ThemeProvider({ children, defaultTheme = "dark" }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system")
        return stored;
    } catch {
      // localStorage unavailable
    }
    return defaultTheme;
  });

  // System-pref sync state (only used when theme === 'system')
  const [systemPref, setSystemPref] = useState(getSystemTheme);

  // Derive resolvedTheme purely from existing state — no extra state needed
  const resolvedTheme = useMemo(
    () => (theme === "system" ? systemPref : theme),
    [theme, systemPref],
  );

  // Sync <html data-theme> with resolved theme (DOM side-effect only, no setState)
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Listen for system preference changes when theme === 'system'
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystemPref(getSystemTheme());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* noop */
    }
    setThemeState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
