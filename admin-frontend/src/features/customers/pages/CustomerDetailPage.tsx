import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { PageHeader } from "@/components/primitives/PageHeader";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { CustomerWorkspaceNav } from "@/components/stitch/CustomerWorkspaceNav";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createAdminCustomerNote,
  getAdminCustomerDetail,
  restoreAdminCustomer,
  suspendAdminCustomer
} from "@/features/customers/api/admin-customers.api";
import { displayCustomerName, formatMinorCurrency } from "@/features/customers/lib/customerDisplay";

const userStatusTone = (s: string): StatusBadgeTone => {
  switch (s) {
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
    case "LOCKED":
    case "DEACTIVATED":
      return "danger";
    default:
      return "pending";
  }
};

const initials = (c: { firstName: string | null; lastName: string | null; email: string | null }) => {
  const f = c.firstName?.trim()?.[0];
  const l = c.lastName?.trim()?.[0];
  if (f && l) {
    return `${f}${l}`.toUpperCase();
  }
  if (f) {
    return f.toUpperCase();
  }
  const em = c.email?.trim()?.[0];
  return em ? em.toUpperCase() : "?";
};

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatJoined = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatDob = (iso: string | null) => {
  if (!iso) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return "—";
  }
};

export const CustomerDetailPage = () => {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [statusReason, setStatusReason] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [newNote, setNewNote] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const detailQuery = useQuery({
    queryKey: ["admin-customer-detail", customerId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminCustomerDetail(accessToken, customerId);
    },
    enabled: Boolean(accessToken) && Boolean(customerId)
  });

  const e = detailQuery.data?.data.entity;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-customer-detail", customerId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
  };

  const suspendMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const r = statusReason.trim();
      if (!r) {
        throw new Error("Reason is required.");
      }
      return suspendAdminCustomer(accessToken, customerId, {
        reason: r,
        ...(statusNote.trim() ? { note: statusNote.trim() } : {})
      });
    },
    onSuccess: () => {
      setStatusReason("");
      setStatusNote("");
      setMsg({ type: "ok", text: "Customer suspended." });
      invalidate();
    },
    onError: (err: unknown) => {
      setMsg({ type: "err", text: err instanceof ApiError ? err.message : "Suspend failed." });
    }
  });

  const restoreMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const r = statusReason.trim();
      if (!r) {
        throw new Error("Reason is required.");
      }
      return restoreAdminCustomer(accessToken, customerId, {
        reason: r,
        ...(statusNote.trim() ? { note: statusNote.trim() } : {})
      });
    },
    onSuccess: () => {
      setStatusReason("");
      setStatusNote("");
      setMsg({ type: "ok", text: "Customer restored to active." });
      invalidate();
    },
    onError: (err: unknown) => {
      setMsg({ type: "err", text: err instanceof ApiError ? err.message : "Restore failed." });
    }
  });

  const noteMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return createAdminCustomerNote(accessToken, customerId, { note: newNote.trim() });
    },
    onSuccess: () => {
      setNewNote("");
      setMsg({ type: "ok", text: "Note added." });
      invalidate();
    },
    onError: (err: unknown) => {
      setMsg({ type: "err", text: err instanceof ApiError ? err.message : "Could not add note." });
    }
  });

  const canSuspend = e && e.status !== "SUSPENDED" && e.status !== "DEACTIVATED";
  const canRestore = e && e.status === "SUSPENDED";

  const errorMessage =
    detailQuery.error instanceof ApiError
      ? detailQuery.error.message
      : detailQuery.error instanceof Error
        ? detailQuery.error.message
        : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={e ? displayCustomerName(e) : "Customer"}
        description="Profile, commerce signals, and internal notes for this account."
        breadcrumbItems={
          e
            ? [
                { label: "CUSTOMERS", to: "/admin/customers" },
                { label: displayCustomerName(e).toUpperCase().slice(0, 48) }
              ]
            : undefined
        }
        meta={
          <Link to="/admin/customers" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
            ← All customers
          </Link>
        }
      />

      {!customerId ? <p className="text-sm text-red-700">Missing customer id.</p> : null}
      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}
      {msg ? (
        <div
          className={
            msg.type === "ok"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          }
        >
          {msg.text}
        </div>
      ) : null}

      {detailQuery.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : e ? (
        <>
          <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#3b6de6] text-3xl font-bold text-white shadow-lg shadow-[#1653cc]/20">
                {initials(e)}
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-3">
                  <h2 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">{displayCustomerName(e)}</h2>
                  <StatusBadge label={e.status.replace(/_/g, " ")} tone={userStatusTone(e.status)} />
                  <span className="rounded bg-[#ecedfb] px-2 py-0.5 text-xs font-medium text-[#434654]">Customer</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
                  {e.email ? (
                    <span className="flex items-center gap-1.5">
                      <MaterialIcon name="mail" className="text-base text-slate-400" />
                      {e.email}
                    </span>
                  ) : null}
                  {e.phoneNumber ? (
                    <span className="flex items-center gap-1.5">
                      <MaterialIcon name="call" className="text-base text-slate-400" />
                      {e.phoneNumber}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1.5">
                    <MaterialIcon name="calendar_today" className="text-base text-slate-400" />
                    Joined {formatJoined(e.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {e.email ? (
                <a
                  href={`mailto:${encodeURIComponent(e.email)}`}
                  className="rounded-md border border-[#c3c6d6] bg-white px-4 py-2 text-sm font-semibold text-[#1653cc] shadow-sm transition-colors hover:bg-[#f2f3ff]"
                >
                  Send email
                </a>
              ) : null}
              <Link
                to={`/admin/customers/${e.id}/orders`}
                className="rounded-md border border-[#c3c6d6] bg-white px-4 py-2 text-sm font-semibold text-[#1653cc] shadow-sm transition-colors hover:bg-[#f2f3ff]"
              >
                View orders
              </Link>
              <Link
                to={`/admin/customers/${e.id}/actions`}
                className="rounded-md bg-[#ba1a1a] px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:bg-red-700"
              >
                Account actions
              </Link>
            </div>
          </section>

          <CustomerWorkspaceNav customerId={e.id} />

          <section className="mb-2 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="flex h-28 flex-col justify-between rounded-xl border-l-4 border-[#1653cc] bg-white p-4 shadow-sm">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Total orders</p>
              <p className="font-headline text-2xl font-bold">{e.counts.orders}</p>
              <span className="text-[10px] font-bold uppercase text-slate-400">Lifetime</span>
            </div>
            <div className="flex h-28 flex-col justify-between rounded-xl border-l-4 border-[#1653cc] bg-white p-4 shadow-sm">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Lifetime value</p>
              <p className="font-headline text-xl font-bold leading-tight">
                {formatMinorCurrency(e.lifetimeValueCents, "GHS")}
              </p>
              <span className="text-[10px] font-bold text-slate-400">Paid + partial refunds</span>
            </div>
            <div className="flex h-28 flex-col justify-between rounded-xl border-l-4 border-[#1653cc] bg-white p-4 shadow-sm">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Avg. order</p>
              <p className="font-headline text-xl font-bold leading-tight">
                {e.averageOrderValueCents != null ? formatMinorCurrency(e.averageOrderValueCents, "GHS") : "—"}
              </p>
              <span className="text-[10px] font-bold text-slate-400">LTV ÷ orders</span>
            </div>
            <div className="flex h-28 flex-col justify-between rounded-xl border-l-4 border-slate-300 bg-white p-4 shadow-sm">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Last order</p>
              {e.lastOrder ? (
                <>
                  <Link
                    className="font-headline text-lg font-bold leading-tight text-[#1653cc] hover:underline"
                    to={`/admin/orders/${e.lastOrder.id}`}
                  >
                    {e.lastOrder.orderNumber}
                  </Link>
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    {formatWhen(e.lastOrder.createdAt)}
                  </span>
                </>
              ) : (
                <>
                  <p className="font-headline text-2xl font-bold text-slate-400">—</p>
                  <span className="text-[10px] font-bold text-slate-400">No orders yet</span>
                </>
              )}
            </div>
            <div className="flex h-28 flex-col justify-between rounded-xl border-l-4 border-[#ba1a1a] bg-white p-4 shadow-sm">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Refunds</p>
              <p className="font-headline text-2xl font-bold text-[#ba1a1a]">{e.counts.refunds}</p>
              <span className="text-[10px] font-bold uppercase text-slate-400">All time</span>
            </div>
            <div className="flex h-28 flex-col justify-between rounded-xl border-l-4 border-[#ba1a1a] bg-white p-4 shadow-sm">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Returns</p>
              <p className="font-headline text-2xl font-bold text-[#ba1a1a]">{e.counts.returns}</p>
              <span className="text-[10px] font-bold uppercase text-slate-400">All time</span>
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#c3c6d6]/20 bg-[#f2f3ff]/50 px-6 py-4">
                  <h3 className="font-headline text-sm font-bold uppercase tracking-wide text-[#181b25]">
                    Contact &amp; profile
                  </h3>
                </div>
                <div className="grid gap-6 p-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Display name</p>
                    <p className="text-sm font-medium">{displayCustomerName(e)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Email</p>
                    <p className="text-sm font-medium">{e.email ?? "—"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Phone</p>
                    <p className="text-sm font-medium">{e.phoneNumber ?? "—"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Date of birth</p>
                    <p className="text-sm font-medium">{formatDob(e.dateOfBirth)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Open support tickets</p>
                    <p className="text-sm font-medium">{e.counts.openSupportTickets}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Reviews posted</p>
                    <p className="text-sm font-medium">{e.counts.reviews}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Last profile update</p>
                    <p className="text-sm font-medium">{formatWhen(e.updatedAt)}</p>
                  </div>
                  {e.addresses.length > 0 ? (
                    <div className="sm:col-span-2">
                      <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">
                        Saved addresses
                      </p>
                      <ul className="space-y-3">
                        {e.addresses.map((a) => (
                          <li
                            key={a.id}
                            className="rounded-lg border border-[#c3c6d6]/30 bg-[#faf8ff] p-3 text-sm leading-relaxed text-slate-700"
                          >
                            <p className="font-semibold text-[#181b25]">
                              {a.fullName}
                              {a.label ? <span className="ml-2 text-xs font-normal text-slate-500">({a.label})</span> : null}
                            </p>
                            <p>
                              {a.addressLine1}
                              {a.addressLine2 ? <>, {a.addressLine2}</> : null}
                            </p>
                            <p>
                              {a.city}, {a.region} {a.postalCode ?? ""} · {a.country}
                            </p>
                            {a.phoneNumber ? <p className="text-xs text-slate-500">{a.phoneNumber}</p> : null}
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {a.isDefaultShipping ? "Default shipping" : ""}
                              {a.isDefaultShipping && a.isDefaultBilling ? " · " : ""}
                              {a.isDefaultBilling ? "Default billing" : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">
                        Saved addresses
                      </p>
                      <p className="text-sm text-slate-500">No addresses on file.</p>
                    </div>
                  )}
                </div>
                <div className="border-t border-[#c3c6d6]/20 px-6 py-4">
                  <TechnicalJsonDisclosure
                    label="System identifiers"
                    data={{
                      userId: e.id,
                      clerkUserId: e.clerkUserId
                    }}
                    defaultOpen={false}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-4">
              <SurfaceCard title="Account status changes" description="Suspend and restore require a documented reason. Use Account actions for reactivate and other workflows.">
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  Reason (required)
                  <input
                    value={statusReason}
                    onChange={(ev) => setStatusReason(ev.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Recorded in audit and status history"
                  />
                </label>
                <label className="mt-2 flex flex-col gap-1 text-xs text-slate-600">
                  Optional note
                  <input
                    value={statusNote}
                    onChange={(ev) => setStatusNote(ev.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canSuspend || suspendMut.isPending || !statusReason.trim()}
                    onClick={() => suspendMut.mutate()}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-50"
                  >
                    {suspendMut.isPending ? "…" : "Suspend"}
                  </button>
                  <button
                    type="button"
                    disabled={!canRestore || restoreMut.isPending || !statusReason.trim()}
                    onClick={() => restoreMut.mutate()}
                    className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {restoreMut.isPending ? "…" : "Restore"}
                  </button>
                </div>
              </SurfaceCard>
            </div>
          </div>

          <SurfaceCard title="Internal notes" description="Visible to authorized staff only.">
            <div className="mb-4 border-b border-slate-100 pb-4">
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                Add note
                <textarea
                  value={newNote}
                  onChange={(ev) => setNewNote(ev.target.value)}
                  rows={2}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Internal CRM note"
                />
              </label>
              <button
                type="button"
                disabled={noteMut.isPending || !newNote.trim()}
                onClick={() => noteMut.mutate()}
                className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {noteMut.isPending ? "Saving…" : "Save note"}
              </button>
            </div>
            {e.notes.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No notes yet.</p>
            ) : (
              <ul className="space-y-3">
                {e.notes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-content)] p-3">
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {formatWhen(n.createdAt)}
                      {n.actorAdmin?.email ? ` · ${n.actorAdmin.email}` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{n.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>
        </>
      ) : null}
    </div>
  );
};
