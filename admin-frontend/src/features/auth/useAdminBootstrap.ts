import { createContext, createElement, useContext, useEffect, useMemo, type PropsWithChildren } from "react";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";

import { fetchCurrentAdmin } from "@/features/auth/auth.api";
import { useAdminAuthStore, type AdminActor } from "@/features/auth/auth.store";
import { ApiError } from "@/lib/api/http";
import { useQuery } from "@tanstack/react-query";

export type AdminBootstrapState =
  | "cold"
  | "hydrating-storage"
  | "auth-refreshing"
  | "auth-loading"
  | "authenticated"
  | "forbidden"
  | "session-expired"
  | "offline-degraded";

export type AdminBootstrapResult = {
  state: AdminBootstrapState;
  shell: Awaited<ReturnType<typeof fetchCurrentAdmin>>["data"] | null;
  refetch: ReturnType<typeof useQuery>["refetch"];
  clearSession: () => void;
};

const AdminBootstrapContext = createContext<AdminBootstrapResult | null>(null);

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

const useAdminBootstrapValue = (): AdminBootstrapResult => {
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
      if (meQuery.isFetching && !meQuery.isPending) {
        return "auth-refreshing";
      }
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

export const AdminBootstrapProvider = ({ children }: PropsWithChildren) => {
  const value = useAdminBootstrapValue();
  return createElement(AdminBootstrapContext.Provider, { value }, children);
};

export const useAdminBootstrap = () => {
  const context = useContext(AdminBootstrapContext);
  return context ?? useAdminBootstrapValue();
};
