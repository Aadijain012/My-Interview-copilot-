import { apiFetchWithRefresh } from "@/api";

export async function fetchCredits(params) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.userId) sp.set("userId", params.userId);
  if (params.type) sp.set("type", params.type);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.search) sp.set("search", params.search);
  const qs = sp.toString();
  return apiFetchWithRefresh(`/credits${qs ? "?" + qs : ""}`, {});
}

export async function exportCredits(params) {
  const sp = new URLSearchParams();
  if (params.userId) sp.set("userId", params.userId);
  if (params.type) sp.set("type", params.type);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const qs = sp.toString();
  return apiFetchWithRefresh(`/credits/export${qs ? "?" + qs : ""}`, {});
}

export async function compensateCredits({ userId, amount, reason }) {
  return apiFetchWithRefresh("/credits/compensate", {
    method: "POST",
    body: JSON.stringify({ userId, amount, reason }),
  });
}

export async function bulkGrantCredits({ amount, reason, tier = "FREE" }) {
  return apiFetchWithRefresh("/credits/bulk-grant", {
    method: "POST",
    body: JSON.stringify({ amount, reason, tier }),
  });
}
