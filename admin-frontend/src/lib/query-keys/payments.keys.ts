export const paymentKeys = {
  all: () => ["admin-payments"] as const,

  lists: () => [...paymentKeys.all(), "list"] as const,
  list: (params: Record<string, unknown>) =>
    [...paymentKeys.lists(), params] as const,

  details: () => [...paymentKeys.all(), "detail"] as const,
  detail: (id: string) => [...paymentKeys.details(), id] as const,

  transactions: (id: string) =>
    [...paymentKeys.detail(id), "transactions"] as const,
  timeline: (id: string) => [...paymentKeys.detail(id), "timeline"] as const,

  reconciliation: () => [...paymentKeys.all(), "reconciliation"] as const };
