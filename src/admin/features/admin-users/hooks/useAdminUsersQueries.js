import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminUsers,
  fetchAdminUserById,
  createAdminUser,
  updateAdminUser,
  suspendAdminUser,
  deleteAdminUser,
} from "../api/adminUsersApi";

export const adminUserKeys = {
  all: ["admin-users"],
  lists: () => [...adminUserKeys.all, "list"],
  list: (params) => [...adminUserKeys.lists(), params],
  details: () => [...adminUserKeys.all, "detail"],
  detail: (id) => [...adminUserKeys.details(), id],
};

export function useAdminUsers(params, enabled = true) {
  return useQuery({
    queryKey: adminUserKeys.list(params),
    queryFn: () => fetchAdminUsers(params),
    enabled,
    staleTime: 30_000,
  });
}

export function useAdminUser(id, enabled = true) {
  return useQuery({
    queryKey: adminUserKeys.detail(id ?? ""),
    queryFn: () => fetchAdminUserById(id),
    enabled: Boolean(id) && enabled,
    staleTime: 60_000,
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => createAdminUser(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }) => updateAdminUser(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adminUserKeys.detail(id) });
    },
  });
}

export function useSuspendAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reactivate }) => suspendAdminUser(id, reactivate),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adminUserKeys.detail(id) });
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deleteAdminUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
    },
  });
}
