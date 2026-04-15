import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { AsyncActionButton } from "@/components/primitives/AsyncActionButton";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { DestructiveActionButton } from "@/components/primitives/DestructiveActionButton";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { requestAdminStepUpToken } from "@/features/auth/step-up";
import { useAdminAction } from "@/lib/admin-actions/useAdminAction";
import {
  ApiError,
  getAdminUser,
  listAdminUserSessions,
  listAdminUsers,
  reactivateAdminUser,
  revokeAdminUserSession,
  suspendAdminUser,
  updateAdminUser,
  updateAdminUserRoles
} from "@/features/system/api/admin-users.api";

const formatWhen = (value: string | null) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
};

export const AdminUserDetailPage = () => {
  const { adminUserId = "" } = useParams<{ adminUserId: string }>();
  const accessToken = useAdminAuthStore((state) => state.accessToken);
  const actorEmail = useAdminAuthStore((state) => state.actor?.email ?? null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "" });
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<"suspend" | "reactivate" | null>(null);

  const [detailQ, rolesQ, sessionsQ] = useQueries({
    queries: [
      {
        queryKey: ["admin-user-detail", adminUserId],
        queryFn: async () => {
          if (!accessToken) throw new Error("Not signed in.");
          return getAdminUser(accessToken, adminUserId);
        },
        enabled: Boolean(accessToken && adminUserId)
      },
      {
        queryKey: ["admin-user-role-options"],
        queryFn: async () => {
          if (!accessToken) throw new Error("Not signed in.");
          return listAdminUsers(accessToken, { page: 1, page_size: 1 });
        },
        enabled: Boolean(accessToken)
      },
      {
        queryKey: ["admin-user-sessions", adminUserId],
        queryFn: async () => {
          if (!accessToken) throw new Error("Not signed in.");
          return listAdminUserSessions(accessToken, adminUserId);
        },
        enabled: Boolean(accessToken && adminUserId)
      }
    ]
  });

  const entity = detailQ.data?.data.entity;
  const roleOptions = rolesQ.data?.data.availableRoles ?? [];
  const selectedSet = useMemo(() => new Set(selectedRoleCodes), [selectedRoleCodes]);

  useEffect(() => {
    if (!entity) {
      return;
    }
    setEditForm({
      firstName: entity.firstName ?? "",
      lastName: entity.lastName ?? ""
    });
    setSelectedRoleCodes(entity.roles.map((role) => role.code));
  }, [entity]);

  const updateProfileMutation = useAdminAction({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return updateAdminUser(accessToken, adminUserId, {
        firstName: editForm.firstName || null,
        lastName: editForm.lastName || null
      });
    },
    invalidate: [["admin-user-detail", adminUserId], ["admin-users"]],
    onSuccess: (result) => {
      setEditForm({
        firstName: result.data.entity.firstName ?? "",
        lastName: result.data.entity.lastName ?? ""
      });
    }
  });

  const updateRolesMutation = useAdminAction({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return updateAdminUserRoles(accessToken, adminUserId, { roleCodes: [...selectedSet] }, stepUpToken);
    },
    invalidate: [["admin-user-detail", adminUserId], ["admin-users"]]
  });

  const suspendMutation = useAdminAction({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return suspendAdminUser(accessToken, adminUserId, {}, stepUpToken);
    },
    invalidate: [["admin-user-detail", adminUserId], ["admin-users"]]
  });

  const reactivateMutation = useAdminAction({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return reactivateAdminUser(accessToken, adminUserId, {}, stepUpToken);
    },
    invalidate: [["admin-user-detail", adminUserId], ["admin-users"]]
  });

  const revokeSessionMutation = useAdminAction({
    mutationFn: async (sessionId: string) => {
      if (!accessToken) throw new Error("Not signed in.");
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return revokeAdminUserSession(accessToken, adminUserId, sessionId, {}, stepUpToken);
    },
    invalidate: [["admin-user-sessions", adminUserId], ["admin-user-detail", adminUserId]]
  });

  const sessionRows = (sessionsQ.data?.data.items ?? []).map((session) => [
    <span key={`ua-${session.id}`} className="text-sm text-[#181b25]">{session.userAgent ?? "Unknown device"}</span>,
    <span key={`ip-${session.id}`} className="font-mono text-xs text-[#434654]">{session.ipAddress ?? "—"}</span>,
    <span key={`last-${session.id}`} className="text-xs text-[#737685]">{formatWhen(session.lastSeenAt)}</span>,
    <span key={`status-${session.id}`} className="text-xs font-semibold uppercase text-[#5b5e68]">{session.revokedAt ? "Revoked" : "Active"}</span>,
    <button
      key={`revoke-${session.id}`}
      type="button"
      className="text-xs font-semibold text-[#ba1a1a] underline decoration-dotted disabled:opacity-50"
      disabled={Boolean(session.revokedAt) || revokeSessionMutation.isPending || revokeSessionMutation.blocked}
      onClick={() => revokeSessionMutation.run(session.id)}
    >
      Revoke
    </button>
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={entity ? entity.fullName ?? entity.email : "Admin user detail"}
        description="Profile metadata, role assignment, status control, and operator session management."
        actions={
          entity?.status === "ACTIVE" ? (
            <DestructiveActionButton pending={suspendMutation.isPending} blocked={suspendMutation.blocked} onClick={() => setConfirmAction("suspend")}>
              Suspend admin
            </DestructiveActionButton>
          ) : (
            <AsyncActionButton pending={reactivateMutation.isPending} blocked={reactivateMutation.blocked} onClick={() => setConfirmAction("reactivate")}>
              Reactivate admin
            </AsyncActionButton>
          )
        }
      />

      {detailQ.error instanceof ApiError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{detailQ.error.message}</div> : null}

      {entity ? (
        <>
          <SurfaceCard title="Profile metadata">
            <div className="grid gap-4 md:grid-cols-2">
              <input value={editForm.firstName} onChange={(event) => setEditForm((current) => ({ ...current, firstName: event.target.value }))} placeholder="First name" className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm" />
              <input value={editForm.lastName} onChange={(event) => setEditForm((current) => ({ ...current, lastName: event.target.value }))} placeholder="Last name" className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm" />
              <input value={entity.email} readOnly className="rounded-lg border border-[#e0e2f0] bg-[#f8f9fb] px-3 py-2 text-sm" />
              <input value={entity.status} readOnly className="rounded-lg border border-[#e0e2f0] bg-[#f8f9fb] px-3 py-2 text-sm" />
            </div>
            <div className="mt-4">
              <AsyncActionButton pending={updateProfileMutation.isPending} blocked={updateProfileMutation.blocked} onClick={() => updateProfileMutation.run(undefined)}>
                Save profile
              </AsyncActionButton>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Role assignments">
            <div className="grid gap-2 md:grid-cols-2">
              {roleOptions.map((role) => (
                <label key={role.id} className="flex items-center gap-2 rounded-lg border border-[#e0e2f0] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(role.code)}
                    onChange={(event) =>
                      setSelectedRoleCodes((current) =>
                        event.target.checked ? [...new Set([...current, role.code])] : current.filter((entry) => entry !== role.code)
                      )
                    }
                  />
                  <span>{role.name}</span>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <AsyncActionButton pending={updateRolesMutation.isPending} blocked={updateRolesMutation.blocked} onClick={() => updateRolesMutation.run(undefined)}>
                Update roles
              </AsyncActionButton>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Sessions" description="Visible operator sessions and explicit revocation controls.">
            <DataTableShell columns={["Device", "IP", "Last seen", "Status", "Action"]} rows={sessionRows} emptyState={sessionsQ.isLoading ? "Loading sessions…" : "No sessions found."} variant="stitchOperational" />
          </SurfaceCard>
        </>
      ) : detailQ.isLoading ? (
        <SurfaceCard title="Admin user detail"><p className="text-sm text-[#5b5e68]">Loading admin user…</p></SurfaceCard>
      ) : null}

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === "suspend" ? "Suspend admin user?" : "Reactivate admin user?"}
        body="This action affects privileged access and is audited."
        danger={confirmAction === "suspend"}
        confirmLabel={confirmAction === "suspend" ? "Suspend" : "Reactivate"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction === "suspend") {
            suspendMutation.run(undefined);
          } else if (confirmAction === "reactivate") {
            reactivateMutation.run(undefined);
          }
          setConfirmAction(null);
        }}
      />
    </div>
  );
};
