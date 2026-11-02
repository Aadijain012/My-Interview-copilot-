import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMilestones,
  createMilestone,
  updateMilestone,
  reorderMilestones,
} from "../api/milestonesApi";

export const milestoneKeys = {
  all: ["milestones"],
  list: (campaignId) => [...milestoneKeys.all, "list", { campaignId }],
};

export function useMilestones(campaignId) {
  return useQuery({
    queryKey: milestoneKeys.list(campaignId),
    queryFn: () => fetchMilestones(campaignId),
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createMilestone(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: milestoneKeys.all });
    },
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateMilestone(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: milestoneKeys.all });
    },
  });
}

export function useReorderMilestones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, orderedIds }) =>
      reorderMilestones(campaignId, orderedIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: milestoneKeys.all });
    },
  });
}
