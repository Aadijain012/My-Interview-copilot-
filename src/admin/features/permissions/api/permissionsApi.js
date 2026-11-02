import { apiFetch } from "@/api/client";

export async function fetchManageableAdmins(search) {
  const query = new URLSearchParams();
  if (search && search.trim()) {
    query.set("search", search.trim());
  }
  const endpoint = query.toString()
    ? `/permissions/users?${query.toString()}`
    : "/permissions/users";
  const res = await apiFetch(endpoint);
  return res.data?.users || [];
}

export async function fetchAdminPermissions(adminId) {
  const res = await apiFetch(`/permissions/${encodeURIComponent(adminId)}`);
  return res.data;
}

export async function updateAdminPermissions(adminId, payload) {
  const res = await apiFetch(`/permissions/${encodeURIComponent(adminId)}`, {
    method: "PUT",
    data: payload,
  });
  return res.data;
}

export async function resetAdminPermissions(adminId) {
  const res = await apiFetch(
    `/permissions/${encodeURIComponent(adminId)}/reset`,
    {
      method: "POST",
    },
  );
  return res.data;
}
