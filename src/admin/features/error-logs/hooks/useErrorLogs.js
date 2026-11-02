import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchErrorLogs,
  fetchErrorLogStats,
  fetchErrorLogById,
  resolveErrorLog,
  updateErrorLogStatus,
  triggerTestError,
} from "../api/errorLogsApi";

export const errorLogKeys = {
  all: ["error-logs"],
  lists: () => [...errorLogKeys.all, "list"],
  list: (params) => [...errorLogKeys.lists(), params],
  stats: () => [...errorLogKeys.all, "stats"],
  detail: (id) => [...errorLogKeys.all, "detail", id],
};

export function useErrorLogs(
  params = {},
  enabled = true,
  refetchInterval = false,
) {
  return useQuery({
    queryKey: errorLogKeys.list(params),
    queryFn: () => fetchErrorLogs(params),
    enabled,
    staleTime: 30_000,
    refetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useErrorLogStats(enabled = true, refetchInterval = false) {
  return useQuery({
    queryKey: errorLogKeys.stats(),
    queryFn: fetchErrorLogStats,
    enabled,
    staleTime: 30_000,
    refetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useErrorLogDetail(id, enabled = true) {
  return useQuery({
    queryKey: errorLogKeys.detail(id),
    queryFn: () => fetchErrorLogById(id),
    enabled: Boolean(id) && enabled,
    staleTime: 60_000,
  });
}

export function useResolveErrorLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolved }) => resolveErrorLog(id, resolved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: errorLogKeys.all });
      queryClient.refetchQueries({ queryKey: errorLogKeys.stats() });
      queryClient.refetchQueries({ queryKey: errorLogKeys.lists() });
    },
  });
}

export function useUpdateErrorLogStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => updateErrorLogStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: errorLogKeys.all });
      queryClient.refetchQueries({ queryKey: errorLogKeys.stats() });
      queryClient.refetchQueries({ queryKey: errorLogKeys.lists() });
    },
  });
}

export function useTriggerTestError() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params) =>
      triggerTestError(params?.severity, params?.source, params?.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: errorLogKeys.all });
      queryClient.refetchQueries({ queryKey: errorLogKeys.stats() });
      queryClient.refetchQueries({ queryKey: errorLogKeys.lists() });
    },
  });
}
