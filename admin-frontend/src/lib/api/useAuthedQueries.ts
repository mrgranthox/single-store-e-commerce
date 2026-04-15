import { useQueries } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useAdminAuthStore } from "@/features/auth/auth.store";

type AnyQueryOptions = UseQueryOptions<unknown, Error, unknown, readonly unknown[]>;

/**
 * Multi-query authenticated wrapper.
 *
 * Pass a factory that receives the current `accessToken` and returns an array
 * of individual `useQuery` option objects.  All queries are automatically
 * disabled when no token is present, mirroring the `useAuthedQuery` contract.
 *
 * Usage:
 * ```ts
 * const [detailQ, rolesQ] = useAuthedQueries((token) => [
 *   { queryKey: ["admin-user-detail", id], queryFn: () => getAdminUser(token, id), enabled: Boolean(id) },
 *   { queryKey: ["admin-roles"],            queryFn: () => listAdminRoles(token) },
 * ]);
 * ```
 */
export function useAuthedQueries(
  factory: (token: string) => AnyQueryOptions[],
) {
  const token = useAdminAuthStore((s) => s.accessToken);
  const hasToken = Boolean(token);

  const queries = factory(token ?? "").map((q) => ({
    ...q,
    enabled: hasToken ? (q.enabled !== false) : false,
  }));

  return useQueries({ queries });
}
