/**
 * AppLayout.tsx — Root application layout shell.
 *
 * Composes: Sidebar + Topbar + page content area.
 * Reads authenticated admin identity from AuthContext (via useAuth).
 * All auth data is live — no hardcoded defaults needed here.
 */

import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useSidebar } from "./useSidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "@/features/auth/useAuth";
import "./AppLayout.css";

export function AppLayout() {
  const sidebar = useSidebar();
  const { admin, logout } = useAuth();

  return (
    <div className="app-shell">
      <Sidebar
        role={admin?.role ?? "viewer"}
        permissions={admin?.permissions}
        isOpen={sidebar.isOpen}
        isCollapsed={sidebar.isCollapsed}
        onClose={sidebar.close}
        onToggleCollapse={sidebar.toggleCollapse}
      />

      <div
        className={`app-content${sidebar.isCollapsed ? " app-content--collapsed" : ""}`}
      >
        <Topbar
          isCollapsed={sidebar.isCollapsed}
          onMenuOpen={sidebar.open}
          adminName={admin?.name ?? ""}
          adminEmail={admin?.email ?? ""}
          adminRole={admin?.role ?? "viewer"}
          onLogout={logout}
        />

        <main className="app-main" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
