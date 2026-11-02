import { apiFetchWithRefresh } from "@/api";

export async function fetchOffers(params = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return apiFetchWithRefresh(`/offers${qs ? "?" + qs : ""}`, {});
}

export async function fetchOfferById(id) {
  return apiFetchWithRefresh(`/offers/${id}`, {});
}

export async function createOffer(data) {
  return apiFetchWithRefresh("/offers", { method: "POST", data });
}

export async function updateOffer(id, data) {
  return apiFetchWithRefresh(`/offers/${id}`, { method: "PATCH", data });
}
