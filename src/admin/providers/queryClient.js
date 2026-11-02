/**
 * queryClient.ts — Shared TanStack QueryClient instance with global 401 handling.
 */

import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import { triggerGlobalSessionExpired } from "@/features/auth/authSession";
import { router } from "@/router";

function handleAuthError(error) {
  if (error instanceof ApiError && error.status === 401) {
    // Exclude invalid credentials error during login attempt
    if (error.code === "INVALID_CREDENTIALS") return;

    triggerGlobalSessionExpired();
    queryClient.clear();

    if (
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      try {
        router.navigate("/login", { replace: true });
      } catch {
        // Safe fallback in test or non-router context
      }
    }
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleAuthError,
  }),
  mutationCache: new MutationCache({
    onError: handleAuthError,
  }),
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 seconds before a background refetch
      staleTime: 30_000,
      // Do not retry 401 unauthenticated errors; retry once for other failures
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status === 401) {
          return false;
        }
        return failureCount < 1;
      },
      // Don't refetch when the user switches tabs — admin panels need explicit refresh
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
