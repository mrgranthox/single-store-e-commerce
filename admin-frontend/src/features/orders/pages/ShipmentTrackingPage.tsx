import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { PageActionsMenu } from "@/components/primitives/PageActionsMenu";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createAdminShipmentTrackingEvent,
  getAdminShipmentTracking,
  type ShipmentTrackingEventApi
} from "@/features/orders/api/admin-orders.api";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const shipmentRef = (id: string) => `SHP-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatDateOnly = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatSyncedAgo = (ts: number) => {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 10) {
    return "just now";
  }
  if (s < 60) {
    return `${s} seconds ago`;
  }
  const m = Math.floor(s / 60);
  if (m < 60) {
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
};

const trackingNote = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const n = (payload as Record<string, unknown>).note;
  return typeof n === "string" && n.trim() ? n.trim() : null;
};

const eventCode = (ev: ShipmentTrackingEventApi) => {
  const t = ev.eventType?.trim();
  if (!t) {
    return "MAN";
  }
  const u = t.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return u.slice(0, 3).padEnd(3, "X").slice(0, 3);
};

const isManualSource = (ev: ShipmentTrackingEventApi) => {
  const t = (ev.eventType ?? "").toLowerCase();
  return !ev.eventType || t.includes("manual");
};

const locationCode = (loc: string | null) => {
  if (!loc?.trim()) {
    return "—";
  }
  const parts = loc
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const head = parts[0] ?? loc;
  return head.slice(0, 3).toUpperCase();
};

const timelineIcon = (ev: ShipmentTrackingEventApi, isLatest: boolean) => {
  if (isLatest) {
    return "check_circle" as const;
  }
  if (isManualSource(ev)) {
    return "edit_note" as const;
  }
  const t = (ev.eventType ?? "").toLowerCase();
  if (t.includes("depart") || t.includes("flight")) {
    return "flight_land" as const;
  }
  if (t.includes("sort") || t.includes("hub")) {
    return "inventory" as const;
  }
  if (t.includes("pickup") || t.includes("pick_up")) {
    return "package_2" as const;
  }
  return "local_shipping" as const;
};

const exportEventsCsv = (ref: string, items: ShipmentTrackingEventApi[]) => {
  const header = ["occurredAt", "code", "statusLabel", "eventType", "location", "note"];
  const lines = [header.join(",")];
  for (const ev of items) {
    const note = trackingNote(ev.payload)?.replace(/"/g, '""') ?? "";
    lines.push(
      [
        ev.occurredAt,
        eventCode(ev),
        `"${ev.statusLabel.replace(/"/g, '""')}"`,
        ev.eventType ?? "",
        `"${(ev.location ?? "").replace(/"/g, '""')}"`,
        `"${note}"`
      ].join(",")
    );
  }
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shipment-${ref}-tracking.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const ShipmentTrackingPage = () => {
  const { shipmentId } = useParams<{ shipmentId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [statusLabel, setStatusLabel] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [eventType, setEventType] = useState("");
  const [tick, setTick] = useState(0);

  const q = useQuery({
    queryKey: ["admin-shipment-tracking", shipmentId],
    queryFn: async () => {
      if (!accessToken || !shipmentId) {
        throw new Error("Missing context.");
      }
      return getAdminShipmentTracking(accessToken, shipmentId);
    },
    enabled: Boolean(accessToken && shipmentId)
  });

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const entity = q.data?.data.entity;
  const items = q.data?.data.items ?? [];
  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const sortedDesc = useMemo(
    () => [...items].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [items]
  );

  const sortedAsc = useMemo(
    () => [...items].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()),
    [items]
  );

  const routeMeta = useMemo(() => {
    if (sortedAsc.length === 0) {
      return { origin: "—", dest: "—", originDate: null as string | null };
    }
    const first = sortedAsc[0];
    const last = sortedAsc[sortedAsc.length - 1];
    return {
      origin: locationCode(first.location),
      dest: locationCode(last.location),
      originDate: formatDateOnly(first.occurredAt)
    };
  }, [sortedAsc]);

  const ref = entity ? shipmentRef(entity.id) : "";
  const lastSynced = useMemo(() => {
    void tick;
    if (q.dataUpdatedAt <= 0) {
      return q.isFetching ? "syncing…" : "—";
    }
    return formatSyncedAgo(q.dataUpdatedAt);
  }, [q.dataUpdatedAt, q.isFetching, tick]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-shipment-tracking", shipmentId] });
    queryClient.invalidateQueries({ queryKey: ["admin-shipment-detail", shipmentId] });
  };

  const addMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !shipmentId) {
        throw new Error("Missing context.");
      }
      const sl = statusLabel.trim();
      if (!sl) {
        throw new Error("Status label is required.");
      }
      return createAdminShipmentTrackingEvent(accessToken, shipmentId, {
        statusLabel: sl,
        eventType: eventType.trim() || "MANUAL",
        location: location.trim() || undefined,
        note: note.trim() || undefined
      });
    },
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setStatusLabel("");
      setLocation("");
      setNote("");
      setEventType("");
    }
  });

  const addErr =
    addMut.error instanceof ApiError
      ? addMut.error.message
      : addMut.error instanceof Error
        ? addMut.error.message
        : null;

  if (!shipmentId) {
    return <p className="text-sm text-slate-500">Missing shipment id.</p>;
  }

  return (
    <div className="text-[#181b25]">
      <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <nav className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[#737685]" aria-label="Breadcrumb">
            <Link className="transition-colors hover:text-[#1653cc]" to="/admin/orders">
              Orders
            </Link>
            <MaterialIcon name="chevron_right" className="text-xs" />
            <span className="border-b-2 border-[#1653cc] pb-1 font-semibold text-[#1653cc]">
              Tracking events
            </span>
          </nav>
          <h1 className="mb-2 font-headline text-2xl font-bold text-[#181b25]">
            Shipment{" "}
            <span className="rounded bg-[#dbe1ff] px-2 py-0.5 font-mono text-lg font-medium text-[#1653cc]">
              #{ref || "…"}
            </span>{" "}
            — Tracking Events
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#737685]">
            <span className="flex items-center gap-1.5">
              <MaterialIcon name="sync" className="text-sm text-[#006b2d]" />
              Last synced {lastSynced}
            </span>
            <span className="h-1 w-1 rounded-full bg-[#c3c6d6]" />
            <span className="flex items-center gap-1.5">
              <MaterialIcon name="local_shipping" className="text-sm" />
              Carrier: {entity?.carrier ?? "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
          >
            <MaterialIcon name="add" className="text-xl text-white" />
            <span>+ Add manual event</span>
          </button>
          <PageActionsMenu
            items={[refreshDataMenuItem(queryClient, ["admin-shipment-tracking", shipmentId])]}
          />
        </div>
      </header>

      <p className="mb-6 text-sm">
        <Link className="text-[#1653cc] hover:underline" to={`/admin/shipments/${shipmentId}`}>
          ← Shipment detail
        </Link>
      </p>

      {err ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#c3c6d6]/10 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-[#c3c6d6]/20 bg-[#f2f3ff] px-6 py-4 sm:flex-row sm:items-center">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#737685]">Operational timeline</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md bg-[#e0e2f0] px-3 py-1 text-xs font-medium text-[#5b5e68] transition-colors hover:bg-[#d8d9e7]"
              >
                Filter
              </button>
              <button
                type="button"
                onClick={() => entity && exportEventsCsv(ref, sortedAsc)}
                disabled={sortedAsc.length === 0}
                className="rounded-md bg-[#e0e2f0] px-3 py-1 text-xs font-medium text-[#5b5e68] transition-colors hover:bg-[#d8d9e7] disabled:opacity-40"
              >
                Export logs
              </button>
            </div>
          </div>

          <div className="p-8">
            {sortedDesc.length === 0 ? (
              <p className="text-center text-sm text-[#737685]">No tracking events yet. Add a manual event to start.</p>
            ) : (
              <div className="relative">
                <div className="absolute bottom-0 left-[23px] top-0 w-0.5 bg-[#c3c6d6]/30" />
                <div className="space-y-12">
                  {sortedDesc.map((ev, idx) => {
                    const latest = idx === 0;
                    const manual = isManualSource(ev);
                    const noteText = trackingNote(ev.payload);
                    return (
                      <div key={ev.id} className="group relative flex items-start gap-8">
                        <div
                          className={`z-10 flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-4 ${
                            latest
                              ? "bg-[#3b6de6] text-white ring-[#dbe1ff]"
                              : "bg-[#e0e2f0] text-[#5b5e68] ring-white group-hover:bg-[#b4c5ff]/40"
                          }`}
                        >
                          <MaterialIcon name={timelineIcon(ev, latest)} className="text-xl" />
                        </div>
                        <div
                          className={`min-w-0 flex-1 rounded-xl border p-5 transition-all ${
                            latest
                              ? "border-[#1653cc]/10 bg-[#f2f3ff]/50 hover:border-[#1653cc]/30"
                              : "border-transparent p-4 hover:bg-[#faf8ff]/80"
                          }`}
                        >
                          <div className="mb-3 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="font-mono text-sm font-bold text-[#1653cc]">{eventCode(ev)}</span>
                              <span className="h-1 w-1 rounded-full bg-[#c3c6d6]" />
                              <span
                                className={`font-headline font-semibold text-[#181b25] ${latest ? "text-lg" : "text-base"}`}
                              >
                                {ev.statusLabel}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <span
                                className={`rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight ${
                                  manual
                                    ? "border-[#c3c6d6]/30 bg-[#e0e2f0] text-[#444650]"
                                    : "border-[#1653cc]/20 bg-[#dbe1ff] text-[#003ea7]"
                                }`}
                              >
                                {manual ? "Manual entry" : "Carrier API"}
                              </span>
                              <span className="font-mono text-sm text-[#737685]">{formatWhen(ev.occurredAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[#434654]">
                            <MaterialIcon name="location_on" className="text-base" />
                            <span className="font-medium">{ev.location?.trim() || "—"}</span>
                          </div>
                          {noteText ? (
                            <p className="mt-3 text-sm leading-relaxed text-[#5b5e68]">{noteText}</p>
                          ) : null}
                          {manual && !noteText ? (
                            <p className="mt-3 text-sm italic text-[#5b5e68]">Operator-submitted timeline entry</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 border-t border-[#c3c6d6]/20 bg-white lg:grid-cols-3">
            <div className="border-b border-[#c3c6d6]/20 p-6 lg:border-b-0 lg:border-r">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#737685]">Origin summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs text-[#5b5e68]">Sender</span>
                  <span className="text-xs font-semibold text-[#181b25]">{entity?.carrier ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#5b5e68]">Pickup date</span>
                  <span className="text-xs font-mono">{routeMeta.originDate ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#5b5e68]">Service level</span>
                  <span className="text-xs font-semibold text-[#1653cc]">Standard</span>
                </div>
              </div>
            </div>
            <div className="relative col-span-1 min-h-[160px] overflow-hidden bg-[#faf8ff] lg:col-span-2">
              <div
                className="pointer-events-none absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #1653cc 0%, transparent 45%), linear-gradient(225deg, #006b2d 0%, transparent 40%)"
                }}
              />
              <div className="absolute inset-0 flex flex-col justify-center p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex flex-col items-center">
                    <div className="mb-1 h-2 w-2 rounded-full bg-[#1653cc]" />
                    <span className="text-[10px] font-mono font-bold text-[#5b5e68]">{routeMeta.origin}</span>
                  </div>
                  <div className="relative mx-4 flex-1 border-t-2 border-dashed border-[#c3c6d6]/30">
                    <MaterialIcon
                      name="local_shipping"
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl text-[#1653cc]"
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="mb-1 h-2 w-2 rounded-full bg-[#006b2d]" />
                    <span className="text-[10px] font-mono font-bold text-[#5b5e68]">{routeMeta.dest}</span>
                  </div>
                </div>
                <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-[#737685]">
                  Transit route progress:{" "}
                  {sortedAsc.length <= 1 ? "—" : entity?.status === "DELIVERED" ? "100% complete" : "In progress"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-tracking-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 id="add-tracking-title" className="font-headline text-lg font-bold text-[#181b25]">
              Add manual event
            </h2>
            <p className="mt-1 text-xs text-[#737685]">Creates a timeline entry visible on this shipment and detail.</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wide text-[#737685]">
                Status label *
                <input
                  value={statusLabel}
                  onChange={(ev) => setStatusLabel(ev.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. Arrived at regional hub"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#737685]">
                Event type (optional)
                <input
                  value={eventType}
                  onChange={(ev) => setEventType(ev.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Defaults to MANUAL"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#737685]">
                Location
                <input
                  value={location}
                  onChange={(ev) => setLocation(ev.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="City, region"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#737685]">
                Note
                <textarea
                  value={note}
                  onChange={(ev) => setNote(ev.target.value)}
                  className="mt-1 min-h-[80px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Internal or customer-facing note for this tracking update"
                />
              </label>
            </div>
            {addErr ? <p className="mt-3 text-sm text-red-600">{addErr}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addMut.isPending}
                onClick={() => addMut.mutate()}
                className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {addMut.isPending ? "Saving…" : "Save event"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
