import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IssuesPage } from "@/pages/IssuesPage";
import * as issuesApi from "../api/issuesApi";

vi.mock("../api/issuesApi", () => ({
  fetchIssues: vi.fn(),
  fetchIssueStats: vi.fn(),
  fetchIssueById: vi.fn(),
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  assignIssue: vi.fn(),
  resolveIssue: vi.fn(),
  closeIssue: vi.fn(),
}));

function renderIssuesPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <IssuesPage />
    </QueryClientProvider>,
  );
}

describe("Issues & Reports Feature — Admin Issues Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Issues page header, KPI cards, and issue table", async () => {
    vi.mocked(issuesApi.fetchIssueStats).mockResolvedValueOnce({
      total: 5,
      open: 2,
      investigating: 1,
      resolved: 1,
      closed: 1,
      critical: 1,
    });
    vi.mocked(issuesApi.fetchIssues).mockResolvedValueOnce({
      ok: true,
      issues: [
        {
          id: "iss-1",
          title: "Audio sync delay on Gemini response",
          description:
            "User reported 2000ms delay between LLM streaming and audio playback.",
          type: "ai_failure",
          priority: "critical",
          status: "open",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: { id: "usr-1", name: "Dev Tester", email: "dev@test.com" },
          assignee: null,
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    renderIssuesPage();

    expect(screen.getByText("Issues & Reports")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(
        screen.getByText("Audio sync delay on Gemini response"),
      ).toBeInTheDocument();
      expect(screen.getByText("dev@test.com")).toBeInTheDocument();
      expect(screen.getByText("critical")).toBeInTheDocument();
      expect(screen.getByText("open")).toBeInTheDocument();
    });
  });

  it("opens issue detail modal when Inspect button is clicked", async () => {
    vi.mocked(issuesApi.fetchIssueStats).mockResolvedValueOnce({
      total: 1,
      open: 1,
      investigating: 0,
      resolved: 0,
      closed: 0,
      critical: 0,
    });
    vi.mocked(issuesApi.fetchIssues).mockResolvedValueOnce({
      ok: true,
      issues: [
        {
          id: "iss-2",
          title: "Microphone disconnect during session",
          description: "Client lost connection to audio stream midway.",
          type: "recording_failure",
          priority: "high",
          status: "open",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: { id: "usr-2", name: "Interviewee", email: "user@test.com" },
          session: {
            id: "sess-88",
            title: "System Design Session",
            tech: "Node.js",
          },
          assignee: null,
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    renderIssuesPage();

    const inspectBtn = await screen.findByRole("button", { name: /inspect/i });
    await userEvent.click(inspectBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Client lost connection to audio stream midway."),
      ).toBeInTheDocument();
      expect(screen.getByText(/System Design Session/i)).toBeInTheDocument();
    });
  });

  it("renders ErrorState with retry button when API returns error", async () => {
    vi.mocked(issuesApi.fetchIssueStats).mockResolvedValueOnce({
      total: 0,
      open: 0,
      investigating: 0,
      resolved: 0,
      closed: 0,
      critical: 0,
    });
    vi.mocked(issuesApi.fetchIssues).mockRejectedValueOnce(
      new Error("Internal Database Timeout"),
    );

    renderIssuesPage();

    await waitFor(() => {
      expect(screen.getByText("Unable to load issues")).toBeInTheDocument();
      expect(screen.getByText("Internal Database Timeout")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /try again/i }),
      ).toBeInTheDocument();
    });
  });
});
