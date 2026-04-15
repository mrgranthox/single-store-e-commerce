import type { PropsWithChildren } from "react";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider } from "@tanstack/react-query";

import { captureFrontendException } from "@/lib/observability/sentry";
import { ApiError } from "@/lib/api/http";
import { CACHE } from "@/lib/api/cache-strategy";
import { toast } from "@/lib/toast";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      captureFrontendException(error, {
        scope: "react-query",
        kind: "query",
        queryKey: query.queryKey });
    } }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      captureFrontendException(error, {
        scope: "react-query",
        kind: "mutation",
        mutationKey: mutation.options.mutationKey ?? null });

      // Safety-net: surface truly unexpected (non-API) runtime errors that no
      // individual mutation handles.  ApiErrors are expected business errors
      // that pages handle with their own errorMessage / onError callbacks.
      if (!(error instanceof ApiError)) {
        toast.error(
          "An unexpected error occurred",
          "Please refresh the page and try again.",
        );
      }
    } }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Default: operational cadence.  Override per-query via CACHE constants.
      ...CACHE.OPERATIONAL } } });

export const AppProviders = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
