import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardSummary,
  fetchDashboardUsers,
  fetchDashboardSessions,
  fetchDashboardActivity,
  fetchDashboardContent,
  fetchDashboardTopUsers,
  fetchDashboardAiApiUsage,
} from "../api/dashboardApi";

export const dashboardKeys = {
  all: ["dashboard"],
  summary: () => [...dashboardKeys.all, "summary"],
  users: (from, to) => [...dashboardKeys.all, "users", { from, to }],
  sessions: (from, to) => [...dashboardKeys.all, "sessions", { from, to }],
  activity: (limit) => [...dashboardKeys.all, "activity", { limit }],
  content: (from, to) => [...dashboardKeys.all, "content", { from, to }],
  topUsers: (limit) => [...dashboardKeys.all, "topUsers", { limit }],
  aiApiUsage: (from, to) => [...dashboardKeys.all, "aiApiUsage", { from, to }],
};

const DEFAULT_STALE_TIME = 60 * 1000; // 1 minute

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: fetchDashboardSummary,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useDashboardUsers(from, to) {
  return useQuery({
    queryKey: dashboardKeys.users(from, to),
    queryFn: () => fetchDashboardUsers(from, to),
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useDashboardSessions(from, to) {
  return useQuery({
    queryKey: dashboardKeys.sessions(from, to),
    queryFn: () => fetchDashboardSessions(from, to),
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useDashboardActivity(limit = 10) {
  return useQuery({
    queryKey: dashboardKeys.activity(limit),
    queryFn: () => fetchDashboardActivity(limit),
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useDashboardContent(from, to) {
  return useQuery({
    queryKey: dashboardKeys.content(from, to),
    queryFn: () => fetchDashboardContent(from, to),
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useDashboardTopUsers(limit = 10) {
  return useQuery({
    queryKey: dashboardKeys.topUsers(limit),
    queryFn: () => fetchDashboardTopUsers(limit),
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useDashboardAiApiUsage(from, to) {
  return useQuery({
    queryKey: dashboardKeys.aiApiUsage(from, to),
    queryFn: () => fetchDashboardAiApiUsage(from, to),
    staleTime: DEFAULT_STALE_TIME,
  });
}
