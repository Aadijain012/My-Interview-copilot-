/**
 * AuthLayout.tsx — Minimal page shell for authentication pages.
 *
 * No sidebar, no topbar. Just a centered container with the app background.
 * Used for: /login, /totp/setup, /totp/verify
 */

import { Outlet } from "react-router-dom";
import "./AuthLayout.css";

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <Outlet />
    </div>
  );
}
