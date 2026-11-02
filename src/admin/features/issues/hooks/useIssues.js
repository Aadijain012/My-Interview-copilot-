import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchIssues,
  fetchIssueStats,
  fetchIssueById,
  createIssue,
  updateIssue,
  assignIssue,
  resolveIssue,
  closeIssue,
  fetchAssignees,
} from "../api/issuesApi";

export const issueKeys = {
  all: ["issues"],
  stats: () => [...issueKeys.all, "stats"],
  lists: () => [...issueKeys.all, "list"],
  list: (params) => [...issueKeys.lists(), params],
  details: () => [...issueKeys.all, "detail"],
  detail: (id) => [...issueKeys.details(), id],
};

export function useIssues(params = {}) {
  return useQuery({
    queryKey: issueKeys.list(params),
    queryFn: () => fetchIssues(params),
  });
}

export function useIssueStats(options = {}) {
  return useQuery({
    queryKey: issueKeys.stats(),
    queryFn: () => fetchIssueStats(),
    refetchInterval: 8000,
    staleTime: 5000,
    ...options
  });
}

export function useIssue(id) {
  return useQuery({
    queryKey: issueKeys.detail(id || ""),
    queryFn: () => fetchIssueById(id || ""),
    enabled: Boolean(id),
  });
}

export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => createIssue(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: issueKeys.all });
    },
  });
}

export function useUpdateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => updateIssue(id, input),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: issueKeys.all });
      qc.invalidateQueries({ queryKey: issueKeys.detail(id) });
    },
  });
}

export function useAssignIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assigneeId }) => assignIssue(id, assigneeId),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: issueKeys.all });
      qc.invalidateQueries({ queryKey: issueKeys.detail(id) });
    },
  });
}

export function useResolveIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNote }) => resolveIssue(id, resolutionNote),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: issueKeys.all });
      qc.invalidateQueries({ queryKey: issueKeys.detail(id) });
    },
  });
}

export function useCloseIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => closeIssue(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: issueKeys.all });
      qc.invalidateQueries({ queryKey: issueKeys.detail(id) });
    },
  });
}

export function useAssignees() {
  return useQuery({
    queryKey: ["issues", "assignees"],
    queryFn: () => fetchAssignees(),
    staleTime: 60_000,
  });
}
