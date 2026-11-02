import { apiFetch } from "@/api/client";

// ── Platform Runtime & Server Settings ────────────────────────────────────────

export async function fetchSettings() {
  return apiFetch("/settings");
}

export async function updateSettings(input) {
  return apiFetch("/settings", {
    method: "PATCH",
    data: input,
  });
}

// ── Subscription Plans ─────────────────────────────────────────────────────────

export async function fetchSubscriptionPlans() {
  return apiFetch("/settings/plans");
}

export async function fetchSubscriptionPlan(id) {
  return apiFetch(`/settings/plans/${id}`);
}

export async function updateSubscriptionPlan(id, input) {
  return apiFetch(`/settings/plans/${id}`, {
    method: "PATCH",
    data: input,
  });
}

// ── Platform Dynamic Pricing ──────────────────────────────────────────────────

export async function fetchPlatformPricing() {
  return apiFetch("/settings/pricing");
}

export async function updatePlatformPricing(input) {
  return apiFetch("/settings/pricing", {
    method: "PATCH",
    data: input,
  });
}

// ── Free Tier Rate Limiting ───────────────────────────────────────────────────

export async function fetchRateLimitConfig() {
  return apiFetch("/settings/rate-limit");
}

export async function updateRateLimitConfig(input) {
  return apiFetch("/settings/rate-limit", {
    method: "PATCH",
    data: input,
  });
}

// ── Free User Signup Bonus Credits ──────────────────────────────────────────

export async function fetchSignupBonus() {
  return apiFetch("/settings/signup-bonus");
}

export async function updateSignupBonus(credits) {
  return apiFetch("/settings/signup-bonus", {
    method: "PUT",
    data: { signupBonusCredits: credits },
  });
}
