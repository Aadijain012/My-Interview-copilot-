import { apiFetchWithRefresh } from "@/api";

export async function fetchSystemHealth() {
  const res = await apiFetchWithRefresh("/system-health", {});
  return res.data;
}
