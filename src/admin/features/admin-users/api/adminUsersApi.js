import { apiFetchWithRefresh } from "@/api";

export async function fetchAdminUsers(params = {}) {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.role) qs.set("role", params.role);
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.order) qs.set("order", params.order);

  const queryString = qs.toString();
  const path = queryString ? `/admin-users?${queryString}` : "/admin-users";
  return apiFetchWithRefresh(path, {});
}

export async function fetchAdminUserById(id) {
  return apiFetchWithRefresh(`/admin-users/${encodeURIComponent(id)}`, {});
}

export async function createAdminUser(input) {
  return apiFetchWithRefresh("/admin-users", {
    method: "POST",
    data: input,
  });
}

export async function updateAdminUser(id, input) {
  return apiFetchWithRefresh(`/admin-users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    data: input,
  });
}

export async function suspendAdminUser(id, reactivate = false) {
  return apiFetchWithRefresh(`/admin-users/${encodeURIComponent(id)}/suspend`, {
    method: "PATCH",
    data: { reactivate },
  });
}

export async function deleteAdminUser(id) {
  return apiFetchWithRefresh(`/admin-users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
