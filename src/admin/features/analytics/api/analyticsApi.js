import { apiFetchWithRefresh } from "@/api";

export async function fetchAIAnalytics() {
  const res = await apiFetchWithRefresh("/analytics", {});
  return res.data;
}
