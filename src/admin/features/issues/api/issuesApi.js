import { apiFetchWithRefresh } from "@/api";

export async function fetchIssues(params = {}) {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.priority && params.priority !== "all")
    qs.set("priority", params.priority);
  if (params.type && params.type !== "all") qs.set("type", params.type);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.order) qs.set("order", params.order);

  const queryString = qs.toString();
  const path = queryString ? `/issues?${queryString}` : "/issues";
  return apiFetchWithRefresh(path, {});
}

export async function fetchIssueStats() {
  const res = await apiFetchWithRefresh("/issues/stats", {});
  return res.data;
}

export async function fetchIssueById(id) {
  const res = await apiFetchWithRefresh(
    `/issues/${encodeURIComponent(id)}`,
    {},
  );
  return res.data;
}

export async function createIssue(input) {
  const res = await apiFetchWithRefresh("/issues", {
    method: "POST",
    data: input,
  });
  return res.data;
}

export async function updateIssue(id, input) {
  const res = await apiFetchWithRefresh(`/issues/${encodeURIComponent(id)}`, {
    method: "PATCH",
    data: input,
  });
  return res.data;
}

export async function assignIssue(id, assigneeId) {
  const res = await apiFetchWithRefresh(
    `/issues/${encodeURIComponent(id)}/assign`,
    {
      method: "PATCH",
      data: { assigneeId },
    },
  );
  return res.data;
}

export async function resolveIssue(id, resolutionNote) {
  const res = await apiFetchWithRefresh(
    `/issues/${encodeURIComponent(id)}/resolve`,
    {
      method: "PATCH",
      data: { resolutionNote },
    },
  );
  return res.data;
}

export async function closeIssue(id) {
  const res = await apiFetchWithRefresh(
    `/issues/${encodeURIComponent(id)}/close`,
    {
      method: "PATCH",
    },
  );
  return res.data;
}

export async function fetchAssignees() {
  const res = await apiFetchWithRefresh("/issues/assignees", {});
  return res.data || [];
}
