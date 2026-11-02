import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/influencerApi";

export const influencerKeys = {
  all: ["influencers"],
  overview: () => [...influencerKeys.all, "overview"],
  myDashboard: () => [...influencerKeys.all, "my-dashboard"],
  list: (params) => [...influencerKeys.all, "list", params],
  detail: (id) => [...influencerKeys.all, "detail", id],
  campaigns: (params) => [...influencerKeys.all, "campaigns", params],
  codes: (params) => [...influencerKeys.all, "codes", params],
  referrals: (params) => [...influencerKeys.all, "referrals", params],
  conversions: (params) => [...influencerKeys.all, "conversions", params],
  commissions: (params) => [...influencerKeys.all, "commissions", params],
  rules: (params) => [...influencerKeys.all, "rules", params],
  payouts: (params) => [...influencerKeys.all, "payouts", params],
};

// ── Overview & My Dashboard ───────────────────────────────────────────────

export function useInfluencerOverview(options = {}) {
  return useQuery({
    queryKey: influencerKeys.overview(),
    queryFn: api.fetchInfluencerOverview,
    staleTime: 30000,
    ...options,
  });
}

export function useMyInfluencerDashboard(options = {}) {
  return useQuery({
    queryKey: influencerKeys.myDashboard(),
    queryFn: api.fetchMyInfluencerDashboard,
    staleTime: 15000,
    ...options,
  });
}

// ── Influencers Collection ────────────────────────────────────────────────

export function useInfluencers(params = {}, options = {}) {
  return useQuery({
    queryKey: influencerKeys.list(params),
    queryFn: () => api.fetchInfluencers(params),
    staleTime: 30000,
    ...options,
  });
}

export function useInfluencerById(id, options = {}) {
  return useQuery({
    queryKey: influencerKeys.detail(id),
    queryFn: () => api.fetchInfluencerById(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function useCreateInfluencer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createInfluencer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

export function useUpdateInfluencer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.updateInfluencer(id, data),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
      qc.invalidateQueries({ queryKey: influencerKeys.detail(vars.id) });
    },
  });
}

export function useSuspendInfluencer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => api.suspendInfluencer(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

export function useReactivateInfluencer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.reactivateInfluencer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

export function useResendInfluencerWelcomeEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.resendInfluencerWelcomeEmail(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

export function useConfigurePayoutCurrency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, currency }) => api.configurePayoutCurrency(id, currency),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

// ── Campaigns ─────────────────────────────────────────────────────────────

export function useInfluencerCampaigns(params = {}, options = {}) {
  return useQuery({
    queryKey: influencerKeys.campaigns(params),
    queryFn: () => api.fetchInfluencerCampaigns(params),
    staleTime: 30000,
    ...options,
  });
}

export function useCreateInfluencerCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createInfluencerCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.campaigns() });
    },
  });
}

export function useUpdateInfluencerCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.updateInfluencerCampaign(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.campaigns() });
    },
  });
}

export function useAssignInfluencerToCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.assignInfluencerToCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

// ── Referral Codes ────────────────────────────────────────────────────────

export function useReferralCodes(params = {}, options = {}) {
  return useQuery({
    queryKey: influencerKeys.codes(params),
    queryFn: () => api.fetchReferralCodes(params),
    staleTime: 30000,
    ...options,
  });
}

export function useCreateReferralCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createReferralCode,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.codes() });
    },
  });
}

export function useUpdateReferralCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, ...rest }) => api.updateReferralCode(id, data || rest),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.codes() });
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

// ── Referrals ─────────────────────────────────────────────────────────────

export function useInfluencerReferrals(params = {}, options = {}) {
  return useQuery({
    queryKey: influencerKeys.referrals(params),
    queryFn: () => api.fetchInfluencerReferrals(params),
    staleTime: 30000,
    ...options,
  });
}

export function useUpdateReferralStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, data }) =>
      api.updateReferralStatus(id, { status: status || data?.status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

// ── Conversions & Commissions ─────────────────────────────────────────────

export function useInfluencerConversions(params = {}, options = {}) {
  return useQuery({
    queryKey: influencerKeys.conversions(params),
    queryFn: () => api.fetchInfluencerConversions(params),
    staleTime: 30000,
    ...options,
  });
}

export function useUpdateConversionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, data }) =>
      api.updateConversionStatus(id, { status: status || data?.status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

export function useInfluencerCommissions(params = {}, options = {}) {
  return useQuery({
    queryKey: influencerKeys.commissions(params),
    queryFn: () => api.fetchInfluencerCommissions(params),
    staleTime: 30000,
    ...options,
  });
}

export function useUpdateCommissionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, payoutNotes }) => api.updateCommissionStatus(id, { status, payoutNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

// ── Commission Tier Rules ─────────────────────────────────────────────────

export function useCommissionRules(params = {}, options = {}) {
  return useQuery({
    queryKey: influencerKeys.rules(params),
    queryFn: () => api.fetchCommissionRules(params),
    staleTime: 60000,
    ...options,
  });
}

export function useCreateCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createCommissionRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

export function useUpdateCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.updateCommissionRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

export function useDeleteCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteCommissionRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

// ── Payouts ───────────────────────────────────────────────────────────────

export function usePayouts(params = {}, options = {}) {
  return useQuery({
    queryKey: influencerKeys.payouts(params),
    queryFn: () => api.fetchPayouts(params),
    staleTime: 30000,
    ...options,
  });
}

export function useCreatePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPayout,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}

export function useUpdatePayoutStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes, data }) =>
      api.updatePayoutStatus(id, {
        status: status || data?.status,
        notes: notes !== undefined ? notes : data?.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: influencerKeys.all });
    },
  });
}
