import { Navigate, Outlet, useLocation } from "react-router-dom";

import { AdminShell } from "@/components/layout/AdminShell";
import { AdminShellSkeleton } from "@/components/primitives/AdminShellSkeleton";
import { WorkspaceStateCard } from "@/components/primitives/WorkspaceStateCard";
import { AdminRoutePermissionGate } from "@/components/routing/AdminRoutePermissionGate";
import { useAdminBootstrap } from "@/features/auth/useAdminBootstrap";

export const ProtectedAdminLayout = () => {
  const location = useLocation();
  const { state, refetch, clearSession } = useAdminBootstrap();

  if (state === "hydrating-storage" || state === "auth-loading" || state === "auth-refreshing") {
    return <AdminShellSkeleton />;
  }

  if (state === "cold" || state === "session-expired") {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (state === "forbidden") {
    return <Navigate to="/admin/forbidden" replace />;
  }

  if (state === "offline-degraded") {
    return (
      <WorkspaceStateCard
        title="You appear to be offline"
        description="The admin shell could not refresh server state. Reconnect and retry the workspace."
        primaryActionLabel="Retry workspace"
        secondaryActionLabel="Sign out"
        onPrimaryAction={() => void refetch()}
        onSecondaryAction={clearSession}
      />
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
