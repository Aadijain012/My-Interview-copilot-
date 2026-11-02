import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchManageableAdmins,
  fetchAdminPermissions,
  updateAdminPermissions,
  resetAdminPermissions,
} from "../api/permissionsApi";

export const PERMISSIONS_QUERY_KEYS = {
  users: (search) => ["permissions", "users", search || ""],
  details: (adminId) => ["permissions", "details", adminId || ""],
};

export function useManageableAdmins(search) {
  return useQuery({
    queryKey: PERMISSIONS_QUERY_KEYS.users(search),
    queryFn: () => fetchManageableAdmins(search),
    staleTime: 30_000,
  });
}

export function useAdminPermissions(adminId) {
  return useQuery({
    queryKey: PERMISSIONS_QUERY_KEYS.details(adminId),
    queryFn: () => fetchAdminPermissions(adminId),
    enabled: Boolean(adminId),
    staleTime: 10_000,
  });
}

export function useUpdateAdminPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adminId, permissions }) =>
      updateAdminPermissions(adminId, { permissions }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["permissions", "users"] });
      queryClient.invalidateQueries({
        queryKey: PERMISSIONS_QUERY_KEYS.details(variables.adminId),
      });
    },
  });
}

export function useResetAdminPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adminId) => resetAdminPermissions(adminId),
    onSuccess: (_, adminId) => {
      queryClient.invalidateQueries({ queryKey: ["permissions", "users"] });
      queryClient.invalidateQueries({
        queryKey: PERMISSIONS_QUERY_KEYS.details(adminId),
      });
    },
  });
}
