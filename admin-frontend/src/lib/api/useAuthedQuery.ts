import { useQuery, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import { useAdminAuthStore } from "@/features/auth/auth.store";

type AuthedQueryOptions<TData> = Omit<
  UseQueryOptions<TData, Error, TData, QueryKey>,
  "queryKey" | "queryFn"
> & {
  /**
   * Extra guard beyond the token presence check.
   * The query only runs when BOTH the token and this flag are truthy.
   */
  enabled?: boolean;
};

/**
 * Drop-in replacement for `useQuery` that:
 * - Automatically injects the admin access token into the queryFn.
 * - Disables the query when no token is present (no "Not signed in." throws).
 * - AND's any caller-supplied `enabled` condition with the token guard.
 */
export function useAuthedQuery<TData>(
  queryKey: QueryKey,
  queryFn: (token: string) => Promise<TData>,
  options?: AuthedQueryOptions<TData>,
) {
  const token = useAdminAuthStore((s) => s.accessToken);
  const { enabled = true, ...rest } = options ?? {};

  return useQuery<TData, Error>({
    ...rest,
    queryKey,
    queryFn: () => queryFn(token!),
    enabled: Boolean(token) && Boolean(enabled),
  });
}
