/**
 * PermissionGuard.tsx — Route-level permission guard for admin pages.
 *
 * If the current admin does NOT have the required permission, the page is
 * completely hidden — they are silently redirected to /dashboard (or /influencer/dashboard for pure influencers).
 * No "Access Denied" message is shown; the page simply doesn't exist for them.
 */

import { Navigate } from "react-router-dom";
import { usePermission } from "@/features/auth/rbac";
import { useAuth } from "@/features/auth/useAuth";

export function PermissionGuard({ permission, children }) {
  const allowed = usePermission(permission);
  const { admin } = useAuth();

  if (!allowed) {
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

  return <>{children}</>;
}
