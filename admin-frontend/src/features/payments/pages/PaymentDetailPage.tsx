import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getAdminPaymentDetail } from "@/features/payments/api/admin-payments.api";
import { listAdminRefunds, type RefundListItem } from "@/features/refunds/api/admin-refunds.api";
import {
  PAYSTACK_RAILS_COMPACT,
  formatPaymentGatewayLabel,
  inferPaymentRailFromTransactions
} from "@/features/payments/lib/paystackRails";
import { StitchPaymentStatusPill, customerInitials } from "@/features/payments/ui/stitchPaymentsUi";

const paymentRefLabel = (id: string) => `PAY-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
const refundRefLabel = (id: string) => `REF-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const formatMoney = (cents: number, currency: string) => {
  const cur = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
};

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const refundStatusStitch = (state: string) => {
  const u = state.toUpperCase();
  const dot =
    u === "COMPLETED"
      ? "bg-emerald-500"
      : u === "REJECTED" || u === "FAILED"
        ? "bg-red-500"
        : "bg-amber-500";
  const label = state.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-tight text-slate-700`}>
      <span className={`mr-2 h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
};

export const PaymentDetailPage = () => {
  const { paymentId = "" } = useParams<{ paymentId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);

  const detailQuery = useQuery({
    queryKey: ["admin-payment-detail", paymentId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminPaymentDetail(accessToken, paymentId);
    },
    enabled: Boolean(accessToken) && Boolean(paymentId)
  });

  const entity = detailQuery.data?.data.entity;

  const refundsQuery = useQuery({
    queryKey: ["admin-payment-refunds-for-order", entity?.orderNumber],
    queryFn: async () => {
      if (!accessToken || !entity?.orderNumber) {
        throw new Error("Missing context.");
      }
      return listAdminRefunds(accessToken, { q: entity.orderNumber, page_size: 50, page: 1 });
    },
    enabled: Boolean(accessToken && entity?.orderNumber)
  });

  const refundRows = useMemo(() => {
    const all = refundsQuery.data?.data.items ?? [];
    if (!entity) return [] as RefundListItem[];
    return all.filter((r) => r.payment.id === entity.id);
  }, [refundsQuery.data?.data.items, entity]);

  const railLabel = useMemo(
    () => (entity ? inferPaymentRailFromTransactions(entity.transactions) : null),
    [entity]
  );

  const methodLine = railLabel ?? PAYSTACK_RAILS_COMPACT;

  const timelineEntries = useMemo(() => {
    if (!entity) return [];
    const sorted = [...entity.transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sorted.slice(0, 8).map((tx, i, arr) => {
      const st = tx.status.toUpperCase();
      const isOk = st === "SUCCESS" || st === "SUCCEEDED";
      const isFail = st === "FAILED" || st === "CANCELLED";
      const ring = isOk ? "bg-[#1653cc] text-white" : isFail ? "bg-red-600 text-white" : "bg-slate-200 text-slate-500";
      const icon = isOk ? "check" : isFail ? "error" : i === arr.length - 1 ? "bolt" : "sync";
      return {
        id: tx.id,
        title: tx.providerEventType?.replace(/_/g, " ") ?? "Provider event",
        when: formatWhen(tx.createdAt),
        ring,
        icon
      };
    });
  }, [entity]);

  const latestPayloadTx = useMemo(() => {
    if (!entity?.transactions.length) return null;
    return [...entity.transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]!;
  }, [entity]);

  const summaryIconWrap =
    entity?.paymentState === "PAID"
      ? "bg-emerald-50 text-emerald-600"
      : entity?.paymentState === "FAILED"
        ? "bg-red-50 text-red-600"
        : "bg-amber-50 text-amber-600";

  const summaryIcon =
    entity?.paymentState === "PAID" ? "check_circle" : entity?.paymentState === "FAILED" ? "error" : "pending";

  const errorMessage =
    detailQuery.error instanceof ApiError
      ? detailQuery.error.message
      : detailQuery.error instanceof Error
        ? detailQuery.error.message
        : null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-12">
      {!paymentId ? <p className="text-sm text-red-700">Missing payment id.</p> : null}

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {detailQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : entity ? (
        <>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <nav className="mb-2 flex items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <Link className="transition-colors hover:text-[#1653cc]" to="/admin/payments">
                  Payments
                </Link>
                <span className="mx-2">/</span>
                <span className="text-slate-900">Details</span>
              </nav>
              <h1 className="font-headline text-3xl font-bold tracking-tight text-slate-900">
                Payment #{paymentRefLabel(entity.id)}
              </h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
              >
                Print Receipt
              </button>
              <Link
                to={`/admin/refunds?q=${encodeURIComponent(entity.orderNumber)}`}
                className="rounded-md bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-90"
              >
                Initiate Refund
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 space-y-8 lg:col-span-8">
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="flex items-start space-x-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${summaryIconWrap}`}>
                      <MaterialIcon name={summaryIcon} className="text-3xl" />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Amount</p>
                      <h2 className="font-headline text-3xl font-bold text-slate-900">
                        {formatMoney(entity.amountCents, entity.currency)}{" "}
                        <span className="text-lg font-medium text-slate-400">{entity.currency.toUpperCase()}</span>
                      </h2>
                    </div>
                  </div>
                  <div className="text-right">
                    <StitchPaymentStatusPill paymentState={entity.paymentState} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 border-t border-slate-50 pt-6 sm:grid-cols-3">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Provider</p>
                    <div className="flex items-center">
                      <MaterialIcon name="account_balance" className="mr-2 text-slate-400" />
                      <span className="text-sm font-semibold">{formatPaymentGatewayLabel(entity.provider)}</span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Method</p>
                    <div className="flex items-center">
                      <MaterialIcon name="credit_card" className="mr-2 text-slate-400" />
                      <span className="text-sm font-semibold">{methodLine}</span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Reference #</p>
                    <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                      {entity.providerPaymentRef?.trim() || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-lg border-l-4 border-[#1653cc] bg-white p-5 shadow-sm">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Order Context</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Order ID</span>
                      <Link
                        className="font-mono text-xs font-bold text-[#1653cc] hover:underline"
                        to={`/admin/orders/${entity.orderId}`}
                      >
                        {entity.orderNumber}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Customer</span>
                      <span className="text-xs font-semibold">
                        {entity.customer.name ?? entity.customer.email ?? (entity.customer.guest ? "Guest" : "—")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Total Value</span>
                      <span className="font-mono text-xs font-bold">{formatMoney(entity.amountCents, entity.currency)}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-white p-5 shadow-sm">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Customer Profile</p>
                  <div className="flex items-center">
                    <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                      {customerInitials(entity.customer.name, entity.customer.email)}
                    </div>
                    <div>
                      <p className="text-sm font-bold">
                        {entity.customer.name ?? entity.customer.email ?? (entity.customer.guest ? "Guest" : "—")}
                      </p>
                      <p className="text-[10px] text-slate-500">{entity.customer.email ?? "—"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Refund History</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {refundRows.length} {refundRows.length === 1 ? "Entry" : "Entries"}
                  </span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr>
                      {(["Refund #", "Amount", "Date", "Status"] as const).map((h) => (
                        <th
                          key={h}
                          className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {refundRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                          No refunds linked to this payment.
                        </td>
                      </tr>
                    ) : (
                      refundRows.map((r) => (
                        <tr key={r.id} className="transition-colors hover:bg-slate-50/80">
                          <td className="px-6 py-4 font-mono text-xs text-[#1653cc]">
                            <Link to={`/admin/refunds/${r.id}`} className="hover:underline">
                              {refundRefLabel(r.id)}
                            </Link>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs font-semibold">
                            {formatMoney(r.amountCents, r.currency)}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">{formatWhen(r.createdAt)}</td>
                          <td className="px-6 py-4">{refundStatusStitch(r.state)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
                <div className="flex cursor-pointer items-center justify-between bg-slate-50 px-6 py-4">
                  <div className="flex items-center">
                    <MaterialIcon name="receipt_long" className="mr-2 text-lg text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Provider response
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {latestPayloadTx ? (
                    <TechnicalJsonDisclosure
                      label="Latest provider event"
                      data={latestPayloadTx.payload ?? {}}
                      defaultOpen={false}
                    />
                  ) : (
                    <p className="text-sm text-slate-500">No provider response data recorded.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-12 space-y-8 lg:col-span-4">
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h3 className="mb-6 text-xs font-bold uppercase tracking-wider text-slate-500">Payment Timeline</h3>
                <div className="relative space-y-8 before:absolute before:inset-0 before:ml-4 before:h-full before:w-0.5 before:bg-slate-100">
                  {timelineEntries.length === 0 ? (
                    <p className="text-sm text-slate-500">No ledger events yet.</p>
                  ) : (
                    timelineEntries.map((e) => (
                      <div key={e.id} className="relative flex items-center space-x-4">
                        <div
                          className={`z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-4 ring-white ${e.ring}`}
                        >
                          <MaterialIcon name={e.icon} className="text-sm" filled />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold">{e.title}</p>
                          <p className="text-[10px] text-slate-400">{e.when}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <Link
                  to={`/admin/payments/${paymentId}/transactions`}
                  className="mt-4 inline-block text-[10px] font-bold uppercase tracking-widest text-[#1653cc] hover:underline"
                >
                  Full transaction ledger →
                </Link>
              </div>

              <div className="relative overflow-hidden rounded-lg bg-slate-900 p-6 text-white shadow-sm">
                <div className="pointer-events-none absolute -right-4 -top-4 opacity-10">
                  <MaterialIcon name="account_balance" className="text-8xl text-white" />
                </div>
                <h3 className="mb-6 text-[10px] font-bold uppercase tracking-wider text-slate-400">Provider Metadata</h3>
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">Paystack reference</p>
                    <p className="break-all font-mono text-xs text-blue-300">
                      {entity.providerPaymentRef?.trim() || "—"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                    <span className="text-xs text-slate-400">Gateway</span>
                    <span className="text-xs font-semibold">{formatPaymentGatewayLabel(entity.provider)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Idempotency</span>
                    <span className="break-all font-mono text-[10px] font-bold text-slate-200">{entity.idempotencyKey}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Internal id</span>
                    <span className="break-all font-mono text-[10px] text-slate-300">{entity.id}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  to={`/admin/payments/${paymentId}/transactions`}
                  className="group flex w-full items-center justify-between rounded-lg border border-slate-100 bg-white p-4 transition-all hover:border-[#1653cc]"
                >
                  <div className="flex items-center">
                    <MaterialIcon name="receipt_long" className="mr-3 text-slate-400 group-hover:text-[#1653cc]" />
                    <span className="text-xs font-bold">View Full Ledger</span>
                  </div>
                  <MaterialIcon name="chevron_right" className="text-sm text-slate-300" />
                </Link>
                <Link
                  to={`/admin/orders/${entity.orderId}`}
                  className="group flex w-full items-center justify-between rounded-lg border border-slate-100 bg-white p-4 transition-all hover:border-[#1653cc]"
                >
                  <div className="flex items-center">
                    <MaterialIcon name="shopping_bag" className="mr-3 text-slate-400 group-hover:text-[#1653cc]" />
                    <span className="text-xs font-bold">Open Order</span>
                  </div>
                  <MaterialIcon name="chevron_right" className="text-sm text-slate-300" />
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
