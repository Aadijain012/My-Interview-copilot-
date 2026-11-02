import { apiFetchWithRefresh } from "@/api";

export async function fetchMilestones(campaignId) {
  const sp = new URLSearchParams();
  if (campaignId) sp.set("campaignId", campaignId);
  const qs = sp.toString();
  return apiFetchWithRefresh(`/milestones${qs ? "?" + qs : ""}`, {});
}

export async function createMilestone(data) {
  return apiFetchWithRefresh("/milestones", { method: "POST", data });
}

export async function updateMilestone(id, data) {
  return apiFetchWithRefresh(`/milestones/${id}`, { method: "PATCH", data });
}

export async function reorderMilestones(campaignId, orderedIds) {
  return apiFetchWithRefresh("/milestones/reorder", {
    method: "PATCH",
    data: { campaignId, orderedIds },
  });
}
