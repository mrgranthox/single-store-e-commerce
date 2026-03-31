import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/http";
import { fetchCurrentAdmin } from "@/features/auth/auth.api";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminRoutePermissionGate } from "@/components/routing/AdminRoutePermissionGate";

export const ProtectedAdminLayout = () => {
  const location = useLocation();
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
    }
  });

  useEffect(() => {
    const shell = meQuery.data?.data;
    if (!shell?.admin) {
      return;
    }

    setActor({
      id: shell.admin.id,
      email: shell.admin.email,
      fullName: null,
      roles: shell.roles.map((role) => role.code),
      permissions: shell.permissions
    });
  }, [meQuery.data, setActor]);

  useEffect(() => {
    if (meQuery.isError) {
      setActor(null);
    }
  }, [meQuery.isError, setActor]);

  useEffect(() => {
    if (meQuery.error instanceof ApiError && (meQuery.error.statusCode === 401 || meQuery.error.statusCode === 403)) {
      clearSession();
    }
  }, [clearSession, meQuery.error]);

  if (!hydrated) {
    return <div className="p-10 text-center text-slate-600">Hydrating admin session...</div>;
  }

  if (!accessToken) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (meQuery.isPending || (meQuery.isFetching && !meQuery.data)) {
    return <div className="p-10 text-center text-slate-600">Loading admin shell...</div>;
  }

  if (meQuery.isError) {
    const message =
      meQuery.error instanceof ApiError
        ? meQuery.error.message
        : meQuery.error instanceof Error
          ? meQuery.error.message
          : "We couldn't load the admin workspace right now.";

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb] p-6">
        <div className="w-full max-w-lg rounded-2xl border border-[#e0e2f0] bg-white p-8 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#737685]">Admin workspace</p>
          <h1 className="mt-2 font-headline text-2xl font-bold tracking-tight text-[#181b25]">
            Workspace temporarily unavailable
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#5b5e68]">{message}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void meQuery.refetch()}
              className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1653cc]/90"
            >
              Retry workspace
            </button>
            <button
              type="button"
              onClick={() => clearSession()}
              className="rounded-lg border border-[#d8dbe8] px-4 py-2 text-sm font-semibold text-[#434654] hover:bg-[#f8f9fb]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminShell>
      <AdminRoutePermissionGate>
        <Outlet />
      </AdminRoutePermissionGate>
    </AdminShell>
  );
};
