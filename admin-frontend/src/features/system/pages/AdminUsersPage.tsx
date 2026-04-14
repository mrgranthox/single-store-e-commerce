import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AsyncActionButton } from "@/components/primitives/AsyncActionButton";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { PageActionGroup } from "@/components/primitives/PageActionGroup";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { requestAdminStepUpToken } from "@/features/auth/step-up";
import { useAdminAction } from "@/lib/admin-actions/useAdminAction";
import {
  ApiError,
  createAdminUser,
  listAdminUsers
} from "@/features/system/api/admin-users.api";

export const AdminUsersPage = () => {
  const accessToken = useAdminAuthStore((state) => state.accessToken);
  const actorEmail = useAdminAuthStore((state) => state.actor?.email ?? null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    clerkAdminUserId: "",
    email: "",
    firstName: "",
    lastName: "",
    roleCodes: [] as string[]
  });
  const [flash, setFlash] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-users", page, q, status],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return listAdminUsers(accessToken, {
        page,
        page_size: 20,
        q: q || undefined,
        status: status || undefined
      });
    },
    enabled: Boolean(accessToken)
  });

  const createMutation = useAdminAction({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return createAdminUser(
        accessToken,
        {
          clerkAdminUserId: form.clerkAdminUserId.trim(),
          email: form.email.trim() || undefined,
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          roleCodes: form.roleCodes
        },
        stepUpToken
      );
    },
    invalidate: [["admin-users"]],
    onSuccess: () => {
      setFlash("Admin user created.");
      setForm({ clerkAdminUserId: "", email: "", firstName: "", lastName: "", roleCodes: [] });
      window.setTimeout(() => setFlash(null), 3000);
    },
    onError: (error) => {
      setFlash(error instanceof ApiError ? error.message : "Admin user creation failed.");
      window.setTimeout(() => setFlash(null), 5000);
    }
  });

  const items = query.data?.data.items ?? [];
  const roles = query.data?.data.availableRoles ?? [];
  const meta = query.data?.meta;

  const rows = items.map((item) => [
    <Link
      key={`email-${item.id}`}
      to={`/admin/system/admin-users/${item.id}`}
      className="font-semibold text-[#1653cc] hover:underline"
    >
      {item.fullName ?? item.email}
    </Link>,
    <span key={`mail-${item.id}`} className="text-sm text-[#434654]">{item.email}</span>,
    <span key={`roles-${item.id}`} className="text-sm text-[#434654]">{item.roles.map((role) => role.name).join(", ") || "—"}</span>,
    <span key={`status-${item.id}`} className="text-xs font-semibold uppercase text-[#5b5e68]">{item.status}</span>,
    <span key={`created-${item.id}`} className="text-xs text-[#737685]">{new Date(item.createdAt).toLocaleDateString()}</span>
  ]);

  const selectedRoleSet = useMemo(() => new Set(form.roleCodes), [form.roleCodes]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Admin users"
        description="Operator directory, role-aware access control, and current admin footprint."
        actions={
          <PageActionGroup>
            <Link to="/admin/system/admin-users/invitations" className="rounded-lg border border-[#d8dbe8] px-4 py-2 text-sm font-semibold text-[#434654] hover:bg-[#f8f9fb]">
              Invitations
            </Link>
          </PageActionGroup>
        }
      />

      {flash ? <div className="rounded-xl border border-[#e0e2f0] bg-white px-4 py-3 text-sm text-[#434654] shadow-sm">{flash}</div> : null}

      <SurfaceCard title="Filters" description="Search and narrow the admin operator list.">
        <div className="grid gap-4 md:grid-cols-3">
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search email or name" className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="LOCKED">Locked</option>
          </select>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Create admin user" description="Link a Clerk identity and assign the initial admin roles.">
        <div className="grid gap-4 md:grid-cols-2">
          <input value={form.clerkAdminUserId} onChange={(event) => setForm((current) => ({ ...current, clerkAdminUserId: event.target.value }))} placeholder="Clerk admin user id" className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm" />
          <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email override (optional)" className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm" />
          <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} placeholder="First name" className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm" />
          <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} placeholder="Last name" className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm" />
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 rounded-lg border border-[#e0e2f0] px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selectedRoleSet.has(role.code)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    roleCodes: event.target.checked
                      ? [...current.roleCodes, role.code]
                      : current.roleCodes.filter((entry) => entry !== role.code)
                  }))
                }
              />
              <span>{role.name}</span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <AsyncActionButton pending={createMutation.isPending} onClick={() => createMutation.mutate(undefined)}>
            Create admin user
          </AsyncActionButton>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Directory">
        {query.error instanceof ApiError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{query.error.message}</div> : null}
        <DataTableShell columns={["Admin", "Email", "Roles", "Status", "Created"]} rows={rows} emptyState={query.isLoading ? "Loading admin users…" : "No admin users matched this filter."} variant="stitchOperational" />
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
