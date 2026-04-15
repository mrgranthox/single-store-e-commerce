/**
 * Hierarchical query key factory for the Orders domain.
 *
 * Hierarchy (invalidate a parent to bust all descendants):
 *   orders → orders.list(p) | orders.detail(id) → orders.timeline(id) | orders.payments(id) | orders.items(id) | orders.fulfillments(id)
 */
export const orderKeys = {
  all: () => ["admin-orders"] as const,

  lists: () => [...orderKeys.all(), "list"] as const,
  list: (params: Record<string, unknown>) =>
    [...orderKeys.lists(), params] as const,

  details: () => [...orderKeys.all(), "detail"] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,

  timeline: (id: string) => [...orderKeys.detail(id), "timeline"] as const,
  payments: (id: string) => [...orderKeys.detail(id), "payments"] as const,
  items: (id: string) => [...orderKeys.detail(id), "items"] as const,
  fulfillments: (id: string) =>
    [...orderKeys.detail(id), "fulfillments"] as const,
  refunds: (id: string) => [...orderKeys.detail(id), "refunds"] as const };
