import { useMemo, useState } from "react";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";

import { AsyncActionButton } from "@/components/primitives/AsyncActionButton";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { requestAdminStepUpToken } from "@/features/auth/step-up";
import { useAdminAction } from "@/lib/admin-actions/useAdminAction";
import { formatDateTime } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import {
  ApiError,
  createAdminInvitation,
  listAdminInvitations,
  resendAdminInvitation,
  revokeAdminInvitation
} from "@/features/system/api/admin-users.api";


export const AdminUserInvitationsPage = () => {
  const accessToken = useAdminAuthStore((state) => state.accessToken);
  const actorEmail = useAdminAuthStore((state) => state.actor?.email ?? null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    note: "",
    roleCodes: [] as string[]
  });
  const [flash, setFlash] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-user-invitations", page, status],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return listAdminInvitations(accessToken, { page, page_size: 20, status: status || undefined });
    },
    enabled: Boolean(accessToken)
  });

  const roles = query.data?.data.availableRoles ?? [];
  const selectedSet = useMemo(() => new Set(form.roleCodes), [form.roleCodes]);

  const createMutation = useAdminAction({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return createAdminInvitation(
        accessToken,
        {
          email: form.email.trim(),
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          note: form.note.trim() || undefined,
          roleCodes: form.roleCodes
        },
        stepUpToken
      );
    },
    invalidate: [["admin-user-invitations"]],
    onSuccess: () => {
      setFlash("Invitation created.");
      setForm({ email: "", firstName: "", lastName: "", note: "", roleCodes: [] });
      window.setTimeout(() => setFlash(null), 3000);
    },
    onError: (error) => {
      setFlash(error instanceof ApiError ? error.message : "Invitation create failed.");
      window.setTimeout(() => setFlash(null), 5000);
    }
  });

  const resendMutation = useAdminAction({
    mutationFn: async (invitationId: string) => {
      if (!accessToken) throw new Error("Not signed in.");
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return resendAdminInvitation(accessToken, invitationId, stepUpToken);
    },
    invalidate: [["admin-user-invitations"]]
  });

  const revokeMutation = useAdminAction({
    mutationFn: async (invitationId: string) => {
      if (!accessToken) throw new Error("Not signed in.");
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return revokeAdminInvitation(accessToken, invitationId, {}, stepUpToken);
    },
    invalidate: [["admin-user-invitations"]]
  });

  const items = query.data?.data.items ?? [];
  const meta = query.data?.meta;
  const rows = items.map((item) => [
    <span key={`email-${item.id}`} className="font-semibold text-[#181b25]">{item.email}</span>,
    <span key={`roles-${item.id}`} className="text-sm text-[#434654]">{item.roles.map((role) => role.name).join(", ") || "—"}</span>,
    <span key={`status-${item.id}`} className="text-xs font-semibold uppercase text-[#5b5e68]">{item.status}</span>,
    <span key={`expires-${item.id}`} className="text-xs text-[#737685]">{formatDateTime(item.expiresAt)}</span>,
    <div key={`actions-${item.id}`} className="flex gap-2">
      <button type="button" className="text-xs font-semibold text-[#1653cc] underline" onClick={() => resendMutation.run(item.id)} disabled={resendMutation.isPending || resendMutation.blocked || item.status === "ACCEPTED"}>
        Resend
      </button>
      <button type="button" className="text-xs font-semibold text-[#ba1a1a] underline" onClick={() => revokeMutation.run(item.id)} disabled={revokeMutation.isPending || revokeMutation.blocked || item.status !== "PENDING"}>
        Revoke
      </button>
    </div>
  ]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Admin invitations" description="Invite, resend, and revoke pending admin access." />
      {flash ? <div className="rounded-xl border border-[#e0e2f0] bg-white px-4 py-3 text-sm text-[#434654] shadow-sm">{flash}</div> : null}

      <SurfaceCard title="Create invitation">
        <div className="grid gap-4 md:grid-cols-2">
          <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm" />
          <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} placeholder="First name" className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm" />
          <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} placeholder="Last name" className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="REVOKED">Revoked</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
        <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Operator note" className="mt-4 min-h-24 w-full rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm" />
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 rounded-lg border border-[#e0e2f0] px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selectedSet.has(role.code)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    roleCodes: event.target.checked
                      ? [...new Set([...current.roleCodes, role.code])]
                      : current.roleCodes.filter((entry) => entry !== role.code)
                  }))
                }
              />
              <span>{role.name}</span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <AsyncActionButton pending={createMutation.isPending} blocked={createMutation.blocked} onClick={() => createMutation.run(undefined)}>
            Send invitation
          </AsyncActionButton>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Invitation queue">
        {query.error instanceof ApiError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{query.error.message}</div> : null}
        <DataTableShell columns={["Email", "Roles", "Status", "Expires", "Actions"]} rows={rows} emptyState={query.isLoading ? "Loading invitations…" : "No invitations found."} variant="stitchOperational" />
        <div className="mt-4 flex items-center justify-between text-sm text-[#5b5e68]">
          <span>Page {meta?.page ?? page} of {meta?.totalPages ?? 1}</span>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border border-[#d8dbe8] px-3 py-1.5 disabled:opacity-50" disabled={(meta?.page ?? page) <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <button type="button" className="rounded-lg border border-[#d8dbe8] px-3 py-1.5 disabled:opacity-50" disabled={(meta?.page ?? page) >= (meta?.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
};
