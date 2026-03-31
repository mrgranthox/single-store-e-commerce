import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, listAdminFinanceExceptions, resolveAdminFinanceException, type FinancialExceptionRow } from "@/features/payments/api/admin-finance.api";

const exceptionRefLabel = (id: string) => `EX-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const readRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const formatMaybeMoney = (v: unknown): string => {
  if (v == null) return "—";
  if (typeof v === "number" && Number.isFinite(v)) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(v / 100);
    } catch {
      return String(v);
    }
  }
  if (typeof v === "string" && v.trim()) return v.trim();
  return "—";
};

const STITCH_EXCEPTION_TYPES = [
  "DUPLICATE_CALLBACK",
  "PARTIAL_CAPTURE",
  "UNMATCHED_REFUND",
  "AMOUNT_MISMATCH",
  "TIMEOUT_UNRESOLVED"
] as const;

const STITCH_TYPE_SET = new Set<string>(STITCH_EXCEPTION_TYPES);

const statusPill = (status: string) => {
  const open = status !== "RESOLVED";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
        open ? "border border-red-200 bg-red-50 text-red-800" : "border border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
};

export const FinanceExceptionsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const queryKey = useMemo(() => ["admin-finance-exceptions", page] as const, [page]);

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminFinanceExceptions(accessToken, { page, page_size: 20 });
    },
    enabled: Boolean(accessToken)
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return resolveAdminFinanceException(accessToken, id, { note });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-finance-exceptions"] })
  });

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;

  const filteredItems = useMemo(() => {
    return items.filter((r) => {
      if (typeFilter === "__other__") {
        if (STITCH_TYPE_SET.has(r.exceptionType)) return false;
      } else if (typeFilter && r.exceptionType !== typeFilter) {
        return false;
      }
      if (statusFilter === "OPEN") return r.status !== "RESOLVED";
      if (statusFilter === "RESOLVED") return r.status === "RESOLVED";
      return true;
    });
  }, [items, typeFilter, statusFilter]);

  const kpis = useMemo(() => {
    const open = filteredItems.filter((r) => r.status !== "RESOLVED").length;
    const resolvedWeek = filteredItems.filter((r) => r.status === "RESOLVED").length;
    let discrepancyCents = 0;
    for (const r of filteredItems) {
      const o = readRecord(r.mismatchSummary);
      const exp = o?.expectedCents ?? o?.expectedAmountCents;
      const act = o?.actualCents ?? o?.actualAmountCents;
      if (typeof exp === "number" && typeof act === "number") {
        discrepancyCents += Math.abs(exp - act);
      }
    }
    return { open, resolvedWeek, discrepancyCents };
  }, [filteredItems]);

  const errorMessage =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error instanceof Error
        ? listQuery.error.message
        : null;

  const exportReport = () => {
    if (filteredItems.length === 0) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      ["ExceptionRef", "Type", "Status", "OrderId", "PaymentId", "DetectedAt"].join(","),
      ...filteredItems.map((r) =>
        [
          esc(exceptionRefLabel(r.id)),
          esc(r.exceptionType),
          esc(r.status),
          esc(r.orderId ?? ""),
          esc(r.paymentId ?? ""),
          esc(r.createdAt)
        ].join(",")
      )
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-exceptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runReconciler = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-finance-exceptions"] });
  };

  const rowMoney = (row: FinancialExceptionRow) => {
    const o = readRecord(row.mismatchSummary);
    return {
      expected: formatMaybeMoney(o?.expectedCents ?? o?.expected ?? o?.expectedAmount),
      actual: formatMaybeMoney(o?.actualCents ?? o?.actual ?? o?.actualAmount),
      disc:
        o && typeof o.expectedCents === "number" && typeof o.actualCents === "number"
          ? formatMaybeMoney(Math.abs(o.expectedCents - o.actualCents))
          : "—"
    };
  };

  const clearFilters = () => {
    setTypeFilter("");
    setStatusFilter("");
  };

  return (
    <div className="mx-auto max-w-7xl pb-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <nav className="mb-2 flex gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Financials</span>
            <span>/</span>
            <span className="font-bold text-[#1653cc]">Financial Exceptions</span>
          </nav>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-slate-900">Financial Exceptions</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportReport}
            disabled={filteredItems.length === 0}
            className="flex items-center gap-2 rounded-sm border border-[#c3c6d6] bg-white px-4 py-2 text-sm font-semibold text-[#181b25] transition-colors hover:bg-[#f2f3ff] disabled:opacity-40"
          >
            <MaterialIcon name="file_download" className="text-sm" />
            Export Report
          </button>
          <button
            type="button"
            onClick={runReconciler}
            className="flex items-center gap-2 rounded-sm bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110"
          >
            <MaterialIcon name="sync" className="text-sm" />
            Run Reconciler
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="group relative overflow-hidden bg-white p-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-red-600" />
          <div className="mb-4 flex items-start justify-between">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">Open Exceptions</p>
            <span className="rounded-full bg-[#ffdad6] px-2 py-0.5 text-[10px] font-bold text-[#93000a]">This page view</span>
          </div>
          <h3 className="font-headline text-4xl font-bold text-slate-900">{kpis.open}</h3>
          <p className="mt-2 text-xs text-slate-400">After local type/status filters</p>
        </div>
        <div className="group relative overflow-hidden bg-white p-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#1653cc]" />
          <div className="mb-4 flex items-start justify-between">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">Amount discrepancy</p>
            <MaterialIcon name="account_balance_wallet" className="text-[#1653cc]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl text-slate-500">$</span>
            <h3 className="font-headline font-mono text-4xl font-bold tracking-tighter text-slate-900">
              {kpis.discrepancyCents > 0
                ? (kpis.discrepancyCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "—"}
            </h3>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Sum of absolute differences between expected and recorded amounts (when available)
          </p>
        </div>
        <div className="group relative overflow-hidden bg-white p-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#006b2d]" />
          <div className="mb-4 flex items-start justify-between">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">Resolved (page)</p>
            <span className="rounded-full bg-[#00873b] px-2 py-0.5 text-[10px] font-bold text-white">Slice</span>
          </div>
          <h3 className="font-headline text-4xl font-bold text-slate-900">{kpis.resolvedWeek}</h3>
          <p className="mt-2 text-xs text-slate-400">Rows with status RESOLVED in current filter</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4 border-b border-[#e6e7f6] bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Type</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-sm border border-[#c3c6d6] py-1 text-xs focus:ring-1 focus:ring-[#1653cc]"
          >
            <option value="">All Exception Types</option>
            {STITCH_EXCEPTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
            <option value="__other__">Other (not listed)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-sm border border-[#c3c6d6] py-1 text-xs focus:ring-1 focus:ring-[#1653cc]"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
        <button type="button" onClick={clearFilters} className="ml-auto text-xs font-bold text-[#1653cc] hover:underline">
          Clear All Filters
        </button>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {listQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading exceptions…</div>
      ) : (
        <div className="overflow-hidden bg-white shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#c3c6d6]/10 bg-[#f2f3ff]">
                {(
                  [
                    "Exception #",
                    "Type",
                    "Order / Payment ID",
                    "Expected",
                    "Actual",
                    "Discrepancy",
                    "Status",
                    "Detected",
                    "Actions"
                  ] as const
                ).map((h) => (
                  <th
                    key={h}
                    className={`px-6 py-4 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500 ${
                      ["Expected", "Actual", "Discrepancy"].includes(h) ? "text-right" : ""
                    } ${h === "Actions" ? "text-center" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e7f6]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-sm text-slate-500">
                    No exceptions match filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((row) => {
                  const m = rowMoney(row);
                  const open = row.status !== "RESOLVED";
                  const note = notes[row.id] ?? "";
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-[#f2f3ff]">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">{exceptionRefLabel(row.id)}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-full border border-red-200 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                          {row.exceptionType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-slate-600">
                          {row.orderId ? (
                            <Link className="text-[#1653cc] hover:underline" to={`/admin/orders/${row.orderId}`}>
                              Order link
                            </Link>
                          ) : (
                            "—"
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {row.paymentId ? (
                            <Link className="text-[#1653cc] hover:underline" to={`/admin/payments/${row.paymentId}`}>
                              {row.paymentId.slice(0, 12)}…
                            </Link>
                          ) : (
                            "No payment id"
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs">{m.expected}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs">{m.actual}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-semibold text-red-700">{m.disc}</td>
                      <td className="px-6 py-4">{statusPill(row.status)}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{formatWhen(row.createdAt)}</td>
                      <td className="px-6 py-4 text-center">
                        {open ? (
                          <div className="mx-auto flex max-w-[200px] flex-col gap-2">
                            <input
                              value={note}
                              onChange={(ev) => setNotes((prev) => ({ ...prev, [row.id]: ev.target.value }))}
                              placeholder="Resolution note"
                              className="rounded-sm border border-slate-200 px-2 py-1.5 text-xs"
                            />
                            <button
                              type="button"
                              disabled={resolveMut.isPending || !note.trim()}
                              onClick={() => resolveMut.mutate({ id: row.id, note: note.trim() })}
                              className="rounded-sm bg-[#006b2d] px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Resolve
                            </button>
                            <TechnicalJsonDisclosure
                              label="Mismatch details"
                              data={row.mismatchSummary ?? {}}
                              defaultOpen={false}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">{row.resolutionNote ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-slate-500">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.totalItems} total in catalog
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
