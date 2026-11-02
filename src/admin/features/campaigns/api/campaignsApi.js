import { apiFetchWithRefresh } from "@/api";

export async function fetchCampaigns(params) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.status) sp.set("status", params.status);
  if (params.search) sp.set("search", params.search);
  const qs = sp.toString();
  return apiFetchWithRefresh(`/campaigns${qs ? "?" + qs : ""}`, {});
}

export async function fetchCampaignById(id) {
  return apiFetchWithRefresh(`/campaigns/${id}`, {});
}

export async function createCampaign(data) {
  return apiFetchWithRefresh("/campaigns", { method: "POST", data });
}

export async function updateCampaign(id, data) {
  return apiFetchWithRefresh(`/campaigns/${id}`, { method: "PATCH", data });
}

export async function fetchCampaignFunnel(id, from, to) {
  const sp = new URLSearchParams();
  if (from) sp.set("from", from);
  if (to) sp.set("to", to);
  const qs = sp.toString();
  return apiFetchWithRefresh(
    `/campaigns/${id}/funnel${qs ? "?" + qs : ""}`,
    {},
  );
}

export async function generateCampaignCode(name, campaignId) {
  if (campaignId) {
    return apiFetchWithRefresh(`/campaigns/${campaignId}/generate-code`, {
      method: "POST",
    });
  }
  return apiFetchWithRefresh("/campaigns/generate-code", {
    method: "POST",
    data: { name },
  });
}
