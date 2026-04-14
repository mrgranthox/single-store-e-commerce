import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

type AdminActionOptions<TVariables, TResult> = {
  mutationFn: (variables: TVariables) => Promise<TResult>;
  invalidate?: QueryKey[];
  onSuccess?: (result: TResult, variables: TVariables) => void;
  onError?: (error: unknown, variables: TVariables) => void;
};

export const useAdminAction = <TVariables, TResult>({
  mutationFn,
  invalidate = [],
  onSuccess,
  onError
}: AdminActionOptions<TVariables, TResult>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      invalidate.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
      onSuccess?.(result, variables);
    },
    onError
  });
};
