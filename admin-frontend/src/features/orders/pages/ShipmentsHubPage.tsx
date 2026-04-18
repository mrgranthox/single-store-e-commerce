import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreVertical,
  Package,
  PlayCircle,
  Upload
} from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { BulkActionBar } from "@/components/primitives/BulkActionBar";
import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { StitchOperationalTableSkeleton } from "@/components/primitives/StitchOperationalTableSkeleton";
import { StitchFilterPanel, StitchFieldLabel, StitchKpiMicro, DisabledTooltipWrapper } from "@/components/stitch";
import { preloadLazyNamedComponent } from "@/app/lazy-admin-routes";
import {
  bulkUpdateAdminShipmentStatus,
  listAdminShipments
} from "@/features/orders/api/admin-shipments.api";
import { getAdminShipmentDetail } from "@/features/orders/api/admin-orders.api";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { useAdminAction } from "@/lib/admin-actions/useAdminAction";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";
import { useAdminDetailPrefetch } from "@/lib/performance/useAdminDetailPrefetch";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { useListFilters } from "@/lib/hooks/useListFilters";
import { formatDateCompact, formatCount, humanize } from "@/lib/format";
import { shipmentKeys } from "@/lib/query-keys";
import { CACHE } from "@/lib/api/cache-strategy";
import { ApiError } from "@/lib/api/http";

const shipmentDetailQueryKey = (shipmentId: string) => ["admin-shipment-detail", shipmentId] as const;

const SHIPMENT_STATUSES = ["", "CREATED", "PACKING", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as const;

const BULK_TARGET_STATUSES = [
  "CREATED",
  "PACKING",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED"
] as const;

const SHIPMENT_FILTERS_DEFAULTS = { q: "", status: "" } as const;

const isSameLocalDay = (iso: string, day: Date) => {
  try {
    const d = new Date(iso);
    return (
      d.getFullYear() === day.getFullYear() &&
      d.getMonth() === day.getMonth() &&
      d.getDate() === day.getDate()
    );
  } catch {
    return false;
  }
};

const shipmentStatusTone = (status: string): StatusBadgeTone => {
  const u = status.toUpperCase();
  if (u === "DELIVERED") return "active";
  if (u === "CANCELLED") return "danger";
  if (u === "IN_TRANSIT" || u === "DISPATCHED") return "info";
  if (u === "PACKING") return "pending";
  return "draft";
};

const orderStatusTone = (status: string): StatusBadgeTone => {
  const u = status.toUpperCase();
  if (u === "COMPLETED" || u === "CLOSED") return "success";
  if (u === "CANCELLED") return "danger";
  return "info";
};

const shortId = (id: string) => `${id.slice(0, 8)}…`;

export const ShipmentsHubPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions ?? []);
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<string>("PACKING");
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  const canBulkMutate = adminHasAnyPermission(actorPermissions, ["orders.override_fulfillment"]);

  const { filters, page, setPage, set, reset } = useListFilters({
    defaults: SHIPMENT_FILTERS_DEFAULTS
  });

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  const shipmentsQuery = useAuthedQuery(
    shipmentKeys.list({ page, ...filters }),
    (token) =>
      listAdminShipments(token, {
        page,
        page_size: 20,
        ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
        ...(filters.status ? { status: filters.status } : {})
      })
  );

  const { prefetch: prefetchShipmentDetail, prefetchMany: prefetchShipmentDetails } = useAdminDetailPrefetch({
    enabled: Boolean(accessToken),
    ...CACHE.OPERATIONAL,
    queryKeyFor: (shipmentId: string) => shipmentDetailQueryKey(shipmentId),
    queryFnFor: (shipmentId: string) => getAdminShipmentDetail(accessToken!, shipmentId),
    onPrefetch: () =>
      preloadLazyNamedComponent("../features/orders/pages/ShipmentDetailPage.tsx", "ShipmentDetailPage")
  });

  const items = shipmentsQuery.data?.data.items ?? [];
  const meta = shipmentsQuery.data?.meta;

  useEffect(() => {
    prefetchShipmentDetails(items.map((s) => s.id), 2);
  }, [items, prefetchShipmentDetails]);

  const bulkMutation = useAdminAction({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return bulkUpdateAdminShipmentStatus(accessToken, {
        shipmentIds: [...selected],
        shipmentStatus: bulkTargetStatus,
        note: "bulk_shipment_status"
      });
    },
    invalidate: [shipmentKeys.lists()],
    onSuccess: (result) => {
      const { succeeded, failed, total } = result.data;
      const failedRows = result.data.results.filter((r): r is { shipmentId: string; ok: false; error: string } => !r.ok);
      const sample =
        failedRows.length > 0
          ? ` Examples: ${failedRows
              .slice(0, 3)
              .map((r) => `${r.shipmentId.slice(0, 8)}… (${r.error})`)
              .join("; ")}`
          : "";
      setBulkSummary(`Bulk status: ${succeeded} of ${total} succeeded${failed > 0 ? `, ${failed} failed.${sample}` : "."}`);
      setSelected(new Set());
    },
    onError: (error) => {
      setBulkSummary(error instanceof ApiError ? error.message : "Bulk update failed.");
    }
  });

  const applySearch = () => {
    set("q", searchDraft.trim());
    setSelected(new Set());
  };

  const clearFilters = () => {
    setSearchDraft("");
    reset();
    setSelected(new Set());
  };

  const shipmentsError = shipmentsQuery.error;
  const errorMessage =
    shipmentsError instanceof ApiError
      ? shipmentsError.message
      : shipmentsError instanceof Error
        ? shipmentsError.message
        : null;

  const today = useMemo(() => new Date(), []);

  const kpi = useMemo(() => {
    const todayShipments = items.filter((s) => isSameLocalDay(s.createdAt, today)).length;
    const inMotion = items.filter((s) => {
      const u = s.status.toUpperCase();
      return u === "DISPATCHED" || u === "IN_TRANSIT";
    }).length;
    const packing = items.filter((s) => s.status.toUpperCase() === "PACKING").length;
    const delivered = items.filter((s) => s.status.toUpperCase() === "DELIVERED").length;
    return { todayShipments, inMotion, packing, delivered };
  }, [items, today]);

  const allPageSelected = items.length > 0 && items.every((s) => selected.has(s.id));

  const toggleAll = () => {
    if (allPageSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((s) => s.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    const subset = items.filter((s) => (selected.size ? selected.has(s.id) : true));
    const header = [
      "shipment_id",
      "order_number",
      "order_status",
      "warehouse_code",
      "shipment_status",
      "tracking",
      "carrier",
      "created_at"
    ];
    const lines = [
      header.join(","),
      ...subset.map((s) =>
        [
          s.id,
          s.orderNumber,
          s.orderStatus,
          s.warehouse.code,
          s.status,
          s.trackingNumber ?? "",
          s.carrier ?? "",
          s.createdAt
        ].join(",")
      )
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipments-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const from = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.totalItems) : 0;

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="mb-3 h-10 w-10 text-[#c3c6d6]" />
      <p className="text-sm font-semibold text-[#181b25]">No shipments found</p>
      <p className="mt-1 max-w-sm text-xs text-[#737685]">
        Adjust filters or search terms to widen the operational view.
      </p>
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Shipments"
        titleSize="deck"
        description="Central list of all shipments with search and status filters."
        actionMenuItems={[refreshDataMenuItem(queryClient, shipmentKeys.lists())]}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
          <StitchKpiMicro
            label="Today's shipments"
            value={kpi.todayShipments}
            footer="On this page"
            barClass="bg-[#1653cc]"
          />
          <StitchKpiMicro
            label="In motion"
            value={kpi.inMotion}
            footer="On this page"
            barClass="bg-indigo-500"
          />
          <StitchKpiMicro
            label="Packing"
            value={kpi.packing}
            footer="On this page"
            barClass="bg-amber-500"
          />
          <StitchKpiMicro
            label="Delivered"
            value={kpi.delivered}
            footer="On this page"
            barClass="bg-emerald-600"
          />
        </div>
        {meta ? (
          <div className="shrink-0 rounded-xl border border-[#e0e2f0] bg-[#f2f3ff] px-4 py-3 text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-[#737685]">Total matched</p>
            <p className="font-headline text-2xl font-bold text-[#181b25]">{formatCount(meta.totalItems)}</p>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-[#737685]">
        KPI counts use the current page. Total matched counts all shipments across pages.
      </p>

      <StitchFilterPanel>
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <StitchFieldLabel>Search</StitchFieldLabel>
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="Order #, tracking, or shipment id…"
              className="w-full rounded-lg border-none bg-[#f2f3ff] py-2.5 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
            />
          </div>
          <div>
            <StitchFieldLabel>Shipment status</StitchFieldLabel>
            <select
              value={filters.status}
              onChange={(e) => set("status", e.target.value)}
              className="w-full rounded-lg border-none bg-[#f2f3ff] py-2.5 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
            >
              {SHIPMENT_STATUSES.map((s) => (
                <option key={s || "all"} value={s}>
                  {s ? humanize(s) : "All statuses"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 lg:col-span-2">
            <button
              type="button"
              onClick={applySearch}
              className="h-10 flex-1 rounded-lg bg-[#1653cc] text-xs font-semibold text-white transition-all hover:brightness-110"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e6e7f6] text-[#737685] transition-all hover:bg-[#e0e2f0]"
              title="Clear filters"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>
      </StitchFilterPanel>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMessage}
          {shipmentsError instanceof ApiError && shipmentsError.statusCode === 403 ? (
            <span className="mt-1 block text-xs">Your role may need the orders.read permission.</span>
          ) : null}
        </div>
      ) : null}

      {bulkSummary ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            bulkSummary.includes("failed")
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-emerald-200 bg-emerald-50 text-emerald-950"
          }`}
          role="status"
        >
          {bulkSummary}
        </div>
      ) : null}

      {shipmentsQuery.isLoading ? (
        <StitchOperationalTableSkeleton rowCount={10} columnCount={10} />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e6e7f6] px-6 py-4">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-[#737685] text-[#1653cc] focus:ring-[#1653cc]/20"
                aria-label="Select all on page"
              />
              <span className="text-xs font-medium text-[#434654]">
                {selected.size > 0
                  ? `${selected.size} shipment${selected.size === 1 ? "" : "s"} selected`
                  : `${items.length} on this page`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={exportCsv}
                className="flex items-center gap-2 rounded-lg bg-[#f2f3ff] px-4 py-2 text-xs font-semibold text-[#181b25] transition-all hover:bg-[#e6e7f6]"
              >
                <Upload className="h-4 w-4" />
                Export
              </button>
              {!canBulkMutate ? (
                <DisabledTooltipWrapper reason="Requires orders.override_fulfillment permission.">
                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-2 rounded-lg bg-[#f2f3ff] px-4 py-2 text-xs font-semibold text-[#181b25] opacity-50"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Set status…
                  </button>
                </DisabledTooltipWrapper>
              ) : (
                <button
                  type="button"
                  disabled={selected.size === 0 || bulkMutation.isPending}
                  onClick={() => {
                    setBulkSummary(null);
                    setBulkDialogOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bg-[#1653cc]/10 px-4 py-2 text-xs font-semibold text-[#1653cc] transition-all hover:bg-[#1653cc]/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlayCircle className="h-4 w-4" />
                  Set status…
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {items.length === 0 ? (
              emptyState
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f8f9fb]">
                    <th className="w-10 px-6 h-11" />
                    <th className="px-4 h-11 text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Shipment
                    </th>
                    <th className="px-4 h-11 text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Order #
                    </th>
                    <th className="px-4 h-11 text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Warehouse
                    </th>
                    <th className="px-4 h-11 text-center text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Shipment status
                    </th>
                    <th className="px-4 h-11 text-center text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Order status
                    </th>
                    <th className="px-4 h-11 text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Tracking
                    </th>
                    <th className="px-4 h-11 text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Carrier
                    </th>
                    <th className="px-4 h-11 text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Created
                    </th>
                    <th className="px-6 h-11 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[#f1f3f9] transition-colors hover:bg-[#f8f9fb]"
                      onMouseEnter={() => prefetchShipmentDetail(row.id)}
                    >
                      <td className="px-6 h-[52px] align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          className="h-4 w-4 rounded border-[#737685] text-[#1653cc] focus:ring-[#1653cc]/20"
                          aria-label={`Select shipment ${row.id.slice(0, 8)}`}
                        />
                      </td>
                      <td className="px-4 h-[52px] align-middle">
                        <Link
                          to={`/admin/shipments/${row.id}`}
                          className="font-mono text-xs font-medium text-[#1653cc] hover:underline"
                          title={row.id}
                        >
                          {shortId(row.id)}
                        </Link>
                      </td>
                      <td className="px-4 h-[52px] align-middle">
                        <Link
                          to={`/admin/orders/${row.orderId}`}
                          className="font-mono text-xs font-medium text-[#1653cc] hover:underline"
                        >
                          #{row.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 h-[52px] align-middle">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#181b25]">{row.warehouse.name}</span>
                          <span className="text-xs text-[#434654]">{row.warehouse.code}</span>
                        </div>
                      </td>
                      <td className="px-4 h-[52px] align-middle text-center">
                        <StatusBadge label={humanize(row.status)} tone={shipmentStatusTone(row.status)} />
                      </td>
                      <td className="px-4 h-[52px] align-middle text-center">
                        <StatusBadge label={humanize(row.orderStatus)} tone={orderStatusTone(row.orderStatus)} />
                      </td>
                      <td className="px-4 h-[52px] align-middle font-mono text-xs text-[#181b25]">
                        {row.trackingNumber ?? "—"}
                      </td>
                      <td className="px-4 h-[52px] align-middle text-xs text-[#434654]">{row.carrier ?? "—"}</td>
                      <td className="px-4 h-[52px] align-middle text-xs text-[#434654]">
                        {formatDateCompact(row.createdAt)}
                      </td>
                      <td className="px-6 h-[52px] align-middle text-right">
                        <Link
                          to={`/admin/shipments/${row.id}`}
                          className="inline-flex text-[#737685] hover:text-[#1653cc]"
                          aria-label="Open shipment"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <BulkActionBar count={selected.size} className="mx-4 mb-4 mt-2">
            <span className="text-xs font-semibold text-[#434654]">
              {selected.size} shipment{selected.size === 1 ? "" : "s"} selected
            </span>
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#181b25] shadow-sm hover:bg-[#f2f3ff]"
            >
              <Upload className="h-3.5 w-3.5" />
              Export selected
            </button>
          </BulkActionBar>

          {meta ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e7f6] bg-[#f8f9fb] px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#737685]">
                Showing {from}–{to} of {formatCount(meta.totalItems)} shipments
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(Math.max(1, page - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded bg-white text-[#737685] shadow-sm transition-all hover:text-[#1653cc] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="flex h-8 min-w-[2rem] items-center justify-center rounded bg-[#1653cc] px-2 text-xs font-bold text-white shadow-sm">
                  {meta.page}
                </span>
                <button
                  type="button"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded bg-white text-[#737685] shadow-sm transition-all hover:text-[#1653cc] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={bulkDialogOpen}
        title="Set shipment status for selection?"
        body={
          <div className="space-y-3 text-sm text-[#434654]">
            <p>
              This runs for {selected.size} shipment{selected.size === 1 ? "" : "s"}. Each row is validated
              server-side; ineligible rows fail without changing others.
            </p>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#737685]">
              Target status
              <select
                value={bulkTargetStatus}
                onChange={(ev) => setBulkTargetStatus(ev.target.value)}
                className="mt-2 w-full rounded-lg border border-[#e0e2f0] bg-white px-3 py-2 text-sm text-[#181b25]"
              >
                {BULK_TARGET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        impactSummary="Uses the same rules as single-shipment updates (state machine and inventory)."
        confirmLabel={bulkMutation.isPending ? "Working…" : "Confirm"}
        confirmDisabled={bulkMutation.isPending || selected.size === 0}
        onClose={() => setBulkDialogOpen(false)}
        onConfirm={() => {
          setBulkSummary(null);
          bulkMutation.mutate(undefined);
          setBulkDialogOpen(false);
        }}
      />
    </div>
  );
};
