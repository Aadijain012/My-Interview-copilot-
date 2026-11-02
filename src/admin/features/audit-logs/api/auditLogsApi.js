import { apiFetch } from "@/api/client";

export async function fetchAuditLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.action) query.set("action", params.action);
  if (params.actorId) query.set("actorId", params.actorId);
  if (params.targetId) query.set("targetId", params.targetId);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.limit !== undefined) query.set("limit", String(params.limit));

  const qs = query.toString();
  return apiFetch(`/audit-logs${qs ? `?${qs}` : ""}`);
}
