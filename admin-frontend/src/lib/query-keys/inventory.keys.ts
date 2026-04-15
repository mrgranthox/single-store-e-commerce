export const inventoryKeys = {
  all: () => ["admin-inventory"] as const,

  lists: () => [...inventoryKeys.all(), "list"] as const,
  list: (params: Record<string, unknown>) =>
    [...inventoryKeys.lists(), params] as const,

  details: () => [...inventoryKeys.all(), "detail"] as const,
  detail: (id: string) => [...inventoryKeys.details(), id] as const,

  movements: (variantId: string) =>
    [...inventoryKeys.detail(variantId), "movements"] as const,

  adjustments: () => [...inventoryKeys.all(), "adjustments"] as const,
  alerts: () => [...inventoryKeys.all(), "alerts"] as const };
