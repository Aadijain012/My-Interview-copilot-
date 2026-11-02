import { useQuery } from "@tanstack/react-query";
import { fetchAIAnalytics } from "../api/analyticsApi";

export const analyticsKeys = {
  all: ["analytics"],
  overview: () => [...analyticsKeys.all, "overview"],
};

export function useAIAnalytics() {
  return useQuery({
    queryKey: analyticsKeys.overview(),
    queryFn: () => fetchAIAnalytics(),
  });
}
