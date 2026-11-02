import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SystemHealthPage } from "@/pages/SystemHealthPage";
import * as healthApi from "../api/systemHealthApi";

vi.mock("../api/systemHealthApi", () => ({
  fetchSystemHealth: vi.fn(),
}));

function renderHealthPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <SystemHealthPage />
    </QueryClientProvider>,
  );
}

describe("System Health Feature — Diagnostics Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders overall status banner and subsystem diagnostic cards", async () => {
    vi.mocked(healthApi.fetchSystemHealth).mockResolvedValueOnce({
      status: "HEALTHY",
      lastChecked: new Date().toISOString(),
      services: [
        {
          service: "PostgreSQL Database",
          status: "HEALTHY",
          responseTimeMs: 3,
          message: "Connected, read/write query successful",
          lastChecked: new Date().toISOString(),
        },
        {
          service: "Backend Node.js API",
          status: "HEALTHY",
          responseTimeMs: 0,
          message: "Uptime: 3600s, RSS: 120MB, Heap: 65MB",
          lastChecked: new Date().toISOString(),
        },
        {
          service: "AI Gateway Connectivity",
          status: "HEALTHY",
          responseTimeMs: 85,
          message: "AI Gateway HTTP probe succeeded",
          lastChecked: new Date().toISOString(),
        },
      ],
      system: {
        platform: "win32",
        arch: "x64",
        nodeVersion: "v20.11.0",
        uptimeSeconds: 3600,
        timestamp: new Date().toISOString(),
      },
    });

    renderHealthPage();

    expect(screen.getByText("System Health & Telemetry")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Platform Status:\s*HEALTHY/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("PostgreSQL Database")).toBeInTheDocument();
      expect(screen.getByText(/3 ms latency/i)).toBeInTheDocument();
      expect(screen.getByText("Backend Node.js API")).toBeInTheDocument();
      expect(screen.getByText("AI Gateway Connectivity")).toBeInTheDocument();
      expect(screen.getByText(/win32 \(x64\)/i)).toBeInTheDocument();
    });
  });

  it("renders ErrorState with retry when health probe fails", async () => {
    vi.mocked(healthApi.fetchSystemHealth).mockRejectedValueOnce(
      new Error("Connection refused to backend diagnostic port"),
    );

    renderHealthPage();

    await waitFor(() => {
      expect(screen.getByText("Diagnostics Check Failed")).toBeInTheDocument();
      expect(
        screen.getByText("Connection refused to backend diagnostic port"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /try again/i }),
      ).toBeInTheDocument();
    });
  });
});
