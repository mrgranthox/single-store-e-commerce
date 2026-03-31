import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { PageActionsMenu } from "@/components/primitives/PageActionsMenu";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getAdminShipmentDetail, type ShipmentTrackingEventApi } from "@/features/orders/api/admin-orders.api";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const shipmentRef = (id: string) => `SHP-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const idSuffix = (uuid: string) => uuid.replace(/-/g, "").slice(-2).toUpperCase();

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatCreatedStitch = (iso: string) => {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
  } catch {
    return iso;
  }
};

const recipientLines = (r: {
  fullName: string | null;
  email: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
}) => {
  const loc = [r.city, r.region, r.country].filter(Boolean).join(", ");
  return { name: r.fullName?.trim() || "—", email: r.email?.trim() || null, loc: loc || "—" };
};

const trackingNote = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const n = (payload as Record<string, unknown>).note;
  return typeof n === "string" && n.trim() ? n.trim() : null;
};

type Phase =
  | { key: string; kind: "created"; at: string }
  | { key: string; kind: "event"; ev: ShipmentTrackingEventApi }
  | { key: string; kind: "pending" };

export const ShipmentDetailPage = () => {
  const { shipmentId } = useParams<{ shipmentId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const q = useQuery({
    queryKey: ["admin-shipment-detail", shipmentId],
    queryFn: async () => {
      if (!accessToken || !shipmentId) {
        throw new Error("Missing context.");
      }
      return getAdminShipmentDetail(accessToken, shipmentId);
    },
    enabled: Boolean(accessToken && shipmentId)
  });

  const e = q.data?.data.entity;
  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const ref = e ? shipmentRef(e.id) : "";
  const displayId = e ? `ID: ${ref}-${idSuffix(e.id)}` : "";
  const shipTo = e ? recipientLines(e.recipient) : { name: "—", email: null as string | null, loc: "—" };

  const terminal = e ? ["DELIVERED", "CANCELLED"].includes(e.status.toUpperCase()) : true;

  const phases = useMemo((): Phase[] => {
    if (!e) {
      return [];
    }
    const eventsAsc = [...e.trackingEvents].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );
    const out: Phase[] = [{ key: "created", kind: "created", at: e.createdAt }];
    for (const ev of eventsAsc) {
      out.push({ key: ev.id, kind: "event", ev });
    }
    if (!terminal) {
      out.push({ key: "pending", kind: "pending" });
    }
    return out;
  }, [e, terminal]);

  const trackSearchUrl =
    e?.trackingNumber?.trim() && e?.carrier
      ? `https://www.google.com/search?q=${encodeURIComponent(`${e.carrier} ${e.trackingNumber}`)}`
      : e?.trackingNumber?.trim()
        ? `https://www.google.com/search?q=${encodeURIComponent(e.trackingNumber)}`
        : null;

  const copyTracking = async () => {
    const tn = e?.trackingNumber?.trim();
    if (!tn || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(tn);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const statusLabelUi = e ? e.status.replace(/_/g, " ") : "";

  if (!shipmentId) {
    return <p className="text-sm text-slate-500">Missing shipment id.</p>;
  }

  return (
    <div className="text-[#181b25]">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-400" aria-label="Breadcrumb">
        <Link className="transition-colors hover:text-[#1653cc]" to="/admin/orders">
          Orders
        </Link>
        <MaterialIcon name="chevron_right" className="text-xs text-slate-300" />
        <Link className="transition-colors hover:text-[#1653cc]" to="/admin/orders/queues/dispatch">
          Shipments
        </Link>
        <MaterialIcon name="chevron_right" className="text-xs text-slate-300" />
        <span className="border-b-2 border-[#4f7ef8] pb-1 font-semibold text-[#4f7ef8]">{ref || "…"}</span>
      </nav>

      {err ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : e ? (
        <>
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="font-headline text-2xl font-bold tracking-tight text-[#181b25]">
                Shipment #{ref}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-500">{displayId}</span>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00873b]/20 px-2.5 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#006b2d]" />
                  <span className="text-xs font-semibold text-[#006b2d]">{statusLabelUi}</span>
                </div>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <MaterialIcon name="calendar_today" className="text-sm" />
                  Created {formatCreatedStitch(e.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl border border-[#c3c6d6] bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <MaterialIcon name="print" className="text-lg" />
                Label
              </button>
              <Link
                to={`/admin/orders/${e.order.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                <MaterialIcon name="edit" className="text-lg text-white" />
                Edit shipment
              </Link>
              <PageActionsMenu
                items={[refreshDataMenuItem(queryClient, ["admin-shipment-detail", shipmentId])]}
                triggerLabel="Actions"
              />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 space-y-6 lg:col-span-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="stitch-surface-card p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-headline text-sm font-bold uppercase tracking-wider text-slate-500">
                      Shipment Summary
                    </h2>
                    <MaterialIcon name="info" className="text-slate-300" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                      <span className="text-xs text-slate-500">Service level</span>
                      <span className="text-sm font-semibold text-[#181b25]">Standard</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                      <span className="text-xs text-slate-500">Estimated delivery</span>
                      <span className="text-sm font-bold text-[#1653cc]">—</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                      <span className="text-xs text-slate-500">Weight</span>
                      <span className="text-sm font-semibold text-[#181b25]">—</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Dimensions</span>
                      <span className="text-sm font-semibold text-[#181b25]">—</span>
                    </div>
                  </div>
                </div>

                <div className="stitch-surface-card relative overflow-hidden p-6 shadow-sm">
                  <div className="pointer-events-none absolute right-4 top-4 opacity-5">
                    <MaterialIcon name="local_shipping" className="text-6xl text-slate-900" />
                  </div>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-headline text-sm font-bold uppercase tracking-wider text-slate-500">
                      Carrier Details
                    </h2>
                    <div className="flex h-6 w-12 items-center justify-center rounded bg-slate-100">
                      <span className="text-[10px] font-bold text-slate-400">
                        {(e.carrier ?? "—").slice(0, 5).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-slate-500">Carrier name</span>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-orange-100">
                          <MaterialIcon name="rocket_launch" className="text-sm text-orange-600" />
                        </div>
                        <span className="text-sm font-bold">{e.carrier ?? "—"}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Tracking number</span>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="break-all font-mono text-sm font-medium text-[#1653cc] underline decoration-[#1653cc]/30 underline-offset-4">
                          {e.trackingNumber?.trim() || "—"}
                        </span>
                        {e.trackingNumber?.trim() ? (
                          <button
                            type="button"
                            onClick={() => void copyTracking()}
                            className="shrink-0 text-slate-400 transition-colors hover:text-[#1653cc]"
                            aria-label="Copy tracking number"
                          >
                            <MaterialIcon name="content_copy" className="text-lg" />
                          </button>
                        ) : null}
                      </div>
                      {copied ? <p className="mt-1 text-xs text-emerald-600">Copied</p> : null}
                    </div>
                    {trackSearchUrl ? (
                      <a
                        href={trackSearchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-[#1653cc] transition-all hover:gap-3"
                      >
                        Track on external portal
                        <MaterialIcon name="open_in_new" className="text-xs" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="stitch-surface-card overflow-hidden shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
                  <h2 className="font-headline text-sm font-bold uppercase tracking-wider text-slate-500">
                    Contents (order)
                  </h2>
                  <span className="rounded bg-[#1653cc]/10 px-2 py-0.5 text-[10px] font-bold text-[#1653cc]">
                    VIEW ON ORDER
                  </span>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Product
                      </th>
                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Variant
                      </th>
                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">SKU</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Qty
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <tr className="transition-colors hover:bg-slate-50/30">
                      <td colSpan={4} className="px-6 py-6 text-center text-sm text-slate-600">
                        Line items live on the linked order.{" "}
                        <Link
                          to={`/admin/orders/${e.order.id}`}
                          className="font-bold text-[#1653cc] hover:underline"
                        >
                          Open order #{e.order.orderNumber}
                        </Link>{" "}
                        for SKUs, variants, and quantities.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="stitch-surface-card border-l-4 border-[#1653cc] p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#dbe1ff]/30 text-[#1653cc]">
                      <MaterialIcon name="link" className="text-2xl" />
                    </div>
                    <div>
                      <h2 className="font-headline text-sm font-bold text-slate-900">
                        Linked to order #{e.order.orderNumber}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Customer: <span className="font-semibold text-slate-700">{shipTo.name}</span>
                      </p>
                      <div className="mt-3 flex items-start gap-2 text-xs text-slate-500">
                        <MaterialIcon name="location_on" className="mt-0.5 text-sm" />
                        <span className="whitespace-pre-line">{shipTo.loc}</span>
                      </div>
                    </div>
                  </div>
                  <Link
                    to={`/admin/orders/${e.order.id}`}
                    className="shrink-0 rounded-lg border border-[#1653cc]/20 px-4 py-2 text-xs font-bold text-[#1653cc] transition-colors hover:bg-[#1653cc]/5"
                  >
                    View order
                  </Link>
                </div>
              </div>
            </div>

            <div className="col-span-12 space-y-6 lg:col-span-4">
              <div className="stitch-surface-card p-6 shadow-sm">
                <h2 className="mb-6 font-headline text-sm font-bold uppercase tracking-wider text-slate-500">
                  Shipment Timeline
                </h2>
                <div className="relative space-y-0">
                  <div className="absolute bottom-2 left-[15px] top-2 w-0.5 bg-slate-100" />
                  {phases.map((phase, i) => {
                    const lastEventIdx = terminal ? phases.length - 1 : phases.length - 2;
                    const isPending = phase.kind === "pending";
                    const isCreated = phase.kind === "created";
                    const isEvent = phase.kind === "event";
                    const activeEvent = isEvent && !terminal && i === lastEventIdx && lastEventIdx >= 1;
                    const doneGreen =
                      isCreated ||
                      (isEvent && (terminal ? i <= lastEventIdx : i < lastEventIdx));

                    return (
                      <div key={phase.key} className="relative flex gap-4 pb-8 last:pb-0">
                        <div
                          className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-white ${
                            activeEvent
                              ? "bg-[#1653cc] text-white ring-4 ring-[#1653cc]/10"
                              : doneGreen
                                ? "bg-[#006b2d] text-white"
                                : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {isPending ? (
                            <MaterialIcon name="home" className="text-sm" />
                          ) : activeEvent ? (
                            <MaterialIcon name="local_shipping" className="animate-pulse text-sm" />
                          ) : isEvent && !phase.ev.eventType ? (
                            <MaterialIcon name="edit_note" className="text-sm" filled={doneGreen} />
                          ) : (
                            <MaterialIcon name="check" className="text-sm" filled={doneGreen} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {isPending ? (
                            <>
                              <p className="text-sm font-semibold text-slate-400">Out for delivery</p>
                              <p className="text-[11px] text-slate-300">Pending</p>
                            </>
                          ) : isCreated ? (
                            <>
                              <p className="text-sm font-bold text-[#181b25]">Shipment created</p>
                              <p className="text-[11px] text-slate-500">{formatWhen(phase.at)}</p>
                            </>
                          ) : (
                            <>
                              <p
                                className={`text-sm font-bold ${activeEvent ? "text-[#1653cc]" : "text-[#181b25]"}`}
                              >
                                {phase.ev.statusLabel}
                              </p>
                              <p className="text-[11px] text-slate-500">{formatWhen(phase.ev.occurredAt)}</p>
                              {activeEvent ? (
                                <p className="text-[11px] text-slate-500">Last event at this checkpoint</p>
                              ) : null}
                              {phase.ev.location || trackingNote(phase.ev.payload) ? (
                                <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                                  <p className="text-[11px] italic text-slate-600">
                                    {phase.ev.location
                                      ? `"${phase.ev.location}"`
                                      : trackingNote(phase.ev.payload)}
                                  </p>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="stitch-surface-card bg-[#1a1d27] p-6 text-white shadow-sm">
                <h2 className="mb-4 font-headline text-sm font-bold uppercase tracking-wider text-slate-400">
                  Operational actions
                </h2>
                <div className="space-y-3">
                  <Link
                    to={`/admin/orders/${e.order.id}`}
                    className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
                  >
                    <span className="text-sm font-medium">Update status</span>
                    <MaterialIcon
                      name="chevron_right"
                      className="text-lg text-[#4f7ef8] transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                  <Link
                    to={`/admin/shipments/${shipmentId}/tracking`}
                    className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
                  >
                    <span className="text-sm font-medium">Add tracking event</span>
                    <MaterialIcon name="add_location" className="text-lg text-[#4f7ef8]" />
                  </Link>
                  <Link
                    to={`/admin/shipments/${shipmentId}/tracking`}
                    className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
                  >
                    <span className="text-sm font-medium">View event log</span>
                    <MaterialIcon
                      name="history"
                      className="text-lg text-slate-400 transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                </div>
              </div>

              <div className="stitch-surface-card border border-slate-100 p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <MaterialIcon name="mail" className="text-lg text-[#1653cc]" />
                  <h2 className="font-headline text-sm font-bold uppercase tracking-wider text-slate-500">
                    Customer comms
                  </h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Notification status</span>
                    <span className="rounded bg-[#6bff8f] px-2 py-0.5 text-[10px] font-bold text-[#002109]">
                      SENT
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Last email</span>
                    <span className="text-xs font-semibold">—</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Active methods</span>
                    <div className="flex gap-1">
                      <MaterialIcon name="alternate_email" className="text-sm text-slate-400" />
                      <MaterialIcon name="sms" className="text-sm text-slate-400" />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-full border-t border-slate-50 pt-4 text-xs font-bold text-slate-600 transition-colors hover:text-[#1653cc]"
                  >
                    Send manual alert
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
