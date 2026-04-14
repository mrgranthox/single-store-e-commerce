import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchCurrentAdmin } from "@/features/auth/auth.api";
import { useAdminAuthStore, type AdminActor } from "@/features/auth/auth.store";
import { ApiError } from "@/lib/api/http";

export type AdminBootstrapState =
  | "cold"
  | "hydrating-storage"
  | "auth-refreshing"
  | "auth-loading"
  | "authenticated"
  | "forbidden"
  | "session-expired"
  | "offline-degraded";

const shellToActor = (shell: NonNullable<Awaited<ReturnType<typeof fetchCurrentAdmin>>["data"]>): AdminActor => ({
  id: shell.admin.id,
  email: shell.admin.email,
  fullName: shell.admin.email.split("@")[0]?.replace(/[._-]+/g, " ") ?? null,
  status: shell.admin.status,
  roles: shell.roles.map((role) => role.code),
  permissions: shell.permissions,
  sessionSummary: {
    sessionId: shell.session?.sessionId ?? null,
    totalSessions: shell.security.totalSessions,
    activeSessions: shell.security.activeSessions
  }
});

export const useAdminBootstrap = () => {
  const accessToken = useAdminAuthStore((state) => state.accessToken);
  const hydrated = useAdminAuthStore((state) => state.hydrated);
  const hydrate = useAdminAuthStore((state) => state.hydrate);
  const setActor = useAdminAuthStore((state) => state.setActor);
  const clearSession = useAdminAuthStore((state) => state.clearSession);

  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrate, hydrated]);

  const meQuery = useQuery({
    queryKey: ["admin-me", accessToken],
    queryFn: async () => fetchCurrentAdmin(accessToken!),
    enabled: hydrated && Boolean(accessToken),
    retry: (failureCount, error) => {
      if (error instanceof ApiError) {
        return error.statusCode >= 500 && failureCount < 2;
      }
      return failureCount < 2;
    },
    staleTime: 30_000
  });

  useEffect(() => {
    const shell = meQuery.data?.data;
    if (shell) {
      setActor(shellToActor(shell));
    }
  }, [meQuery.data, setActor]);

  useEffect(() => {
    if (meQuery.error instanceof ApiError && (meQuery.error.statusCode === 401 || meQuery.error.statusCode === 403)) {
      clearSession();
    }
  }, [clearSession, meQuery.error]);

  const state = useMemo<AdminBootstrapState>(() => {
    if (!hydrated) {
      return "hydrating-storage";
    }
    if (!accessToken) {
      return "cold";
    }
    if (meQuery.isPending || (meQuery.isFetching && !meQuery.data)) {
      return "auth-loading";
    }
    if (meQuery.error instanceof ApiError) {
      if (meQuery.error.statusCode === 401) {
        return "session-expired";
      }
      if (meQuery.error.statusCode === 403) {
        return "forbidden";
      }
    }
    if (meQuery.isError && typeof navigator !== "undefined" && navigator.onLine === false) {
      return "offline-degraded";
    }
    if (meQuery.data?.data) {
      return "authenticated";
    }
    return "cold";
  }, [accessToken, hydrated, meQuery.data, meQuery.error, meQuery.isError, meQuery.isFetching, meQuery.isPending]);

  return {
    state,
    shell: meQuery.data?.data ?? null,
    refetch: meQuery.refetch,
    clearSession
  };
};
