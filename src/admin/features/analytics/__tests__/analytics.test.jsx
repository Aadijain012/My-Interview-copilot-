import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AIAnalyticsPage } from "@/pages/AIAnalyticsPage";
import * as analyticsApi from "../api/analyticsApi";

vi.mock("../api/analyticsApi", () => ({
  fetchAIAnalytics: vi.fn(),
}));

function renderAnalyticsPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AIAnalyticsPage />
    </QueryClientProvider>,
  );
}

describe("AI Analytics Feature — Admin Analytics Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders AI analytics metrics, models, and top users", async () => {
    vi.mocked(analyticsApi.fetchAIAnalytics).mockResolvedValueOnce({
      metrics: {
        totalRequests: 1200,
        totalResponses: 1180,
        totalSessions: 140,
        totalUsers: 85,
        aiErrorCount: 2,
        successRate: 98.3,
      },
      providers: [
        { provider: "gemini", model: "gemini-1.5-pro", count: 800 },
        { provider: "openai", model: "gpt-4o", count: 380 },
      ],
      topUsers: [
        {
          id: "usr-1",
          name: "Alice Smith",
          email: "alice@example.com",
          aiUsage: 450,
        },
      ],
    });

    renderAnalyticsPage();

    expect(screen.getByText("AI / Interview Analytics")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("1200")).toBeInTheDocument();
      expect(screen.getByText("1180")).toBeInTheDocument();
      expect(screen.getByText("98.3%")).toBeInTheDocument();
      expect(screen.getByText("gemini-1.5-pro")).toBeInTheDocument();
      expect(screen.getByText("gpt-4o")).toBeInTheDocument();
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.getByText("450")).toBeInTheDocument();
    });
  });

  it("renders ErrorState with retry button when analytics fetch fails", async () => {
    vi.mocked(analyticsApi.fetchAIAnalytics).mockRejectedValueOnce(
      new Error("AI Gateway unreachable"),
    );

    renderAnalyticsPage();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load AI analytics"),
      ).toBeInTheDocument();
      expect(screen.getByText("AI Gateway unreachable")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /try again/i }),
      ).toBeInTheDocument();
    });
  });
});
