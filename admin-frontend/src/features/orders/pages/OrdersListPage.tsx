import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreVertical,
  Package,
  Upload,
  Warehouse
} from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { StitchOperationalTableSkeleton } from "@/components/primitives/StitchOperationalTableSkeleton";
import { listAdminOrders, ApiError, type AdminOrderListItem } from "@/features/orders/api/admin-orders.api";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

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

const formatMoney = (cents: number | null | undefined, currency: string | null | undefined) => {
  if (typeof cents !== "number" || Number.isNaN(cents)) {
    return "—";
  }
  const cur = (currency ?? "GHS").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
};

const formatPlacedShort = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

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

const GhostPill = ({
  dotClass,
  label,
  textClass = "text-[#434654]"
}: {
  dotClass: string;
  label: string;
  textClass?: string;
}) => (
  <span
    className={`inline-flex items-center rounded-full border border-[rgba(115,118,133,0.15)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${textClass}`}
  >
    <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dotClass}`} />
    {label}
  </span>
);

const paymentPill = (paymentState: string) => {
  const u = paymentState.toUpperCase();
  if (u === "PAID") return <GhostPill dotClass="bg-emerald-600" label="Paid" textClass="text-emerald-800" />;
  if (u === "FAILED" || u === "CANCELLED")
    return <GhostPill dotClass="bg-red-600" label={paymentState.replace(/_/g, " ")} textClass="text-red-800" />;
  if (u.includes("REFUND"))
    return <GhostPill dotClass="bg-slate-500" label={paymentState.replace(/_/g, " ")} textClass="text-slate-700" />;
  return <GhostPill dotClass="bg-amber-500" label={paymentState.replace(/_/g, " ")} textClass="text-amber-800" />;
};

const fulfillmentPill = (order: AdminOrderListItem) => {
  const st = (order.fulfillment?.status ?? "UNFULFILLED").toUpperCase();
  if (st === "DELIVERED")
    return <GhostPill dotClass="bg-emerald-600" label="Fulfilled" textClass="text-emerald-800" />;
  if (st === "UNFULFILLED")
    return <GhostPill dotClass="bg-amber-500" label="Unfulfilled" textClass="text-amber-800" />;
  if (st === "IN_TRANSIT" || st === "DISPATCHED")
    return <GhostPill dotClass="bg-[#1653cc]" label={st.replace(/_/g, " ")} textClass="text-[#1653cc]" />;
  return <GhostPill dotClass="bg-slate-400" label={st.replace(/_/g, " ")} textClass="text-slate-700" />;
};

const orderStatusPill = (status: string) => {
  const u = status.toUpperCase();
  if (u === "COMPLETED" || u === "CLOSED")
    return <GhostPill dotClass="bg-slate-500" label={status.replace(/_/g, " ")} textClass="text-slate-700" />;
  if (u === "CANCELLED") return <GhostPill dotClass="bg-red-600" label="Cancelled" textClass="text-red-800" />;
  return <GhostPill dotClass="bg-[#1653cc]" label={status.replace(/_/g, " ")} textClass="text-[#1653cc]" />;
};

export const OrdersListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [orderDraft, setOrderDraft] = useState("");
  const [customerDraft, setCustomerDraft] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStateFilter, setPaymentStateFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const queryKey = useMemo(
    () => ["admin-orders", page, appliedQ, statusFilter, paymentStateFilter] as const,
    [page, appliedQ, statusFilter, paymentStateFilter]
  );

  const ordersQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminOrders(accessToken, {
        page,
        page_size: 20,
        ...(appliedQ.trim() ? { q: appliedQ.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(paymentStateFilter ? { paymentState: paymentStateFilter } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = ordersQuery.data?.data.items ?? [];
  const meta = ordersQuery.data?.meta;

  const applyFilters = useCallback(() => {
    const parts = [orderDraft.trim(), customerDraft.trim()].filter(Boolean);
    setAppliedQ(parts.join(" "));
    setPage(1);
    setSelected(new Set());
  }, [orderDraft, customerDraft]);

  const clearFilters = useCallback(() => {
    setOrderDraft("");
    setCustomerDraft("");
    setAppliedQ("");
    setStatusFilter("");
    setPaymentStateFilter("");
    setPage(1);
    setSelected(new Set());
  }, []);

  const errorMessage =
    ordersQuery.error instanceof ApiError
      ? ordersQuery.error.message
      : ordersQuery.error instanceof Error
        ? ordersQuery.error.message
        : null;

  const today = useMemo(() => new Date(), []);

  const kpi = useMemo(() => {
    const rows = items;
    const todayOrders = rows.filter((o) => isSameLocalDay(o.createdAt, today)).length;
    const pendingPay = rows.filter((o) => {
      const p = o.paymentState.toUpperCase();
      return (
        p.includes("PENDING") || p === "INITIALIZED" || p === "AWAITING_CUSTOMER_ACTION"
      );
    }).length;
    const unfulfilled = rows.filter((o) => {
      const s = (o.fulfillment?.status ?? "UNFULFILLED").toUpperCase();
      return s === "UNFULFILLED" || s === "CREATED" || s === "PACKING";
    }).length;
    const cancelled = rows.filter((o) => o.status === "CANCELLED").length;
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
      "order_number",
      "customer",
      "email",
      "items",
      "total_cents",
      "currency",
      "payment_state",
      "fulfillment_status",
      "order_status",
      "created_at"
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Orders"
        titleSize="deck"
        description="Central command for all orders."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-orders"])]}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-3 lg:pl-0">
          <div className="relative min-w-[140px] overflow-hidden rounded-xl bg-white p-4 shadow-sm">
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#1653cc]" />
            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685]">
              Today&apos;s orders
            </span>
            <p className="mt-1 font-headline text-2xl font-bold text-[#181b25]">{kpi.todayOrders}</p>
            <p className="mt-1 text-[0.6875rem] text-[#434654]">On this page</p>
          </div>
          <div className="relative min-w-[140px] overflow-hidden rounded-xl bg-white p-4 shadow-sm">
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-amber-500" />
            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685]">
              Pending payment
            </span>
            <p className="mt-1 font-headline text-2xl font-bold text-[#181b25]">{kpi.pendingPay}</p>
            <p className="mt-1 text-[0.6875rem] text-[#434654]">On this page</p>
          </div>
          <div className="relative min-w-[140px] overflow-hidden rounded-xl bg-white p-4 shadow-sm">
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-indigo-500" />
            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685]">
              Unfulfilled
            </span>
            <p className="mt-1 font-headline text-2xl font-bold text-[#181b25]">{kpi.unfulfilled}</p>
            <p className="mt-1 text-[0.6875rem] text-[#434654]">On this page</p>
          </div>
          <div className="relative min-w-[140px] overflow-hidden rounded-xl bg-white p-4 shadow-sm">
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-red-600" />
            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685]">
              Cancelled
            </span>
            <p className="mt-1 font-headline text-2xl font-bold text-[#181b25]">{kpi.cancelled}</p>
            <p className="mt-1 text-[0.6875rem] text-[#434654]">On this page</p>
          </div>
        </div>
        {meta ? (
          <div className="shrink-0 rounded-xl border border-[#e0e2f0] bg-[#f2f3ff] px-4 py-3 text-right">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685]">Total matched</p>
            <p className="font-headline text-2xl font-bold text-[#181b25]">{meta.totalItems.toLocaleString()}</p>
          </div>
        ) : null}
      </div>
      <p className="text-[10px] text-[#737685]">
        KPI counts in cards use the current results page. Total matched counts every order returned by your filters
        across pages.
      </p>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3 lg:grid-cols-7">
          <div className="lg:col-span-1">
            <label className="mb-2 block text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
              Order #
            </label>
            <input
              value={orderDraft}
              onChange={(e) => setOrderDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Search ID…"
              className="w-full rounded-lg border-none bg-[#f2f3ff] py-2.5 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
            />
          </div>
          <div className="lg:col-span-1">
            <label className="mb-2 block text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
              Customer
            </label>
            <input
              value={customerDraft}
              onChange={(e) => setCustomerDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Name or email…"
              className="w-full rounded-lg border-none bg-[#f2f3ff] py-2.5 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
              Payment
            </label>
            <select
              value={paymentStateFilter}
              onChange={(e) => {
                setPaymentStateFilter(e.target.value);
                setPage(1);
              }}
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
            <label className="mb-2 block text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
              Fulfillment
            </label>
            <select
              disabled
              title="Fulfillment filter uses shipment data; refine with order status or open queues."
              className="w-full cursor-not-allowed rounded-lg border-none bg-slate-100 py-2.5 text-xs opacity-60"
              value=""
            >
              <option value="">All statuses</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
              Order status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border-none bg-[#f2f3ff] py-2.5 text-xs focus:ring-2 focus:ring-[#1653cc]/20"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s || "all"} value={s}>
                  {s ? s.replace(/_/g, " ") : "All statuses"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
              Date range
            </label>
            <input
              type="date"
              disabled
              title="Date range filter is not available on this endpoint."
              className="w-full cursor-not-allowed rounded-lg border-none bg-slate-100 py-2.5 text-xs opacity-60"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={applyFilters}
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
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMessage}
          {ordersQuery.error instanceof ApiError && ordersQuery.error.statusCode === 403 ? (
            <span className="mt-1 block text-xs">Your role may need the orders.read permission.</span>
          ) : null}
        </div>
      ) : null}

      {ordersQuery.isLoading ? (
        <StitchOperationalTableSkeleton rowCount={10} columnCount={7} />
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
                Selected: {selected.size} order{selected.size === 1 ? "" : "s"}
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
              <button
                type="button"
                disabled
                title="Bulk assign warehouse is not enabled from the list view."
                className="flex items-center gap-2 rounded-lg bg-[#f2f3ff] px-4 py-2 text-xs font-semibold text-[#181b25] opacity-40"
              >
                <Warehouse className="h-4 w-4" />
                Assign warehouse
              </button>
              <button
                type="button"
                disabled
                title="Mark fulfilled from an open order detail."
                className="flex items-center gap-2 rounded-lg bg-[#1653cc]/10 px-4 py-2 text-xs font-semibold text-[#1653cc] opacity-40"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark fulfilled
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="mb-3 h-10 w-10 text-[#c3c6d6]" />
                <p className="text-sm font-semibold text-[#181b25]">No orders found</p>
                <p className="mt-1 max-w-sm text-xs text-[#737685]">
                  Adjust filters or search terms to widen the operational view.
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#f2f3ff]">
                    <th className="w-10 px-6 py-3" />
                    <th className="px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                      Order #
                    </th>
                    <th className="px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                      Items
                    </th>
                    <th className="px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                      Total
                    </th>
                    <th className="px-4 py-3 text-center text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                      Payment
                    </th>
                    <th className="px-4 py-3 text-center text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                      Fulfillment
                    </th>
                    <th className="px-4 py-3 text-center text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                      Placed at
                    </th>
                    <th className="px-6 py-3 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e7f6]">
                  {items.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-[#e6e7f6]/80">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selected.has(order.id)}
                          onChange={() => toggleRow(order.id)}
                          className="h-4 w-4 rounded border-[#737685] text-[#1653cc] focus:ring-[#1653cc]/20"
                          aria-label={`Select ${order.orderNumber}`}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="font-mono text-xs font-medium text-[#1653cc] hover:underline"
                        >
                          #{order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#181b25]">
                            {order.customer.name ?? order.customer.email ?? (order.customer.guest ? "Guest" : "—")}
                          </span>
                          {order.customer.email ? (
                            <span className="text-xs text-[#434654]">{order.customer.email}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-[#181b25]">
                        {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs font-semibold text-[#181b25]">
                        {formatMoney(order.totals?.grandTotalCents ?? null, order.totals?.currency ?? null)}
                      </td>
                      <td className="px-4 py-4 text-center">{paymentPill(order.paymentState)}</td>
                      <td className="px-4 py-4 text-center">{fulfillmentPill(order)}</td>
                      <td className="px-4 py-4 text-center">{orderStatusPill(order.status)}</td>
                      <td className="px-4 py-4 text-xs text-[#434654]">{formatPlacedShort(order.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
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
          {meta ? (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f2f3ff] px-6 py-4">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                Showing {from} to {to} of {meta.totalItems.toLocaleString()} orders
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded bg-white text-[#737685] shadow-sm transition-all hover:text-[#1653cc] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
