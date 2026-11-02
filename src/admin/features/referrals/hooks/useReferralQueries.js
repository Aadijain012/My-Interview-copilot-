import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchReferralDashboard,
  fetchReferrals,
  fetchReferralById,
  approveReferral,
  rejectReferral,
  fetchUserReferralProfile,
  fetchReferralUsers,
} from "../api/referralsApi";

export const referralKeys = {
  all: ["referrals"],
  dashboard: (from, to) => [...referralKeys.all, "dashboard", { from, to }],
  lists: () => [...referralKeys.all, "list"],
  list: (params) => [...referralKeys.lists(), params],
  details: () => [...referralKeys.all, "detail"],
  detail: (id) => [...referralKeys.details(), id],
  userProfiles: () => [...referralKeys.all, "user-profile"],
  userProfile: (userId) => [...referralKeys.userProfiles(), userId],
};

export function useReferralDashboard(from, to) {
  return useQuery({
    queryKey: referralKeys.dashboard(from, to),
    queryFn: () => fetchReferralDashboard(from, to),
    select: (res) => res.data,
  });
}

export function useReferrals(params) {
  return useQuery({
    queryKey: referralKeys.list(params),
    queryFn: () => fetchReferrals(params),
  });
}

export function useReferral(id) {
  return useQuery({
    queryKey: referralKeys.detail(id),
    queryFn: () => fetchReferralById(id),
    select: (res) => res.referral,
    enabled: !!id,
  });
}

export function useApproveReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => approveReferral(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: referralKeys.all });
    },
  });
}

export function useRejectReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => rejectReferral(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: referralKeys.all });
    },
  });
}

export function useReferralProfile(userId) {
  return useQuery({
    queryKey: referralKeys.userProfile(userId),
    queryFn: () => fetchUserReferralProfile(userId),
    select: (res) => res.profile,
    enabled: !!userId,
  });
}

export const useUserReferralProfile = useReferralProfile;

export function useReferralUsers(params) {
  return useQuery({
    queryKey: [...referralKeys.all, "users", params],
    queryFn: () => fetchReferralUsers(params),
  });
}
