import {
  useMutation,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useAdminAuthStore } from "@/features/auth/auth.store";

/**
 * Drop-in replacement for `useMutation` that:
 * - Automatically injects the admin access token into the mutationFn.
 * - Throws a typed error when no token is present, rather than each page
 *   duplicating `if (!accessToken) throw new Error("Not signed in.")`.
 */
export function useAuthedMutation<TData, TVariables = void>(
  mutationFn: (token: string, variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables>,
) {
  const token = useAdminAuthStore((s) => s.accessToken);

  return useMutation<TData, Error, TVariables>({
    ...options,
    mutationFn: (variables) => {
      if (!token) throw new Error("Session expired. Please sign in again.");
      return mutationFn(token, variables);
    },
  });
}
