/**
 * Centralised staleTime + refetchInterval constants.
 *
 * REAL_TIME   — dashboards, stock levels, live queue feeds  (~10 s stale)
 * OPERATIONAL — order lists, payment records, audit logs   (~30 s stale)
 * REFERENCE   — catalog, categories, brands, settings      (5 min stale)
 * ANALYTICS   — reporting, KPI cards                       (1 min stale)
 */
export const CACHE = {
  REAL_TIME: {
    staleTime: 10_000,
    refetchInterval: 15_000 },
  OPERATIONAL: {
    staleTime: 30_000 },
  REFERENCE: {
    staleTime: 5 * 60_000 },
  ANALYTICS: {
    staleTime: 60_000 } } as const;
