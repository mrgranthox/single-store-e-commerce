import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";

import { preloadLazyNamedComponent } from "@/app/lazy-admin-routes";
import { PageHeader } from "@/components/primitives/PageHeader";
import { QueryError } from "@/components/primitives/QueryError";
import { SkeletonTable } from "@/components/primitives/Skeleton";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { StitchFilterPanel } from "@/components/stitch";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getAdminReturnDetail, listAdminReturns, type ReturnListItem } from "@/features/returns/api/admin-returns.api";
import { useAdminDetailPrefetch } from "@/lib/performance/useAdminDetailPrefetch";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { CACHE } from "@/lib/api/cache-strategy";
import { useListFilters } from "@/lib/hooks/useListFilters";

const RETURN_STATUSES = ["", "REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "COMPLETED"] as const;

const RETURN_FILTER_DEFAULTS = { q: "", reason: "", status: "" };

const REASON_FILTERS: { label: string; value: string }[] = [
  { label: "All reasons", value: "" },
  { label: "Damaged", value: "damaged" },
  { label: "Wrong size", value: "wrong" },
  { label: "Defective", value: "defect" },
  { label: "Changed mind", value: "changed" }
];

const formatQueueWhen = (iso: string) => {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
};

const returnRef = (r: ReturnListItem) => `R-${r.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const returnStatusTone = (status: string): StatusBadgeTone => {
  const u = status.toUpperCase();
  if (u === "COMPLETED") return "success";
  if (u === "REJECTED") return "danger";
  if (u === "APPROVED" || u === "RECEIVED") return "info";
  return "pending";
};

const statusPill = (status: string) => (
  <StatusBadge label={status.replace(/_/g, " ")} tone={returnStatusTone(status)} />
);

const refundStateTone = (st: string): StatusBadgeTone => {
  if (!st) return "pending";
  if (st === "COMPLETED" || st === "SUCCEEDED" || st === "PAID") return "success";
  if (st === "FAILED") return "danger";
  return "pending";
};

const refundPill = (r: ReturnListItem) => {
  const st = r.refunds[0]?.state?.toUpperCase() ?? "";
  return <StatusBadge label={st ? st.replace(/_/g, " ") : "Pending"} tone={refundStateTone(st)} />;
};

export const ReturnsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const { filters, page, setPage, setMany } = useListFilters({ defaults: RETURN_FILTER_DEFAULTS });
  const [customerDraft, setCustomerDraft] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCustomerDraft(filters.q);
    setReasonDraft(filters.reason);
    setStatusDraft(filters.status);
  }, [filters.q, filters.reason, filters.status]);

  const queryKey = useMemo(
    () => ["admin-returns", page, filters.q, filters.reason, filters.status] as const,
    [page, filters.q, filters.reason, filters.status],
  );

  const listQuery = useAuthedQuery(queryKey, (token) =>
    listAdminReturns(token, {
      page,
      page_size: 20,
      ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
      ...(filters.reason.trim() ? { reason_contains: filters.reason.trim() } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    }),
  );

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;
  const { prefetch: prefetchReturn, prefetchMany: prefetchReturns } = useAdminDetailPrefetch({
    enabled: Boolean(accessToken),
    ...CACHE.OPERATIONAL,
    queryKeyFor: (returnId: string) => ["admin-return-detail", returnId],
    queryFnFor: (returnId: string) => getAdminReturnDetail(accessToken!, returnId),
    onPrefetch: () => preloadLazyNamedComponent("../features/returns/pages/ReturnDetailPage.tsx", "ReturnDetailPage")
  });

  useEffect(() => {
    prefetchReturns(items.map((item) => item.id), 2);
  }, [items, prefetchReturns]);

  const applyFilters = useCallback(() => {
    setMany({
      q: customerDraft.trim(),
      reason: reasonDraft,
      status: statusDraft,
    });
    setSelected(new Set());
  }, [customerDraft, reasonDraft, statusDraft, setMany]);

  const exportCsv = useCallback(() => {
    const rows: string[][] = [
      [
        "Return ref",
        "Order #",
        "Customer",
        "Items",
        "Reason",
        "Status",
        "Refund",
        "Created"
      ],
      ...items.map((r) => [
        returnRef(r),
        r.orderNumber,
        r.customer.name ?? r.customer.email ?? "Guest",
        String(r.itemCount),
        r.customerReason ?? "",
        r.status,
        r.refunds[0]?.state ?? "",
        r.requestedAt
      ])
    ];
    const esc = (c: string) => `"${c.replace(/"/g, '""')}"`;
    const body = rows.map((row) => row.map(esc).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `returns-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  const allOnPageSelected = items.length > 0 && items.every((r) => selected.has(r.id));
  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const from = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.totalItems) : 0;

  const kpiApproval = useMemo(() => {
    if (items.length === 0) {
      return "—";
    }
    const denom = items.filter((r) => r.status !== "REQUESTED").length;
    if (!denom) {
      return "—";
    }
    const approved = items.filter((r) => r.status === "APPROVED" || r.status === "COMPLETED" || r.status === "RECEIVED").length;
    return `${((approved / items.length) * 100).toFixed(1)}%`;
  }, [items]);

  const kpiRefundVolume = useMemo(() => {
    const cents = items.reduce((acc, r) => acc + (r.refunds[0]?.amountCents ?? 0), 0);
    if (!cents) {
      return "—";
    }
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
  }, [items]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <PageHeader
        title="Returns"
        titleSize="deck"
        description=""
        autoBreadcrumbs={false}
        actionMenuItems={[refreshDataMenuItem(queryClient, queryKey)]}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">Returns</h2>
          <p className="mt-1 text-sm text-slate-500">Manage reverse logistics and customer refund requests.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-lg bg-[#dbe1ff] px-4 py-2 text-sm font-semibold text-[#1653cc] transition-colors hover:bg-[#b4c5ff]"
          >
            <MaterialIcon name="download" className="text-base" />
            Export CSV
          </button>
          <button
            type="button"
            disabled
            title="Bulk approval is not enabled yet."
            className="flex cursor-not-allowed items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-6 py-2 text-sm font-semibold text-white opacity-50 shadow-lg shadow-[#1653cc]/20"
          >
            <MaterialIcon name="check_circle" filled className="text-base" />
            Approve selected
          </button>
        </div>
      </div>

      <StitchFilterPanel className="flex flex-wrap items-center gap-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Status</label>
          <select
            value={statusDraft}
            onChange={(e) => setStatusDraft(e.target.value)}
            className="w-full rounded border-none bg-[#f2f3ff] py-2 text-xs focus:ring-1 focus:ring-[#1653cc]/30"
          >
            {RETURN_STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? s.replace(/_/g, " ") : "All statuses"}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Reason</label>
          <select
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            className="w-full rounded border-none bg-[#f2f3ff] py-2 text-xs focus:ring-1 focus:ring-[#1653cc]/30"
          >
            {REASON_FILTERS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Customer search</label>
          <input
            value={customerDraft}
            onChange={(e) => setCustomerDraft(e.target.value)}
            placeholder="Email or name…"
            className="w-full rounded border-none bg-[#f2f3ff] py-2 text-xs focus:ring-1 focus:ring-[#1653cc]/30"
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Date range</label>
          <div
            className="flex cursor-not-allowed items-center gap-2 rounded bg-[#f2f3ff] px-3 py-2 opacity-60"
            title="Date range filter is not available on the API yet."
          >
            <MaterialIcon name="calendar_today" className="text-xs text-slate-400" />
            <span className="text-xs text-[#434654]">Last 30 days</span>
          </div>
        </div>
        <button
          type="button"
          onClick={applyFilters}
          className="mt-5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#e6e7f6] text-slate-600 transition-colors hover:bg-[#e0e2f0]"
          title="Apply filters"
        >
          <MaterialIcon name="filter_list" />
        </button>
      </StitchFilterPanel>

      {listQuery.isError ? (
        <QueryError label="returns" error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#c3c6d6]/10 bg-white shadow-sm">
        {listQuery.isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={10} cols={10} label="Loading returns" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-[#c3c6d6]/15 bg-[#f2f3ff]">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleAll}
                        className="rounded-sm border-slate-300 text-[#1653cc] focus:ring-[#1653cc]/30"
                      />
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Return #</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Order #</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Customer</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Items</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Reason</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Refund</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d6]/10">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-sm text-[#737685]">
                        No returns in this view.
                      </td>
                    </tr>
                  ) : (
                    items.map((r) => (
                      <tr key={r.id} className="h-[44px] transition-colors hover:bg-[#e6e7f6]/30">
                        <td className="px-4">
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => toggleOne(r.id)}
                            className="rounded-sm border-slate-300 text-[#1653cc] focus:ring-[#1653cc]/30"
                          />
                        </td>
                        <td className="px-4">
                          <Link
                            to={`/admin/returns/${r.id}`}
                            onMouseEnter={() => prefetchReturn(r.id)}
                            onFocus={() => prefetchReturn(r.id)}
                            className="font-mono text-xs font-medium text-[#1653cc] hover:underline"
                          >
                            {returnRef(r)}
                          </Link>
                        </td>
                        <td className="px-4">
                          <Link
                            to={`/admin/orders/${r.orderId}`}
                            className="font-mono text-xs text-slate-600 hover:underline"
                          >
                            #{r.orderNumber}
                          </Link>
                        </td>
                        <td className="px-4 text-xs font-medium">
                          {r.customer.name ?? r.customer.email ?? "Guest"}
                        </td>
                        <td className="px-4 text-xs text-slate-500">
                          {r.itemCount} {r.itemCount === 1 ? "unit" : "units"}
                        </td>
                        <td className="max-w-[140px] truncate px-4 text-xs italic text-slate-600" title={r.customerReason ?? ""}>
                          {r.customerReason ?? "—"}
                        </td>
                        <td className="px-4">{statusPill(r.status)}</td>
                        <td className="px-4">{refundPill(r)}</td>
                        <td className="px-4 font-mono text-xs text-slate-400">{formatQueueWhen(r.requestedAt)}</td>
                        <td className="px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/admin/returns/${r.id}`}
                              onMouseEnter={() => prefetchReturn(r.id)}
                              onFocus={() => prefetchReturn(r.id)}
                              className="p-1 text-slate-500 hover:text-[#1653cc]"
                            >
                              <MaterialIcon name="visibility" className="text-lg" />
                            </Link>
                            <button
                              type="button"
                              disabled
                              className="p-1 text-slate-300"
                              title="Use return detail to approve."
                            >
                              <MaterialIcon name="check_circle" className="text-lg" />
                            </button>
                            <button
                              type="button"
                              disabled
                              className="p-1 text-slate-300"
                              title="Use return detail to reject."
                            >
                              <MaterialIcon name="cancel" className="text-lg" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {meta ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#c3c6d6]/15 bg-[#f2f3ff] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Showing {items.length ? `${from}-${to}` : "0"} of {meta.totalItems} returns
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(Math.max(1, page - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded hover:bg-[#e6e7f6] disabled:opacity-40"
                  >
                    <MaterialIcon name="chevron_left" className="text-sm" />
                  </button>
                  {Array.from({ length: Math.min(3, meta.totalPages) }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPage(num)}
                      className={`flex h-8 w-8 items-center justify-center rounded text-xs font-bold ${
                        page === num ? "bg-[#1653cc] text-white" : "hover:bg-[#e6e7f6] text-slate-600"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded hover:bg-[#e6e7f6] disabled:opacity-40"
                  >
                    <MaterialIcon name="chevron_right" className="text-sm" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-xl border-l-4 border-[#1653cc] bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Approval rate (page)</span>
          <div className="mt-2 flex items-end justify-between">
            <h3 className="font-mono text-3xl font-bold text-[#181b25]">{kpiApproval}</h3>
            <span className="flex items-center text-xs font-bold text-[#006b2d]">
              <MaterialIcon name="trending_up" className="text-xs" /> snapshot
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Avg processing time</span>
          <div className="mt-2 flex items-end justify-between">
            <h3 className="font-mono text-3xl font-bold text-[#181b25]">—</h3>
            <span className="flex items-center text-xs font-bold text-[#ba1a1a]">
              <MaterialIcon name="trending_up" className="text-xs" /> n/a
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl border-l-4 border-[#006b2d] bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Refund volume (page)</span>
          <div className="mt-2 flex items-end justify-between">
            <h3 className="font-mono text-3xl font-bold text-[#181b25]">{kpiRefundVolume}</h3>
            <span className="flex items-center text-xs font-bold text-[#006b2d]">
              <MaterialIcon name="trending_down" className="text-xs" /> partial
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
