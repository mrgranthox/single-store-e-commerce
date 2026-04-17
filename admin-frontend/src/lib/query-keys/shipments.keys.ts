export const shipmentKeys = {
  all: () => ["admin-shipments"] as const,

  lists: () => [...shipmentKeys.all(), "list"] as const,
  list: (params: Record<string, unknown>) => [...shipmentKeys.lists(), params] as const,

  details: () => [...shipmentKeys.all(), "detail"] as const,
  detail: (id: string) => [...shipmentKeys.details(), id] as const
};
