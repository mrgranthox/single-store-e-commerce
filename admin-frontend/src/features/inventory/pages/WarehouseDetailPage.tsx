import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Download, Package, Truck } from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getAdminWarehouseDetail, type InventoryMovementRow } from "@/features/inventory/api/admin-inventory.api";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { InventorySubNav } from "@/features/inventory/components/InventorySubNav";

const movementTypeShort = (t: string) => t.replace(/_/g, " ");

const movementRefLabel = (m: InventoryMovementRow) => {
  if (m.orderId) return `ORD-${m.orderId.slice(0, 8)}`;
  if (m.returnId) return `RET-${m.returnId.slice(0, 8)}`;
  if (m.paymentId) return `PAY-${m.paymentId.slice(0, 8)}`;
  if (m.reservationId) return `RSV-${m.reservationId.slice(0, 8)}`;
  const r = m.reason?.trim();
  if (r) return r.length > 20 ? `${r.slice(0, 20)}…` : r;
  return `MOV-${m.id.slice(0, 8)}`;
};

const contactLinesFromMetadata = (metadata: unknown): string[] => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const root = metadata as Record<string, unknown>;
  const c = root.contact;
  if (!c || typeof c !== "object" || Array.isArray(c)) {
    return [];
  }
  const contact = c as Record<string, unknown>;
  const out: string[] = [];
  if (typeof contact.name === "string" && contact.name.trim()) {
    out.push(contact.name.trim());
  }
  if (typeof contact.email === "string" && contact.email.trim()) {
    out.push(contact.email.trim());
  }
  if (typeof contact.phone === "string" && contact.phone.trim()) {
    out.push(contact.phone.trim());
  }
  return out;
};

const opStatusLabel = (raw?: string) => {
  const s = (raw ?? "ACTIVE").toUpperCase();
  if (s === "MAINTENANCE") return { label: "Maintenance", dot: "bg-amber-500" };
  if (s === "OFFLINE") return { label: "Offline", dot: "bg-slate-500" };
  return { label: "Active", dot: "bg-emerald-500" };
};

const formatShipmentStatus = (raw: string) =>
  raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const WarehouseDetailPage = () => {
  const { warehouseId } = useParams<{ warehouseId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-warehouse-detail", warehouseId],
    queryFn: async () => {
      if (!accessToken || !warehouseId) {
        throw new Error("Missing context.");
      }
      return getAdminWarehouseDetail(accessToken, warehouseId);
    },
    enabled: Boolean(accessToken && warehouseId)
  });

  const e = q.data?.data.entity;
  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  if (!warehouseId) {
    return <p className="text-sm text-[var(--color-text-muted)]">Missing warehouse id.</p>;
  }

  const summary = e?.summary;
  const totalLines = summary?.inventoryItemCount ?? 0;
  const low = summary?.lowStockCount ?? 0;
  const out = summary?.outOfStockCount ?? 0;
  const healthy = Math.max(0, totalLines - low - out);
  const pctHealthy = totalLines > 0 ? (healthy / totalLines) * 100 : 0;
  const pctLow = totalLines > 0 ? (low / totalLines) * 100 : 0;
  const pctOut = totalLines > 0 ? (out / totalLines) * 100 : 0;
  const pH = Math.round(pctHealthy * 100) / 100;
  const pL = Math.round(pctLow * 100) / 100;
  const pO = Math.round(pctOut * 100) / 100;
  const donutStyle =
    totalLines > 0
      ? {
          background: `conic-gradient(rgb(5 150 105) 0% ${pH}%, rgb(245 158 11) ${pH}% ${pH + pL}%, rgb(239 68 68) ${
            pH + pL
          }% 100%)`
        }
      : { background: "conic-gradient(rgb(226 232 240) 0% 100%)" };

  const exportWarehouseCsv = () => {
    if (!e || !summary) return;
    const stockRows = e.stockHealth?.items ?? [];
    const header = [
      "sku",
      "product",
      "on_hand",
      "reserved",
      "available",
      "reorder",
      "low_stock",
      "out_of_stock"
    ];
    const lines = [
      header.join(","),
      ...stockRows.map((r) =>
        [
          r.variant.sku,
          `"${r.variant.product.title.replace(/"/g, '""')}"`,
          r.stock.onHand,
          r.stock.reserved,
          r.stock.available,
          r.stock.effectiveReorderLevel,
          r.health?.lowStock ? "1" : "0",
          r.health?.outOfStock ? "1" : "0"
        ].join(",")
      )
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `warehouse-${e.code}-stock.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const contactLines = e ? contactLinesFromMetadata(e.metadata) : [];

  const linkedShipmentSlice = e?.linkedShipments.slice(0, 25) ?? [];
  const linkedShipmentRows = linkedShipmentSlice.map((s) => [
    <Link
      key={`o-${s.id}`}
      to={`/admin/orders/${s.orderId}`}
      className="font-mono text-xs font-semibold text-[#1653cc] hover:underline"
    >
      ORD-{s.orderId.slice(0, 8)}
    </Link>,
    <span key={`st-${s.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-slate-700">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {formatShipmentStatus(s.status)}
    </span>,
    <span key={`c-${s.id}`} className="text-[13px] text-slate-600">
      {s.carrier?.trim() ? s.carrier : "—"}
    </span>,
    <span key={`tr-${s.id}`} className="font-mono text-xs text-slate-600">
      {s.trackingNumber?.trim() ? s.trackingNumber : "—"}
    </span>,
    <span key={`u-${s.id}`} className="text-xs text-slate-500">
      {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(s.updatedAt))}
    </span>
  ]);

  const movementRows =
    e?.recentMovements.slice(0, 10).map((m) => [
      <span key={`id-${m.id}`} className="font-mono text-xs text-[#1653cc]">
        {movementRefLabel(m)}
      </span>,
      <span key={`ty-${m.id}`} className="flex items-center gap-2 text-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-[#1653cc]" />
        {movementTypeShort(m.movementType)}
      </span>,
      <span key={`sk-${m.id}`} className="font-mono text-xs">
        {m.variant.sku}
      </span>,
      <span key={`qt-${m.id}`} className={`font-mono font-medium ${m.deltaOnHand < 0 ? "text-red-600" : ""}`}>
        {m.deltaOnHand > 0 ? `+${m.deltaOnHand}` : m.deltaOnHand}
      </span>,
      <span key={`ts-${m.id}`} className="text-xs text-slate-500">
        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(m.createdAt))}
      </span>
    ]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={e ? `${e.name} [${e.code}]` : "Warehouse"}
        titleSize="screen"
        description="Facility summary, stock health, and recent movements."
        breadcrumbItems={
          e
            ? [
                { label: "Inventory", to: "/admin/inventory/overview" },
                { label: "Warehouses", to: "/admin/inventory/warehouses" },
                { label: e.name }
              ]
            : undefined
        }
        actions={
          e && summary ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportWarehouseCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export stock CSV
              </button>
              <Link
                to="/admin/orders/fulfillment-queue"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2 text-sm font-semibold text-white shadow-lg"
              >
                <Truck className="h-4 w-4" />
                New shipment
              </Link>
            </div>
          ) : null
        }
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-warehouse-detail", warehouseId])]}
      />

      <InventorySubNav warehouseId={warehouseId} />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : e && summary ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 space-y-6 lg:col-span-8">
            <section className="rounded-xl border-l-4 border-[#1653cc] bg-white p-6 shadow-card ring-1 ring-slate-200">
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Facility code</p>
                  <p className="mt-1 font-mono text-sm font-semibold">{e.code}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                  <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                    <span className={`h-1.5 w-1.5 rounded-full ${opStatusLabel(e.operationalStatus).dot}`} />
                    {opStatusLabel(e.operationalStatus).label}
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {e.locationLabel?.trim() ? e.locationLabel : "No address in warehouse metadata."}
                  </p>
                  {contactLines.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                      {contactLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="col-span-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last updated</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(
                      new Date(e.updatedAt)
                    )}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <section className="rounded-xl bg-white p-6 shadow-card ring-1 ring-slate-200">
                <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-slate-500">Stock health</h3>
                <div className="flex items-center gap-8">
                  <div
                    className="relative h-32 w-32 shrink-0 rounded-full shadow-inner ring-4 ring-white"
                    style={donutStyle}
                  >
                    <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white">
                      <span className="font-mono text-lg font-bold">{pH.toFixed(1)}%</span>
                      <span className="text-[9px] uppercase text-slate-400">Healthy</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm bg-emerald-600" />
                      Healthy ({pH.toFixed(1)}% · {healthy} lines)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm bg-amber-500" />
                      Low stock ({pL.toFixed(1)}% · {low} lines)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm bg-red-500" />
                      Critical ({pO.toFixed(1)}% · {out} lines)
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl bg-white p-6 shadow-card ring-1 ring-slate-200">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-slate-500">Shipments</h3>
                <p className="font-headline text-2xl font-bold">{summary.shipmentCount}</p>
                <p className="mt-1 text-xs text-slate-500">Linked shipments for this warehouse.</p>
              </section>
            </div>

            <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f8f9fb] px-6 py-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Recent movements</h3>
                <Link to="/admin/inventory/movements" className="text-xs font-semibold text-[#1653cc] hover:underline">
                  View all history
                </Link>
              </div>
              <DataTableShell
                embedded
                variant="stitchOperational"
                columns={["Reference", "Type", "SKU", "Qty", "Timestamp"]}
                rows={movementRows}
                rowKeys={e.recentMovements.slice(0, 10).map((m) => m.id)}
                emptyState="No recent movements."
              />
            </section>
          </div>

          <div className="col-span-12 space-y-6 lg:col-span-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total SKUs</p>
                <p className="mt-1 font-headline text-2xl font-bold">{summary.inventoryItemCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total units</p>
                <p className="mt-1 font-headline text-2xl font-bold">{summary.totals.onHand.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Reserved</p>
                <p className="mt-1 font-headline text-2xl font-bold">{summary.totals.reserved.toLocaleString()}</p>
                <p className="mt-2 text-[10px] font-medium text-slate-500">Locked in orders</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-700">Low stock</p>
                <p className="mt-1 font-headline text-2xl font-bold text-red-700">{summary.lowStockCount}</p>
                <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-700">
                  Action required
                </p>
              </div>
            </div>

            <section className="rounded-xl bg-[#f2f3ff] p-1 ring-1 ring-slate-200/80">
              <div className="space-y-2 rounded-lg bg-white p-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Operations</h3>
                <Link
                  to={`/admin/inventory/warehouses/${warehouseId}/inventory`}
                  className="flex items-center justify-between rounded-lg border border-transparent p-3 hover:border-slate-200 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1653cc]/10 text-[#1653cc]">
                      <Package className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold">View inventory</span>
                  </div>
                </Link>
                <Link
                  to="/admin/inventory/movements"
                  className="flex items-center justify-between rounded-lg border border-transparent p-3 hover:border-slate-200 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Truck className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold">View movements</span>
                  </div>
                </Link>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e7eb] bg-[#f8f9fb] px-6 py-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Linked shipments</h3>
                <span className="text-xs font-medium text-slate-500">{e.linkedShipments.length} total</span>
              </div>
              {e.linkedShipments.length > 25 ? (
                <p className="border-b border-[#f1f3f9] px-6 py-2 text-xs text-slate-500">
                  Showing the 25 most recent shipment records.
                </p>
              ) : null}
              <DataTableShell
                embedded
                variant="stitchOperational"
                columns={["Order", "Status", "Carrier", "Tracking", "Last update"]}
                rows={linkedShipmentRows}
                rowKeys={linkedShipmentSlice.map((s) => s.id)}
                emptyState="No shipments linked to this warehouse yet."
              />
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
};
