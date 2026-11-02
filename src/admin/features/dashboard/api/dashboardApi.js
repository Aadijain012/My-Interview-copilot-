import { apiFetch } from "@/api/client";

/**
 * Builds query string from parameters, omitting undefined/empty values.
 */
function buildQueryString(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const str = query.toString();
  return str ? `?${str}` : "";
}

/**
 * GET /api/admin/dashboard/summary
 * Returns overall platform totals for KPI cards.
 */
export async function fetchDashboardSummary() {
  const res = await apiFetch("/dashboard/summary");
  return res.data;
}

/**
 * GET /api/admin/dashboard/users?from=&to=
 * Returns user growth count and daily signup trend.
 */
export async function fetchDashboardUsers(from, to) {
  const qs = buildQueryString({ from, to });
  const res = await apiFetch(`/dashboard/users${qs}`);
  return res.data;
}

/**
 * GET /api/admin/dashboard/sessions?from=&to=
 * Returns session counts, average duration, and top technologies.
 */
export async function fetchDashboardSessions(from, to) {
  const qs = buildQueryString({ from, to });
  const res = await apiFetch(`/dashboard/sessions${qs}`);
  return res.data;
}

/**
 * GET /api/admin/dashboard/activity?limit=
 * Returns recent platform audit events.
 */
export async function fetchDashboardActivity(limit) {
  const qs = buildQueryString({ limit });
  const res = await apiFetch(`/dashboard/activity${qs}`);
  return res.data;
}

/**
 * GET /api/admin/dashboard/content?from=&to=
 * Returns AI feature usage metrics (questions, answers, notes, transcripts, recordings).
 */
export async function fetchDashboardContent(from, to) {
  const qs = buildQueryString({ from, to });
  const res = await apiFetch(`/dashboard/content${qs}`);
  return res.data;
}

/**
 * GET /api/admin/dashboard/top-users?limit=
 * Returns Top 10 most active users ranked by AI feature usage.
 */
export async function fetchDashboardTopUsers(limit = 10) {
  const qs = buildQueryString({ limit });
  const res = await apiFetch(`/dashboard/top-users${qs}`);
  return res.data;
}

/**
 * GET /api/admin/dashboard/ai-api-usage?from=&to=
 * Returns internal AI provider API consumption, budget, remaining credits, and warning states.
 */
export async function fetchDashboardAiApiUsage(from, to) {
  const qs = buildQueryString({ from, to });
  const res = await apiFetch(`/dashboard/ai-api-usage${qs}`);
  return res.data;
}
