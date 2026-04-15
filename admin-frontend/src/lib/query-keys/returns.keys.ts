export const returnsKeys = {
  all: () => ["admin-returns"] as const,
  lists: () => [...returnsKeys.all(), "list"] as const,
  list: (params: Record<string, unknown>) =>
    [...returnsKeys.lists(), params] as const,
  detail: (id: string) => [...returnsKeys.all(), id] as const,
};

export const refundsKeys = {
  all: () => ["admin-refunds"] as const,
  lists: () => [...refundsKeys.all(), "list"] as const,
  list: (params: Record<string, unknown>) =>
    [...refundsKeys.lists(), params] as const,
  detail: (id: string) => [...refundsKeys.all(), id] as const,
};
