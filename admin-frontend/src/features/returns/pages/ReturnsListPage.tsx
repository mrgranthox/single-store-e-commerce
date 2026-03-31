import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/primitives/PageHeader";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, listAdminReturns, type ReturnListItem } from "@/features/returns/api/admin-returns.api";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const RETURN_STATUSES = ["", "REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "COMPLETED"] as const;

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

const statusPill = (status: string) => {
  const u = status.toUpperCase();
  let dot = "bg-amber-500";
  if (u === "APPROVED") dot = "bg-blue-500";
  if (u === "COMPLETED") dot = "bg-[#006b2d]";
  if (u === "REJECTED") dot = "bg-[#ba1a1a]";
  if (u === "RECEIVED") dot = "bg-[#1653cc]";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(115,118,133,0.2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-tight text-[#181b25]">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
};

const refundPill = (r: ReturnListItem) => {
  const st = r.refunds[0]?.state?.toUpperCase() ?? "";
  if (!st) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(115,118,133,0.2)] px-2 py-0.5 text-[10px] font-semibold text-[#181b25]">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        Pending
      </span>
    );
  }
  const ok = st === "COMPLETED" || st === "SUCCEEDED" || st === "PAID";
  const dot = ok ? "bg-[#006b2d]" : st === "FAILED" ? "bg-[#ba1a1a]" : "bg-amber-500";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(115,118,133,0.2)] px-2 py-0.5 text-[10px] font-semibold text-[#181b25]">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {st.replace(/_/g, " ")}
    </span>
  );
};

export const ReturnsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [customerDraft, setCustomerDraft] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [appliedCustomer, setAppliedCustomer] = useState("");
  const [appliedReason, setAppliedReason] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const queryKey = useMemo(
    () => ["admin-returns", page, appliedCustomer, appliedReason, appliedStatus] as const,
    [page, appliedCustomer, appliedReason, appliedStatus]
  );

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminReturns(accessToken, {
        page,
        page_size: 20,
        ...(appliedCustomer.trim() ? { q: appliedCustomer.trim() } : {}),
        ...(appliedReason.trim() ? { reason_contains: appliedReason.trim() } : {}),
        ...(appliedStatus ? { status: appliedStatus } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;

  const errorMessage =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error instanceof Error
        ? listQuery.error.message
        : null;

  const applyFilters = useCallback(() => {
    setPage(1);
    setAppliedCustomer(customerDraft);
    setAppliedReason(reasonDraft);
    setAppliedStatus(statusDraft);
    setSelected(new Set());
  }, [customerDraft, reasonDraft, statusDraft]);

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

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#c3c6d6]/10 bg-white p-4 shadow-sm">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</label>
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
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Reason</label>
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
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Customer search</label>
          <input
            value={customerDraft}
            onChange={(e) => setCustomerDraft(e.target.value)}
            placeholder="Email or name…"
            className="w-full rounded border-none bg-[#f2f3ff] py-2 text-xs focus:ring-1 focus:ring-[#1653cc]/30"
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date range</label>
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
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#c3c6d6]/10 bg-white shadow-sm">
        {listQuery.isLoading ? (
          <p className="p-12 text-center text-sm text-[#737685]">Loading…</p>
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
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Return #</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Order #</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Customer</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Items</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Reason</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Status</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Refund</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Created</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">
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
                            <Link to={`/admin/returns/${r.id}`} className="p-1 text-slate-500 hover:text-[#1653cc]">
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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Showing {items.length ? `${from}-${to}` : "0"} of {meta.totalItems} returns
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                    onClick={() => setPage((p) => p + 1)}
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
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Approval rate (page)</span>
          <div className="mt-2 flex items-end justify-between">
            <h3 className="font-mono text-3xl font-bold text-[#181b25]">{kpiApproval}</h3>
            <span className="flex items-center text-[10px] font-bold text-[#006b2d]">
              <MaterialIcon name="trending_up" className="text-xs" /> snapshot
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Avg processing time</span>
          <div className="mt-2 flex items-end justify-between">
            <h3 className="font-mono text-3xl font-bold text-[#181b25]">—</h3>
            <span className="flex items-center text-[10px] font-bold text-[#ba1a1a]">
              <MaterialIcon name="trending_up" className="text-xs" /> n/a
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl border-l-4 border-[#006b2d] bg-white p-5 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Refund volume (page)</span>
          <div className="mt-2 flex items-end justify-between">
            <h3 className="font-mono text-3xl font-bold text-[#181b25]">{kpiRefundVolume}</h3>
            <span className="flex items-center text-[10px] font-bold text-[#006b2d]">
              <MaterialIcon name="trending_down" className="text-xs" /> partial
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
