import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, listFailedPaymentInvestigations, type FailedPaymentInvestigationItem } from "@/features/payments/api/admin-payments.api";
import {
  PAYSTACK_GATEWAY_NAME,
  PAYSTACK_PROVIDER_QUERY_VALUE,
  PAYSTACK_RAILS_COMPACT,
  formatPaymentGatewayLabel
} from "@/features/payments/lib/paystackRails";
import { customerInitials } from "@/features/payments/ui/stitchPaymentsUi";

const paymentRefLabel = (id: string) => `PAY-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const formatMoney = (cents: number, currency: string) => {
  const cur = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
};

const formatTimeUtc = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const PaymentsFailedInvestigationsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [providerDraft, setProviderDraft] = useState("");
  const [providerApplied, setProviderApplied] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-payments-failed-investigations", page, providerApplied],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listFailedPaymentInvestigations(accessToken, {
        page,
        page_size: 20,
        ...(providerApplied.trim() ? { provider: providerApplied.trim() } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = q.data?.data.items ?? [];
  const meta = q.data?.meta;

  const displayItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((row) => {
      const cust = (row.customer.name ?? row.customer.email ?? "").toLowerCase();
      return (
        row.orderNumber.toLowerCase().includes(needle) ||
        cust.includes(needle) ||
        row.id.toLowerCase().includes(needle) ||
        (row.providerPaymentRef ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, search]);

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const volumeOnPage = useMemo(
    () => displayItems.reduce((acc, row) => acc + row.amountCents, 0),
    [displayItems]
  );
  const cur = displayItems[0]?.currency ?? items[0]?.currency ?? "USD";
  const totalCatalog = meta?.totalItems ?? 0;

  const exportCsv = () => {
    if (displayItems.length === 0) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["PaymentRef", "OrderNumber", "Customer", "Amount", "Currency", "Provider", "LatestSignal", "UpdatedAt"];
    const lines = [
      header.join(","),
      ...displayItems.map((row) => {
        const customer = row.customer.name ?? row.customer.email ?? (row.customer.guest ? "Guest" : "—");
        const latest = row.latestTransactionStatus?.replace(/_/g, " ") ?? "";
        return [
          esc(paymentRefLabel(row.id)),
          esc(row.orderNumber),
          esc(customer),
          esc(String(row.amountCents / 100)),
          esc(row.currency),
          esc(formatPaymentGatewayLabel(row.provider)),
          esc(latest),
          esc(row.updatedAt)
        ].join(",");
      })
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `failed-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reasonChip = (row: FailedPaymentInvestigationItem) => {
    const latest = (row.latestTransactionStatus ?? "FAILED").toUpperCase();
    const dot =
      latest.includes("TIMEOUT") || latest.includes("PENDING")
        ? "bg-orange-500"
        : latest.includes("FRAUD") || latest.includes("BLOCK")
          ? "bg-orange-500"
          : "bg-red-600";
    const label = row.latestTransactionStatus?.replace(/_/g, " ") || "Payment failed";
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-[#181b25]">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 pb-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">Failed Payments</h1>
          <p className="mt-1 text-sm italic text-[#5b5e68]">Investigation workspace for transaction lifecycle exceptions.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportCsv}
            disabled={displayItems.length === 0}
            className="flex items-center gap-2 rounded border border-[#c3c6d6] bg-white px-4 py-2 text-xs font-semibold transition-colors hover:bg-[#f2f3ff] disabled:opacity-40"
          >
            <MaterialIcon name="download" className="text-sm" />
            Export CSV
          </button>
          <button
            type="button"
            disabled
            title="Bulk retry is not automated in this build — open a payment to act."
            className="flex items-center gap-2 rounded bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-6 py-2 text-xs font-semibold text-white opacity-50 shadow-lg shadow-[#1653cc]/20"
          >
            <MaterialIcon name="refresh" className="text-sm" />
            Bulk Retry All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex h-32 flex-col justify-between rounded-xl border-l-4 border-red-600 bg-white p-5">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[#5b5e68]">Failed (this page)</span>
          <div className="flex items-baseline gap-2">
            <span className="font-headline text-3xl font-bold">{displayItems.length}</span>
            <span className="text-xs font-medium text-red-600">visible rows</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[#ecedfb]">
            <div className="h-full w-3/4 bg-red-600" />
          </div>
        </div>
        <div className="flex h-32 flex-col justify-between rounded-xl border-l-4 border-[#1653cc] bg-white p-5">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[#5b5e68]">Catalog total</span>
          <div className="flex items-baseline gap-2">
            <span className="font-headline text-3xl font-bold">{totalCatalog}</span>
            <span className="text-xs font-medium text-[#006b2d]">matching query</span>
          </div>
          <p className="text-[10px] italic text-[#737685]">Paged list from admin API</p>
        </div>
        <div className="flex h-32 flex-col justify-between rounded-xl border-l-4 border-[#006b2d] bg-white p-5">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[#5b5e68]">Gateway</span>
          <div className="flex items-baseline gap-2">
            <span className="font-headline text-3xl font-bold">{PAYSTACK_GATEWAY_NAME}</span>
          </div>
          <div className="flex gap-1">
            <div className="h-1 flex-1 rounded-full bg-[#006b2d]" />
            <div className="h-1 flex-1 rounded-full bg-[#006b2d]" />
            <div className="h-1 flex-1 rounded-full bg-[#ecedfb]" />
          </div>
        </div>
        <div className="flex h-32 flex-col justify-between rounded-xl border-l-4 border-orange-500 bg-white p-5">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[#5b5e68]">Revenue at risk (page)</span>
          <div className="flex items-baseline gap-2">
            <span className="font-headline text-3xl font-bold font-mono tracking-tight text-[#181b25]">
              {displayItems.length ? formatMoney(volumeOnPage, cur) : "—"}
            </span>
          </div>
          <span className="text-xs text-[#5b5e68]">Sum of failed attempt totals on this view</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl bg-white p-6 lg:col-span-1">
          <h3 className="mb-6 text-sm font-bold text-[#181b25]">Failure reasons</h3>
          <div className="flex items-center justify-center py-4">
            <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-[16px] border-[#ecedfb]">
              <div className="absolute inset-0 rotate-45 rounded-full border-[16px] border-[#1653cc] border-r-transparent border-b-transparent border-l-transparent" />
              <div className="absolute inset-0 -rotate-12 rounded-full border-[16px] border-red-600 border-t-transparent border-l-transparent border-r-transparent" />
              <div className="text-center">
                <span className="block text-xl font-bold">{displayItems.length || totalCatalog}</span>
                <span className="text-[8px] font-semibold uppercase tracking-widest text-[#5b5e68]">Events</span>
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-500">Segments are illustrative; see Latest signal per row.</p>
        </div>
        <div className="rounded-xl bg-white p-6 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#181b25]">Failures by provider</h3>
            <span className="rounded bg-[#ecedfb] px-2 py-1 text-[10px] font-bold">LIVE FEED</span>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>{PAYSTACK_GATEWAY_NAME}</span>
                <span className="font-mono text-[#1653cc]">{totalCatalog} in catalog</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[#ecedfb]">
                <div className="h-full w-full bg-[#1653cc]" />
              </div>
            </div>
            <p className="text-xs text-[#5b5e68]">Checkout is Paystack-only — {PAYSTACK_RAILS_COMPACT}.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Gateway scope</span>
          <select
            value={providerDraft.trim().toLowerCase() === PAYSTACK_PROVIDER_QUERY_VALUE ? PAYSTACK_PROVIDER_QUERY_VALUE : ""}
            onChange={(e) => setProviderDraft(e.target.value)}
            className="rounded-lg border-none bg-[#ecedfb] px-3 py-2 text-xs focus:ring-1 focus:ring-[#1653cc]"
          >
            <option value="">All Paystack records</option>
            <option value={PAYSTACK_PROVIDER_QUERY_VALUE}>Paystack filter (API)</option>
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            setPage(1);
            setProviderApplied(providerDraft);
          }}
        >
          Apply filter
        </button>
        <button
          type="button"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-payments-failed-investigations"] })}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Refresh
        </button>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading failed payments…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#c3c6d6]/30 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-bold">Failed Transactions Log</h3>
            <div className="flex flex-wrap gap-4">
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSearch(searchDraft)}
                placeholder="Search failed transactions..."
                className="w-full rounded-full border-none bg-[#ecedfb] py-2 pl-4 pr-4 text-xs focus:ring-1 focus:ring-[#1653cc] sm:w-64"
              />
              <button
                type="button"
                onClick={() => setSearch(searchDraft)}
                className="rounded-full bg-[#1653cc] px-4 py-2 text-xs font-semibold text-white"
              >
                Search
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-[#f2f3ff]">
                <tr>
                  {(
                    [
                      "Payment ID",
                      "Order #",
                      "Customer",
                      "Amount",
                      "Provider",
                      "Reason",
                      "Time (UTC)",
                      "Retries",
                      "Actions"
                    ] as const
                  ).map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-[#5b5e68] ${
                        h === "Retries" ? "text-center" : h === "Actions" ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d6]/10">
                {displayItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-sm text-slate-500">
                      No failed investigations match filters.
                    </td>
                  </tr>
                ) : (
                  displayItems.map((row) => {
                    const customer = row.customer.name ?? row.customer.email ?? (row.customer.guest ? "Guest" : "—");
                    const initials = customerInitials(row.customer.name, row.customer.email);
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-[#e6e7f6]">
                        <td className="px-6 py-4">
                          <Link
                            to={`/admin/payments/${encodeURIComponent(row.id)}`}
                            className="font-mono text-[11px] font-medium text-[#1653cc] hover:underline"
                          >
                            {paymentRefLabel(row.id)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px] text-[#5b5e68]">{row.orderNumber}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 text-[10px] font-bold">
                              {initials}
                            </div>
                            <span className="text-xs font-semibold">{customer}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold">{formatMoney(row.amountCents, row.currency)}</td>
                        <td className="px-6 py-4 text-xs font-semibold">{formatPaymentGatewayLabel(row.provider)}</td>
                        <td className="px-6 py-4">{reasonChip(row)}</td>
                        <td className="px-6 py-4 text-[11px] text-[#5b5e68]">{formatTimeUtc(row.updatedAt)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="rounded bg-[#ecedfb] px-2 py-0.5 text-[10px] font-bold">—</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              to={`/admin/payments/${row.id}`}
                              className="p-1 text-slate-400 hover:text-[#1653cc]"
                              title="View"
                            >
                              <MaterialIcon name="visibility" className="text-sm" />
                            </Link>
                            <Link
                              to={`/admin/orders/${row.orderId}`}
                              className="p-1 text-slate-400 hover:text-[#1653cc]"
                              title="Order"
                            >
                              <MaterialIcon name="shopping_bag" className="text-sm" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {meta ? (
            <div className="flex flex-col gap-2 border-t border-[#ecedfb] bg-[#f2f3ff] px-6 py-3 text-[11px] text-[#5b5e68] sm:flex-row sm:items-center sm:justify-between">
              <span>
                {displayItems.length !== items.length ? (
                  <>Showing {displayItems.length} filtered of {items.length} on page · {meta.totalItems} total</>
                ) : (
                  <>
                    Showing {items.length ? (meta.page - 1) * meta.limit + 1 : 0} to {(meta.page - 1) * meta.limit + items.length} of{" "}
                    {meta.totalItems} failures
                  </>
                )}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  className="rounded border border-[#c3c6d6] bg-white px-3 py-1 disabled:opacity-40"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="flex items-center rounded bg-[#1653cc] px-3 py-1 font-bold text-white">{meta.page}</span>
                <button
                  type="button"
                  disabled={page >= meta.totalPages}
                  className="rounded border border-[#c3c6d6] bg-white px-3 py-1 disabled:opacity-40"
                  onClick={() => setPage((p) => p + 1)}
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
