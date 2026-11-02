import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { UsersPage } from "@/pages/UsersPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { PermissionsPage } from "@/pages/PermissionsPage";
import { ErrorLogsPage } from "@/pages/ErrorLogsPage";
import { AuditLogsPage } from "@/pages/AuditLogsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { CreditDeductionPage } from "@/pages/CreditDeductionPage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { OffersPage } from "@/pages/OffersPage";
import { DesktopReleasePage } from "@/pages/DesktopReleasePage";
import { LoginPage } from "@/pages/LoginPage";
import { PasswordChangePage } from "@/pages/PasswordChangePage";
import { TotpSetupPage } from "@/pages/TotpSetupPage";
import { TotpVerifyPage } from "@/pages/TotpVerifyPage";
import { ReferralDashboardPage } from "@/pages/ReferralDashboardPage";
import { CampaignsPage } from "@/pages/CampaignsPage";
import { CampaignFunnelPage } from "@/pages/CampaignFunnelPage";
import { MilestonesPage } from "@/pages/MilestonesPage";
import { CreditsLedgerPage } from "@/pages/CreditsLedgerPage";
import { SystemHealthPage } from "@/pages/SystemHealthPage";
import { AIAnalyticsPage } from "@/pages/AIAnalyticsPage";
import { IssuesPage } from "@/pages/IssuesPage";
import { InfluencerManagementPage } from "@/pages/InfluencerManagementPage";
import { InfluencerDashboardPage } from "@/pages/InfluencerDashboardPage";
import { InfluencerReferralsPage } from "@/pages/InfluencerReferralsPage";
import { InfluencerConversionsPage } from "@/pages/InfluencerConversionsPage";
import { InfluencerPayoutsPage } from "@/pages/InfluencerPayoutsPage";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RootRedirect,
  InfluencerRouteGuard,
} from "./ProtectedRoute";
import { PermissionGuard } from "./PermissionGuard";

/**
 * Application router.
 *
 * Every protected admin page is wrapped in <PermissionGuard> so that
 * if the owner removes a permission for a role/user, that page is hidden
 * from both the sidebar AND the route itself (shows "Access Restricted").
 *
 * Route tree:
 *
 *   Public-only auth routes (redirect to /dashboard if authenticated):
 *     /login                → LoginPage
 *     /password-change      → PasswordChangePage
 *     /totp/setup           → TotpSetupPage
 *     /totp/verify          → TotpVerifyPage
 *
 *   Protected admin routes (redirect to /login if not authenticated):
 *     /                     → redirect to /dashboard
 *     /dashboard            → DashboardPage          (dashboard:read)
 *     /users                → UsersPage               (users:read)
 *     /admin-users          → AdminUsersPage           (admin-users:read)
 *     /permissions          → PermissionsPage          (permissions:read)
 *     /error-logs           → ErrorLogsPage            (error-logs:read)
 *     /audit-logs           → AuditLogsPage            (audit-logs:read)
 *     /analytics            → AIAnalyticsPage          (analytics:read)
 *     /system-health        → SystemHealthPage         (system-health:read)
 *     /settings             → SettingsPage             (settings:read)
 *     /referrals            → ReferralDashboardPage    (referrals:read)
 *     /referrals/campaigns  → CampaignsPage            (campaigns:read)
 *     /referrals/funnel     → CampaignFunnelPage       (referrals:read)
 *     /referrals/milestones → MilestonesPage           (milestones:read)
 *     /referrals/credits    → CreditsLedgerPage        (credits:read)
 *     *                     → NotFoundPage
 *
 * All auth pages use AuthLayout (no sidebar).
 * All admin pages use AppLayout (sidebar + topbar).
 */
export const router = createBrowserRouter(
  [
    // ── Public-only auth routes ───────────────────────────────────────────────
    {
      element: <PublicOnlyRoute />,
      children: [
        {
          element: <AuthLayout />,
          children: [
            { path: "login", element: <LoginPage /> },
            { path: "password-change", element: <PasswordChangePage /> },
            { path: "totp/setup", element: <TotpSetupPage /> },
            { path: "totp/verify", element: <TotpVerifyPage /> },
          ],
        },
      ],
    },

    // ── Protected admin routes ────────────────────────────────────────────────
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: "/",
          element: <AppLayout />,
          children: [
            {
              index: true,
              element: <RootRedirect />,
            },
            {
              path: "dashboard",
              element: (
                <PermissionGuard permission="dashboard:read">
                  <DashboardPage />
                </PermissionGuard>
              ),
            },
            {
              path: "users",
              element: (
                <PermissionGuard permission="users:read">
                  <UsersPage />
                </PermissionGuard>
              ),
            },
            {
              path: "issues",
              element: (
                <PermissionGuard permission="issues:read">
                  <IssuesPage />
                </PermissionGuard>
              ),
            },
            {
              path: "admin-users",
              element: (
                <PermissionGuard permission="admin-users:read">
                  <AdminUsersPage />
                </PermissionGuard>
              ),
            },
            {
              path: "permissions",
              element: (
                <PermissionGuard permission="permissions:read">
                  <PermissionsPage />
                </PermissionGuard>
              ),
            },
            {
              path: "error-logs",
              element: (
                <PermissionGuard permission="error-logs:read">
                  <ErrorLogsPage />
                </PermissionGuard>
              ),
            },
            {
              path: "audit-logs",
              element: (
                <PermissionGuard permission="audit-logs:read">
                  <AuditLogsPage />
                </PermissionGuard>
              ),
            },
            {
              path: "analytics",
              element: (
                <PermissionGuard permission="analytics:read">
                  <AIAnalyticsPage />
                </PermissionGuard>
              ),
            },
            {
              path: "system-health",
              element: (
                <PermissionGuard permission="system-health:read">
                  <SystemHealthPage />
                </PermissionGuard>
              ),
            },
            {
              path: "subscriptions",
              element: (
                <PermissionGuard permission="settings:read">
                  <SubscriptionsPage />
                </PermissionGuard>
              ),
            },
            {
              path: "offers",
              element: (
                <PermissionGuard permission="offers:read">
                  <OffersPage />
                </PermissionGuard>
              ),
            },
            {
              path: "settings",
              element: (
                <PermissionGuard permission="settings:read">
                  <SettingsPage />
                </PermissionGuard>
              ),
            },
            {
              path: "desktop-app",
              element: (
                <PermissionGuard permission="settings:read">
                  <DesktopReleasePage />
                </PermissionGuard>
              ),
            },
            {
              path: "desktop-release",
              element: (
                <PermissionGuard permission="settings:read">
                  <DesktopReleasePage />
                </PermissionGuard>
              ),
            },
            {
              path: "credit-deduction",
              element: (
                <PermissionGuard permission="settings:read">
                  <CreditDeductionPage />
                </PermissionGuard>
              ),
            },
            {
              path: "credit deduction",
              element: (
                <PermissionGuard permission="settings:read">
                  <CreditDeductionPage />
                </PermissionGuard>
              ),
            },
            {
              path: "credit-dedaction",
              element: (
                <PermissionGuard permission="settings:read">
                  <CreditDeductionPage />
                </PermissionGuard>
              ),
            },
            {
              path: "credit dedaction",
              element: (
                <PermissionGuard permission="settings:read">
                  <CreditDeductionPage />
                </PermissionGuard>
              ),
            },
            {
              path: "referrals",
              element: (
                <PermissionGuard permission="referrals:read">
                  <ReferralDashboardPage />
                </PermissionGuard>
              ),
            },
            {
              path: "referrals/campaigns",
              element: (
                <PermissionGuard permission="campaigns:read">
                  <CampaignsPage />
                </PermissionGuard>
              ),
            },
            {
              path: "referrals/funnel",
              element: (
                <PermissionGuard permission="referrals:read">
                  <CampaignFunnelPage />
                </PermissionGuard>
              ),
            },
            {
              path: "referrals/milestones",
              element: (
                <PermissionGuard permission="milestones:read">
                  <MilestonesPage />
                </PermissionGuard>
              ),
            },
            {
              path: "referrals/credits",
              element: (
                <PermissionGuard permission="credits:read">
                  <CreditsLedgerPage />
                </PermissionGuard>
              ),
            },
            {
              path: "influencers",
              element: (
                <PermissionGuard permission="influencers:view">
                  <InfluencerManagementPage />
                </PermissionGuard>
              ),
            },
            {
              path: "influencer",
              element: <RootRedirect />,
            },
            {
              path: "influencer/dashboard",
              element: (
                <InfluencerRouteGuard>
                  <InfluencerDashboardPage />
                </InfluencerRouteGuard>
              ),
            },
            {
              path: "influencer/referrals",
              element: (
                <InfluencerRouteGuard>
                  <InfluencerReferralsPage />
                </InfluencerRouteGuard>
              ),
            },
            {
              path: "influencer/conversions",
              element: (
                <InfluencerRouteGuard>
                  <InfluencerConversionsPage />
                </InfluencerRouteGuard>
              ),
            },
            {
              path: "influencer/payouts",
              element: (
                <InfluencerRouteGuard>
                  <InfluencerPayoutsPage />
                </InfluencerRouteGuard>
              ),
            },
            {
              path: "*",
              element: <NotFoundPage />,
            },
          ],
        },
      ],
    },
  ],
  {
    basename: "/admin",
  },
);
