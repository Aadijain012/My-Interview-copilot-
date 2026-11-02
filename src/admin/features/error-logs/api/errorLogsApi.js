import { apiFetchWithRefresh as apiFetch } from "@/api";

export async function fetchErrorLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.severity && params.severity !== "all")
    query.set("severity", params.severity);
  if (params.source && params.source !== "all")
    query.set("source", params.source);
  if (params.status && params.status !== "all")
    query.set("status", params.status);
  if (
    params.resolved !== undefined &&
    params.resolved !== "" &&
    params.resolved !== "all"
  ) {
    query.set("resolved", String(params.resolved));
  }
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);

  const queryString = query.toString();
  const endpoint = queryString ? `/error-logs?${queryString}` : "/error-logs";
  const res = await apiFetch(endpoint);

  const dataField = res.data;
  const logs = Array.isArray(dataField)
    ? dataField
    : Array.isArray(
          dataField && "errorLogs" in dataField
            ? dataField.errorLogs
            : undefined,
        )
      ? dataField.errorLogs
      : Array.isArray(res.errorLogs)
        ? res.errorLogs
        : [];

  const nestedPagination =
    dataField && typeof dataField === "object" && "pagination" in dataField
      ? dataField.pagination
      : undefined;

  const pagination = res.pagination ||
    nestedPagination || {
      page: params.page || 1,
      limit: params.limit || 10,
      total: logs.length,
      totalPages: 1,
    };

  return {
    ok: Boolean(res.ok),
    data: logs,
    pagination,
  };
}

export async function fetchErrorLogStats() {
  const res = await apiFetch("/error-logs/stats");
  const raw = res.data || {};
  return {
    ok: Boolean(res.ok),
    data: {
      totalErrors: raw.totalErrors ?? raw.total ?? 0,
      criticalErrors: raw.criticalErrors ?? raw.critical ?? 0,
      unresolvedErrors: raw.unresolvedErrors ?? raw.unresolved ?? 0,
      todayErrors: raw.todayErrors ?? raw.today ?? 0,
      monitoringErrors: raw.monitoringErrors ?? raw.monitoring ?? 0,
      bySource: raw.bySource ?? {},
    },
  };
}

export async function fetchErrorLogById(id) {
  return apiFetch(`/error-logs/${id}`);
}

export async function resolveErrorLog(id, resolved = true) {
  return apiFetch(`/error-logs/${id}/resolve`, {
    method: "PATCH",
    data: { resolved },
  });
}

export async function updateErrorLogStatus(id, status) {
  return apiFetch(`/error-logs/${id}`, {
    method: "PATCH",
    data: { status },
  });
}

export async function reportFrontendError(payload) {
  return apiFetch("/error-logs/report", {
    method: "POST",
    data: payload,
  });
}

export async function triggerTestError(
  severity = "error",
  source = "api",
  message,
) {
  return apiFetch("/error-logs/test", {
    method: "POST",
    data: { severity, source, message },
  });
}
