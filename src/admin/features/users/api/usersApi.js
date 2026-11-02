import { apiFetchWithRefresh } from "@/api";

export async function fetchUsers(params = {}) {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.order) qs.set("order", params.order);

  const queryString = qs.toString();
  const path = queryString ? `/users?${queryString}` : "/users";
  return apiFetchWithRefresh(path, {});
}

export async function fetchUserById(id) {
  return apiFetchWithRefresh(`/users/${encodeURIComponent(id)}`, {});
}

export async function suspendUser(id, reactivate = false) {
  return apiFetchWithRefresh(`/users/${encodeURIComponent(id)}/suspend`, {
    method: "PATCH",
    data: { reactivate },
  });
}

export async function deleteUser(id) {
  return apiFetchWithRefresh(`/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function exportUsersCsv(params = {}) {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.status) qs.set("status", params.status);

  const queryString = qs.toString();
  const path = queryString ? `/users/export?${queryString}` : "/users/export";
  return apiFetchWithRefresh(path, {});
}
