import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

export type AdminActionState =
  | "idle"
  | "pending"
  | "permission-blocked"
  | "unavailable";

type AdminActionOptions<TVariables, TResult> = {
  mutationFn: (variables: TVariables) => Promise<TResult>;
  /** Dedupes concurrent runs of the same logical admin mutation (TanStack Query `mutationKey`). */
  mutationKey?: QueryKey;
  /** Default false: admin mutations should not auto-retry (avoids duplicate side effects). */
  retry?: number | boolean;
  /** When false, action is blocked (typically permission-based). */
  isAllowed?: boolean;
  /** When false, action is unavailable due to record status/input requirements. */
  isAvailable?: boolean;
  invalidate?: QueryKey[];
  onSuccess?: (result: TResult, variables: TVariables) => void;
  onError?: (error: unknown, variables: TVariables) => void;
};

export const useAdminAction = <TVariables, TResult>({
  mutationFn,
  mutationKey,
  retry = false,
  isAllowed = true,
  isAvailable = true,
  invalidate = [],
  onSuccess,
  onError
}: AdminActionOptions<TVariables, TResult>) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey,
    mutationFn,
    retry,
    onSuccess: (result, variables) => {
      invalidate.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
      onSuccess?.(result, variables);
    },
    onError
  });

  const run = (variables: TVariables) => {
    if (mutation.isPending || !isAllowed || !isAvailable) {
      return;
    }
    mutation.mutate(variables);
  };

  const state: AdminActionState = mutation.isPending
    ? "pending"
    : !isAllowed
      ? "permission-blocked"
      : !isAvailable
        ? "unavailable"
        : "idle";

  return {
    ...mutation,
    run,
    state,
    blocked: state === "permission-blocked" || state === "unavailable"
  };
};
