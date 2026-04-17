import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreVertical,
  Package,
  PlayCircle,
  Upload,
  Warehouse
} from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { BulkActionBar } from "@/components/primitives/BulkActionBar";
import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { StitchOperationalTableSkeleton } from "@/components/primitives/StitchOperationalTableSkeleton";
import { StitchFilterPanel, StitchFieldLabel, StitchKpiMicro, DisabledTooltipWrapper } from "@/components/stitch";
import { preloadLazyNamedComponent } from "@/app/lazy-admin-routes";
import {
  ApiError,
  bulkUpdateAdminOrderStatus,
  getAdminOrderDetail,
  listAdminOrders,
  type AdminOrderListItem,
  type BulkOrderStatus
} from "@/features/orders/api/admin-orders.api";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { useAdminAction } from "@/lib/admin-actions/useAdminAction";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";
import { useAdminDetailPrefetch } from "@/lib/performance/useAdminDetailPrefetch";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { useListFilters } from "@/lib/hooks/useListFilters";
import { formatMoney, formatDateCompact, formatCount, humanize } from "@/lib/format";
import { orderKeys } from "@/lib/query-keys";
import { CACHE } from "@/lib/api/cache-strategy";

const ORDER_STATUSES = [
  "",
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "CLOSED"
] as const;

const PAYMENT_STATES = [
  { value: "", label: "All statuses" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING_INITIALIZATION", label: "Pending" },
  { value: "AWAITING_CUSTOMER_ACTION", label: "Awaiting customer" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" }
] as const;

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

const paymentTone = (paymentState: string): StatusBadgeTone => {
  const u = paymentState.toUpperCase();
  if (u === "PAID") return "active";
  if (u === "FAILED" || u === "CANCELLED") return "danger";
  if (u.includes("REFUND")) return "neutral";
  return "pending";
};

const fulfillmentTone = (order: AdminOrderListItem): StatusBadgeTone => {
  const st = (order.fulfillment?.status ?? "UNFULFILLED").toUpperCase();
  if (st === "DELIVERED") return "active";
  if (st === "UNFULFILLED") return "pending";
  if (st === "IN_TRANSIT" || st === "DISPATCHED") return "info";
  return "draft";
};

const orderStatusTone = (status: string): StatusBadgeTone => {
  const u = status.toUpperCase();
  if (u === "COMPLETED" || u === "CLOSED") return "success";
  if (u === "CANCELLED") return "danger";
  return "info";
};

const ORDER_FILTERS_DEFAULTS = { q: "", status: "", paymentState: "" } as const;

export const OrdersListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions ?? []);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<BulkOrderStatus>("PROCESSING");
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);
  const [orderDraft, setOrderDraft] = useState("");
  const [customerDraft, setCustomerDraft] = useState("");

  const { filters, page, setPage, set, reset } = useListFilters({
    defaults: ORDER_FILTERS_DEFAULTS
  });

  const ordersQuery = useAuthedQuery(
    orderKeys.list({ page, ...filters }),
    (token) =>
      listAdminOrders(token, {
        page,
        page_size: 20,
        ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.paymentState ? { paymentState: filters.paymentState } : {})
      })
  );

  const { prefetch: prefetchOrderDetail, prefetchMany: prefetchOrderDetails } = useAdminDetailPrefetch({
    enabled: Boolean(accessToken),
    ...CACHE.OPERATIONAL,
    queryKeyFor: (orderId: string) => orderKeys.detail(orderId),
    queryFnFor: (orderId: string) => getAdminOrderDetail(accessToken!, orderId),
    onPrefetch: () => preloadLazyNamedComponent("../features/orders/pages/OrderDetailPage.tsx", "OrderDetailPage")
  });

  const items = ordersQuery.data?.data.items ?? [];
  const meta = ordersQuery.data?.meta;

  const canBulkUpdate = adminHasAnyPermission(actorPermissions, ["orders.update"]);

  const selectedOrders = useMemo(() => items.filter((o) => selected.has(o.id)), [items, selected]);

  const canBulkSetProcessing =
    canBulkUpdate &&
    selectedOrders.length > 0 &&
    selectedOrders.every((o) => o.status === "CONFIRMED");

  const canBulkMarkComplete =
    canBulkUpdate &&
    selectedOrders.length > 0 &&
    selectedOrders.every((o) => {
      if (["CANCELLED", "COMPLETED", "CLOSED"].includes(o.status)) {
        return false;
      }
      const f = (o.fulfillment?.status ?? "").toUpperCase();
      return f === "DELIVERED";
    });

  const bulkMutation = useAdminAction({
    mutationFn: async (status: BulkOrderStatus) => {
      if (!accessToken) throw new Error("Not signed in.");
      return bulkUpdateAdminOrderStatus(accessToken, {
        orderIds: [...selected],
        status,
        reason: `bulk_${status.toLowerCase()}`
      });
    },
    invalidate: [orderKeys.lists()],
    onSuccess: (result, _variables) => {
      const { succeeded, failed, total } = result.data;
      const failedRows = result.data.results.filter((r): r is { orderId: string; ok: false; error: string } => !r.ok);
      const sample =
        failedRows.length > 0
          ? ` Examples: ${failedRows
              .slice(0, 3)
              .map((r) => `${r.orderId.slice(0, 8)}… (${r.error})`)
              .join("; ")}`
          : "";
      setBulkSummary(`Bulk status: ${succeeded} of ${total} succeeded${failed > 0 ? `, ${failed} failed.${sample}` : "."}`);
      setSelected(new Set());
    },
    onError: (error, _variables) => {
      setBulkSummary(error instanceof ApiError ? error.message : "Bulk update failed.");
    }
  });

  useEffect(() => {
    prefetchOrderDetails(items.map((order) => order.id), 2);
  }, [items, prefetchOrderDetails]);

  const applySearch = () => {
    const parts = [orderDraft.trim(), customerDraft.trim()].filter(Boolean);
    set("q", parts.join(" "));
    setSelected(new Set());
  };

  const clearFilters = () => {
    setOrderDraft("");
    setCustomerDraft("");
    reset();
    setSelected(new Set());
  };

  const errorMessage =
    ordersQuery.error instanceof ApiError
      ? ordersQuery.error.message
      : ordersQuery.error instanceof Error
        ? ordersQuery.error.message
        : null;

  const today = useMemo(() => new Date(), []);

  const kpi = useMemo(() => {
    const todayOrders = items.filter((o) => isSameLocalDay(o.createdAt, today)).length;
    const pendingPay = items.filter((o) => {
      const p = o.paymentState.toUpperCase();
      return p.includes("PENDING") || p === "INITIALIZED" || p === "AWAITING_CUSTOMER_ACTION";
    }).length;
    const unfulfilled = items.filter((o) => {
      const s = (o.fulfillment?.status ?? "UNFULFILLED").toUpperCase();
      return s === "UNFULFILLED" || s === "CREATED" || s === "PACKING";
    }).length;
    const cancelled = items.filter((o) => o.status === "CANCELLED").length;
    return { todayOrders, pendingPay, unfulfilled, cancelled };
  }, [items, today]);

  const allPageSelected = items.length > 0 && items.every((o) => selected.has(o.id));

  const toggleAll = () => {
    if (allPageSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((o) => o.id)));
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
    const subset = items.filter((o) => (selected.size ? selected.has(o.id) : true));
    const header = [
      "order_number", "customer", "email", "items",
      "total_cents", "currency", "payment_state",
      "fulfillment_status", "order_status", "created_at"
    ];
    const lines = [
      header.join(","),
      ...subset.map((o) =>
        [
          o.orderNumber,
          `"${(o.customer.name ?? "").replace(/"/g, '""')}"`,
          o.customer.email ?? "",
          o.itemCount,
          o.totals?.grandTotalCents ?? "",
          o.totals?.currency ?? "",
          o.paymentState,
          o.fulfillment?.status ?? "UNFULFILLED",
          o.status,
          o.createdAt
        ].join(",")
      )
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const from = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.totalItems) : 0;

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="mb-3 h-10 w-10 text-[#c3c6d6]" />
      <p className="text-sm font-semibold text-[#181b25]">No orders found</p>
      <p className="mt-1 max-w-sm text-xs text-[#737685]">
        Adjust filters or search terms to widen the operational view.
      </p>
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Orders"
        titleSize="deck"
        description="Central command for all orders."
        actionMenuItems={[refreshDataMenuItem(queryClient, orderKeys.lists())]}
      />

      {/* KPI strip */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
          <StitchKpiMicro
            label="Today's orders"
            value={kpi.todayOrders}
            footer="On this page"
            barClass="bg-[#1653cc]"
          />
          <StitchKpiMicro
            label="Pending payment"
            value={kpi.pendingPay}
            footer="On this page"
            barClass="bg-amber-500"
          />
          <StitchKpiMicro
            label="Unfulfilled"
            value={kpi.unfulfilled}
            footer="On this page"
            barClass="bg-indigo-500"
          />
          <StitchKpiMicro
            label="Cancelled"
            value={kpi.cancelled}
            footer="On this page"
            barClass="bg-red-600"
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
        KPI counts use the current page. Total matched counts all orders across pages.
      </p>

      {/* Filters */}
      <StitchFilterPanel>
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3 lg:grid-cols-7">
          <div className="lg:col-span-1">
            <StitchFieldLabel>Order #</StitchFieldLabel>
            <input
              value={orderDraft}
              onChange={(e) => setOrderDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="Search ID…"
              className="w-full rounded-lg border-none bg-[#f2f3ff] py-2.5 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
            />
          </div>
          <div className="lg:col-span-1">
            <StitchFieldLabel>Customer</StitchFieldLabel>
            <input
              value={customerDraft}
              onChange={(e) => setCustomerDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="Name or email…"
              className="w-full rounded-lg border-none bg-[#f2f3ff] py-2.5 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
            />
          </div>
          <div>
            <StitchFieldLabel>Payment</StitchFieldLabel>
            <select
              value={filters.paymentState}
              onChange={(e) => set("paymentState", e.target.value)}
              className="w-full rounded-lg border-none bg-[#f2f3ff] py-2.5 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
            >
              {PAYMENT_STATES.map((p) => (
                <option key={p.value || "all"} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <StitchFieldLabel>Fulfillment</StitchFieldLabel>
            <DisabledTooltipWrapper reason="Fulfillment filter uses shipment data; refine with order status or open queues.">
              <select
                disabled
                className="w-full rounded-lg border-none bg-slate-100 py-2.5 text-xs"
                value=""
              >
                <option value="">All statuses</option>
              </select>
            </DisabledTooltipWrapper>
          </div>
          <div>
            <StitchFieldLabel>Order status</StitchFieldLabel>
            <select
              value={filters.status}
              onChange={(e) => set("status", e.target.value)}
              className="w-full rounded-lg border-none bg-[#f2f3ff] py-2.5 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s || "all"} value={s}>
                  {s ? humanize(s) : "All statuses"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <StitchFieldLabel>Date range</StitchFieldLabel>
            <DisabledTooltipWrapper reason="Date range filter is not available on this endpoint.">
              <input
                type="date"
                disabled
                className="w-full rounded-lg border-none bg-slate-100 py-2.5 text-xs"
              />
            </DisabledTooltipWrapper>
          </div>
          <div className="flex items-end gap-2">
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
          {ordersQuery.error instanceof ApiError && ordersQuery.error.statusCode === 403 ? (
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

      {ordersQuery.isLoading ? (
        <StitchOperationalTableSkeleton rowCount={10} columnCount={7} />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {/* Table toolbar */}
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
                  ? `${selected.size} order${selected.size === 1 ? "" : "s"} selected`
                  : "Select orders to act on"}
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
              <DisabledTooltipWrapper reason="Bulk assign warehouse is not enabled from the list view.">
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 rounded-lg bg-[#f2f3ff] px-4 py-2 text-xs font-semibold text-[#181b25]"
                >
                  <Warehouse className="h-4 w-4" />
                  Assign warehouse
                </button>
              </DisabledTooltipWrapper>
              {!canBulkUpdate ? (
                <DisabledTooltipWrapper reason="Requires orders.update permission.">
                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-2 rounded-lg bg-[#f2f3ff] px-4 py-2 text-xs font-semibold text-[#181b25]"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Set processing
                  </button>
                </DisabledTooltipWrapper>
              ) : (
                <button
                  type="button"
                  disabled={!canBulkSetProcessing || bulkMutation.isPending}
                  title={
                    !canBulkSetProcessing && selected.size > 0
                      ? "Every selected order must be CONFIRMED to move to PROCESSING."
                      : undefined
                  }
                  onClick={() => {
                    setBulkTargetStatus("PROCESSING");
                    setBulkDialogOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bg-[#f2f3ff] px-4 py-2 text-xs font-semibold text-[#181b25] transition-all hover:bg-[#e6e7f6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlayCircle className="h-4 w-4" />
                  Set processing
                </button>
              )}
              {!canBulkUpdate ? (
                <DisabledTooltipWrapper reason="Requires orders.update permission.">
                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-2 rounded-lg bg-[#1653cc]/10 px-4 py-2 text-xs font-semibold text-[#1653cc]"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark complete
                  </button>
                </DisabledTooltipWrapper>
              ) : (
                <button
                  type="button"
                  disabled={!canBulkMarkComplete || bulkMutation.isPending}
                  title={
                    !canBulkMarkComplete && selected.size > 0
                      ? "Every selected order must have a delivered shipment (fulfillment shows DELIVERED) and not be terminal."
                      : undefined
                  }
                  onClick={() => {
                    setBulkTargetStatus("COMPLETED");
                    setBulkDialogOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bg-[#1653cc]/10 px-4 py-2 text-xs font-semibold text-[#1653cc] transition-all hover:bg-[#1653cc]/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark complete
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {items.length === 0 ? (
              emptyState
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f8f9fb]">
                    <th className="w-10 px-6 h-11" />
                    <th className="px-4 h-11 text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Order #
                    </th>
                    <th className="px-4 h-11 text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Customer
                    </th>
                    <th className="px-4 h-11 text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Items
                    </th>
                    <th className="px-4 h-11 text-right text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Total
                    </th>
                    <th className="px-4 h-11 text-center text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Payment
                    </th>
                    <th className="px-4 h-11 text-center text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Fulfillment
                    </th>
                    <th className="px-4 h-11 text-center text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Status
                    </th>
                    <th className="px-4 h-11 text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                      Placed
                    </th>
                    <th className="px-6 h-11 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-[#f1f3f9] transition-colors hover:bg-[#f8f9fb]"
                      onMouseEnter={() => prefetchOrderDetail(order.id)}
                    >
                      <td className="px-6 h-[52px] align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(order.id)}
                          onChange={() => toggleRow(order.id)}
                          className="h-4 w-4 rounded border-[#737685] text-[#1653cc] focus:ring-[#1653cc]/20"
                          aria-label={`Select ${order.orderNumber}`}
                        />
                      </td>
                      <td className="px-4 h-[52px] align-middle">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="font-mono text-xs font-medium text-[#1653cc] hover:underline"
                        >
                          #{order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 h-[52px] align-middle">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#181b25]">
                            {order.customer.name ?? order.customer.email ?? (order.customer.guest ? "Guest" : "—")}
                          </span>
                          {order.customer.email ? (
                            <span className="text-xs text-[#434654]">{order.customer.email}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 h-[52px] align-middle text-xs font-medium text-[#181b25]">
                        {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                      </td>
                      <td className="px-4 h-[52px] align-middle text-right font-mono text-xs font-semibold text-[#181b25]">
                        {formatMoney(order.totals?.grandTotalCents, order.totals?.currency)}
                      </td>
                      <td className="px-4 h-[52px] align-middle text-center">
                        <StatusBadge
                          label={humanize(order.paymentState)}
                          tone={paymentTone(order.paymentState)}
                        />
                      </td>
                      <td className="px-4 h-[52px] align-middle text-center">
                        <StatusBadge
                          label={humanize(order.fulfillment?.status ?? "UNFULFILLED")}
                          tone={fulfillmentTone(order)}
                        />
                      </td>
                      <td className="px-4 h-[52px] align-middle text-center">
                        <StatusBadge
                          label={humanize(order.status)}
                          tone={orderStatusTone(order.status)}
                        />
                      </td>
                      <td className="px-4 h-[52px] align-middle text-xs text-[#434654]">
                        {formatDateCompact(order.createdAt)}
                      </td>
                      <td className="px-6 h-[52px] align-middle text-right">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="inline-flex text-[#737685] hover:text-[#1653cc]"
                          aria-label={`Open order ${order.orderNumber}`}
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

          {/* Sticky bulk bar */}
          <BulkActionBar count={selected.size} className="mx-4 mb-4 mt-2">
            <span className="text-xs font-semibold text-[#434654]">
              {selected.size} order{selected.size === 1 ? "" : "s"} selected
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

          {/* Pagination */}
          {meta ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e7f6] bg-[#f8f9fb] px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#737685]">
                Showing {from}–{to} of {formatCount(meta.totalItems)} orders
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
        title={
          bulkTargetStatus === "PROCESSING"
            ? "Set selected orders to processing?"
            : "Mark selected orders complete?"
        }
        body={
          <p className="text-sm text-[#434654]">
            This runs for {selected.size} order{selected.size === 1 ? "" : "s"}. Orders that fail validation stay
            unchanged; you will see a short summary afterward.
          </p>
        }
        impactSummary="Uses the same rules as single-order status updates (eligibility is enforced server-side)."
        confirmLabel={bulkMutation.isPending ? "Working…" : "Confirm"}
        confirmDisabled={bulkMutation.isPending || selected.size === 0}
        onClose={() => setBulkDialogOpen(false)}
        onConfirm={() => {
          setBulkSummary(null);
          bulkMutation.mutate(bulkTargetStatus);
          setBulkDialogOpen(false);
        }}
      />
    </div>
  );
};
