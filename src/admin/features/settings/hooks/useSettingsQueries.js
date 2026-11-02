import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSettings,
  updateSettings,
  fetchSubscriptionPlans,
  updateSubscriptionPlan,
  fetchPlatformPricing,
  updatePlatformPricing,
  fetchRateLimitConfig,
  updateRateLimitConfig,
  fetchSignupBonus,
  updateSignupBonus,
} from "../api/settingsApi";

export const settingsKeys = {
  all: ["settings"],
  detail: () => [...settingsKeys.all, "detail"],
  plans: () => [...settingsKeys.all, "plans"],
  pricing: () => [...settingsKeys.all, "pricing"],
  rateLimit: () => [...settingsKeys.all, "rateLimit"],
};

// ── Platform Runtime Settings ─────────────────────────────────────────────────

export function useSettings(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: fetchSettings,
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => updateSettings(input),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.detail(), {
        ok: true,
        settings: data.settings,
      });
    },
  });
}

// ── Subscription Plans ─────────────────────────────────────────────────────────

export function useSubscriptionPlans(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.plans(),
    queryFn: fetchSubscriptionPlans,
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateSubscriptionPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }) => updateSubscriptionPlan(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.plans() });
    },
  });
}

// ── Platform Dynamic Pricing ──────────────────────────────────────────────────

export function usePlatformPricing(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.pricing(),
    queryFn: fetchPlatformPricing,
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdatePlatformPricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => updatePlatformPricing(input),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.pricing(), {
        ok: true,
        pricing: data.pricing,
      });
    },
  });
}

// ── Free Tier Rate Limiting ───────────────────────────────────────────────────

export function useRateLimitConfig(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.rateLimit(),
    queryFn: fetchRateLimitConfig,
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateRateLimitConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => updateRateLimitConfig(input),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.rateLimit(), {
        ok: true,
        rateLimit: data.rateLimit,
      });
    },
  });
}

// ── Free User Signup Bonus Credits ──────────────────────────────────────────

export function useSignupBonus(enabled = true) {
  return useQuery({
    queryKey: ["settings", "signupBonus"],
    queryFn: fetchSignupBonus,
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateSignupBonus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credits) => updateSignupBonus(credits),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings", "signupBonus"], data);
      queryClient.invalidateQueries({ queryKey: settingsKeys.plans() });
    },
  });
}
