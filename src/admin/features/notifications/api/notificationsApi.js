import { apiFetchWithRefresh } from "@/api";

export async function fetchNotifications(params = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.category) sp.set("category", params.category);
  if (params.priority) sp.set("priority", params.priority);
  if (
    params.isRead !== undefined &&
    params.isRead !== null &&
    params.isRead !== ""
  ) {
    sp.set("isRead", String(params.isRead));
  }

  const qs = sp.toString();
  return apiFetchWithRefresh(`/notifications${qs ? "?" + qs : ""}`);
}

export async function fetchUnreadCount() {
  return apiFetchWithRefresh("/notifications/unread-count");
}

export async function markNotificationAsRead(id) {
  return apiFetchWithRefresh(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsAsRead() {
  return apiFetchWithRefresh("/notifications/read-all", { method: "PATCH" });
}
