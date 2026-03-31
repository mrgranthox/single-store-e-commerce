import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CreditCard, ShoppingBasket, TrendingUp, UserSearch } from "lucide-react";

import { NetRevenueAreaChart } from "@/components/dashboard/NetRevenueAreaChart";
import { TimeSeriesA11yTable } from "@/components/dashboard/TimeSeriesA11yTable";
import { DashboardPartialBody, getDashboardPartialState } from "@/components/primitives/DashboardPartialBody";
import { PageHeader } from "@/components/primitives/PageHeader";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { adminJsonGet } from "@/lib/api/admin-get";
import { ApiError } from "@/lib/api/http";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

type OverviewPayload = {
  range: { from: string | null; to: string | null };
  kpis: {
    orderCount: number;
    ordersTodayCount?: number;
    grossRevenueCents: number;
    completedRefundsCents?: number;
    netRevenueCents?: number;
    totalCustomers: number;
    openSupportCount: number;
    pendingReviews: number;
    activeReturns: number;
    lowStockCount: number;
    openAlerts: number;
  };
  payments: {
    paidCount: number;
    refundedCount: number;
    partiallyRefundedCount: number;
  };
};

type SalesPayload = {
  summary: {
    orderCount: number;
    revenueCents: number;
    averageOrderValueCents: number;
    completedRefundsCents?: number;
    netRevenueCents?: number;
  };
  series: Array<{
    date: string;
    orderCount: number;
    revenueCents: number;
    refundsCents?: number;
    netRevenueCents?: number;
  }>;
};

type HealthPayload = {
  status: "ready" | "degraded";
  now: string;
  runtime?: {
    uptimeSeconds: number;
    environment: string;
  };
  workload24h?: {
    failedJobs24h: number;
    failingIntegrationProviders: number;
    webhookHourly: Array<{ hour: number; received: number; failed: number }>;
  };
  dependencies?: Array<{ id: string; label: string; ok: boolean; role: string }>;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  totals: { grandTotalCents?: number | null; currency?: string | null } | null;
  customer: { name: string | null; email: string | null };
};

type LowStockRow = {
  productTitle: string;
  sku: string;
  onHand: number;
  productId: string;
};

type TicketRow = {
  id: string;
  subject: string;
  priority: string;
  createdAt: string;
};

const stitchHealthTriplet = (deps: HealthPayload["dependencies"]) => {
  const list = deps ?? [];
  const pick = (re: RegExp) => list.find((d) => re.test(`${d.id} ${d.label} ${d.role ?? ""}`));
  const payment = pick(/payment|pay|stripe|billing|card/i) ?? list[0];
  const shipping = pick(/ship|carrier|fulfill|delivery|logistics/i) ?? list[1];
  const email = pick(/email|mail|smtp|send|notify/i) ?? list[2];
  return [
    {
      label: "Payment Gateway",
      ok: payment?.ok ?? true,
      sub: payment?.label ?? "Payments"
    },
    {
      label: "Shipping API",
      ok: shipping?.ok ?? true,
      sub: shipping?.label ?? "Shipping"
    },
    {
      label: "Email Service",
      ok: email ? email.ok : false,
      sub: email?.label ?? "Notifications"
    }
  ];
};

const formatMoney = (cents: number) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} GHS`;
  }
};

const rangeQueryLastDays = (days: number) => {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString()
  }).toString();
};

const formatTimeAgo = (iso: string) => {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
};

const formatProcessUptime = (totalSeconds: number) => {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 0)}m`;
};

const humanizeOrderStatus = (status: string) =>
  status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const orderStatusStyle = (status: string) => {
  const u = status.toUpperCase();
  if (u.includes("CANCEL") || u.includes("FAIL")) {
    return { dot: "bg-[#ba1a1a]", text: "text-[#ba1a1a]" };
  }
  if (u.includes("PENDING") || u.includes("DRAFT")) {
    return { dot: "bg-slate-400", text: "text-slate-500" };
  }
  if (u.includes("SHIP") || u.includes("PROCESS")) {
    return { dot: "bg-[#3b6de6]", text: "text-[#3b6de6]" };
  }
  return { dot: "bg-[#006b2d]", text: "text-[#006b2d]" };
};

const ticketPriorityClass = (priority: string) => {
  const p = priority.toUpperCase();
  if (p.includes("CRITICAL") || p.includes("URGENT")) {
    return "bg-[#ba1a1a]/10 text-[#ba1a1a]";
  }
  if (p.includes("HIGH")) {
    return "bg-[#3b6de6]/10 text-[#3b6de6]";
  }
  return "bg-slate-100 text-slate-600";
};

export const DashboardOverviewPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const rangeQs = useMemo(() => rangeQueryLastDays(30), []);

  const [overviewQ, salesQ, healthQ, ordersQ, inventoryQ, ticketsQ] = useQueries({
    queries: [
      {
        queryKey: ["admin-dashboard", "overview", rangeQs],
        queryFn: () =>
          adminJsonGet<OverviewPayload>(`/api/admin/dashboard/overview?${rangeQs}`, accessToken),
        enabled: Boolean(accessToken),
        staleTime: 30_000
      },
      {
        queryKey: ["admin-dashboard", "sales-series", rangeQs],
        queryFn: () => adminJsonGet<SalesPayload>(`/api/admin/reports/sales?${rangeQs}`, accessToken),
        enabled: Boolean(accessToken),
        staleTime: 60_000
      },
      {
        queryKey: ["admin-dashboard", "system-health"],
        queryFn: () => adminJsonGet<HealthPayload>("/api/admin/dashboard/system-health", accessToken),
        enabled: Boolean(accessToken),
        staleTime: 15_000
      },
      {
        queryKey: ["admin-dashboard", "recent-orders"],
        queryFn: () =>
          adminJsonGet<{ items: OrderRow[] }>(
            "/api/admin/orders?page=1&page_size=5",
            accessToken
          ),
        enabled: Boolean(accessToken),
        staleTime: 20_000
      },
      {
        queryKey: ["admin-dashboard", "inventory-slice", rangeQs],
        queryFn: () =>
          adminJsonGet<{ lowStock: LowStockRow[] }>(
            `/api/admin/reports/inventory?${rangeQs}`,
            accessToken
          ),
        enabled: Boolean(accessToken),
        staleTime: 60_000
      },
      {
        queryKey: ["admin-dashboard", "urgent-tickets"],
        queryFn: () =>
          adminJsonGet<{ items: TicketRow[] }>(
            "/api/admin/support/tickets?page=1&page_size=12",
            accessToken
          ),
        enabled: Boolean(accessToken),
        staleTime: 25_000
      }
    ]
  });

  const overviewData = overviewQ.data?.data;
  const kpis = overviewData?.kpis;
  const kpiCards = kpis
    ? [
        {
          label: "Total Revenue",
          value: formatMoney(kpis.grossRevenueCents),
          delta: "Last 30 days · trend",
          icon: CreditCard,
          border: "border-l-[#1653cc]",
          iconClass: "text-[#1653cc]",
          urgent: false as const,
          deltaStyle: "trend" as const
        },
        {
          label: "Orders Today",
          value: (kpis.ordersTodayCount ?? 0).toLocaleString(),
          delta: "UTC calendar day",
          icon: ShoppingBasket,
          border: "border-l-[#5b5e68]",
          iconClass: "text-[#5b5e68]",
          urgent: false as const,
          deltaStyle: "muted" as const
        },
        {
          label: "Active Customers",
          value: kpis.totalCustomers.toLocaleString(),
          delta: "In range",
          icon: UserSearch,
          border: "border-l-[#3b6de6]",
          iconClass: "text-[#3b6de6]",
          urgent: false as const,
          deltaStyle: "muted" as const
        },
        {
          label: "Open Alerts",
          value: kpis.openAlerts.toLocaleString(),
          delta: kpis.openAlerts > 0 ? "Needs attention" : "Clear",
          icon: AlertTriangle,
          border: "border-l-[#ba1a1a]",
          iconClass: "text-[#ba1a1a]",
          urgent: kpis.openAlerts > 0,
          deltaStyle: "urgent" as const
        }
      ]
    : [];

  const series = salesQ.data?.data.series ?? [];
  const areaPoints = useMemo(() => {
    const net = (p: SalesPayload["series"][number]) => {
      if (p.netRevenueCents !== undefined) return Math.max(0, p.netRevenueCents);
      const r = p.refundsCents ?? 0;
      return Math.max(0, p.revenueCents - r);
    };
    const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-30).map((p) => ({ date: p.date, netCents: net(p) }));
  }, [series]);

  const orderItems = ordersQ.data?.data.items ?? [];
  const lowStockItems = (inventoryQ.data?.data.lowStock ?? []).slice(0, 5);
  const urgentTickets = useMemo(() => {
    const items = ticketsQ.data?.data.items ?? [];
    const score = (p: string) => (p.toUpperCase().includes("URGENT") ? 0 : p.toUpperCase().includes("HIGH") ? 1 : 2);
    return [...items].sort((a, b) => score(a.priority) - score(b.priority)).slice(0, 3);
  }, [ticketsQ.data?.data.items]);
  const healthData = healthQ.data?.data;
  const healthRuntime = healthData?.runtime;
  const failedJobs24h = healthData?.workload24h?.failedJobs24h ?? 0;

  const salesChartState = getDashboardPartialState({
    isLoading: salesQ.isLoading,
    isError: salesQ.isError,
    error: salesQ.error,
    isEmpty: !salesQ.isLoading && !salesQ.isError && areaPoints.length === 0
  });

  const healthTriplet = stitchHealthTriplet(healthData?.dependencies);

  return (
    <div className="space-y-6 px-3 sm:space-y-8 sm:px-0">
      <PageHeader
        title="Executive Dashboard"
        description="Command center — revenue trend, recent orders, inventory and support signals, system health."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-dashboard"])]}
      />

      {overviewQ.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading overview…</p>
      ) : overviewQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {overviewQ.error instanceof ApiError ? overviewQ.error.message : "Failed to load overview."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <article
                  key={kpi.label}
                  className={`flex min-h-[110px] flex-col justify-between rounded-[12px] border border-slate-200 border-l-4 bg-white p-5 shadow-sm ${kpi.border}`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#434654]">{kpi.label}</p>
                    <Icon className={`h-5 w-5 ${kpi.iconClass}`} strokeWidth={2} aria-hidden />
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <h2 className="font-headline text-2xl font-bold tracking-tight text-[#181b25]">{kpi.value}</h2>
                    {kpi.urgent ? (
                      <span className="mb-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter text-white">
                        {kpi.delta}
                      </span>
                    ) : kpi.deltaStyle === "muted" ? (
                      <span className="mb-1 max-w-[120px] text-right text-[10px] font-bold text-slate-400">{kpi.delta}</span>
                    ) : (
                      <span className="mb-1 flex items-center gap-0.5 text-[10px] font-bold text-[#006b2d]">
                        <TrendingUp className="h-3 w-3" strokeWidth={2} aria-hidden />
                        {kpi.delta}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8 lg:max-w-none">
          <section className="rounded-[12px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="font-headline text-base font-bold text-[#181b25]">Revenue trend</h3>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Last 30 days · net revenue (area)
              </p>
            </div>
            <DashboardPartialBody
              state={salesChartState}
              permissionsNeeded={["reports.read"]}
              error={salesQ.error}
              emptyLabel="No sales series in this window yet."
            >
              <figure className="space-y-3">
                <TimeSeriesA11yTable
                  caption="Net revenue by day for the last 30 days"
                  valueColumnHeader="Net revenue"
                  rows={areaPoints.map((p) => ({
                    date: p.date,
                    value: formatMoney(p.netCents)
                  }))}
                />
                <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                    <NetRevenueAreaChart points={areaPoints} formatValue={formatMoney} />
                  </div>
                </div>
              </figure>
            </DashboardPartialBody>
          </section>

          <section className="overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-50 px-6 py-4">
              <h3 className="font-headline text-base font-bold text-[#181b25]">Recent Orders</h3>
              <Link
                to="/admin/orders"
                className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] hover:underline"
              >
                View All Records
              </Link>
            </div>
            {ordersQ.isLoading ? (
              <p className="px-6 py-4 text-sm text-[var(--color-text-muted)]">Loading orders…</p>
            ) : ordersQ.isError ? (
              <p className="px-6 py-4 text-sm text-amber-800">
                {ordersQ.error instanceof ApiError ? ordersQ.error.message : "Orders unavailable."}
              </p>
            ) : orderItems.length === 0 ? (
              <p className="px-6 py-4 text-sm text-[var(--color-text-muted)]">No orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Order #", "Customer", "Amount", "Status", "Age"].map((h) => (
                        <th
                          key={h}
                          className={`h-11 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${
                            h === "Age" ? "text-right" : "text-left"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {orderItems.map((row) => {
                      const st = orderStatusStyle(row.status);
                      const customer = row.customer.name?.trim() || row.customer.email || "Guest";
                      const amt = row.totals?.grandTotalCents ?? 0;
                      return (
                        <tr key={row.id} className="min-h-[44px] transition-colors hover:bg-[#f2f3ff]/60">
                          <td className="h-11 px-6 align-middle text-xs font-semibold text-[var(--color-primary)]">
                            <Link to={`/admin/orders/${row.id}`} className="font-mono hover:underline">
                              #{row.orderNumber}
                            </Link>
                          </td>
                          <td className="h-11 px-6 align-middle text-xs font-medium text-[#181b25]">{customer}</td>
                          <td className="h-11 px-6 align-middle font-mono text-xs">{formatMoney(amt)}</td>
                          <td className="h-11 px-6 align-middle">
                            <span className={`flex items-center gap-2 text-[10px] font-bold ${st.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                              {humanizeOrderStatus(row.status)}
                            </span>
                          </td>
                          <td className="h-11 px-6 text-right align-middle text-[10px] text-slate-400">
                            {formatTimeAgo(row.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-8 lg:col-span-4">
          <section className="rounded-[12px] bg-[#1a1d27] p-5 text-white shadow-sm">
            <h3 className="mb-4 font-headline text-xs font-bold uppercase tracking-widest text-slate-400">
              System Health
            </h3>
            {healthQ.isLoading ? (
              <p className="text-xs text-slate-400">Checking…</p>
            ) : healthQ.isError ? (
              <p className="text-xs text-amber-300">
                {healthQ.error instanceof ApiError ? healthQ.error.message : "Health check failed."}
              </p>
            ) : (
              <div className="space-y-4">
                {healthTriplet.map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_rgba(107,255,143,0.35)] ${
                          row.ok ? "bg-[#6bff8f]" : "bg-amber-400"
                        }`}
                      />
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold">{row.label}</span>
                        <span className="block truncate font-mono text-[9px] text-slate-500">{row.sub}</span>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">{row.ok ? "OK" : "Check"}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-3">
                  {healthRuntime ? (
                    <p className="text-[10px] leading-relaxed text-slate-500">
                      Process{" "}
                      <span className="font-mono text-slate-300">
                        {formatProcessUptime(healthRuntime.uptimeSeconds)}
                      </span>
                      <span className="text-slate-600"> · </span>
                      {healthRuntime.environment}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Failed jobs (24h)</span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        failedJobs24h > 0 ? "text-amber-300" : "text-slate-400"
                      }`}
                    >
                      {failedJobs24h}
                    </span>
                  </div>
                  <Link
                    to="/admin/dashboard/system-health"
                    className="mt-2 inline-block text-[9px] font-bold uppercase tracking-wider text-[#8fb4ff] hover:underline"
                  >
                    System health dashboard
                  </Link>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-[12px] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.05em] text-[#434654]">Low Stock Alerts</h3>
              <span className="rounded-full bg-[#ffdad6] px-2 py-0.5 text-[9px] font-bold text-[#93000a]">
                {kpis?.lowStockCount ?? lowStockItems.length} ALERTS
              </span>
            </div>
            {inventoryQ.isLoading ? (
              <p className="text-xs text-slate-500">Loading stock signals…</p>
            ) : inventoryQ.isError ? (
              <p className="text-xs text-amber-800">Could not load low stock.</p>
            ) : lowStockItems.length === 0 ? (
              <p className="text-xs text-slate-500">No low-stock variants in view.</p>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((row) => (
                  <div key={`${row.productId}-${row.sku}`} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-[#181b25]">{row.productTitle}</p>
                      <p className="font-mono text-[10px] text-slate-400">{row.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-[#ba1a1a]">{row.onHand} left</p>
                      <Link
                        to="/admin/inventory/low-stock"
                        className="text-[9px] font-bold uppercase tracking-tighter text-[var(--color-primary)] hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-[12px] bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-[0.05em] text-[#434654]">Urgent Support Tickets</h3>
            {ticketsQ.isLoading ? (
              <p className="text-xs text-slate-500">Loading tickets…</p>
            ) : ticketsQ.isError ? (
              <p className="text-xs text-amber-800">Tickets unavailable.</p>
            ) : urgentTickets.length === 0 ? (
              <p className="text-xs text-slate-500">No urgent or high-priority tickets in preview.</p>
            ) : (
              <div className="space-y-4">
                {urgentTickets.map((t) => (
                  <div key={t.id} className="rounded border-l-2 border-slate-200 bg-slate-50 p-3">
                    <div className="mb-1 flex items-start justify-between">
                      <span className="font-mono text-[10px] font-bold text-slate-400">
                        #{t.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${ticketPriorityClass(t.priority)}`}
                      >
                        {t.priority.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="truncate text-xs font-bold text-[#181b25]">{t.subject}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">Opened {formatTimeAgo(t.createdAt)}</p>
                    <Link
                      to={`/admin/support/tickets/${t.id}`}
                      className="mt-1 inline-block text-[9px] font-bold uppercase tracking-tighter text-[var(--color-primary)] hover:underline"
                    >
                      Open ticket
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};
