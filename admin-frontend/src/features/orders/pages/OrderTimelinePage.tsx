import { useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CreditCard, Headphones, Info, RotateCcw, Truck } from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  getAdminOrderDetail,
  getAdminOrderTimeline
} from "@/features/orders/api/admin-orders.api";
import { OrderStitchFulfillmentTimeline } from "@/features/orders/components/OrderStitchFulfillmentTimeline";

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

const formatCreatedMono = (iso: string) => {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
};

const humanize = (raw: string) => raw.replace(/_/g, " ");

const HeaderStatusChip = ({ status }: { status: string }) => {
  const u = status.toUpperCase();
  const cancelled = u === "CANCELLED";
  return (
    <div
      className={`flex items-center gap-1.5 rounded border border-[#c3c6d6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        cancelled ? "text-[#ba1a1a]" : "text-[#006b2d]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cancelled ? "bg-[#ba1a1a]" : "bg-[#006b2d]"}`} />
      {humanize(status)}
    </div>
  );
};

export const OrderTimelinePage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [detailQ, timelineQ] = useQueries({
    queries: [
      {
        queryKey: ["admin-order-detail", orderId],
        queryFn: async () => {
          if (!accessToken || !orderId) {
            throw new Error("Missing context.");
          }
          return getAdminOrderDetail(accessToken, orderId);
        },
        enabled: Boolean(accessToken && orderId)
      },
      {
        queryKey: ["admin-order-timeline", orderId],
        queryFn: async () => {
          if (!accessToken || !orderId) {
            throw new Error("Missing context.");
          }
          return getAdminOrderTimeline(accessToken, orderId);
        },
        enabled: Boolean(accessToken && orderId)
      }
    ]
  });

  const entity = detailQ.data?.data.entity;
  const timeline = timelineQ.data?.data.timeline ?? [];
  const orderNumber = entity?.orderNumber ?? timelineQ.data?.data.entity.orderNumber;

  const itemQty = useMemo(
    () => (entity?.items ?? []).reduce((acc, line) => acc + line.quantity, 0),
    [entity?.items]
  );

  const previewLines = useMemo(() => (entity?.items ?? []).slice(0, 2), [entity?.items]);

  const latestShip = useMemo(() => {
    const s = entity?.shipments ?? [];
    if (s.length === 0) {
      return null;
    }
    return [...s].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  }, [entity?.shipments]);

  const grand = entity?.totals?.grandTotalCents ?? null;
  const cur = entity?.totals?.currency ?? entity?.payment.currency;

  const detailErr =
    detailQ.error instanceof ApiError ? detailQ.error.message : detailQ.error instanceof Error ? detailQ.error.message : null;
  const timelineErr =
    timelineQ.error instanceof ApiError
      ? timelineQ.error.message
      : timelineQ.error instanceof Error
        ? timelineQ.error.message
        : null;

  const loading = detailQ.isLoading || timelineQ.isLoading;

  if (!orderId) {
    return <p className="text-sm text-[#737685]">Missing order id.</p>;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title={orderNumber ? `Order #${orderNumber} — Timeline` : "Order timeline"}
        titleSize="deck"
        description={
          <>
            <span className="block">Fulfillment journey and linked operational entities for this order.</span>
            {entity ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <HeaderStatusChip status={entity.status} />
                <span className="text-sm text-[#434654]">
                  Created on{" "}
                  <span className="rounded bg-[#f2f3ff] px-2 py-0.5 font-mono text-xs text-[#434654]">
                    {formatCreatedMono(entity.createdAt)}
                  </span>
                </span>
              </div>
            ) : null}
          </>
        }
        autoBreadcrumbs={false}
        actionMenuItems={[
          {
            id: "refresh-order-timeline",
            label: "Refresh data",
            onSelect: () => {
              void queryClient.invalidateQueries({ queryKey: ["admin-order-timeline", orderId] });
              void queryClient.invalidateQueries({ queryKey: ["admin-order-detail", orderId] });
            }
          }
        ]}
      />

      <p className="text-sm">
        <Link className="font-semibold text-[#1653cc] hover:underline" to={`/admin/orders/${orderId}`}>
          ← Order detail
        </Link>
      </p>

      {detailErr ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{detailErr}</div>
      ) : null}
      {timelineErr ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {timelineErr}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-[#e0e2f0] bg-white p-12 text-center text-sm text-[#737685]">
          Loading timeline…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <div className="relative rounded-xl bg-white p-8 shadow-sm">
                <h3 className="mb-10 text-sm font-bold uppercase tracking-widest text-[#434654]">
                  Fulfillment journey
                </h3>
                <OrderStitchFulfillmentTimeline events={timeline} />
              </div>
            </div>

            <div className="space-y-6 lg:col-span-4">
              <div className="overflow-hidden rounded-xl border border-[#e0e2f0]/40 bg-white shadow-sm">
                <div className="bg-[#13161e] p-4 text-white">
                  <h3 className="text-xs font-bold uppercase tracking-widest opacity-70">Order snapshot</h3>
                </div>
                <div className="p-6">
                  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">
                        Total value
                      </span>
                      <h4 className="mt-1 font-headline text-2xl font-bold text-[#181b25]">
                        {formatMoney(grand, cur)}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Qty</span>
                      <p className="text-sm font-semibold text-[#181b25]">
                        {itemQty} {itemQty === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {previewLines.length === 0 ? (
                      <p className="text-sm text-[#737685]">No line items loaded.</p>
                    ) : (
                      previewLines.map((line) => (
                        <div key={line.id} className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-[#ecedfb] text-[10px] font-bold text-[#1653cc]">
                            {line.productTitle.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-[#181b25]">{line.productTitle}</p>
                            <p className="font-mono text-[10px] text-[#434654]">
                              Variant ·{" "}
                              {line.variantId.length > 14
                                ? `${line.variantId.slice(0, 12)}…`
                                : line.variantId}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-[#181b25]">
                              {formatMoney(line.lineTotalCents, line.unitPriceCurrency)}
                            </p>
                            <p className="text-[10px] text-[#434654]">×{line.quantity}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <Link
                    to={`/admin/orders/${orderId}`}
                    className="mt-6 block w-full rounded-lg bg-[#1653cc] py-2.5 text-center text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                  >
                    View full manifest
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-white bg-[#f2f3ff] p-6 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#434654]">Linked entities</h3>
                <div className="space-y-3">
                  {entity?.payment.id ? (
                    <Link
                      to={`/admin/payments/${entity.payment.id}`}
                      className="group flex items-center justify-between rounded-lg bg-white p-3 transition-all hover:ring-1 hover:ring-[#1653cc]/20"
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-[#1653cc]" aria-hidden />
                        <div>
                          <p className="text-xs font-semibold text-[#181b25]">Payment</p>
                          <p className="font-mono text-[10px] text-[#434654]">
                            {humanize(entity.payment.paymentState)}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[#737685] transition-colors group-hover:text-[#1653cc]" />
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg bg-white p-3 opacity-80">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-[#737685]" aria-hidden />
                        <div>
                          <p className="text-xs font-semibold text-[#181b25]">Payment</p>
                          <p className="text-[10px] text-[#434654]">No payment record linked</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {latestShip ? (
                    <Link
                      to={`/admin/shipments/${latestShip.id}`}
                      className="group flex items-center justify-between rounded-lg bg-white p-3 transition-all hover:ring-1 hover:ring-[#1653cc]/20"
                    >
                      <div className="flex items-center gap-3">
                        <Truck className="h-5 w-5 text-[#006b2d]" aria-hidden />
                        <div>
                          <p className="text-xs font-semibold text-[#181b25]">Shipment</p>
                          <p className="font-mono text-[10px] text-[#434654]">
                            {latestShip.trackingNumber ?? latestShip.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[#737685] transition-colors group-hover:text-[#1653cc]" />
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg bg-white p-3 opacity-80">
                      <div className="flex items-center gap-3">
                        <Truck className="h-5 w-5 text-[#737685]" aria-hidden />
                        <div>
                          <p className="text-xs font-semibold text-[#181b25]">Shipment</p>
                          <p className="text-[10px] text-[#434654]">No shipments yet</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-lg bg-white p-3 opacity-50 grayscale">
                    <div className="flex items-center gap-3">
                      <RotateCcw className="h-5 w-5 text-[#737685]" aria-hidden />
                      <div>
                        <p className="text-xs font-semibold text-[#181b25]">Returns</p>
                        <p className="text-[10px] italic text-[#434654]">No active returns</p>
                      </div>
                    </div>
                  </div>

                  <Link
                    to="/admin/support/tickets"
                    className="group flex items-center justify-between rounded-lg bg-white p-3 transition-all hover:ring-1 hover:ring-[#1653cc]/20"
                  >
                    <div className="flex items-center gap-3">
                      <Headphones className="h-5 w-5 text-[#ba1a1a]" aria-hidden />
                      <div>
                        <p className="text-xs font-semibold text-[#181b25]">Support</p>
                        <p className="font-mono text-[10px] text-[#434654]">Open support queue</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#737685] transition-colors group-hover:text-[#1653cc]" />
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border-l-4 border-[#1653cc] bg-[#dbe1ff]/30 p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 shrink-0 text-[#1653cc]" aria-hidden />
                  <div>
                    <h4 className="text-xs font-bold text-[#00174a]">Pro tip</h4>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#003ea7]">
                      Use order detail for mutations and shipment creation. This view is optimized for chronological
                      auditing and cross-entity navigation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
