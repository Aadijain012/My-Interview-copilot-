import { apiFetchWithRefresh } from "@/api";

/**
 * Influencer Referral & Dashboard API Service
 * Encapsulates all backend HTTP interactions with `/api/admin/influencers`.
 */

export async function fetchInfluencerOverview() {
  const res = await apiFetchWithRefresh("/influencers/overview", {});
  return res.data;
}

export async function fetchMyInfluencerDashboard() {
  const res = await apiFetchWithRefresh("/influencers/my-dashboard", {});
  return res.data;
}

export async function fetchInfluencers(params = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.status) sp.set("status", params.status);
  if (params.platform) sp.set("platform", params.platform);
  if (params.campaignId) sp.set("campaignId", params.campaignId);
  if (params.search) sp.set("search", params.search);
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  if (params.order) sp.set("order", params.order);
  const qs = sp.toString();
  return apiFetchWithRefresh(`/influencers${qs ? `?${qs}` : ""}`, {});
}

export async function fetchInfluencerById(id) {
  const res = await apiFetchWithRefresh(`/influencers/${encodeURIComponent(id)}`, {});
  return res.influencer;
}

export async function createInfluencer(payload) {
  return apiFetchWithRefresh("/influencers", {
    method: "POST",
    data: payload,
  });
}

export async function updateInfluencer(id, payload) {
  return apiFetchWithRefresh(`/influencers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    data: payload,
  });
}

export async function suspendInfluencer(id, reason) {
  return apiFetchWithRefresh(`/influencers/${encodeURIComponent(id)}/suspend`, {
    method: "POST",
    data: { reason },
  });
}

export async function reactivateInfluencer(id) {
  return apiFetchWithRefresh(`/influencers/${encodeURIComponent(id)}/reactivate`, {
    method: "POST",
  });
}

export async function resendInfluencerWelcomeEmail(id) {
  return apiFetchWithRefresh(`/influencers/${encodeURIComponent(id)}/resend-welcome-email`, {
    method: "POST",
  });
}

export async function configurePayoutCurrency(id, currency) {
  return apiFetchWithRefresh(`/influencers/${encodeURIComponent(id)}/currency`, {
    method: "PATCH",
    data: { currency },
  });
}

// ── Campaigns ─────────────────────────────────────────────────────────────

export async function fetchInfluencerCampaigns(params = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.status) sp.set("status", params.status);
  if (params.search) sp.set("search", params.search);
  const qs = sp.toString();
  const res = await apiFetchWithRefresh(`/influencers/campaigns${qs ? `?${qs}` : ""}`, {});
  return res.items || [];
}

export async function createInfluencerCampaign(payload) {
  return apiFetchWithRefresh("/influencers/campaigns", {
    method: "POST",
    data: payload,
  });
}

export async function updateInfluencerCampaign(id, payload) {
  return apiFetchWithRefresh(`/influencers/campaigns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    data: payload,
  });
}

export async function assignInfluencerToCampaign(payload) {
  return apiFetchWithRefresh("/influencers/assign-campaign", {
    method: "POST",
    data: payload,
  });
}

// ── Referral Codes ────────────────────────────────────────────────────────

export async function fetchReferralCodes(params = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return apiFetchWithRefresh(`/influencers/codes${qs ? `?${qs}` : ""}`, {});
}

export async function createReferralCode(payload) {
  return apiFetchWithRefresh("/influencers/codes", {
    method: "POST",
    data: payload,
  });
}

export async function updateReferralCode(id, payload) {
  return apiFetchWithRefresh(`/influencers/codes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    data: payload,
  });
}

// ── Referrals ─────────────────────────────────────────────────────────────

export async function fetchInfluencerReferrals(params = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.influencerId) sp.set("influencerId", params.influencerId);
  if (params.status) sp.set("status", params.status);
  if (params.platform) sp.set("platform", params.platform);
  if (params.source) sp.set("source", params.source);
  if (params.search) sp.set("search", params.search);
  const qs = sp.toString();
  return apiFetchWithRefresh(`/influencers/referrals${qs ? `?${qs}` : ""}`, {});
}

export async function updateReferralStatus(id, payload) {
  return apiFetchWithRefresh(`/influencers/referrals/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    data: payload,
  });
}

// ── Conversions & Commissions ─────────────────────────────────────────────

export async function fetchInfluencerConversions(params = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.influencerId) sp.set("influencerId", params.influencerId);
  if (params.status) sp.set("status", params.status);
  if (params.platform) sp.set("platform", params.platform);
  if (params.source) sp.set("source", params.source);
  const qs = sp.toString();
  return apiFetchWithRefresh(`/influencers/conversions${qs ? `?${qs}` : ""}`, {});
}

export async function updateConversionStatus(id, payload) {
  return apiFetchWithRefresh(`/influencers/conversions/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    data: payload,
  });
}

export async function fetchInfluencerCommissions(params = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.influencerId) sp.set("influencerId", params.influencerId);
  if (params.status) sp.set("status", params.status);
  const qs = sp.toString();
  return apiFetchWithRefresh(`/influencers/commissions${qs ? `?${qs}` : ""}`, {});
}

export async function updateCommissionStatus(id, payload) {
  return apiFetchWithRefresh(`/influencers/commissions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    data: payload,
  });
}

// ── Commission Tier Rules ─────────────────────────────────────────────────

export async function fetchCommissionRules(params = {}) {
  const sp = new URLSearchParams();
  if (params.planId) sp.set("planId", params.planId);
  const qs = sp.toString();
  const res = await apiFetchWithRefresh(`/influencers/commission-rules${qs ? `?${qs}` : ""}`, {});
  return res.rules || [];
}

export async function createCommissionRule(payload) {
  return apiFetchWithRefresh("/influencers/commission-rules", {
    method: "POST",
    data: payload,
  });
}

export async function updateCommissionRule(id, payload) {
  return apiFetchWithRefresh(`/influencers/commission-rules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    data: payload,
  });
}

export async function deleteCommissionRule(id) {
  return apiFetchWithRefresh(`/influencers/commission-rules/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── Payouts ───────────────────────────────────────────────────────────────

export async function fetchPayouts(params = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.influencerId) sp.set("influencerId", params.influencerId);
  if (params.status) sp.set("status", params.status);
  const qs = sp.toString();
  return apiFetchWithRefresh(`/influencers/payouts${qs ? `?${qs}` : ""}`, {});
}

export async function createPayout(payload) {
  return apiFetchWithRefresh("/influencers/payouts", {
    method: "POST",
    data: payload,
  });
}

export async function updatePayoutStatus(id, payload) {
  return apiFetchWithRefresh(`/influencers/payouts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    data: payload,
  });
}
