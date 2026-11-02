import { useAuth } from "./useAuth";

export const PERMISSION_MAP = {
  "dashboard:read": ["viewer", "ops", "admin", "owner"],
  "users:read": ["viewer", "ops", "admin", "owner"],
  "users:export": ["ops", "admin", "owner"],
  "users:suspend": ["ops", "admin", "owner"],
  "users:delete": ["admin", "owner"],
  "referrals:read": ["viewer", "ops", "admin", "owner"],
  "referrals:write": ["ops", "admin", "owner"],
  "campaigns:read": ["viewer", "ops", "admin", "owner"],
  "campaigns:write": ["ops", "admin", "owner"],
  "campaigns:delete": ["admin", "owner"],
  "offers:read": ["viewer", "ops", "admin", "owner"],
  "offers:write": ["ops", "admin", "owner"],
  "credits:read": ["viewer", "ops", "admin", "owner"],
  "credits:write": ["ops", "admin", "owner"],
  "credits:compensate": ["ops", "admin", "owner"],
  "milestones:read": ["viewer", "ops", "admin", "owner"],
  "milestones:write": ["ops", "admin", "owner"],
  "admin-users:read": ["admin", "owner"],
  "admin-users:create": ["admin", "owner"],
  "admin-users:update": ["admin", "owner"],
  "admin-users:suspend": ["admin", "owner"],
  "admin-users:delete": ["owner"],
  "settings:read": ["admin", "owner"],
  "settings:write": ["owner"],
  "audit-logs:read": ["admin", "owner"],
  "error-logs:read": ["ops", "admin", "owner"],
  "error-logs:write": ["admin", "owner"],
  "permissions:read": ["owner"],
  "permissions:write": ["owner"],
  "system-health:read": ["viewer", "ops", "admin", "owner"],
  "sessions:read": ["viewer", "ops", "admin", "owner"],
  "analytics:read": ["viewer", "ops", "admin", "owner"],
  "recordings:read": ["admin", "owner"],
  "transcripts:read": ["ops", "admin", "owner"],
  "issues:read": ["viewer", "ops", "admin", "owner"],
  "issues:create": ["viewer", "ops", "admin", "owner"],
  "issues:update": ["ops", "admin", "owner"],
  "issues:delete": ["admin", "owner"],

  // Influencer Management (Owner controls access for admin, ops, viewer)
  "influencers:view": ["owner"],
  "influencers:create": ["owner"],
  "influencers:update": ["owner"],
  "influencers:suspend": ["owner"],

  "campaigns:view": ["owner"],
  "campaigns:create": ["owner"],
  "campaigns:update": ["owner"],

  "referral_codes:view": ["owner"],
  "referral_codes:create": ["owner"],
  "referral_codes:update": ["owner"],

  "referrals:view": ["owner"],
  "conversions:view": ["owner"],

  "commissions:view": ["owner"],
  "commission_rules:view": ["owner"],
  "commission_rules:create": ["owner"],
  "commission_rules:update": ["owner"],
  "commission_rules:delete": ["owner"],

  "payouts:view": ["owner"],
  "payouts:manage": ["owner"],
  "payout_currency:manage": ["owner"],

  "influencer_dashboard:view": ["viewer", "ops", "admin", "owner"],
};

/**
 * Canonical list of all admin roles in order of ascending privilege.
 * Matches backend `VALID_ROLES` in `admin-users.service.js`.
 */
export const ADMIN_ROLES = ["viewer", "ops", "admin", "owner"];

/**
 * Role hierarchy rank: index 0 = lowest, index 3 = highest.
 * Matches backend `ROLE_RANK` in `admin-users.service.js`.
 * An actor can only manage or assign roles at or below their own level.
 */
export const ROLE_RANK = {
  viewer: 0,
  ops: 1,
  admin: 2,
  owner: 3,
};

/**
 * Checks if a role or admin is permitted to perform an action.
 * If target has role 'owner', always returns true.
 * If admin object has a custom permissions array, checks the array.
 * Otherwise falls back to role default in PERMISSION_MAP.
 */
export function hasPermission(roleOrAdmin, permission) {
  if (!roleOrAdmin) return false;
  const role = typeof roleOrAdmin === "string" ? roleOrAdmin : roleOrAdmin.role;
  if (role === "owner") return true;
  if (
    typeof roleOrAdmin !== "string" &&
    Array.isArray(roleOrAdmin.permissions)
  ) {
    return roleOrAdmin.permissions.includes(permission);
  }
  if (!role) return false;
  const allowed = PERMISSION_MAP[permission];
  return allowed ? allowed.includes(role) : false;
}

/**
 * Returns all roles that the specified actor is legitimately permitted to assign/create.
 * Rules:
 *   - Actor cannot assign a role higher than their own rank.
 *   - An 'owner' (rank 3) can assign 'viewer', 'ops', 'admin', 'owner'.
 *   - An 'admin' (rank 2) can assign 'viewer', 'ops', 'admin'.
 *   - Roles below 'admin' cannot create admin users (enforced by 'admin-users:create' permission).
 */
export function getAllowedAssignableRoles(actorRole) {
  if (!actorRole) return [];
  const actorRank = ROLE_RANK[actorRole] ?? -1;
  return ADMIN_ROLES.filter((role) => ROLE_RANK[role] <= actorRank);
}

/**
 * React hook to check permissions for the currently logged-in admin.
 */
export function usePermission(permission) {
  const { admin } = useAuth();
  return hasPermission(admin || undefined, permission);
}
