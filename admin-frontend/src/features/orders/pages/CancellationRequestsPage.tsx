import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { PageActionsMenu } from "@/components/primitives/PageActionsMenu";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  approveAdminCancellationRequest,
  listAdminCancellationRequests,
  rejectAdminCancellationRequest,
  type CancellationRequestListItem
} from "@/features/orders/api/admin-orders.api";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const crRef = (id: string) => `CR-${id.replace(/-/g, "").slice(0, 5).toUpperCase()}`;

const formatWhenTable = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatMoney = (cents: number | null | undefined, currency: string | null | undefined) => {
  if (typeof cents !== "number" || Number.isNaN(cents)) {
    return "—";
  }
  const cur = (currency ?? "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
};

const initialsFromCustomer = (row: CancellationRequestListItem) => {
  const name = row.customer.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const em = row.customer.email?.trim();
  if (em) {
    return em.slice(0, 2).toUpperCase();
  }
  return "—";
};

const displayCustomerName = (row: CancellationRequestListItem) => {
  const n = row.customer.name?.trim();
  if (n) {
    return n;
  }
  if (row.customer.email?.trim()) {
    return row.customer.email;
  }
  return "Guest";
};

const orderStatusUi = (row: CancellationRequestListItem) => {
  const fs = (row.order.fulfillment?.status ?? "UNFULFILLED").toUpperCase();
  if (fs === "PACKING" || fs === "DISPATCHED" || fs === "IN_TRANSIT") {
    return {
      label: "In Fulfillment",
      wrap: "border border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500"
    };
  }
  if (row.order.status === "PROCESSING") {
    return {
      label: "Processing",
      wrap: "border border-slate-200 bg-slate-50 text-slate-600",
      dot: "bg-slate-400"
    };
  }
  return {
    label: row.order.status.replace(/_/g, " "),
    wrap: "border border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400"
  };
};

const requestStatusUi = (status: string) => {
  if (status === "PENDING_APPROVAL") {
    return {
      label: "Pending",
      wrap: "border border-blue-200 bg-blue-50 text-blue-700 uppercase"
    };
  }
  if (status === "COMPLETED") {
    return {
      label: "Approved",
      wrap: "border border-emerald-200 bg-emerald-50 text-emerald-800 uppercase"
    };
  }
  if (status === "REJECTED") {
    return {
      label: "Rejected",
      wrap: "border border-red-200 bg-red-50 text-red-700 uppercase"
    };
  }
  return {
    label: status.replace(/_/g, " "),
    wrap: "border border-slate-200 bg-slate-50 text-slate-600 uppercase"
  };
};

const exportPageCsv = (items: CancellationRequestListItem[]) => {
  const header = [
    "Request",
    "Order",
    "Customer",
    "Total",
    "Reason",
    "Order status",
    "Request status",
    "Requested at"
  ];
  const lines = [header.join(",")];
  for (const row of items) {
    lines.push(
      [
        crRef(row.id),
        row.order.orderNumber,
        `"${displayCustomerName(row).replace(/"/g, '""')}"`,
        formatMoney(row.order.payment.amountCents, row.order.payment.currency),
        `"${(row.reason ?? "").replace(/"/g, '""')}"`,
        orderStatusUi(row).label,
        requestStatusUi(row.status).label,
        row.createdAt
      ].join(",")
    );
  }
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cancellation-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const CancellationRequestsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusDraft, setStatusDraft] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<
    { id: string; action: "approve" | "reject" } | null
  >(null);
  const [resolveNote, setResolveNote] = useState("");

  const queryKey = useMemo(
    () => ["admin-cancellation-requests", page, statusDraft] as const,
    [page, statusDraft]
  );

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminCancellationRequests(accessToken, {
        page,
        page_size: 20,
        ...(statusDraft.trim() ? { status: statusDraft.trim() } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const approveMut = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return approveAdminCancellationRequest(accessToken, id, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cancellation-requests"] });
      setResolveTarget(null);
      setResolveNote("");
    }
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return rejectAdminCancellationRequest(accessToken, id, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cancellation-requests"] });
      setResolveTarget(null);
      setResolveNote("");
    }
  });

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;
  const stats = meta?.queueStats;

  const errorMessage =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error instanceof Error
        ? listQuery.error.message
        : null;

  const pendingTotal = stats?.pendingTotal ?? 0;
  const locked = stats?.fulfillmentLockedPending ?? 0;
  const startRow = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const endRow = meta ? Math.min(meta.page * meta.limit, meta.totalItems) : 0;

  const avgLabel =
    stats?.avgResponseMinutes != null && Number.isFinite(stats.avgResponseMinutes)
      ? `${stats.avgResponseMinutes.toFixed(1)}m`
      : "—";

  const successLabel =
    stats?.successRatePercent != null ? `${stats.successRatePercent}% success rate` : "No resolves today yet";

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-[#181b25]">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-slate-900">
            Cancellation requests
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Operational queue for customer-initiated cancellation requests.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className="flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
          >
            <MaterialIcon name="filter_list" className="text-lg" />
            Filter queue
          </button>
          <button
            type="button"
            onClick={() => exportPageCsv(items)}
            disabled={items.length === 0}
            className="flex items-center gap-2 rounded bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-40"
          >
            <MaterialIcon name="download" className="text-lg text-white" />
            Export CSV
          </button>
          <PageActionsMenu
            items={[refreshDataMenuItem(queryClient, ["admin-cancellation-requests"])]}
            triggerLabel="Actions"
          />
        </div>
      </div>

      {filterOpen ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status code
            <input
              value={statusDraft}
              onChange={(e) => {
                setStatusDraft(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. PENDING_APPROVAL or leave blank for all"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </label>
        </div>
      ) : null}

      <div className="flex items-start gap-4 border-l-4 border-blue-600 bg-blue-600/5 p-4">
        <MaterialIcon name="info" className="mt-0.5 text-blue-600" filled />
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {pendingTotal} pending cancellation request{pendingTotal === 1 ? "" : "s"}
            {locked > 0 ? ` — ${locked} for orders already in fulfillment` : ""}.
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Fulfillment-locked orders require supervisor override for automatic refunds.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {[
                      "Request #",
                      "Order #",
                      "Customer",
                      "Order total",
                      "Request reason",
                      "Order status",
                      "Req. status",
                      "Requested at",
                      "Actions"
                    ].map((col) => (
                      <th
                        key={col}
                        className={`px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 ${
                          col === "Actions" ? "text-right" : ""
                        }`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                        No cancellation requests.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => {
                      const os = orderStatusUi(row);
                      const rs = requestStatusUi(row.status);
                      const pending = row.status === "PENDING_APPROVAL";
                      return (
                        <tr key={row.id} className="group transition-colors hover:bg-slate-50">
                          <td className="px-6 py-4 font-mono text-xs font-medium text-slate-600">{crRef(row.id)}</td>
                          <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600">
                            <Link className="hover:underline" to={`/admin/orders/${row.order.id}`}>
                              {row.order.orderNumber}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                                {initialsFromCustomer(row)}
                              </div>
                              <span className="text-xs font-semibold text-slate-900">{displayCustomerName(row)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs font-medium">
                            {formatMoney(row.order.payment.amountCents, row.order.payment.currency)}
                          </td>
                          <td className="max-w-[150px] truncate px-6 py-4 text-xs text-slate-500" title={row.reason ?? ""}>
                            {row.reason ?? "—"}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold ${os.wrap}`}
                            >
                              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${os.dot}`} />
                              {os.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold ${rs.wrap}`}
                            >
                              {rs.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[11px] text-slate-400">{formatWhenTable(row.createdAt)}</td>
                          <td className="px-6 py-4 text-right">
                            {pending ? (
                              <div className="flex justify-end gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                                <button
                                  type="button"
                                  title="Approve"
                                  disabled={approveMut.isPending || rejectMut.isPending}
                                  onClick={() => {
                                    setResolveNote("");
                                    setResolveTarget({ id: row.id, action: "approve" });
                                  }}
                                  className="rounded p-1.5 text-[#006b2d] transition-colors hover:bg-[#006b2d]/10"
                                >
                                  <MaterialIcon name="check_circle" className="text-lg" />
                                </button>
                                <button
                                  type="button"
                                  title="Reject"
                                  disabled={approveMut.isPending || rejectMut.isPending}
                                  onClick={() => {
                                    setResolveNote("");
                                    setResolveTarget({ id: row.id, action: "reject" });
                                  }}
                                  className="rounded p-1.5 text-[#ba1a1a] transition-colors hover:bg-[#ba1a1a]/10"
                                >
                                  <MaterialIcon name="cancel" className="text-lg" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                {row.resolvedAt ? formatWhenTable(row.resolvedAt) : "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {meta ? (
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {meta.totalItems === 0
                    ? "No requests"
                    : `Showing ${startRow}-${endRow} of ${meta.totalItems} total requests`}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!meta || page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-xl bg-white p-6 shadow-sm">
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#1653cc]" />
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Avg response time</p>
                <p className="font-headline text-3xl font-bold text-slate-900">{avgLabel}</p>
              </div>
              <div className="flex items-center gap-1 self-end text-[#006b2d]">
                <MaterialIcon name="trending_down" className="text-xs" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Rolling 200 resolves</span>
              </div>
            </div>
            <div className="relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-xl bg-white p-6 shadow-sm">
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#ba1a1a]" />
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Fulfillment locked</p>
                <p className="font-headline text-3xl font-bold text-slate-900">{locked}</p>
              </div>
              <div className="flex items-center gap-1 self-end text-[#ba1a1a]">
                <MaterialIcon name="priority_high" className="text-xs" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Action required</span>
              </div>
            </div>
            <div className="relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-xl bg-white p-6 shadow-sm">
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#006b2d]" />
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Resolved today</p>
                <p className="font-headline text-3xl font-bold text-slate-900">{stats?.resolvedToday ?? 0}</p>
              </div>
              <div className="flex items-center gap-1 self-end text-[#006b2d]">
                <MaterialIcon name="trending_up" className="text-xs" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{successLabel}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {resolveTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-cxl-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 id="resolve-cxl-title" className="font-headline text-lg font-bold text-slate-900">
              {resolveTarget.action === "approve" ? "Approve cancellation" : "Reject cancellation"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Optional note stored on the resolution record.</p>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              className="mt-4 min-h-[88px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Note (optional)"
            />
            {(() => {
              const a =
                approveMut.error instanceof ApiError
                  ? approveMut.error.message
                  : approveMut.error instanceof Error
                    ? approveMut.error.message
                    : null;
              const r =
                rejectMut.error instanceof ApiError
                  ? rejectMut.error.message
                  : rejectMut.error instanceof Error
                    ? rejectMut.error.message
                    : null;
              const msg = a ?? r;
              return msg ? <p className="mt-2 text-sm text-red-600">{msg}</p> : null;
            })()}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResolveTarget(null);
                  setResolveNote("");
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approveMut.isPending || rejectMut.isPending}
                onClick={() => {
                  const note = resolveNote.trim() || undefined;
                  if (resolveTarget.action === "approve") {
                    approveMut.mutate({ id: resolveTarget.id, note });
                  } else {
                    rejectMut.mutate({ id: resolveTarget.id, note });
                  }
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  resolveTarget.action === "approve" ? "bg-[#006b2d] hover:opacity-90" : "bg-[#ba1a1a] hover:opacity-90"
                }`}
              >
                {approveMut.isPending || rejectMut.isPending
                  ? "Working…"
                  : resolveTarget.action === "approve"
                    ? "Confirm approve"
                    : "Confirm reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
