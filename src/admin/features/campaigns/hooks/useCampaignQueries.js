import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCampaigns,
  fetchCampaignById,
  createCampaign,
  updateCampaign,
  fetchCampaignFunnel,
} from "../api/campaignsApi";

export const campaignKeys = {
  all: ["campaigns"],
  lists: () => [...campaignKeys.all, "list"],
  list: (params) => [...campaignKeys.lists(), params],
  details: () => [...campaignKeys.all, "detail"],
  detail: (id) => [...campaignKeys.details(), id],
  funnel: (id, from, to) => [...campaignKeys.all, "funnel", id, { from, to }],
};

export function useCampaigns(params) {
  return useQuery({
    queryKey: campaignKeys.list(params),
    queryFn: () => fetchCampaigns(params),
  });
}

export function useCampaign(id) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => fetchCampaignById(id),
    select: (res) => res.campaign,
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createCampaign(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateCampaign(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: campaignKeys.lists() });
      qc.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

export function useCampaignFunnel(id, from, to) {
  return useQuery({
    queryKey: campaignKeys.funnel(id, from, to),
    queryFn: () => fetchCampaignFunnel(id, from, to),
    enabled: !!id,
  });
}
