import type { PropsWithChildren } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { captureFrontendException } from "@/lib/observability/sentry";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      captureFrontendException(error, {
        scope: "react-query",
        kind: "query",
        queryKey: query.queryKey
      });
    }
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      captureFrontendException(error, {
        scope: "react-query",
        kind: "mutation",
        mutationKey: mutation.options.mutationKey ?? null
      });
    }
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000
    }
  }
});

export const AppProviders = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
