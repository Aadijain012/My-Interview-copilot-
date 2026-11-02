import { useQuery } from "@tanstack/react-query";
import { fetchAuditLogs } from "../api/auditLogsApi";

export const auditLogKeys = {
  all: ["audit-logs"],
  lists: () => [...auditLogKeys.all, "list"],
  list: (params) => [...auditLogKeys.lists(), params],
};

export function useAuditLogs(params, enabled = true) {
  return useQuery({
    queryKey: auditLogKeys.list(params),
    queryFn: () => fetchAuditLogs(params),
    enabled,
    staleTime: 30_000,
  });
}
