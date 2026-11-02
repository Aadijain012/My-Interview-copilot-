/**
 * ProtectedRoute.tsx — Route guards for the admin panel.
 *
 * Two guards:
 *
 * ProtectedRoute:
 *   - While auth is loading → show PageLoader (prevents redirect flash)
 *   - Not authenticated → Navigate to /login
 *   - Authenticated → render <Outlet />
 *
 * PublicOnlyRoute:
 *   - While auth is loading → show PageLoader
 *   - Already authenticated → Navigate to /dashboard (or /influencer/dashboard for scoped partners)
 *   - Not authenticated → render <Outlet /> (login/totp pages)
 *
 * Usage in router:
 *   { element: <ProtectedRoute />, children: [...protected routes] }
 *   { element: <PublicOnlyRoute />, children: [...login routes] }
 */

import { Navigate, Outlet } from "react-router-dom";
import { PageLoader } from "@/components";
import { useAuth } from "@/features/auth/useAuth";

/** Wraps routes that require authentication. */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <PageLoader text="Loading..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Wraps routes that should only be visible when NOT authenticated (login, totp). */
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading, admin } = useAuth();

  if (isLoading) return <PageLoader text="Loading..." />;
  if (isAuthenticated) {
    const isPureInfluencer =
      admin &&
      Array.isArray(admin.permissions) &&
      !admin.permissions.includes("dashboard:read") &&
      admin.permissions.includes("influencer_dashboard:view");

    if (isPureInfluencer) {
      return <Navigate to="/influencer/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

/** Handles root path '/' navigation based on role/permissions. */
export function RootRedirect() {
  const { admin } = useAuth();
  if (!admin) return <Navigate to="/login" replace />;
  const isPureInfluencer =
    admin &&
    Array.isArray(admin.permissions) &&
    !admin.permissions.includes("dashboard:read") &&
    admin.permissions.includes("influencer_dashboard:view");
  if (isPureInfluencer) {
    return <Navigate to="/influencer/dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

/** Route guard ensuring only pure influencer partners can access the personal influencer dashboard. */
export function InfluencerRouteGuard({ children }) {
  const { admin } = useAuth();
  const isPureInfluencer =
    admin &&
    Array.isArray(admin.permissions) &&
    !admin.permissions.includes("dashboard:read") &&
    admin.permissions.includes("influencer_dashboard:view");

  if (!isPureInfluencer) {
    // Owner, Admin, Ops, and non-influencers are restricted from personal influencer dashboard.
    // Redirect them to Influencer Management.
    return <Navigate to="/influencers" replace />;
  }

  return children;
}
