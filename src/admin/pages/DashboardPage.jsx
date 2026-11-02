import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DateRangeFilter,
  DashboardKpiSection,
  UserGrowthSection,
  FeatureUsageSection,
  RecentActivitySection,
  AiApiCreditUsageSection,
  TopUsersSection,
  getPresetDateRange,
  getPresetLabel,
  useDashboardSummary,
  useDashboardUsers,
  useDashboardContent,
  useDashboardActivity,
  useDashboardTopUsers,
  useDashboardAiApiUsage,
  dashboardKeys,
} from "@/features/dashboard";
import "./DashboardPage.css";

function IconRefresh() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

export function DashboardPage() {
  const [preset, setPreset] = useState("30d");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Compute the from/to dates based on the active preset
  const dateRange = useMemo(() => getPresetDateRange(preset), [preset]);

  // Queries
  const summaryQuery = useDashboardSummary();
  const usersQuery = useDashboardUsers(dateRange.from, dateRange.to);
  const contentQuery = useDashboardContent(dateRange.from, dateRange.to);
  const activityQuery = useDashboardActivity(10);
  const topUsersQuery = useDashboardTopUsers(10);
  const aiApiUsageQuery = useDashboardAiApiUsage(dateRange.from, dateRange.to);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="dashboard-page" role="main" aria-label="Admin Dashboard">
      {/* Header with Title and Unified Date Range Filter */}
      <header className="dashboard-page__header">
        <div>
          <h1 className="dashboard-page__title">Dashboard</h1>
          <p className="dashboard-page__subtitle">
            Overview of platform activity, user growth and interview copilot
            metrics ({getPresetLabel(preset)})
          </p>
        </div>

        <div className="dashboard-page__controls">
          <DateRangeFilter
            preset={preset}
            onChange={setPreset}
            disabled={isRefreshing}
          />
          <button
            type="button"
            className={`dashboard-page__refresh-btn${isRefreshing ? " dashboard-page__refresh-btn--spinning" : ""}`}
            onClick={handleRefresh}
            title="Refresh dashboard data"
            aria-label="Refresh dashboard data"
          >
            <IconRefresh />
          </button>
        </div>
      </header>

      {/* Top: KPI Cards */}
      <section className="dashboard-page__section" aria-label="Top KPIs">
        <DashboardKpiSection
          data={summaryQuery.data}
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          error={summaryQuery.error}
          onRetry={() => summaryQuery.refetch()}
        />
      </section>

      {/* User Growth Chart */}
      <section className="dashboard-page__section" aria-label="User Growth">
        <UserGrowthSection
          data={usersQuery.data}
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          error={usersQuery.error}
          onRetry={() => usersQuery.refetch()}
        />
      </section>

      {/* Middle Row: AI API / Credit Usage BESIDE Top 10 Active Users */}
      <section
        className="dashboard-page__section"
        aria-label="AI API / Credit Usage and Top Active Users"
      >
        <div className="dashboard-page__split-grid">
          <AiApiCreditUsageSection
            data={aiApiUsageQuery.data}
            isLoading={aiApiUsageQuery.isLoading}
            isError={aiApiUsageQuery.isError}
            error={aiApiUsageQuery.error}
            onRetry={() => aiApiUsageQuery.refetch()}
          />

          <TopUsersSection
            data={topUsersQuery.data}
            isLoading={topUsersQuery.isLoading}
            isError={topUsersQuery.isError}
            error={topUsersQuery.error}
            onRetry={() => topUsersQuery.refetch()}
          />
        </div>
      </section>

      {/* AI Feature Usage: Directly BELOW AI API / Credit Usage and Top Users */}
      <section
        className="dashboard-page__section"
        aria-label="AI Feature Usage"
      >
        <FeatureUsageSection
          data={contentQuery.data}
          isLoading={contentQuery.isLoading}
          isError={contentQuery.isError}
          error={contentQuery.error}
          onRetry={() => contentQuery.refetch()}
        />
      </section>

      {/* Recent Activity Feed */}
      <section className="dashboard-page__section" aria-label="Recent Activity">
        <RecentActivitySection
          data={activityQuery.data}
          isLoading={activityQuery.isLoading}
          isError={activityQuery.isError}
          error={activityQuery.error}
          onRetry={() => activityQuery.refetch()}
        />
      </section>
    </div>
  );
}
