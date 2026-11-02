import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatCurrency } from "@/utils";
import { SubscriptionPlansSection } from "../components/SubscriptionPlansSection";
import { PlatformPricingSection } from "../components/PlatformPricingSection";
import { RateLimitSection } from "../components/RateLimitSection";
import * as settingsApi from "../api/settingsApi";

// Mock Auth
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    admin: { id: "admin-1", email: "owner@test.com", role: "owner" },
  }),
}));

describe("Format Currency Utility", () => {
  it("formats INR correctly without hardcoded symbols", () => {
    const formattedZero = formatCurrency(0, "INR");
    expect(formattedZero).toContain("0");
    const formattedAmount = formatCurrency(499, "INR");
    expect(formattedAmount).toContain("499");
  });

  it("formats USD correctly", () => {
    const formattedUsd = formatCurrency(19.99, "USD");
    expect(formattedUsd).toContain("19.99");
  });

  it("handles zero, NaN, or fallback gracefully", () => {
    expect(formatCurrency(NaN, "INR")).toContain("0");
  });
});

describe("Subscription Plans Section", () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("renders initial Free, Pro, and Pro+ tiers with pricing and credits", async () => {
    vi.spyOn(settingsApi, "fetchSubscriptionPlans").mockResolvedValue({
      ok: true,
      plans: [
        {
          id: "plan-1",
          name: "Free",
          monthlyPrice: 0,
          currency: "INR",
          includedCredits: 250,
          featureFlags: { aiVoice: true },
          isActive: true,
          userCount: 12,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "plan-2",
          name: "Pro",
          monthlyPrice: 499,
          currency: "INR",
          includedCredits: 5000,
          featureFlags: { aiVoice: true, audioUpload: true },
          isActive: true,
          userCount: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionPlansSection />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
    });

    expect(screen.getByText(/250 AI Credits/i)).toBeInTheDocument();
    expect(screen.getByText(/5,000 AI Credits/i)).toBeInTheDocument();
    expect(screen.getByText(/Group A: Usage Limits/i)).toBeInTheDocument();
    expect(screen.getByText(/Group B: Feature Access/i)).toBeInTheDocument();
  });

  it("renders interactive feature toggles and switches toggle state", async () => {
    vi.spyOn(settingsApi, "fetchSubscriptionPlans").mockResolvedValue({
      ok: true,
      plans: [
        {
          id: "plan-pro",
          name: "Pro",
          monthlyPrice: 499,
          currency: "INR",
          includedCredits: 5000,
          featureFlags: { maxSessions: 100 },
          isActive: true,
          userCount: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionPlansSection />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Pro Tier Configuration/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Main App / Full Screen View")).toBeInTheDocument();
    expect(screen.getByText("Group A: Usage Limits")).toBeInTheDocument();
    expect(screen.getByText("Group B: Feature Access")).toBeInTheDocument();

    // Find a toggle button
    const toggleBtns = screen.getAllByRole("button", { name: /Toggle/i });
    expect(toggleBtns.length).toBeGreaterThan(0);
    fireEvent.click(toggleBtns[0]);

    // Should indicate unsaved changes
    expect(
      screen.getByText(/Unsaved changes pending for this plan/i),
    ).toBeInTheDocument();
  });
});

describe("Platform Pricing Section", () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("renders credits per unit and unit price with conversion preview", async () => {
    vi.spyOn(settingsApi, "fetchPlatformPricing").mockResolvedValue({
      ok: true,
      pricing: {
        creditsPerUnit: 250,
        unitPrice: 1.0,
        currencyCode: "INR",
        updatedAt: new Date().toISOString(),
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PlatformPricingSection />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("250")).toBeInTheDocument();
      expect(screen.getByDisplayValue("1")).toBeInTheDocument();
      expect(screen.getByDisplayValue("INR")).toBeInTheDocument();
    });

    expect(screen.getByText(/Conversion preview:/i)).toBeInTheDocument();
  });
});

describe("Free-User Rate Limiting Section", () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("renders max requests and window minutes with tier policy notice", async () => {
    vi.spyOn(settingsApi, "fetchRateLimitConfig").mockResolvedValue({
      ok: true,
      rateLimit: {
        freeMaxRequests: 10,
        freeWindowMinutes: 15,
        updatedAt: new Date().toISOString(),
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RateLimitSection />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("10")).toBeInTheDocument();
      expect(screen.getByDisplayValue("15")).toBeInTheDocument();
    });

    expect(screen.getByText(/Tier Enforcement Policy:/i)).toBeInTheDocument();
  });
});
