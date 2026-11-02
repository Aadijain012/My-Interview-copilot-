import { useQuery } from "@tanstack/react-query";
import { fetchSystemHealth } from "../api/systemHealthApi";

export const healthKeys = {
  all: ["system-health"],
};

export function useSystemHealth(refetchInterval = 30000) {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: () => fetchSystemHealth(),
    refetchInterval,
  });
}
