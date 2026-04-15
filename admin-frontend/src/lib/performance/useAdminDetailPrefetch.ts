import { useCallback, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

type UseAdminDetailPrefetchOptions<TId, TResult> = {
  enabled: boolean;
  staleTime?: number;
  queryKeyFor: (id: TId) => QueryKey;
  queryFnFor: (id: TId) => Promise<TResult>;
  onPrefetch?: (id: TId) => void | Promise<void>;
};

const signatureForKey = (queryKey: QueryKey) => JSON.stringify(queryKey);

export const useAdminDetailPrefetch = <TId, TResult>({
  enabled,
  staleTime = 20_000,
  queryKeyFor,
  queryFnFor,
  onPrefetch
}: UseAdminDetailPrefetchOptions<TId, TResult>) => {
  const queryClient = useQueryClient();
  const prefetchedKeys = useRef(new Set<string>());

  const prefetch = useCallback(
    (id: TId) => {
      if (!enabled) {
        return;
      }
      const queryKey = queryKeyFor(id);
      const signature = signatureForKey(queryKey);
      if (prefetchedKeys.current.has(signature)) {
        return;
      }
      prefetchedKeys.current.add(signature);
      void onPrefetch?.(id);
      void queryClient.prefetchQuery({
        queryKey,
        queryFn: () => queryFnFor(id),
        staleTime
      });
    },
    [enabled, onPrefetch, queryClient, queryFnFor, queryKeyFor, staleTime]
  );

  const prefetchMany = useCallback(
    (ids: TId[], limit = 1) => {
      ids.slice(0, limit).forEach((id) => prefetch(id));
    },
    [prefetch]
  );

  return { prefetch, prefetchMany };
};
