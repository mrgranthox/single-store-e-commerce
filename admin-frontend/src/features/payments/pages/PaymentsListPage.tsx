import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, listAdminPayments, type AdminPaymentListItem } from "@/features/payments/api/admin-payments.api";
import { PAYSTACK_PROVIDER_QUERY_VALUE, formatPaymentGatewayLabel } from "@/features/payments/lib/paystackRails";
import {
  StitchPaymentStatusPill,
  StitchTableActions,
  customerInitials,
  stitchProviderSwatch
} from "@/features/payments/ui/stitchPaymentsUi";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { PageActionsMenu } from "@/components/primitives/PageActionsMenu";

const formatMoney = (cents: number, currency: string) => {
  const cur = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
};

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const paymentRefLabel = (id: string) => `PAY-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const parseMoneyToCents = (raw: string): number | null => {
  const t = raw.trim().replace(/[^0-9.]/g, "");
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
};

const providerCellLabel = (p: AdminPaymentListItem) => formatPaymentGatewayLabel(p.provider);

export const PaymentsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [providerUi, setProviderUi] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [dateFrom, setDateFrom] = useState("");

  const providerFilter = providerUi === "" ? "" : PAYSTACK_PROVIDER_QUERY_VALUE;

  const queryKey = useMemo(
    () => ["admin-payments", page, appliedSearch, stateFilter, providerFilter] as const,
    [page, appliedSearch, stateFilter, providerFilter]
  );

  const paymentsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminPayments(accessToken, {
        page,
        page_size: 20,
        ...(appliedSearch.trim() ? { q: appliedSearch.trim() } : {}),
        ...(stateFilter ? { paymentState: stateFilter } : {}),
        ...(providerFilter.trim() ? { provider: providerFilter.trim() } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = paymentsQuery.data?.data.items ?? [];
  const meta = paymentsQuery.data?.meta;

  const applyFilters = () => {
    setPage(1);
    setAppliedSearch(searchDraft);
  };

  const displayItems = useMemo(() => {
    let r = items;
    const minC = parseMoneyToCents(amountMin);
    const maxC = parseMoneyToCents(amountMax);
    if (minC != null) r = r.filter((p) => p.amountCents >= minC);
    if (maxC != null) r = r.filter((p) => p.amountCents <= maxC);
    if (dateFrom.trim()) {
      const d0 = new Date(dateFrom);
      r = r.filter((p) => new Date(p.createdAt) >= d0);
    }
    return r;
  }, [items, amountMin, amountMax, dateFrom]);

  const pageKpis = useMemo(() => {
    const n = displayItems.length;
    const paid = displayItems.filter((p) => p.paymentState === "PAID").length;
    const failed = displayItems.filter((p) => p.paymentState === "FAILED").length;
    const pending = displayItems.filter(
      (p) =>
        !["PAID", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(p.paymentState)
    ).length;
    const volume = displayItems.reduce((acc, p) => acc + p.amountCents, 0);
    const cur = displayItems[0]?.currency ?? items[0]?.currency ?? "USD";
    const successRate = n ? Math.round((paid / n) * 100) : 0;
    return { n, paid, failed, pending, volume, cur, successRate };
  }, [displayItems, items]);

  const errorMessage =
    paymentsQuery.error instanceof ApiError
      ? paymentsQuery.error.message
      : paymentsQuery.error instanceof Error
        ? paymentsQuery.error.message
        : null;

  const exportPageCsv = () => {
    if (displayItems.length === 0) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["PaymentRef", "OrderNumber", "Customer", "Amount", "Currency", "ProviderLabel", "Status", "CreatedAt"];
    const lines = [
      header.join(","),
      ...displayItems.map((p) =>
        [
          esc(paymentRefLabel(p.id)),
          esc(p.orderNumber),
          esc(p.customer.name ?? p.customer.email ?? "Guest"),
          esc(String(p.amountCents / 100)),
          esc(p.currency),
          esc(providerCellLabel(p)),
          esc(p.paymentState),
          esc(p.createdAt)
        ].join(",")
      )
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchDraft("");
    setAppliedSearch("");
    setStateFilter("");
    setProviderUi("");
    setAmountMin("");
    setAmountMax("");
    setDateFrom("");
    setPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-slate-900">Payments</h1>
            <p className="mt-1 text-sm text-slate-500">Monitor and manage all inbound financial transactions</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PageActionsMenu items={[refreshDataMenuItem(queryClient, ["admin-payments"])]} />
            <button
              type="button"
              onClick={exportPageCsv}
              disabled={displayItems.length === 0}
              className="flex items-center gap-2 rounded-md bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MaterialIcon name="download" className="text-sm" />
              Export Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-xl border-l-4 border-[#1653cc] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">Total Processed</p>
              <span className="text-xs font-bold text-[#3b6de6]">Live</span>
            </div>
            <h3 className="mt-2 font-headline text-2xl font-bold text-slate-900">
              {pageKpis.n ? formatMoney(pageKpis.volume, pageKpis.cur) : "—"}
            </h3>
            <p className="mt-1 font-label text-[0.65rem] text-slate-400">Current result page (after local refinements)</p>
          </div>
          <div className="rounded-xl border-l-4 border-emerald-700 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">Success Rate</p>
              <MaterialIcon name="check_circle" className="text-sm text-emerald-700" />
            </div>
            <h3 className="mt-2 font-headline text-2xl font-bold text-slate-900">{pageKpis.successRate}%</h3>
            <p className="mt-1 font-label text-[0.65rem] text-slate-400">Real-time throughput (page)</p>
          </div>
          <div className="rounded-xl border-l-4 border-red-600 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">Failed Count</p>
              <MaterialIcon name="error" className="text-sm text-red-600" />
            </div>
            <h3 className="mt-2 font-headline text-2xl font-bold text-slate-900">{pageKpis.failed}</h3>
            <p className="mt-1 font-label text-[0.65rem] text-slate-400">Matching filters on this page</p>
          </div>
          <div className="rounded-xl border-l-4 border-orange-400 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">Pending Count</p>
              <MaterialIcon name="pending" className="text-sm text-orange-400" />
            </div>
            <h3 className="mt-2 font-headline text-2xl font-bold text-slate-900">{pageKpis.pending}</h3>
            <p className="mt-1 font-label text-[0.65rem] text-slate-400">Awaiting verification</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-6">
          <div className="relative md:col-span-2">
            <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">
              Search Reference
            </label>
            <div className="relative">
              <MaterialIcon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400"
              />
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                placeholder="Order # or Payment Ref..."
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-xs focus:ring-1 focus:ring-[#1653cc]/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">
              Provider
            </label>
            <select
              value={providerUi}
              onChange={(e) => {
                setProviderUi(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 text-xs focus:ring-1 focus:ring-[#1653cc]/20"
            >
              <option value="">All Providers</option>
              <option value="paystack">Paystack</option>
              <option value="mtn">MTN Mobile Money</option>
              <option value="telecel">Telecel Cash</option>
              <option value="airteltigo">AirtelTigo Money</option>
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Status</label>
            <select
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 text-xs focus:ring-1 focus:ring-[#1653cc]/20"
            >
              <option value="">All Statuses</option>
              <option value="PAID">Completed</option>
              <option value="AWAITING_CUSTOMER_ACTION">Pending</option>
              <option value="INITIALIZED">Initialized</option>
              <option value="PENDING_INITIALIZATION">Pending init</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUND_PENDING">Refund pending</option>
              <option value="PARTIALLY_REFUNDED">Partially refunded</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">
              Amount Range
            </label>
            <div className="flex gap-2">
              <input
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                placeholder="Min"
                className="w-1/2 rounded-md border border-slate-200 bg-slate-50 py-2 text-xs focus:ring-1 focus:ring-[#1653cc]/20"
              />
              <input
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                placeholder="Max"
                className="w-1/2 rounded-md border border-slate-200 bg-slate-50 py-2 text-xs focus:ring-1 focus:ring-[#1653cc]/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">
              Date Range
            </label>
            <input
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              type="date"
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 text-xs focus:ring-1 focus:ring-[#1653cc]/20"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-[0.65rem] text-slate-400">
            Amount and date refine the loaded page. Provider options mirror checkout rails; the ledger lists the gateway
            (Paystack) — open a row for card vs mobile money detail.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-md bg-[#1653cc] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              Apply search
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-widest text-[#1653cc] hover:underline"
            >
              <MaterialIcon name="filter_alt_off" className="text-sm" />
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMessage}
          {paymentsQuery.error instanceof ApiError && paymentsQuery.error.statusCode === 403 ? (
            <span className="mt-1 block text-xs">Requires payments.read.</span>
          ) : null}
        </div>
      ) : null}

      {paymentsQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading payments…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {(
                  [
                    "Payment #",
                    "Order #",
                    "Customer",
                    "Amount",
                    "Provider",
                    "Status",
                    "Created",
                    "Actions"
                  ] as const
                ).map((col) => (
                  <th
                    key={col}
                    className={`px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500 ${
                      col === "Amount" ? "text-right" : ""
                    } ${col === "Actions" ? "text-center" : ""}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500">
                    No payments match the current filters.
                  </td>
                </tr>
              ) : (
                displayItems.map((p) => {
                  const cust = p.customer.name ?? p.customer.email ?? (p.customer.guest ? "Guest" : "—");
                  const initials = customerInitials(p.customer.name, p.customer.email);
                  const provLabel = providerCellLabel(p);
                  const { swatch, text } = stitchProviderSwatch(provLabel);
                  return (
                    <tr key={p.id} className="group transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-[0.75rem] text-slate-600">{paymentRefLabel(p.id)}</td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/admin/payments/${p.id}`}
                          className="cursor-pointer font-mono text-[0.75rem] text-[#1653cc] hover:underline"
                        >
                          {p.orderNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[0.65rem] font-bold text-slate-700">
                            {initials}
                          </div>
                          <span className="text-xs font-semibold text-slate-700">{cust}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-semibold text-slate-900">
                        {formatMoney(p.amountCents, p.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-4 w-4 rounded ${swatch}`} />
                          <span className="text-xs text-slate-600">{text}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StitchPaymentStatusPill paymentState={p.paymentState} />
                      </td>
                      <td className="px-6 py-4 text-[0.7rem] text-slate-500">{formatDate(p.createdAt)}</td>
                      <td className="px-6 py-4 text-center">
                        <StitchTableActions detailTo={`/admin/payments/${p.id}`} orderTo={`/admin/orders/${p.orderId}`} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {meta ? (
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
              <p className="font-label text-xs text-slate-500">
                {displayItems.length !== items.length ? (
                  <>
                    Showing {displayItems.length} of {items.length} rows on this page after local refinements ·{" "}
                    {meta.totalItems} total in ledger
                  </>
                ) : (
                  <>
                    Showing {items.length ? (meta.page - 1) * meta.limit + 1 : 0} to{" "}
                    {(meta.page - 1) * meta.limit + items.length} of {meta.totalItems} results
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((pg) => Math.max(1, pg - 1))}
                  className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="rounded bg-[#1653cc] px-3 py-1 text-xs font-bold text-white">{meta.page}</span>
                <button
                  type="button"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((pg) => pg + 1)}
                  className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
