import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, listAdminRefunds, type RefundListItem } from "@/features/refunds/api/admin-refunds.api";
import { customerInitials } from "@/features/payments/ui/stitchPaymentsUi";

const refundRefLabel = (id: string) => `REF-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
const returnRefLabel = (id: string) => `RET-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const money = (cents: number, cur: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
};

const relativeRequested = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1) return "<1h ago";
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 36e5;

const parseMoney = (raw: string): number | null => {
  const t = raw.trim().replace(/[^0-9.]/g, "");
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
};

const RefundStatusPill = ({ state }: { state: string }) => {
  const label = state.replace(/_/g, " ");
  if (state === "PENDING_APPROVAL") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        <span className="text-[10px] font-bold uppercase tracking-tight text-amber-700">Pending Approval</span>
      </div>
    );
  }
  if (state === "COMPLETED") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
        <span className="text-[10px] font-bold uppercase tracking-tight text-emerald-800">Completed</span>
      </div>
    );
  }
  if (state === "REJECTED" || state === "FAILED") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
        <span className="text-[10px] font-bold uppercase tracking-tight text-red-800">{label}</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      <span className="text-[10px] font-bold uppercase tracking-tight text-slate-700">{label}</span>
    </div>
  );
};

const STATE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Statuses" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "PENDING_PROVIDER", label: "Processing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "FAILED", label: "Failed" }
];

export const RefundsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const queryKey = useMemo(() => ["admin-refunds", page, q, state] as const, [page, q, state]);

  useEffect(() => {
    setSelected(new Set());
  }, [page, q, state]);

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminRefunds(accessToken, {
        page,
        page_size: 20,
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(state ? { state } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;

  const displayItems = useMemo(() => {
    let r = items;
    const minC = parseMoney(amountMin);
    const maxC = parseMoney(amountMax);
    if (minC != null) r = r.filter((x) => x.amountCents >= minC);
    if (maxC != null) r = r.filter((x) => x.amountCents <= maxC);
    if (dateFrom.trim()) {
      const d0 = new Date(dateFrom);
      r = r.filter((x) => new Date(x.createdAt) >= d0);
    }
    return r;
  }, [items, amountMin, amountMax, dateFrom]);

  const pendingApproval = useMemo(() => displayItems.filter((r) => r.state === "PENDING_APPROVAL").length, [displayItems]);
  const stale48 = useMemo(
    () => displayItems.filter((r) => r.state === "PENDING_APPROVAL" && hoursSince(r.createdAt) > 48).length,
    [displayItems]
  );

  const errorMessage =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error instanceof Error
        ? listQuery.error.message
        : null;

  const allOnPageSelected = displayItems.length > 0 && displayItems.every((r) => selected.has(r.id));

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        displayItems.forEach((r) => next.delete(r.id));
      } else {
        displayItems.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const exportSelectedCsv = () => {
    const picked = displayItems.filter((r) => selected.has(r.id));
    if (picked.length === 0) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["RefundId", "OrderNumber", "Customer", "Amount", "Currency", "State", "RequestedAt"];
    const lines = [
      header.join(","),
      ...picked.map((r) =>
        [
          esc(r.id),
          esc(r.order.orderNumber),
          esc(r.order.customer.name ?? r.order.customer.email ?? "Guest"),
          esc(String(r.amountCents / 100)),
          esc(r.currency),
          esc(r.state),
          esc(r.createdAt)
        ].join(",")
      )
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `refunds-selected-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyFilters = () => {
    setPage(1);
    setQ(qDraft);
  };

  const clearFilters = () => {
    setQDraft("");
    setQ("");
    setState("");
    setDateFrom("");
    setAmountMin("");
    setAmountMax("");
    setPage(1);
  };

  const urgentRow = (r: RefundListItem) => r.state === "PENDING_APPROVAL" && hoursSince(r.createdAt) > 48;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-[#0f1117]">Refunds</h1>
          <p className="mt-1 text-sm text-slate-500">Manage customer return capital and adjustment workflows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-refunds"] })}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-[#1653cc]"
            title="Refresh"
          >
            <MaterialIcon name="refresh" className="text-lg" />
          </button>
          <button
            type="button"
            disabled
            title="Bulk approval is not enabled — open each refund to approve."
            className="flex items-center gap-2 rounded-md bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 text-sm font-semibold text-white opacity-50 shadow-sm"
          >
            <MaterialIcon name="check_circle" className="text-sm" />
            Approve Selected
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border-l-4 border-[#1653cc] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1653cc]/10 text-[#1653cc]">
            <MaterialIcon name="info" filled className="text-xl" />
          </div>
          <div>
            <p className="font-headline text-sm font-bold text-[#0f1117]">
              {pendingApproval} refund{pendingApproval === 1 ? "" : "s"} pending approval on this view
            </p>
            <p className="text-xs text-slate-500">Action required to maintain SLA performance metrics.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
          <MaterialIcon name="warning" className="text-lg text-red-600" />
          <span className="font-headline text-xs font-bold text-red-900">{stale48} awaiting &gt;48h</span>
        </div>
      </div>

      <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</label>
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border-none bg-slate-50 py-2 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
            >
              {STATE_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Date Range</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <MaterialIcon name="calendar_today" className="text-sm" />
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-md border-none bg-slate-50 py-2 pl-9 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount Range</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-slate-400">
                  <MaterialIcon name="payments" className="text-sm" />
                </span>
                <input
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  placeholder="Min"
                  className="w-full rounded-md border-none bg-slate-50 py-2 pl-8 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
                />
              </div>
              <input
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                placeholder="Max"
                className="w-1/2 rounded-md border-none bg-slate-50 py-2 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
              />
            </div>
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer Search</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <MaterialIcon name="person_search" className="text-sm" />
              </span>
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                placeholder="Search by name, email, or order #..."
                className="w-full rounded-md border-none bg-slate-50 py-2 pl-9 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-md bg-[#1653cc] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Apply search
          </button>
          <button type="button" onClick={clearFilters} className="text-xs font-bold uppercase tracking-widest text-[#1653cc] hover:underline">
            Clear filters
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {listQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading refunds…</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">{selected.size} selected</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAllPage}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#1653cc]"
              >
                {allOnPageSelected ? "Clear page" : "Select page"}
              </button>
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={exportSelectedCsv}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 disabled:opacity-40"
              >
                Export CSV
              </button>
            </div>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="w-10 p-4">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-[#1653cc] focus:ring-[#1653cc]/20"
                    checked={displayItems.length > 0 && allOnPageSelected}
                    onChange={toggleAllPage}
                    aria-label="Select all on page"
                  />
                </th>
                {(
                  [
                    "Refund #",
                    "Order / Return #",
                    "Customer",
                    "Amount",
                    "Reason",
                    "Status",
                    "Requested",
                    "Actions"
                  ] as const
                ).map((h) => (
                  <th key={h} className={`p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 ${h === "Actions" ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-sm text-slate-500">
                    No refunds match the current filters.
                  </td>
                </tr>
              ) : (
                displayItems.map((r) => {
                  const customer = r.order.customer.name ?? r.order.customer.email ?? "Guest";
                  const reason = r.return?.customerReason?.trim() || "—";
                  const initials = customerInitials(r.order.customer.name, r.order.customer.email);
                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors hover:bg-slate-50/50 ${urgentRow(r) ? "border-l-4 border-amber-400 bg-amber-50/30" : ""}`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-[#1653cc] focus:ring-[#1653cc]/20"
                          checked={selected.has(r.id)}
                          onChange={() => toggleRow(r.id)}
                          aria-label={`Select ${refundRefLabel(r.id)}`}
                        />
                      </td>
                      <td className="p-4">
                        <Link to={`/admin/refunds/${r.id}`} className="font-mono text-xs font-medium text-[#0f1117] hover:text-[#1653cc]">
                          {refundRefLabel(r.id)}
                        </Link>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <Link
                            to={`/admin/orders/${r.order.id}`}
                            className="font-mono text-[11px] text-slate-700 hover:text-[#1653cc]"
                          >
                            {r.order.orderNumber}
                          </Link>
                          {r.return ? (
                            <Link
                              to={`/admin/returns/${r.return.id}`}
                              className="font-mono text-[11px] text-slate-400 hover:text-[#1653cc]"
                            >
                              {returnRefLabel(r.return.id)}
                            </Link>
                          ) : (
                            <span className="font-mono text-[11px] text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                            {initials}
                          </div>
                          <span className="text-xs font-semibold text-[#0f1117]">{customer}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs font-bold text-[#0f1117]">{money(r.amountCents, r.currency)}</td>
                      <td className="max-w-[200px] truncate p-4 text-xs text-slate-600" title={reason}>
                        {reason}
                      </td>
                      <td className="p-4">
                        <RefundStatusPill state={r.state} />
                      </td>
                      <td className="p-4 text-xs text-slate-500">{relativeRequested(r.createdAt)}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/admin/refunds/${r.id}`}
                            className="p-1.5 text-slate-400 transition-colors hover:text-[#1653cc]"
                            title="Review"
                          >
                            <MaterialIcon name="visibility" className="text-lg" />
                          </Link>
                          <Link
                            to={`/admin/payments/${r.payment.id}`}
                            className="p-1.5 text-slate-400 transition-colors hover:text-[#1653cc]"
                            title="Payment"
                          >
                            <MaterialIcon name="payments" className="text-lg" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {meta ? (
            <div className="flex flex-col gap-2 border-t border-slate-100 px-6 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {displayItems.length !== items.length ? (
                  <>
                    Showing {displayItems.length} refined of {items.length} on page · {meta.totalItems} in catalog
                  </>
                ) : (
                  <>
                    Showing {items.length ? (meta.page - 1) * meta.limit + 1 : 0} to {(meta.page - 1) * meta.limit + items.length} of{" "}
                    {meta.totalItems} results
                  </>
                )}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-200 px-3 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="flex items-center rounded bg-[#1653cc] px-3 py-1 font-bold text-white">{meta.page}</span>
                <button
                  type="button"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-slate-200 px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
