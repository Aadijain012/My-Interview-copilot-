/**
 * dashboard.test.tsx — Unit & integration tests for Admin Dashboard.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DateRangeFilter,
  DashboardKpiSection,
  UserGrowthSection,
  FeatureUsageSection,
  RecentActivitySection,
  AiApiCreditUsageSection,
  TopUsersSection,
} from "../index";
import { DashboardPage } from "@/pages/DashboardPage";
import * as dashboardApi from "../api/dashboardApi";

// ── Mock API data ─────────────────────────────────────────────────────────────

const MOCK_SUMMARY = {
  users: { total: 1250, active: 450 },
  interviews: { total: 480 },
  storage: { totalBytes: 1073741824 },
  sessions: {
    total: 480,
    withRecording: 320,
    avgDurationSeconds: 1540,
  },
  referrals: {
    total: 88,
  },
  content: {
    questions: 3100,
    aiAnswers: 2950,
    aiModels: [
      {
        model: "grok-4.20-0309-non-reasoning",
        provider: "xai",
        count: 2000,
        percentage: 67.8,
      },
      {
        model: "gpt-4o-mini",
        provider: "openai",
        count: 950,
        percentage: 32.2,
      },
    ],
    transcriptSegments: 14200,
    notes: 890,
    recordings: 320,
  },
  activity: { auditEvents: 540 },
};

const MOCK_AI_API_USAGE = {
  range: null,
  balanceSource: "estimated",
  totalBudget: 300,
  totalUsage: 224.5,
  totalRemaining: 75.5,
  overallPercentage: 74.8,
  overallStatus: "warning",
  overallStatusMessage: "⚠️ Warning — API budget is getting low.",
  providers: [
    {
      provider: "OpenAI",
      providerId: "openai",
      usage: 81.9,
      budget: 100,
      remaining: 18.1,
      usagePercentage: 81.9,
      status: "warning",
      statusLabel: "Warning",
      statusLevel: "warning",
      statusMessage: "⚠️ Warning — API budget is getting low.",
      requestCount: 210,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      estimatedCost: 81.9,
      costUnavailable: false,
      currency: "USD",
      currencySymbol: "$",
      balanceSource: "estimated",
    },
    {
      provider: "Anthropic",
      providerId: "anthropic",
      usage: 51.6,
      budget: 100,
      remaining: 48.4,
      usagePercentage: 51.6,
      status: "normal",
      statusLabel: "Normal",
      statusLevel: "normal",
      statusMessage: "Normal",
      requestCount: 120,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      estimatedCost: 51.6,
      costUnavailable: false,
      currency: "USD",
      currencySymbol: "$",
      balanceSource: "estimated",
    },
    {
      provider: "Grok",
      providerId: "grok",
      usage: 91,
      budget: 100,
      remaining: 9,
      usagePercentage: 91,
      status: "critical",
      statusLabel: "Critical",
      statusLevel: "danger",
      statusMessage: "🔴 Critical — API budget critically low.",
      requestCount: 325,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      estimatedCost: 91,
      costUnavailable: false,
      currency: "USD",
      currencySymbol: "$",
      balanceSource: "estimated",
    },
  ],
};

const MOCK_TOP_USERS = [
  {
    rank: 1,
    id: "usr-1",
    name: "Top Learner",
    email: "toplearner@example.com",
    usageCount: 420,
    sessionsCount: 15,
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  {
    rank: 2,
    id: "usr-2",
    name: "Tech Candidate",
    email: "tech@example.com",
    usageCount: 310,
    sessionsCount: 11,
    createdAt: "2026-08-10T00:00:00.000Z",
  },
];

const MOCK_USERS = {
  range: { from: "2026-08-21T00:00:00.000Z", to: "2026-09-21T00:00:00.000Z" },
  total: 1250,
  newInRange: 185,
  dailySignups: [
    { date: "2026-09-01", count: 5 },
    { date: "2026-09-02", count: 12 },
    { date: "2026-09-03", count: 8 },
  ],
};

const MOCK_SESSIONS = {
  range: { from: "2026-08-21T00:00:00.000Z", to: "2026-09-21T00:00:00.000Z" },
  totalInRange: 75,
  avgDurationSeconds: 1420,
  topTechs: [
    { tech: "React", count: 35 },
    { tech: "Node.js", count: 25 },
    { tech: "Python", count: 15 },
  ],
  dailySessions: [
    { date: "2026-09-01", count: 2 },
    { date: "2026-09-02", count: 5 },
  ],
};

const MOCK_ACTIVITY = [
  {
    id: "act-1",
    action: "admin.auth.login",
    actorId: "adm-1",
    actorName: "Super Admin",
    targetId: null,
    metadata: { ip: "127.0.0.1" },
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: "act-2",
    action: "admin.user.created",
    actorId: "adm-2",
    actorName: "Ops Lead",
    targetId: "adm-3",
    metadata: { role: "viewer" },
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
];

const MOCK_CONTENT = {
  range: { from: "2026-08-21T00:00:00.000Z", to: "2026-09-21T00:00:00.000Z" },
  questions: 450,
  aiAnswers: 440,
  aiModels: [
    {
      model: "grok-4.20-0309-non-reasoning",
      provider: "xai",
      count: 300,
      percentage: 68.2,
    },
    { model: "gpt-4o-mini", provider: "openai", count: 140, percentage: 31.8 },
  ],
  transcriptSegments: 2100,
  notes: 120,
  recordings: 55,
};

// ── Test helpers ──────────────────────────────────────────────────────────────

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("Admin Dashboard Feature Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. DateRangeFilter ──────────────────────────────────────────────────────
  describe("DateRangeFilter", () => {
    it("renders all three preset options with 30d selected by default", () => {
      const onChange = vi.fn();
      render(<DateRangeFilter preset="30d" onChange={onChange} />);

      expect(
        screen.getByRole("button", { name: "Last 7 days" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Last 30 days" }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        screen.getByRole("button", { name: "Last 90 days" }),
      ).toBeInTheDocument();
    });

    it("triggers onChange when clicking a different preset", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DateRangeFilter preset="30d" onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: "Last 7 days" }));
      expect(onChange).toHaveBeenCalledWith("7d");
    });
  });

  // ── 2. DashboardKpiSection ───────────────────────────────────────────────────
  describe("DashboardKpiSection", () => {
    it("renders primary KPI cards with correct metric values", () => {
      render(
        <DashboardKpiSection
          data={MOCK_SUMMARY}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText("Total Users")).toBeInTheDocument();
      expect(screen.getByText("1,250")).toBeInTheDocument();
      expect(screen.getByText("Active Users")).toBeInTheDocument();
      expect(screen.getByText("450")).toBeInTheDocument();
      expect(screen.getByText("Total Storage Used")).toBeInTheDocument();
      expect(screen.getByText("1 GB")).toBeInTheDocument();
      expect(screen.getByText("Total Referrals")).toBeInTheDocument();
      expect(screen.getByText("88")).toBeInTheDocument();
    });

    it("renders error state with retry callback when API fails", async () => {
      const onRetry = vi.fn();
      render(
        <DashboardKpiSection
          isLoading={false}
          isError={true}
          error={new Error("Database unavailable")}
          onRetry={onRetry}
        />,
      );

      expect(
        screen.getByText("Could not load summary metrics"),
      ).toBeInTheDocument();
      expect(screen.getByText("Database unavailable")).toBeInTheDocument();
      const retryBtn = screen.getByRole("button", { name: /try again/i });
      await userEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  // ── 3. UserGrowthSection ────────────────────────────────────────────────────
  describe("UserGrowthSection", () => {
    it("renders user totals and new signups count", () => {
      render(
        <UserGrowthSection
          data={MOCK_USERS}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText("User Growth & Signups")).toBeInTheDocument();
      expect(
        screen.getByText(/1,250 total platform users/),
      ).toBeInTheDocument();
      expect(screen.getByText(/185 signups/)).toBeInTheDocument();
    });
  });

  // ── 4. FeatureUsageSection ──────────────────────────────────────────────────
  describe("FeatureUsageSection", () => {
    it("renders all AI feature usage counters with labels and formatting", () => {
      render(
        <FeatureUsageSection
          data={MOCK_CONTENT}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText("AI & Feature Usage")).toBeInTheDocument();
      expect(screen.getByText("440")).toBeInTheDocument(); // AI Answers
      expect(screen.getByText("450")).toBeInTheDocument(); // Questions Asked
      expect(screen.getByText("2,100")).toBeInTheDocument(); // Transcripts
      expect(screen.getByText("120")).toBeInTheDocument(); // Notes
      expect(screen.getByText("55")).toBeInTheDocument(); // Recordings
    });
  });

  // ── 5. RecentActivitySection ────────────────────────────────────────────────
  describe("RecentActivitySection", () => {
    it("renders activity events with action titles, tags and relative time", () => {
      render(
        <RecentActivitySection
          data={MOCK_ACTIVITY}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText("Recent Platform Activity")).toBeInTheDocument();
      expect(screen.getByText("Admin Auth Login")).toBeInTheDocument();
      expect(screen.getByText("Admin User Created")).toBeInTheDocument();
      expect(screen.getByText("admin.auth.login")).toBeInTheDocument();
      expect(screen.getByText("admin.user.created")).toBeInTheDocument();
    });

    it("renders empty state when no activity exists", () => {
      render(
        <RecentActivitySection data={[]} isLoading={false} isError={false} />,
      );

      expect(
        screen.getByText("No recent activity recorded"),
      ).toBeInTheDocument();
    });
  });

  // ── 6. AiApiCreditUsageSection ────────────────────────────────────────────
  describe("AiApiCreditUsageSection", () => {
    it("renders provider credit usage, budget, remaining, percentages, and warning states", () => {
      render(
        <AiApiCreditUsageSection
          data={MOCK_AI_API_USAGE}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText("AI API / Credit Usage")).toBeInTheDocument();
      expect(screen.getByText("OpenAI")).toBeInTheDocument();
      expect(screen.getByText("Anthropic")).toBeInTheDocument();
      expect(screen.getByText("Grok")).toBeInTheDocument();

      // Usage & Budget
      expect(screen.getByText("$81.90 / $100.00")).toBeInTheDocument();
      expect(screen.getByText("(81.9% used)")).toBeInTheDocument();
      expect(screen.getByText("$18.10 remaining")).toBeInTheDocument();

      expect(screen.getByText("$51.60 / $100.00")).toBeInTheDocument();
      expect(screen.getByText("(51.6% used)")).toBeInTheDocument();
      expect(screen.getByText("$48.40 remaining")).toBeInTheDocument();

      expect(screen.getByText("$91.00 / $100.00")).toBeInTheDocument();
      expect(screen.getByText("(91% used)")).toBeInTheDocument();
      expect(screen.getByText("$9.00 remaining")).toBeInTheDocument();

      // Warning and Critical Badges & Advisories
      expect(screen.getByText("⚠️ Warning")).toBeInTheDocument();
      expect(screen.getByText("Normal")).toBeInTheDocument();
      expect(screen.getByText("🔴 Critical")).toBeInTheDocument();
      expect(
        screen.getByText("⚠️ Warning — API budget is getting low."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("🔴 Critical — API budget critically low."),
      ).toBeInTheDocument();
      expect(screen.getAllByText("Estimated Remaining").length).toBeGreaterThan(
        0,
      );
    });

    it("renders exhausted state correctly when usage exceeds budget", () => {
      const exhaustedData = {
        ...MOCK_AI_API_USAGE,
        providers: [
          {
            provider: "Grok",
            providerId: "grok",
            usage: 105,
            budget: 100,
            remaining: 0,
            usagePercentage: 100,
            status: "exhausted",
            statusLabel: "Exhausted",
            statusLevel: "danger",
            statusMessage:
              "🔴 Exhausted — API credits consumed. Top up immediately.",
            requestCount: 400,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            estimatedCost: 105,
            currency: "USD",
            currencySymbol: "$",
            balanceSource: "estimated",
          },
        ],
      };

      render(
        <AiApiCreditUsageSection
          data={exhaustedData}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText("🔴 Exhausted")).toBeInTheDocument();
      expect(screen.getByText("$0.00 remaining")).toBeInTheDocument();
      expect(
        screen.getByText(
          "🔴 Exhausted — API credits consumed. Top up immediately.",
        ),
      ).toBeInTheDocument();
    });

    it("renders loading state with skeletons", () => {
      render(<AiApiCreditUsageSection isLoading={true} isError={false} />);

      expect(screen.getByText("AI API / Credit Usage")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Monitoring internal provider budget & credit consumption…",
        ),
      ).toBeInTheDocument();
    });

    it("renders error state with retry button", () => {
      const onRetry = vi.fn();
      render(
        <AiApiCreditUsageSection
          isLoading={false}
          isError={true}
          error={new Error("Network error")}
          onRetry={onRetry}
        />,
      );

      expect(
        screen.getByText("Failed to load AI API usage"),
      ).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    it("renders empty state when no provider usage exists", () => {
      render(
        <AiApiCreditUsageSection
          data={{ ...MOCK_AI_API_USAGE, providers: [] }}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText("No AI Provider Configured")).toBeInTheDocument();
    });
  });

  // ── 7. TopUsersSection ─────────────────────────────────────────────────────
  describe("TopUsersSection", () => {
    it("renders top active users with rank, name, email, usage, and sessions", () => {
      render(
        <TopUsersSection
          data={MOCK_TOP_USERS}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText("Top 10 Most Active Users")).toBeInTheDocument();
      expect(screen.getByText("Top Learner")).toBeInTheDocument();
      expect(screen.getByText("toplearner@example.com")).toBeInTheDocument();
      expect(screen.getByText("420")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("Tech Candidate")).toBeInTheDocument();
      expect(screen.getByText("310")).toBeInTheDocument();
    });

    it("renders empty state when no active users exist", () => {
      render(<TopUsersSection data={[]} isLoading={false} isError={false} />);

      expect(screen.getByText("No user activity recorded")).toBeInTheDocument();
    });
  });

  // ── 8. DashboardPage Full Integration ───────────────────────────────────────
  describe("DashboardPage Full View", () => {
    it("loads and displays all dashboard sections using API mocks", async () => {
      vi.spyOn(dashboardApi, "fetchDashboardSummary").mockResolvedValue(
        MOCK_SUMMARY,
      );
      vi.spyOn(dashboardApi, "fetchDashboardUsers").mockResolvedValue(
        MOCK_USERS,
      );
      vi.spyOn(dashboardApi, "fetchDashboardSessions").mockResolvedValue(
        MOCK_SESSIONS,
      );
      vi.spyOn(dashboardApi, "fetchDashboardContent").mockResolvedValue(
        MOCK_CONTENT,
      );
      vi.spyOn(dashboardApi, "fetchDashboardActivity").mockResolvedValue(
        MOCK_ACTIVITY,
      );
      vi.spyOn(dashboardApi, "fetchDashboardTopUsers").mockResolvedValue(
        MOCK_TOP_USERS,
      );
      vi.spyOn(dashboardApi, "fetchDashboardAiApiUsage").mockResolvedValue(
        MOCK_AI_API_USAGE,
      );

      renderWithClient(<DashboardPage />);

      // Header title
      expect(
        screen.getByRole("heading", { level: 1, name: "Dashboard" }),
      ).toBeInTheDocument();

      // Top KPI Cards render
      await waitFor(() => {
        expect(screen.getByText("1,250")).toBeInTheDocument();
      });
      expect(screen.getByText("Active Users")).toBeInTheDocument();
      expect(screen.getByText("Total Storage Used")).toBeInTheDocument();
      expect(screen.getByText("1 GB")).toBeInTheDocument();
      expect(screen.getByText("Total Referrals")).toBeInTheDocument();
      expect(screen.getByText("88")).toBeInTheDocument();

      // User Growth Chart renders
      expect(screen.getByText("User Growth & Signups")).toBeInTheDocument();

      // AI API / Credit Usage renders and AI Model Usage is NOT rendered
      expect(screen.getByText("AI API / Credit Usage")).toBeInTheDocument();
      expect(screen.queryByText("AI Model Usage")).not.toBeInTheDocument();

      // Top 10 Users renders
      expect(screen.getByText("Top 10 Most Active Users")).toBeInTheDocument();

      // Feature Usage renders
      expect(screen.getByText("AI & Feature Usage")).toBeInTheDocument();

      // Recent Activity renders
      expect(screen.getByText("Recent Platform Activity")).toBeInTheDocument();
    });
  });
});
