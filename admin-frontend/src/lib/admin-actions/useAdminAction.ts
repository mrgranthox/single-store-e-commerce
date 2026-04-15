import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { toast } from "@/lib/toast";

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
  /**
   * Declarative success toast message.
   * When provided, a success toast fires automatically after mutation completes.
   * The callback form receives the mutation result for dynamic messages.
   */
  successMessage?: string | ((result: TResult, variables: TVariables) => string);
  /**
   * Declarative error toast message.
   * When provided, an error toast fires automatically on failure.
   * The callback form receives the error for dynamic message extraction.
   */
  errorMessage?: string | ((error: unknown, variables: TVariables) => string);
  onSuccess?: (result: TResult, variables: TVariables) => void;
  onError?: (error: unknown, variables: TVariables, context?: unknown) => void;
  /**
   * Called immediately before the mutation fires.
   * Return a snapshot value to pass to `onError` and `onSettled` for rollback.
   * Use this to implement optimistic UI updates.
   */
  onMutate?: (variables: TVariables) => Promise<unknown> | unknown;
  onSettled?: (result: TResult | undefined, error: unknown, variables: TVariables) => void;
};

export const useAdminAction = <TVariables, TResult>({
  mutationFn,
  mutationKey,
  retry = false,
  isAllowed = true,
  isAvailable = true,
  invalidate = [],
  successMessage,
  errorMessage,
  onSuccess,
  onError,
  onMutate,
  onSettled,
}: AdminActionOptions<TVariables, TResult>) => {
  const queryClient = useQueryClient();
  const token = useAdminAuthStore((s) => s.accessToken);

  const mutation = useMutation({
    mutationKey,
    // Token guard centralised here — callers never need to duplicate this check.
    mutationFn: (variables: TVariables) => {
      if (!token) throw new Error("Session expired. Please sign in again.");
      return mutationFn(variables);
    },
    retry,
    onSuccess: (result, variables) => {
      invalidate.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
      if (successMessage) {
        const msg =
          typeof successMessage === "function"
            ? successMessage(result, variables)
            : successMessage;
        toast.success(msg);
      }
      onSuccess?.(result, variables);
    },
    onMutate,
    onError: (error, variables, context) => {
      if (errorMessage) {
        const msg =
          typeof errorMessage === "function"
            ? errorMessage(error, variables)
            : errorMessage;
        toast.error(msg);
      }
      onError?.(error, variables, context);
    },
    onSettled: onSettled
      ? (result, error, variables) => onSettled(result as TResult | undefined, error, variables)
      : undefined,
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
    blocked: state === "permission-blocked" || state === "unavailable" };
};
