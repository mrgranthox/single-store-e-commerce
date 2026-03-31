import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/primitives/PageHeader";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  listAdminDispatchQueue,
  listAdminFulfillmentQueue,
  type AdminOrderListItem
} from "@/features/orders/api/admin-orders.api";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

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

const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 36e5;

const priorityRow = (order: AdminOrderListItem) => {
  const h = hoursSince(order.createdAt);
  const unassigned = !order.assignedWarehouse?.id;
  if (h > 24 && unassigned) {
    return { label: "CRITICAL", className: "text-[#ba1a1a]", icon: "priority_high" as const };
  }
  if (h > 20) {
    return { label: "HIGH", className: "text-amber-600", icon: "priority" as const };
  }
  if (h < 6) {
    return { label: "LOW", className: "text-[#737685]", icon: "low_priority" as const };
  }
  return { label: "NORMAL", className: "text-[#434654]", icon: "drag_handle" as const };
};

const fulfillmentDotStatus = (order: AdminOrderListItem) => {
  const f = (order.fulfillment?.status ?? "UNFULFILLED").toUpperCase();
  if (f === "UNFULFILLED" && !order.assignedWarehouse) {
    return { dot: "bg-slate-400", label: "NEW ORDER", text: "text-slate-500" };
  }
  if (!order.assignedWarehouse) {
    return { dot: "bg-amber-500", label: "PENDING START", text: "text-amber-600" };
  }
  if (f === "DELIVERED") {
    return { dot: "bg-[#006b2d]", label: "FULFILLED", text: "text-[#006b2d]" };
  }
  return { dot: "bg-[#1653cc]", label: "QUEUED", text: "text-[#1653cc]" };
};

const dispatchStatusUi = (order: AdminOrderListItem) => {
  const f = (order.fulfillment?.status ?? "").toUpperCase();
  const hasTrack = Boolean(order.fulfillment?.latestTrackingNumber);
  if (f === "IN_TRANSIT" || f === "DISPATCHED" || f === "DELIVERED") {
    return {
      wrap: "border border-slate-200 bg-[#f1f5f9] text-[#475569]",
      dot: "bg-[#475569]",
      label: "DISPATCHED"
    };
  }
  if (hasTrack || f === "PACKING") {
    return {
      wrap: "border border-emerald-200 bg-[#dcfce7] text-[#166534]",
      dot: "bg-[#166534]",
      label: "READY"
    };
  }
  return {
    wrap: "border border-yellow-200 bg-[#fef9c3] text-[#854d0e]",
    dot: "bg-[#854d0e]",
    label: "PACKING"
  };
};

type OrderQueuesPageProps = {
  mode: "fulfillment" | "dispatch";
};

export const OrderQueuesPage = ({ mode }: OrderQueuesPageProps) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const queryKey = useMemo(
    () => ["admin-order-queue", mode, page, appliedSearch] as const,
    [mode, page, appliedSearch]
  );

  const queueQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const base = { page, page_size: 20 };
      if (mode === "fulfillment") {
        return listAdminFulfillmentQueue(accessToken, {
          ...base,
          ...(appliedSearch.trim() ? { q: appliedSearch.trim() } : {})
        });
      }
      return listAdminDispatchQueue(accessToken, {
        ...base,
        ...(appliedSearch.trim() ? { q: appliedSearch.trim() } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = queueQuery.data?.data.items ?? [];
  const meta = queueQuery.data?.meta;

  const errorMessage =
    queueQuery.error instanceof ApiError
      ? queueQuery.error.message
      : queueQuery.error instanceof Error
        ? queueQuery.error.message
        : null;

  const atRisk = useMemo(() => items.filter((o) => hoursSince(o.createdAt) > 24).length, [items]);
  const unassignedWh = useMemo(() => items.filter((o) => !o.assignedWarehouse?.id).length, [items]);

  const clearFilters = () => {
    setSearchDraft("");
    setAppliedSearch("");
    setPage(1);
  };

  const from = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.totalItems) : 0;

  if (mode === "fulfillment") {
    return (
      <div className="mx-auto max-w-[1600px] space-y-6">
        <PageHeader
          title="Fulfillment queue"
          titleSize="deck"
          description=""
          autoBreadcrumbs={false}
          actionMenuItems={[refreshDataMenuItem(queryClient, queryKey)]}
        />

        <div className="flex flex-col space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <nav className="mb-1 flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-[#737685]">
                <span>Operations</span>
                <MaterialIcon name="chevron_right" className="text-xs" />
                <span className="text-[#1653cc]">Fulfillment queue</span>
              </nav>
              <h2 className="font-headline text-3xl font-bold text-[#181b25]">Fulfillment queue</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled
                title="Advanced filters coming soon."
                className="flex items-center rounded-lg border border-[#c3c6d6]/50 bg-white px-4 py-2 font-semibold text-[#5b5e68] shadow-sm"
              >
                <MaterialIcon name="filter_list" className="mr-2 text-lg" />
                Filters
              </button>
              <button
                type="button"
                disabled
                title="Bulk assign uses order detail today."
                className="flex items-center rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 font-semibold text-white shadow-md opacity-60"
              >
                <MaterialIcon name="warehouse" className="mr-2 text-lg" />
                Assign warehouse to selected
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="flex flex-col justify-between rounded-xl border-l-4 border-[#1653cc] bg-white p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">
                Awaiting fulfillment
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-headline text-2xl font-bold">{meta?.totalItems ?? items.length}</span>
                <span className="text-xs text-[#434654]">Orders total</span>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-xl border-l-4 border-[#ba1a1a] bg-white p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">
                At risk (&gt;24h)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-headline text-2xl font-bold text-[#ba1a1a]">{atRisk}</span>
                <span className="text-xs text-[#ba1a1a]/80">Require immediate action</span>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-xl border-l-4 border-amber-500 bg-white p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">
                Unassigned warehouse
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-headline text-2xl font-bold text-amber-500">
                  {String(unassignedWh).padStart(2, "0")}
                </span>
                <span className="text-xs text-[#434654]">Pending allocation</span>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-xl border-l-4 border-[#006b2d] bg-white p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Completed today</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-headline text-2xl font-bold text-[#006b2d]">—</span>
                <span className="text-xs text-[#434654]">Not tracked in this view</span>
              </div>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
        ) : null}

        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c3c6d6]/20 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-bold text-[#181b25]">Active queue</span>
              <span className="rounded bg-[#ecedfb] px-2 py-0.5 font-mono text-xs">LIVE</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#737685]">
              <span>
                Showing {items.length ? `${from}-${to}` : "0"} of {meta?.totalItems ?? 0} orders
              </span>
              <div className="ml-2 flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded p-1 hover:bg-[#ecedfb] disabled:opacity-40"
                >
                  <MaterialIcon name="chevron_left" className="text-sm" />
                </button>
                <button
                  type="button"
                  disabled={!meta || page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded p-1 hover:bg-[#ecedfb] disabled:opacity-40"
                >
                  <MaterialIcon name="chevron_right" className="text-sm" />
                </button>
              </div>
            </div>
          </div>

          {queueQuery.isLoading ? (
            <p className="p-10 text-center text-sm text-[#737685]">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[#f2f3ff]">
                  <tr>
                    <th className="w-10 px-6 py-3">
                      <input type="checkbox" disabled className="rounded-sm border-[#c3c6d6] text-[#1653cc]" />
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]">Order #</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]">Placed at</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]">Customer</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]">Items</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]">
                      Warehouse assignment
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]">Status</th>
                    <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#737685]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d6]/10">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-sm text-[#737685]">
                        No orders in this queue.
                      </td>
                    </tr>
                  ) : (
                    items.map((order) => {
                      const pr = priorityRow(order);
                      const st = fulfillmentDotStatus(order);
                      const h = hoursSince(order.createdAt);
                      const borderWarn = h > 20 && !order.assignedWarehouse;
                      return (
                        <tr
                          key={order.id}
                          className={`transition-colors hover:bg-[#e6e7f6]/40 ${borderWarn ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-transparent"}`}
                        >
                          <td className="px-6 py-3">
                            <input type="checkbox" disabled className="rounded-sm border-[#c3c6d6] text-[#1653cc]" />
                          </td>
                          <td className="px-4 py-3">
                            <div className={`flex items-center font-bold ${pr.className}`}>
                              <MaterialIcon name={pr.icon} className="mr-1 text-sm" />
                              {pr.label}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-[#434654]">
                            <Link className="text-[#1653cc] hover:underline" to={`/admin/orders/${order.id}`}>
                              {order.orderNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-[#434654]">
                            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
                              new Date(order.createdAt)
                            )}
                            {h > 24 ? (
                              <span className="ml-1 font-bold text-[#ba1a1a]">({Math.floor(h)}h ago)</span>
                            ) : (
                              <span className="ml-1 text-[#737685]">({Math.floor(h)}h ago)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {order.customer.name ?? order.customer.email ?? (order.customer.guest ? "Guest" : "—")}
                          </td>
                          <td className="px-4 py-3">
                            {order.itemCount} lines · {formatMoney(order.totals?.grandTotalCents, order.totals?.currency)}
                          </td>
                          <td className="px-4 py-3">
                            {order.assignedWarehouse ? (
                              <span className="flex items-center text-[#434654]">
                                <MaterialIcon name="location_on" className="mr-1 text-sm" />
                                {order.assignedWarehouse.code ?? order.assignedWarehouse.name}
                              </span>
                            ) : (
                              <span className="flex items-center rounded bg-[#fef3c7] px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                                <MaterialIcon name="warning" className="mr-1 text-sm" />
                                No warehouse
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                              <span className={`text-[11px] font-bold uppercase tracking-tight ${st.text}`}>
                                {st.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {!order.assignedWarehouse ? (
                                <Link
                                  to={`/admin/orders/${order.id}`}
                                  className="text-xs font-bold text-[#1653cc] hover:underline"
                                >
                                  Assign
                                </Link>
                              ) : (
                                <Link
                                  to={`/admin/orders/${order.id}`}
                                  className="rounded bg-[#1653cc] px-3 py-1 text-[11px] font-bold text-white hover:opacity-90"
                                >
                                  Start fulfillment
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-xl bg-[#1a1d27] p-6 text-white lg:col-span-2">
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="mb-1 font-headline text-lg font-bold">Queue health overview</h3>
                  <p className="max-w-md text-xs text-gray-400">
                    {atRisk} orders exceed 24h in queue. Unassigned warehouse count: {unassignedWh}. Open an order to
                    assign and progress fulfillment.
                  </p>
                </div>
                <MaterialIcon name="monitoring" className="text-4xl text-[#1653cc] opacity-50" />
              </div>
              <div className="mt-6 flex flex-wrap gap-8">
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Average wait (page)</span>
                  <span className="font-mono text-xl font-bold">
                    {items.length
                      ? `${(items.reduce((a, o) => a + hoursSince(o.createdAt), 0) / items.length).toFixed(1)}h`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Queue depth</span>
                  <span className="font-mono text-xl font-bold">{meta?.totalItems ?? 0}</span>
                </div>
              </div>
            </div>
            <div
              className="pointer-events-none absolute inset-0 opacity-5"
              style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                backgroundSize: "24px 24px"
              }}
            />
          </div>
          <div className="flex flex-col items-center justify-center space-y-3 rounded-xl bg-white p-6 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbe1ff] text-[#1653cc]">
              <MaterialIcon name="smart_toy" filled className="text-2xl" />
            </div>
            <h4 className="text-sm font-bold">Routing</h4>
            <p className="text-xs text-[#434654]">Use order detail for warehouse assignment and shipment creation.</p>
            <Link
              to="/admin/orders"
              className="rounded-lg border border-[#1653cc]/20 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#1653cc] hover:bg-[#1653cc]/5"
            >
              Orders list
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* Dispatch queue — Stitch dispatch_queue */
  return (
    <div className="ml-0 min-h-0 flex-1 space-y-8">
      <PageHeader
        title="Dispatch queue"
        titleSize="deck"
        description=""
        autoBreadcrumbs={false}
        actionMenuItems={[refreshDataMenuItem(queryClient, queryKey)]}
      />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <nav className="mb-2 flex text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            <span>Orders</span>
            <span className="mx-2">/</span>
            <span className="font-bold text-[#1653cc]">Dispatch queue</span>
          </nav>
          <h2 className="font-headline text-3xl font-bold text-[#181b25]">Dispatch queue</h2>
          <p className="mt-1 text-sm text-[#434654]">Orders ready for packing or courier handoff</p>
        </div>
        <button
          type="button"
          disabled
          title="Bulk dispatch from order detail."
          className="flex items-center gap-2 rounded-sm bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-6 py-2.5 text-sm font-semibold text-white opacity-60 shadow-md"
        >
          <MaterialIcon name="local_shipping" className="text-lg" />
          Dispatch selected
        </button>
      </div>

      <div className="mb-8 grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-wrap items-center gap-4 rounded-sm border border-[rgba(115,118,133,0.15)] bg-white p-5 lg:col-span-9">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Search context</label>
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setAppliedSearch(searchDraft), setPage(1))}
              placeholder="Order # or customer…"
              className="w-full rounded-sm border border-slate-200 bg-slate-50 py-2 pl-3 pr-3 text-sm focus:border-[#1653cc] focus:ring-0"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Status</label>
            <select disabled className="rounded-sm border border-slate-200 bg-slate-50 py-2 pl-3 pr-10 text-sm">
              <option>All statuses</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Warehouse</label>
            <select disabled className="rounded-sm border border-slate-200 bg-slate-50 py-2 pl-3 pr-10 text-sm">
              <option>All warehouses</option>
            </select>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 flex items-center gap-1 px-4 py-2 text-sm font-semibold text-slate-500 transition-all hover:text-[#1653cc]"
          >
            <MaterialIcon name="filter_list" className="text-lg" />
            Clear filters
          </button>
          <button
            type="button"
            onClick={() => {
              setAppliedSearch(searchDraft);
              setPage(1);
            }}
            className="mt-5 rounded-sm bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Apply search
          </button>
        </div>
        <div className="relative col-span-12 overflow-hidden rounded-sm border border-[rgba(115,118,133,0.15)] bg-white p-5 lg:col-span-3">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#1653cc]" />
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Queue priority</span>
            <span className="rounded-sm bg-[#ffdad6] px-1.5 py-0.5 text-[10px] font-bold text-[#ba1a1a]">CRITICAL</span>
          </div>
          <h3 className="mt-2 font-headline text-3xl font-bold">{meta?.totalItems ?? 0}</h3>
          <p className="mt-1 text-[10px] uppercase tracking-tight text-slate-400">Orders pending handoff</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      <div className="overflow-hidden rounded-sm border border-[rgba(115,118,133,0.15)] bg-white">
        {queueQuery.isLoading ? (
          <p className="p-10 text-center text-sm text-[#737685]">Loading…</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="w-10 px-6 py-4">
                      <input type="checkbox" disabled className="rounded-sm border-slate-300 text-[#1653cc]" />
                    </th>
                    <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Order #</th>
                    <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Customer</th>
                    <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Items</th>
                    <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Warehouse</th>
                    <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Carrier</th>
                    <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-sm text-[#737685]">
                        No orders in this queue.
                      </td>
                    </tr>
                  ) : (
                    items.map((order) => {
                      const du = dispatchStatusUi(order);
                      return (
                        <tr key={order.id} className="transition-colors hover:bg-[#e6e7f6]">
                          <td className="px-6 py-4">
                            <input type="checkbox" disabled className="rounded-sm border-slate-300 text-[#1653cc]" />
                          </td>
                          <td className="px-4 py-4 font-mono text-sm font-medium text-[#1653cc]">
                            <Link to={`/admin/orders/${order.id}`}>#{order.orderNumber}</Link>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-semibold">
                              {order.customer.name ?? order.customer.email ?? "Guest"}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {order.customer.guest ? "Guest checkout" : "Registered customer"}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                {order.itemCount}
                              </span>
                              <span className="max-w-[120px] truncate text-xs text-slate-600">Order lines</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs font-medium text-slate-600">
                            {order.assignedWarehouse?.name ?? order.assignedWarehouse?.code ?? "—"}
                          </td>
                          <td className="px-4 py-4 text-xs italic text-slate-400">
                            {order.fulfillment?.latestTrackingNumber ? "Assigned" : "Unassigned"}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-tight ${du.wrap}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${du.dot}`} />
                              {du.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              to={`/admin/orders/${order.id}`}
                              className="text-[10px] font-bold uppercase tracking-widest text-[#1653cc] hover:underline"
                            >
                              Open order
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {meta ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <p className="text-[11px] font-medium text-slate-500">
                  Showing {items.length} of {meta.totalItems} entries in dispatch queue
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-400 hover:text-[#1653cc] disabled:opacity-40"
                  >
                    <MaterialIcon name="chevron_left" className="text-lg" />
                  </button>
                  <span className="px-2 text-xs text-slate-600">
                    Page {meta.page} / {meta.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-400 hover:text-[#1653cc] disabled:opacity-40"
                  >
                    <MaterialIcon name="chevron_right" className="text-lg" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-sm border-l-4 border-[#5b5e68] bg-[#dedfeb]/20 p-4">
          <MaterialIcon name="info" className="text-[#5b5e68]" />
          <div>
            <h4 className="text-xs font-bold text-[#60626c]">Carrier integration</h4>
            <p className="mt-1 text-[11px] text-[#60626c]/80">
              Tracking and labels are confirmed via webhooks. Enter carrier data on the order shipment workflow.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-sm border-l-4 border-[#1653cc] bg-[#3b6de6]/10 p-4">
          <MaterialIcon name="speed" className="text-[#1653cc]" />
          <div>
            <h4 className="text-xs font-bold text-[#1653cc]">Throughput</h4>
            <p className="mt-1 text-[11px] text-[#1653cc]/80">
              {meta?.totalItems ?? 0} orders currently in the dispatch-facing queue for this page scope.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
