import { apiFetchWithRefresh } from "@/api";

export async function fetchReferralDashboard(from, to) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return apiFetchWithRefresh(`/referrals/dashboard${qs ? "?" + qs : ""}`, {});
}

export async function fetchReferrals(params) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.status) sp.set("status", params.status);
  if (params.campaignId) sp.set("campaignId", params.campaignId);
  if (params.search) sp.set("search", params.search);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  if (params.order) sp.set("order", params.order);
  const qs = sp.toString();
  return apiFetchWithRefresh(`/referrals${qs ? "?" + qs : ""}`, {});
}

export async function fetchReferralById(id) {
  return apiFetchWithRefresh(`/referrals/${id}`, {});
}

export async function approveReferral(id) {
  return apiFetchWithRefresh(`/referrals/${id}/approve`, { method: "PATCH" });
}

export async function rejectReferral(id, reason) {
  return apiFetchWithRefresh(`/referrals/${id}/reject`, {
    method: "PATCH",
    data: { reason },
  });
}

export async function fetchUserReferralProfile(userId) {
  return apiFetchWithRefresh(`/referrals/users/${userId}`, {});
}

export async function fetchReferralUsers(params) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.search) sp.set("search", params.search);
  if (params?.sortBy) sp.set("sortBy", params.sortBy);
  if (params?.order) sp.set("order", params.order);
  const qs = sp.toString();
  return apiFetchWithRefresh(`/referrals/users${qs ? "?" + qs : ""}`, {});
}
