/**
 * useAuth.ts — Access the authentication context.
 *
 * Must be used inside <AuthProvider>.
 * Throws a descriptive error if used outside the provider tree.
 */

import { useContext } from "react";
import { AuthContext } from "./AuthProvider";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth must be used inside <AuthProvider>. " +
        "Make sure AuthProvider wraps your router in main.tsx.",
    );
  }
  return ctx;
}
