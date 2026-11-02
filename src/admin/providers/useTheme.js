import { useContext } from "react";
import { ThemeContext } from "./ThemeProvider";

// Re-export Theme type so consumers only need to import from useTheme

/**
 * Access the current theme and the setTheme function.
 * Must be used inside <ThemeProvider>.
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside <ThemeProvider>");
  return ctx;
}
