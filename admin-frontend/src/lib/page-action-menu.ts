import type { QueryClient } from "@tanstack/react-query";

import type { PageActionItem } from "@/components/primitives/PageActionsMenu";

/** Standard Stitch-style “Actions → Refresh data” entry; invalidates all queries under this key prefix. */
export const refreshDataMenuItem = (queryClient: QueryClient, queryKey: readonly unknown[]): PageActionItem => ({
  id: "refresh-data",
  label: "Refresh data",
  onSelect: () => {
    void queryClient.invalidateQueries({ queryKey });
  }
});
