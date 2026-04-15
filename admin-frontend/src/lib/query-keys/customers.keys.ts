export const customerKeys = {
  all: () => ["admin-customers"] as const,

  lists: () => [...customerKeys.all(), "list"] as const,
  list: (params: Record<string, unknown>) =>
    [...customerKeys.lists(), params] as const,

  details: () => [...customerKeys.all(), "detail"] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,

  orders: (id: string) => [...customerKeys.detail(id), "orders"] as const,
  addresses: (id: string) =>
    [...customerKeys.detail(id), "addresses"] as const,
  notes: (id: string) => [...customerKeys.detail(id), "notes"] as const,
  timeline: (id: string) => [...customerKeys.detail(id), "timeline"] as const,
};
