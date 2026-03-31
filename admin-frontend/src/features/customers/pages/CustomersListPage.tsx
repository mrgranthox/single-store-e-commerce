import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/primitives/PageHeader";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, listAdminCustomers, type AdminCustomerListItem } from "@/features/customers/api/admin-customers.api";
import { displayCustomerName } from "@/features/customers/lib/customerDisplay";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { StitchFilterPanel } from "@/components/stitch";

const USER_STATUSES = ["", "ACTIVE", "PENDING_VERIFICATION", "SUSPENDED", "LOCKED", "DEACTIVATED"] as const;

type ListFilters = {
  q: string;
  status: string;
  joined_after: string;
  joined_before: string;
  min_orders: string;
  max_orders: string;
  min_ltv_dollars: string;
  max_ltv_dollars: string;
};

const emptyFilters: ListFilters = {
  q: "",
  status: "",
  joined_after: "",
  joined_before: "",
  min_orders: "",
  max_orders: "",
  min_ltv_dollars: "",
  max_ltv_dollars: ""
};

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

const listInitials = (c: AdminCustomerListItem) => {
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
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const parseOptionalInt = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOptionalLtvCents = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
};

const exportPageCsv = (items: AdminCustomerListItem[], page: number) => {
  const headers = ["Name", "Email", "Phone", "Status", "Orders", "OpenTickets", "Reviews", "Joined", "UpdatedAt"];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...items.map((c) =>
      [
        displayCustomerName(c),
        c.email ?? "",
        c.phoneNumber ?? "",
        c.status,
        c.counts.orders,
        c.counts.openSupportTickets,
        c.counts.reviews,
        c.createdAt,
        c.updatedAt
      ]
        .map((v) => esc(String(v)))
        .join(",")
    )
  ].join("\n");
  const blob = new Blob([lines], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `customers-page-${page}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const CustomersListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<ListFilters>(emptyFilters);
  const [draft, setDraft] = useState<ListFilters>(emptyFilters);

  const queryKey = useMemo(() => ["admin-customers", page, applied] as const, [page, applied]);

  const customersQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminCustomers(accessToken, {
        page,
        page_size: 20,
        ...(applied.q.trim() ? { q: applied.q.trim() } : {}),
        ...(applied.status ? { status: applied.status } : {}),
        ...(applied.joined_after.trim() ? { joined_after: applied.joined_after.trim() } : {}),
        ...(applied.joined_before.trim() ? { joined_before: applied.joined_before.trim() } : {}),
        ...(() => {
          const minO = parseOptionalInt(applied.min_orders);
          const maxO = parseOptionalInt(applied.max_orders);
          return {
            ...(minO != null ? { min_orders: minO } : {}),
            ...(maxO != null ? { max_orders: maxO } : {})
          };
        })(),
        ...(() => {
          const minL = parseOptionalLtvCents(applied.min_ltv_dollars);
          const maxL = parseOptionalLtvCents(applied.max_ltv_dollars);
          return {
            ...(minL != null ? { min_ltv_cents: minL } : {}),
            ...(maxL != null ? { max_ltv_cents: maxL } : {})
          };
        })()
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = customersQuery.data?.data.items ?? [];
  const meta = customersQuery.data?.meta;

  const summary = meta?.matchingSummary;
  const totalMatching = summary?.totalMatching ?? meta?.totalItems ?? 0;
  const activeMatching = summary?.byStatus?.ACTIVE ?? 0;
  const restrictedMatching =
    (summary?.byStatus?.SUSPENDED ?? 0) +
    (summary?.byStatus?.LOCKED ?? 0) +
    (summary?.byStatus?.DEACTIVATED ?? 0);
  const pendingMatching = summary?.byStatus?.PENDING_VERIFICATION ?? 0;

  const applyFilters = () => {
    setPage(1);
    setApplied({ ...draft });
  };

  const errorMessage =
    customersQuery.error instanceof ApiError
      ? customersQuery.error.message
      : customersQuery.error instanceof Error
        ? customersQuery.error.message
        : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Search and review shopper accounts, order volume, and support load."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-customers"])]}
        actions={
          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => exportPageCsv(items, page)}
            className="flex items-center gap-2 rounded-lg border border-[#c3c6d6] bg-white px-4 py-2 text-sm font-semibold text-[#181b25] transition-colors hover:bg-[#f2f3ff] disabled:opacity-40"
          >
            <MaterialIcon name="download" className="text-lg text-[#1653cc]" />
            Export page (CSV)
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-xl border-l-4 border-[#1653cc] bg-white p-4 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">Matching accounts</span>
            <span className="font-headline text-2xl font-bold">{totalMatching}</span>
            <span className="text-[10px] text-slate-400">All filters applied</span>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border-l-4 border-[#006b2d] bg-white p-4 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">Active</span>
            <span className="font-headline text-2xl font-bold">{activeMatching}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border-l-4 border-[#ba1a1a] bg-white p-4 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">Restricted</span>
            <span className="font-headline text-2xl font-bold">{restrictedMatching}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border-l-4 border-[#3b6de6] bg-white p-4 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">Pending verification</span>
            <span className="font-headline text-2xl font-bold">{pendingMatching}</span>
          </div>
        </div>
      </div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
        KPI strip reflects every account that matches the current filters (not just this page).
      </p>

      <StitchFilterPanel className="grid gap-4 md:grid-cols-12 md:items-end">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] md:col-span-3">
          Search
          <div className="relative">
            <MaterialIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400"
            />
            <input
              value={draft.q}
              onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyFilters();
                }
              }}
              className="w-full rounded-lg border border-[var(--color-border-light)] py-2 pl-10 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
              placeholder="Name or email"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] md:col-span-2">
          Status
          <select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 text-sm"
          >
            {USER_STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? s.replace(/_/g, " ") : "All statuses"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] md:col-span-2">
          Joined after
          <input
            type="date"
            value={draft.joined_after}
            onChange={(e) => setDraft((d) => ({ ...d, joined_after: e.target.value }))}
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] md:col-span-2">
          Joined before
          <input
            type="date"
            value={draft.joined_before}
            onChange={(e) => setDraft((d) => ({ ...d, joined_before: e.target.value }))}
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] md:col-span-1">
          Min orders
          <input
            inputMode="numeric"
            value={draft.min_orders}
            onChange={(e) => setDraft((d) => ({ ...d, min_orders: e.target.value }))}
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 text-sm"
            placeholder="0"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] md:col-span-1">
          Max orders
          <input
            inputMode="numeric"
            value={draft.max_orders}
            onChange={(e) => setDraft((d) => ({ ...d, max_orders: e.target.value }))}
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] md:col-span-1">
          Min LTV ($)
          <input
            inputMode="decimal"
            value={draft.min_ltv_dollars}
            onChange={(e) => setDraft((d) => ({ ...d, min_ltv_dollars: e.target.value }))}
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 text-sm"
            placeholder="0"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] md:col-span-1">
          Max LTV ($)
          <input
            inputMode="decimal"
            value={draft.max_ltv_dollars}
            onChange={(e) => setDraft((d) => ({ ...d, max_ltv_dollars: e.target.value }))}
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-12">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(emptyFilters);
              setApplied(emptyFilters);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--color-border-light)] px-4 py-2 text-sm font-semibold text-slate-600"
          >
            Reset
          </button>
        </div>
      </StitchFilterPanel>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {customersQuery.isLoading ? (
        <div className="rounded-xl border border-[var(--color-border-light)] bg-white p-8 text-center text-sm text-[var(--color-text-muted)]">
          Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#c3c6d6]/20 bg-white shadow-sm">
          {items.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No customers match filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#f2f3ff]">
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Customer</th>
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Contact</th>
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Orders</th>
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Open tickets</th>
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Reviews</th>
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Joined</th>
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Updated</th>
                    <th className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d6]/20">
                  {items.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-[#faf8ff]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#b4c5ff] text-[11px] font-bold text-[#003ea7]">
                            {listInitials(c)}
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/admin/customers/${c.id}`}
                              className="block truncate font-semibold text-[#1653cc] hover:underline"
                            >
                              {displayCustomerName(c)}
                            </Link>
                            <span className="font-mono text-[10px] text-slate-400">{c.id.slice(0, 8)}…</span>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[200px] px-4 py-4 text-sm text-slate-700">
                        <div className="truncate">{c.email ?? "—"}</div>
                        {c.phoneNumber ? <div className="truncate text-xs text-slate-500">{c.phoneNumber}</div> : null}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={c.status.replace(/_/g, " ")} tone={userStatusTone(c.status)} />
                      </td>
                      <td className="px-4 py-4 font-mono text-sm">{c.counts.orders}</td>
                      <td className="px-4 py-4 font-mono text-sm">{c.counts.openSupportTickets}</td>
                      <td className="px-4 py-4 font-mono text-sm">{c.counts.reviews}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{formatWhen(c.createdAt)}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{formatWhen(c.updatedAt)}</td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          to={`/admin/customers/${c.id}`}
                          className="text-xs font-bold uppercase tracking-wide text-[#1653cc] hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-muted)]">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.totalItems} customers
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[var(--color-border-light)] px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[var(--color-border-light)] px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
