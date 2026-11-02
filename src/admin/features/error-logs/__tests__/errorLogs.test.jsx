import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ErrorLogsPage } from "@/pages/ErrorLogsPage";
import * as errorLogsApi from "../api/errorLogsApi";
import { AuthContext } from "@/features/auth/AuthProvider";

const MOCK_ERROR_LOGS = [
  {
    id: "err-1",
    source: "api",
    severity: "critical",
    message: "Unhandled database connection timeout on /api/chat/stream",
    stackTrace:
      "Error: Connection timeout\n    at Database.connect (/app/db.js:42:15)",
    endpoint: "/api/chat/stream",
    method: "POST",
    statusCode: 500,
    userId: "usr-101",
    adminId: null,
    metadata: { attempt: 3 },
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: "2026-09-22T10:00:00.000Z",
  },
  {
    id: "err-2",
    source: "ai_service",
    severity: "error",
    message: "OpenAI upstream rate limit reached (HTTP 429)",
    stackTrace:
      "Error: Rate limit\n    at OpenAIClient.createCompletion (/app/ai.js:88:12)",
    endpoint: "/api/ai/completion",
    method: "POST",
    statusCode: 429,
    userId: "usr-202",
    adminId: null,
    metadata: { model: "gpt-4o" },
    resolved: true,
    resolvedAt: "2026-09-22T10:30:00.000Z",
    resolvedBy: "Lead Admin",
    createdAt: "2026-09-22T09:30:00.000Z",
  },
];

const MOCK_LIST_RESPONSE = {
  ok: true,
  data: MOCK_ERROR_LOGS,
  pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
};

const MOCK_STATS_RESPONSE = {
  ok: true,
  data: {
    totalErrors: 2,
    criticalErrors: 1,
    unresolvedErrors: 1,
    monitoringErrors: 3,
    todayErrors: 2,
    bySource: { api: 1, ai_service: 1 },
  },
};

function createMockAuth(role = "owner") {
  const admin = {
    id: "adm-1",
    email: "admin@kairos.ai",
    name: "Lead Admin",
    role,
  };
  return {
    admin,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setFullAuth: vi.fn(),
    handleRefreshSuccess: vi.fn(),
    handleRefreshFailure: vi.fn(),
  };
}

function renderErrorLogsPage(role = "owner") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const authValue = createMockAuth(role);
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={["/error-logs"]}>
          <ErrorLogsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ErrorLogsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(errorLogsApi, "fetchErrorLogs").mockResolvedValue(
      MOCK_LIST_RESPONSE,
    );
    vi.spyOn(errorLogsApi, "fetchErrorLogStats").mockResolvedValue(
      MOCK_STATS_RESPONSE,
    );
    vi.spyOn(errorLogsApi, "resolveErrorLog").mockImplementation(
      async (id, resolved) => {
        const existing =
          MOCK_ERROR_LOGS.find((e) => e.id === id) || MOCK_ERROR_LOGS[0];
        return {
          ok: true,
          data: {
            ...existing,
            resolved,
            resolvedAt: resolved ? new Date().toISOString() : null,
          },
        };
      },
    );
    vi.spyOn(errorLogsApi, "updateErrorLogStatus").mockImplementation(
      async (id, status) => {
        const existing =
          MOCK_ERROR_LOGS.find((e) => e.id === id) || MOCK_ERROR_LOGS[0];
        const isResolved = status === "resolved";
        return {
          ok: true,
          data: {
            ...existing,
            status,
            resolved: isResolved,
            resolvedAt: isResolved ? new Date().toISOString() : null,
          },
        };
      },
    );
    vi.spyOn(errorLogsApi, "triggerTestError").mockResolvedValue({
      ok: true,
      message: "Test error log generated",
      data: MOCK_ERROR_LOGS[0],
    });
  });

  it("denies access to viewers without error-logs:read permission", () => {
    renderErrorLogsPage("viewer");
    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
  });

  it("allows access to ops, admin, and owner roles", async () => {
    renderErrorLogsPage("ops");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Error Logs" }),
      ).toBeInTheDocument();
    });
  });

  it("renders all 4 summary metric cards correctly", async () => {
    renderErrorLogsPage("admin");
    await waitFor(() => {
      expect(screen.getByText("Total Logged Errors")).toBeInTheDocument();
      expect(screen.getByText("Critical Failures")).toBeInTheDocument();
      expect(screen.getByText("Unresolved Issues")).toBeInTheDocument();
      expect(screen.getByText("Errors Today (24h)")).toBeInTheDocument();
    });
  });

  it("renders error log items in the table with message, severity, and status", async () => {
    renderErrorLogsPage("owner");
    await waitFor(() => {
      expect(
        screen.getByText(/Unhandled database connection timeout/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/OpenAI upstream rate limit reached/i),
      ).toBeInTheDocument();
      expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    });
  });

  it("opens details modal with stack trace when clicking View", async () => {
    renderErrorLogsPage("owner");
    await waitFor(() => {
      expect(
        screen.getByText(/Unhandled database connection timeout/i),
      ).toBeInTheDocument();
    });
    const viewButtons = screen.getAllByRole("button", { name: "View" });
    fireEvent.click(viewButtons[0]);
    await waitFor(() => {
      expect(
        screen.getByText("Error Details & Stack Trace"),
      ).toBeInTheDocument();
      expect(screen.getByText(/at Database/i)).toBeInTheDocument();
    });
  });

  it("resolves an error when Mark Resolved button is clicked by admin/owner", async () => {
    renderErrorLogsPage("owner");
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: "Mark Resolved" })[0],
      ).toBeInTheDocument();
    });
    const resolveBtn = screen.getAllByRole("button", {
      name: "Mark Resolved",
    })[0];
    fireEvent.click(resolveBtn);
    await waitFor(() => {
      expect(errorLogsApi.updateErrorLogStatus).toHaveBeenCalledWith(
        "err-1",
        "resolved",
      );
    });
  });

  it("moves an error to monitoring when Save & Monitor button is clicked by admin/owner", async () => {
    renderErrorLogsPage("owner");
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: "Save & Monitor" })[0],
      ).toBeInTheDocument();
    });
    const monitorBtn = screen.getAllByRole("button", {
      name: "Save & Monitor",
    })[0];
    fireEvent.click(monitorBtn);
    await waitFor(() => {
      expect(errorLogsApi.updateErrorLogStatus).toHaveBeenCalledWith(
        "err-1",
        "monitoring",
      );
    });
  });

  it("filters errors by source when clicking Frontend or Backend tabs in toolbar", async () => {
    renderErrorLogsPage("owner");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Frontend" }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Frontend" }));
    await waitFor(() => {
      expect(errorLogsApi.fetchErrorLogs).toHaveBeenCalledWith(
        expect.objectContaining({ source: "frontend" }),
      );
    });
  });

  it("triggers a test error from the toolbar", async () => {
    renderErrorLogsPage("owner");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "+ Test Error" }),
      ).toBeInTheDocument();
    });
    const testBtn = screen.getByRole("button", { name: "+ Test Error" });
    fireEvent.click(testBtn);
    await waitFor(() => {
      expect(errorLogsApi.triggerTestError).toHaveBeenCalled();
    });
  });

  it("allows filtering by search term", async () => {
    const user = userEvent.setup();
    renderErrorLogsPage("owner");
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Search error message/i),
      ).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/Search error message/i);
    await user.type(searchInput, "timeout");
    await waitFor(() => {
      expect(errorLogsApi.fetchErrorLogs).toHaveBeenCalledWith(
        expect.objectContaining({ search: "timeout" }),
      );
    });
  });

  it("renders Total Errors Monitoring metric card", async () => {
    renderErrorLogsPage("admin");
    await waitFor(() => {
      expect(screen.getByText("Total Errors Monitoring")).toBeInTheDocument();
      expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("filters errors by status: monitoring when dedicated Monitoring button is clicked", async () => {
    renderErrorLogsPage("owner");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Monitoring/i }),
      ).toBeInTheDocument();
    });
    const monitorBtn = screen.getByRole("button", { name: /Monitoring/i });
    fireEvent.click(monitorBtn);
    await waitFor(() => {
      expect(errorLogsApi.fetchErrorLogs).toHaveBeenCalledWith(
        expect.objectContaining({ status: "monitoring" }),
      );
    });
  });

  it("filters errors by status: monitoring when Total Errors Monitoring card is clicked", async () => {
    renderErrorLogsPage("owner");
    await waitFor(() => {
      expect(screen.getByText("Total Errors Monitoring")).toBeInTheDocument();
    });
    const monitoringCard = screen
      .getByText("Total Errors Monitoring")
      .closest("div");
    expect(monitoringCard).not.toBeNull();
    fireEvent.click(monitoringCard);
    await waitFor(() => {
      expect(errorLogsApi.fetchErrorLogs).toHaveBeenCalledWith(
        expect.objectContaining({ status: "monitoring" }),
      );
    });
  });
});
