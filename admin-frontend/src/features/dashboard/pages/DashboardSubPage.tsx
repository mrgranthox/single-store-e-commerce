import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Link } from "react-router-dom";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { GrossNetBarChart } from "@/components/dashboard/GrossNetBarChart";
import { SecurityHourlyLineChart } from "@/components/dashboard/SecurityHourlyLineChart";
import { TimeSeriesA11yTable } from "@/components/dashboard/TimeSeriesA11yTable";
import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { DashboardPartialBody, getDashboardPartialState } from "@/components/primitives/DashboardPartialBody";
import { StitchGradientButton, StitchKpiMicro, StitchSecondaryButton } from "@/components/stitch/stitch-primitives";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { adminJsonGet } from "@/lib/api/admin-get";
import { ApiError } from "@/lib/api/http";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const rangeQueryString = () => {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 30);
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString()
  });
  return params.toString();
};

const rangeQueryDays = (days: number) => {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString()
  }).toString();
};

const money = (cents: number, currency = "GHS") => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
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

type SalesDash = {
  summary: {
    orderCount: number;
    revenueCents: number;
    completedRefundsCents?: number;
    netRevenueCents?: number;
    averageOrderValueCents: number;
    averageNetOrderValueCents?: number;
  };
  series: Array<{
    date: string;
    orderCount: number;
    revenueCents: number;
    refundsCents?: number;
    netRevenueCents?: number;
  }>;
};

type ProductsDash = {
  topProducts: Array<{ title: string; quantitySold: number; revenueCents: number; slug: string }>;
};

type OverviewPayments = {
  payments: { paidCount: number; refundedCount: number; partiallyRefundedCount: number };
};

type OperationsDash = {
  topProducts: Array<{ title: string; quantitySold: number; revenueCents: number; slug: string }>;
  warehouseHealth?: Array<{
    warehouseName: string;
    totalSkus: number;
    inStockPct: number;
    lowStockCount: number;
  }>;
  fulfillment?: { avgHoursToDeliver: number | null };
  lowStock: Array<{
    productTitle: string;
    sku: string;
    onHand: number;
    reserved: number;
    reorderLevel: number | null;
    warehouse?: { name: string };
  }>;
};

type SupportDash = {
  summary: {
    totalTickets: number;
    openTickets: number;
    pendingCustomerTickets: number;
    averageMessageCount: number;
    avgFirstResponseMinutes?: number | null;
    resolutionRatePct?: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  stitchBacklog?: {
    new: number;
    open: number;
    pending: number;
    onHold: number;
    resolved: number;
  };
  complaintCategories?: Array<{ category: string; count: number }>;
  slaAtRiskTickets?: Array<{
    id: string;
    subject: string;
    priority: string;
    status: string;
    createdAt: string;
    slaDeadlineIso: string;
  }>;
};

type RiskDash = {
  metrics: {
    openSecurityEvents: number;
    criticalSecurityEventsLast24Hours: number;
    unreviewedRiskSignals: number;
    failedLoginsLast24Hours: number;
    openAlerts: number;
    openIncidents?: number;
    suspendedAccounts?: number;
    flaggedTransactionsLast24h?: number;
  };
  recentSecurityEvents: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    createdAt: string;
  }>;
  topRiskSignals: Array<{ id: string; score: number; type: string; reviewedAt: string | null }>;
  activeAlertsList?: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    assignedToEmail: string | null;
    createdAt: string;
  }>;
  openIncidentsList?: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    ownerEmail: string | null;
  }>;
};

type HealthDash = {
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
    webhookDeliveryRate24hPct?: number | null;
    jobSuccessRate24hPct?: number | null;
  };
  deployment?: {
    cell: string | null;
    release: string | null;
  };
  dependencies?: Array<{ id: string; label: string; ok: boolean; role: string }>;
};

const SEGMENTS = {
  sales: {
    title: "Sales Performance",
    description: "Revenue, order volume, and product mix for the selected window.",
    buildPath: () => "",
    queryKey: ["admin-dashboard", "sales-v2"] as const
  },
  operations: {
    title: "Operations Control",
    description: "Fulfillment load, stock risk, and warehouse coverage.",
    buildPath: () => `/api/admin/reports/inventory?${rangeQueryString()}`,
    queryKey: ["admin-dashboard", "operations-v2"] as const
  },
  support: {
    title: "Customer Service",
    description: "Ticket backlog, SLA pressure, and complaint mix.",
    buildPath: () => `/api/admin/dashboard/support?${rangeQueryString()}`,
    queryKey: ["admin-dashboard", "support-v2"] as const
  },
  risk: {
    title: "Risk & Security",
    description: "Alerts, incidents, and authentication risk in the last day.",
    buildPath: () => "/api/admin/security/dashboard",
    queryKey: ["admin-dashboard", "risk-v2"] as const
  },
  "system-health": {
    title: "System Health",
    description: "Real-time status of background jobs, integrations, and webhook processing.",
    buildPath: () => "/api/admin/dashboard/system-health",
    queryKey: ["admin-dashboard", "system-health-v2"] as const
  }
} as const;

export type DashboardSubSegment = keyof typeof SEGMENTS;

type DashboardSubPageProps = {
  segment: DashboardSubSegment;
};

export const DashboardSubPage = ({ segment }: DashboardSubPageProps) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const cfg = SEGMENTS[segment];
  const [salesRangeDays, setSalesRangeDays] = useState<7 | 30 | 90>(30);
  const salesRangeQs = useMemo(() => rangeQueryDays(salesRangeDays), [salesRangeDays]);

  const salesBundle = useQueries({
    queries: [
      {
        queryKey: ["admin-dashboard", "sales-bundle", "sales", salesRangeDays],
        queryFn: () =>
          adminJsonGet<SalesDash>(`/api/admin/reports/sales?${salesRangeQs}`, accessToken),
        enabled: Boolean(accessToken) && segment === "sales",
        staleTime: 30_000
      },
      {
        queryKey: ["admin-dashboard", "sales-bundle", "products", salesRangeDays],
        queryFn: () =>
          adminJsonGet<ProductsDash>(`/api/admin/reports/products?${salesRangeQs}`, accessToken),
        enabled: Boolean(accessToken) && segment === "sales",
        staleTime: 30_000
      },
      {
        queryKey: ["admin-dashboard", "sales-bundle", "payments-overview"],
        queryFn: () => adminJsonGet<OverviewPayments>("/api/admin/dashboard/overview", accessToken),
        enabled: Boolean(accessToken) && segment === "sales",
        staleTime: 60_000
      }
    ]
  });

  const legacyQ = useQuery({
    queryKey: [...cfg.queryKey],
    queryFn: () => {
      const path = (cfg as { buildPath: () => string }).buildPath();
      return adminJsonGet<unknown>(path, accessToken);
    },
    enabled: Boolean(accessToken) && segment !== "sales",
    staleTime: 30_000
  });

  const err =
    legacyQ.error instanceof ApiError
      ? legacyQ.error.message
      : legacyQ.error instanceof Error
        ? legacyQ.error.message
        : null;

  const salesErr = salesBundle.find((q) => q.isError)?.error;
  const salesErrMsg =
    salesErr instanceof ApiError ? salesErr.message : salesErr instanceof Error ? salesErr.message : null;

  const body = useMemo(() => {
    const raw = legacyQ.data?.data;
    if (!raw || typeof raw !== "object") {
      return null;
    }
    return raw;
  }, [legacyQ.data?.data]);

  const quickLinks = (
    <div className="flex flex-wrap gap-2">
      {segment === "operations" ? (
        <>
          <Link
            to="/admin/orders/fulfillment-queue"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Fulfillment queue
          </Link>
          <Link
            to="/admin/orders/dispatch-queue"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Dispatch queue
          </Link>
          <Link
            to="/admin/inventory/low-stock"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Low stock
          </Link>
        </>
      ) : null}
      {segment === "support" ? (
        <>
          <Link
            to="/admin/support/queue"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
          >
            SLA queue
          </Link>
          <Link
            to="/admin/support/complaints"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Complaints
          </Link>
        </>
      ) : null}
      {segment === "risk" ? (
        <>
          <Link
            to="/admin/security/alerts"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Alerts
          </Link>
          <Link
            to="/admin/security/risk-signals"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Risk signals
          </Link>
          <Link
            to="/admin/security/incidents"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Incidents
          </Link>
        </>
      ) : null}
      {segment === "system-health" ? (
        <>
          <Link
            to="/admin/system/jobs"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Job runs
          </Link>
          <Link
            to="/admin/system/webhooks"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Webhooks
          </Link>
          <Link
            to="/admin/system/integrations-health"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Integrations
          </Link>
        </>
      ) : null}
      {segment === "sales" ? (
        <Link
          to="/admin/reports/sales"
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Full sales report
        </Link>
      ) : null}
    </div>
  );

  const salesRangePicker =
    segment === "sales" ? (
      <div className="flex rounded-lg bg-[#f2f3ff] p-1">
        {([7, 30, 90] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setSalesRangeDays(d)}
            className={clsx(
              "min-h-11 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-tighter transition-all sm:min-h-0 sm:py-1",
              salesRangeDays === d
                ? "bg-white text-[var(--color-primary)] shadow-sm"
                : "text-[#434654] hover:text-[var(--color-primary)]"
            )}
          >
            Last {d}d
          </button>
        ))}
        <button
          type="button"
          disabled
          className="flex min-h-11 items-center gap-1 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-tighter text-slate-400 sm:min-h-0 sm:py-1"
          title="Custom range coming soon"
        >
          Custom
        </button>
      </div>
    ) : null;

  return (
    <div className="space-y-6 px-3 sm:space-y-8 sm:px-0">
      <PageHeader
        title={cfg.title}
        description={cfg.description}
        titleSize={segment === "system-health" ? "deck" : "default"}
        autoBreadcrumbs={segment !== "system-health"}
        breadcrumbItems={
          segment === "system-health"
            ? [{ label: "System", to: "/admin/dashboard/overview" }, { label: "Health" }]
            : undefined
        }
        meta={
          <div className="flex flex-wrap items-center gap-4">
            {salesRangePicker}
            {quickLinks}
            {segment === "system-health" ? (
              <div className="flex flex-wrap gap-2">
                <StitchSecondaryButton type="button" disabled title="Coming soon">
                  Export Report
                </StitchSecondaryButton>
                <StitchGradientButton
                  type="button"
                  onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] })}
                >
                  Force System Sync
                </StitchGradientButton>
              </div>
            ) : null}
          </div>
        }
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-dashboard"])]}
      />

      {segment === "sales" ? (
        <>
          {salesErrMsg ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {salesErrMsg}
            </div>
          ) : null}
          {salesBundle.some((q) => q.isLoading) ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : salesBundle[0].data?.data && salesBundle[1].data?.data ? (
            <SalesSegment
              sales={salesBundle[0].data.data}
              products={salesBundle[1].data.data}
              payments={salesBundle[2].data?.data?.payments}
              paymentsOverviewQuery={{
                isLoading: salesBundle[2].isLoading,
                isError: salesBundle[2].isError,
                error: salesBundle[2].error
              }}
            />
          ) : (
            <SurfaceCard title="No data" description="Sales dashboards need report access.">
              <p className="text-sm text-slate-500">Try refreshing or verify permissions.</p>
            </SurfaceCard>
          )}
          {salesBundle[0].data?.data ? (
            <details className="rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#737685]">
                Advanced details
              </summary>
              <div className="border-t border-slate-100 p-4">
                <TechnicalJsonDisclosure
                  data={{ sales: salesBundle[0].data.data, products: salesBundle[1].data?.data }}
                  label="Underlying dashboard data"
                  defaultOpen={false}
                />
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <>
          {err ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
          ) : null}

          {legacyQ.isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : body ? (
            <div className="space-y-8">
              {segment === "operations" ? (
                <OperationsSegment data={body as OperationsDash} accessToken={accessToken} />
              ) : null}
              {segment === "support" ? <SupportSegment data={body as SupportDash} /> : null}
              {segment === "risk" ? <RiskSegment data={body as RiskDash} /> : null}
              {segment === "system-health" ? (
                <HealthSegment data={body as HealthDash} accessToken={accessToken} />
              ) : null}
              <details className="rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#737685]">
                  Advanced details
                </summary>
                <div className="border-t border-slate-100 p-4">
                  <TechnicalJsonDisclosure data={body} label="Underlying dashboard data" defaultOpen={false} />
                </div>
              </details>
            </div>
          ) : (
            <SurfaceCard title="No data" description="The dashboard endpoint returned an empty body.">
              <p className="text-sm text-slate-500">Try refreshing or verify permissions for this slice.</p>
            </SurfaceCard>
          )}
        </>
      )}
    </div>
  );
};

const SalesSegment = ({
  sales,
  products,
  payments,
  paymentsOverviewQuery
}: {
  sales: SalesDash;
  products: ProductsDash;
  payments?: OverviewPayments["payments"];
  paymentsOverviewQuery?: { isLoading: boolean; isError: boolean; error: unknown };
}) => {
  const grossRev = sales.summary?.revenueCents ?? 0;
  const refundsCompleted = sales.summary?.completedRefundsCents ?? 0;
  const netRev = sales.summary?.netRevenueCents ?? Math.max(0, grossRev - refundsCompleted);
  const grossLabel = money(grossRev);
  const netLabel = money(netRev);
  const discountPct =
    grossRev > 0 && payments
      ? (((payments.refundedCount + payments.partiallyRefundedCount) / Math.max(payments.paidCount, 1)) * 100).toFixed(1)
      : "—";

  const series = sales.series ?? [];
  const grossNetPoints = useMemo(() => {
    const netC = (p: SalesDash["series"][number]) => {
      if (p.netRevenueCents !== undefined) return Math.max(0, p.netRevenueCents);
      const r = p.refundsCents ?? 0;
      return Math.max(0, p.revenueCents - r);
    };
    return [...series]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({
        date: p.date,
        grossCents: p.revenueCents,
        netCents: netC(p)
      }));
  }, [series]);

  const avgGrossOrder = sales.summary?.averageOrderValueCents ?? 0;

  const top = (products.topProducts ?? []).slice(0, 8);
  const totalTopRev = top.reduce((s, p) => s + p.revenueCents, 0) || 1;

  const paid = payments?.paidCount ?? 0;
  const failed = payments?.refundedCount ?? 0;
  const pend = payments?.partiallyRefundedCount ?? 0;
  const payTotal = Math.max(paid + failed + pend, 1);
  const successPct = ((paid / payTotal) * 100).toFixed(1);
  const a1 = (paid / payTotal) * 360;
  const a2 = ((paid + pend) / payTotal) * 360;

  const paymentMixState = paymentsOverviewQuery
    ? getDashboardPartialState({
        isLoading: paymentsOverviewQuery.isLoading,
        isError: paymentsOverviewQuery.isError,
        error: paymentsOverviewQuery.error,
        isEmpty: false
      })
    : "ready";

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-[12px] bg-white p-5 shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#1653cc]" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#434654]">Gross Revenue</div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#181b25]">{grossLabel}</div>
          <p className="mt-2 text-[10px] text-slate-400">{sales.summary?.orderCount ?? 0} orders in range</p>
        </div>
        <div className="relative overflow-hidden rounded-[12px] bg-white p-5 shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#006b2d]" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#434654]">Net Revenue</div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#181b25]">{netLabel}</div>
          <p className="mt-2 text-[10px] text-slate-400">
            Gross {grossLabel} minus refunds completed in window ({money(refundsCompleted)}).
          </p>
        </div>
        <div className="relative overflow-hidden rounded-[12px] bg-white p-5 shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#5b5e68]" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#434654]">Average Order Value</div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#181b25]">{money(avgGrossOrder)}</div>
          <p className="mt-2 text-[10px] text-slate-400">Gross AOV in window</p>
        </div>
        <div className="relative overflow-hidden rounded-[12px] bg-white p-5 shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#ba1a1a]" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#434654]">Discount Impact</div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#181b25]">
            {discountPct === "—" ? "—" : `${discountPct}%`}
          </div>
          <p className="mt-2 text-[10px] text-[#434654]">Paid payments with refund activity / paid count.</p>
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-card)] sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8">
          <div>
            <h3 className="font-headline font-bold text-[var(--color-text-dark)]" style={{ fontSize: "var(--text-sm)" }}>
              Revenue trend
            </h3>
            <p className="mt-1 text-[var(--color-text-muted)]" style={{ fontSize: "var(--text-xs)", lineHeight: 1.5 }}>
              Grouped bars per day: gross (blue) and net (slate). Hover for amounts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-[#1653cc]/85" />
              <span className="font-bold uppercase tracking-widest text-[var(--color-text-muted)]" style={{ fontSize: "var(--text-xs)" }}>
                Gross
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-[#94a3b8]" />
              <span className="font-bold uppercase tracking-widest text-[var(--color-text-muted)]" style={{ fontSize: "var(--text-xs)" }}>
                Net
              </span>
            </div>
          </div>
        </div>
        {grossNetPoints.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No series data in this range.</p>
        ) : (
          <figure className="space-y-2">
            <TimeSeriesA11yTable
              caption="Daily gross and net revenue for the sales dashboard range"
              valueColumnHeader="Net revenue"
              rows={grossNetPoints.map((p) => ({
                date: p.date,
                value: money(p.netCents),
                detail: `Gross ${money(p.grossCents)}`
              }))}
            />
            <div
              role="group"
              aria-label="Grouped bar chart of gross and net revenue by day"
              className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-page)] px-2 py-3"
            >
              <GrossNetBarChart points={grossNetPoints} formatValue={money} />
            </div>
          </figure>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col rounded-[12px] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-tight text-[#181b25]">Top Products by Revenue</h3>
            <Link
              to="/admin/reports/products"
              className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] hover:underline"
            >
              View Full Report
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-50 text-[10px] font-bold uppercase tracking-widest text-[#434654]">
                  <th className="pb-3">Rank</th>
                  <th className="pb-3">Product Name</th>
                  <th className="pb-3 text-right">Units Sold</th>
                  <th className="pb-3 text-right">Revenue</th>
                  <th className="pb-3 text-right">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50/50">
                {top.map((p, i) => {
                  const pct = Math.round((p.revenueCents / totalTopRev) * 100);
                  return (
                    <tr key={p.slug} className="hover:bg-slate-50">
                      <td className="py-4 font-mono text-[11px] text-slate-400">{String(i + 1).padStart(2, "0")}</td>
                      <td className="py-4 text-xs font-semibold text-[#181b25]">{p.title}</td>
                      <td className="py-4 text-right font-mono text-xs">{p.quantitySold.toLocaleString()}</td>
                      <td className="py-4 text-right font-mono text-xs font-bold">{money(p.revenueCents)}</td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full bg-[#1653cc]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-[10px]">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col rounded-[var(--radius-lg)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-card)] sm:p-6">
          <div className="mb-6 flex items-center justify-between sm:mb-10">
            <h3
              className="font-headline font-bold text-[var(--color-text-dark)]"
              style={{ fontSize: "var(--text-sm)" }}
            >
              Payment Success Rate
            </h3>
          </div>
          <DashboardPartialBody
            state={paymentMixState}
            permissionsNeeded={["reports.read"]}
            error={paymentsOverviewQuery?.error}
          >
            <div className="flex flex-1 flex-wrap items-center gap-8 px-2 sm:gap-10 sm:px-4">
              <figure className="relative mx-auto h-44 w-44 shrink-0 sm:h-48 sm:w-48">
                <figcaption className="sr-only">
                  Payment success rate {successPct}% with successful, pending, and failed segments from overview payments.
                </figcaption>
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(from 0deg, var(--color-primary) 0deg ${a1}deg, #eab308 ${a1}deg ${a2}deg, #ba1a1a ${a2}deg 360deg)`
                  }}
                  role="img"
                  aria-hidden
                />
                <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-[var(--color-bg-card)] shadow-inner">
                  <span
                    className="font-bold tracking-tighter text-[var(--color-text-dark)]"
                    style={{ fontSize: "var(--text-2xl)" }}
                  >
                    {successPct}%
                  </span>
                  <span
                    className="font-bold uppercase tracking-widest text-[var(--color-text-muted)]"
                    style={{ fontSize: "var(--text-xs)" }}
                  >
                    Success
                  </span>
                </div>
              </figure>
              <div className="min-w-[min(100%,200px)] flex-1 space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
                    <span className="font-semibold text-[var(--color-text-dark)]" style={{ fontSize: "var(--text-sm)" }}>
                      Successful
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[var(--color-text-dark)]" style={{ fontSize: "var(--text-sm)" }}>
                    {paid.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-warning)]" />
                    <span className="font-semibold text-[var(--color-text-dark)]" style={{ fontSize: "var(--text-sm)" }}>
                      Pending
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[var(--color-text-dark)]" style={{ fontSize: "var(--text-sm)" }}>
                    {pend.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-danger)]" />
                    <span className="font-semibold text-[var(--color-text-dark)]" style={{ fontSize: "var(--text-sm)" }}>
                      Failed
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[var(--color-text-dark)]" style={{ fontSize: "var(--text-sm)" }}>
                    {failed.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </DashboardPartialBody>
        </div>
      </div>
    </>
  );
};

type AdminActionRow = {
  id: string;
  adminUser: { email: string } | null;
  actionCode: string;
  entityType: string | null;
  entityId: string | null;
  reason: string | null;
  createdAt: string;
};

const OperationsSegment = ({
  data,
  accessToken
}: {
  data: OperationsDash;
  accessToken: string | null;
}) => {
  const overridesQ = useQuery({
    queryKey: ["admin-dashboard", "ops-admin-actions"],
    queryFn: () =>
      adminJsonGet<{ items: AdminActionRow[] }>("/api/admin/admin-action-logs?page=1&page_size=5", accessToken),
    enabled: Boolean(accessToken),
    staleTime: 20_000,
    retry: false
  });
  const overridesState = getDashboardPartialState({
    isLoading: overridesQ.isLoading,
    isError: overridesQ.isError,
    error: overridesQ.error,
    isEmpty:
      !overridesQ.isLoading &&
      !overridesQ.isError &&
      (overridesQ.data?.data.items ?? []).length === 0
  });

  const queues = useQueries({
    queries: [
      {
        queryKey: ["admin-dashboard", "ops-fulfill-count"],
        queryFn: async () => {
          const r = await adminJsonGet<{ items: unknown[] }>(
            "/api/admin/orders/fulfillment-queue?page=1&page_size=1",
            accessToken
          );
          return Number((r.meta as { totalItems?: number })?.totalItems ?? 0);
        },
        enabled: Boolean(accessToken),
        retry: false
      },
      {
        queryKey: ["admin-dashboard", "ops-dispatch-count"],
        queryFn: async () => {
          const r = await adminJsonGet<{ items: unknown[] }>(
            "/api/admin/orders/dispatch-queue?page=1&page_size=1",
            accessToken
          );
          return Number((r.meta as { totalItems?: number })?.totalItems ?? 0);
        },
        enabled: Boolean(accessToken),
        retry: false
      }
    ]
  });

  const ufQ = queues[0];
  const dqQ = queues[1];
  const unfulfilled = ufQ.isError || ufQ.isLoading ? 0 : (ufQ.data ?? 0);
  const dispatchBacklog = dqQ.isError || dqQ.isLoading ? 0 : (dqQ.data ?? 0);
  const oos = (data.lowStock ?? []).filter((r) => r.onHand === 0).length;

  const warehouseRows = useMemo(() => {
    if (data.warehouseHealth?.length) {
      return data.warehouseHealth.map((w) => ({
        name: w.warehouseName,
        totalSkus: w.totalSkus,
        inStockPct: w.inStockPct,
        lowStockCount: w.lowStockCount
      }));
    }
    const map = new Map<string, typeof data.lowStock>();
    for (const row of data.lowStock ?? []) {
      const name = row.warehouse?.name ?? "All locations";
      const list = map.get(name) ?? [];
      list.push(row);
      map.set(name, list);
    }
    return [...map.entries()].map(([name, rows]) => {
      const inStockPct = rows.length
        ? Math.round((rows.filter((r) => r.onHand > 0).length / rows.length) * 100)
        : 0;
      return { name, totalSkus: rows.length, inStockPct, lowStockCount: rows.length };
    });
  }, [data.lowStock, data.warehouseHealth]);

  const avgFulfill = data.fulfillment?.avgHoursToDeliver;
  const fulfillLabel =
    avgFulfill != null && !Number.isNaN(avgFulfill) ? `${avgFulfill}h avg` : "—";

  const onTime = Math.max(0, unfulfilled - Math.floor(dispatchBacklog / 2));
  const atRisk = Math.min(unfulfilled, Math.ceil(dispatchBacklog / 2));
  const overdue = dispatchBacklog;
  const barTotal = Math.max(onTime + atRisk + overdue, 1);

  return (
    <>
      <div className="space-y-2">
        {ufQ.isError && !ufQ.isLoading ? (
          <DashboardPartialBody
            state={getDashboardPartialState({
              isLoading: false,
              isError: true,
              error: ufQ.error
            })}
            permissionsNeeded={["orders.read"]}
            error={ufQ.error}
          />
        ) : null}
        {dqQ.isError && !dqQ.isLoading ? (
          <DashboardPartialBody
            state={getDashboardPartialState({
              isLoading: false,
              isError: true,
              error: dqQ.error
            })}
            permissionsNeeded={["orders.read"]}
            error={dqQ.error}
          />
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StitchKpiMicro
          label="Unfulfilled Orders"
          value={ufQ.isLoading ? "…" : ufQ.isError ? "—" : unfulfilled}
          barClass="bg-[#1653cc]"
        />
        <StitchKpiMicro
          label="Dispatch Backlog"
          value={dqQ.isLoading ? "…" : dqQ.isError ? "—" : dispatchBacklog}
          barClass="bg-amber-500"
        />
        <StitchKpiMicro label="Out-of-Stock SKUs" value={oos} barClass="bg-rose-600" />
        <StitchKpiMicro label="Avg. Fulfillment Time" value={fulfillLabel} barClass="bg-slate-500" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard title="Fulfillment queue pressure" description="Relative mix of on-time, at-risk, and dispatch work.">
          <div className="h-8 w-full overflow-hidden rounded-lg bg-slate-100">
            <div className="flex h-full w-full">
              <div
                className="h-full bg-[#006b2d] transition-all"
                style={{ width: `${(onTime / barTotal) * 100}%` }}
                title="On-time"
              />
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${(atRisk / barTotal) * 100}%` }}
                title="At-risk"
              />
              <div
                className="h-full bg-[#ba1a1a] transition-all"
                style={{ width: `${(overdue / barTotal) * 100}%` }}
                title="Dispatch-heavy"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#006b2d]" /> On-time
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> At-risk
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#ba1a1a]" /> Dispatch backlog
            </span>
          </div>
        </SurfaceCard>
        <SurfaceCard
          title="Warehouse stock health"
          description="SKU coverage and low-stock concentration by warehouse."
        >
          <DataTableShell
            columns={["Warehouse", "Total SKUs", "In-stock %", "Low-stock", "Actions"]}
            rows={warehouseRows.map((w) => [
              w.name,
              String(w.totalSkus),
              `${w.inStockPct}%`,
              String(w.lowStockCount),
              <Link
                key={w.name}
                to="/admin/inventory/low-stock"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-primary)] hover:underline"
              >
                View
              </Link>
            ])}
            emptyState="No warehouse rollups in this window."
          />
        </SurfaceCard>
      </div>

      <SurfaceCard
        title="Recent operational overrides"
        description="Latest admin actions (security.audit.read). Five most recent rows."
      >
        <DashboardPartialBody
          state={overridesState}
          permissionsNeeded={["security.audit.read"]}
          error={overridesQ.error}
          emptyLabel="No admin actions recorded yet."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="h-11 px-3">Admin</th>
                  <th className="h-11 px-3">Action</th>
                  <th className="h-11 px-3">Entity</th>
                  <th className="h-11 px-3">Time</th>
                  <th className="h-11 px-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(overridesQ.data?.data.items ?? []).map((row) => (
                  <tr key={row.id} className="h-11">
                    <td className="px-3 align-middle font-mono text-[11px] text-slate-700">
                      {row.adminUser?.email ?? "—"}
                    </td>
                    <td className="px-3 align-middle text-xs font-semibold text-[#181b25]">{row.actionCode}</td>
                    <td className="px-3 align-middle font-mono text-[10px] text-slate-500">
                      {(row.entityType ?? "—") + (row.entityId ? ` · ${row.entityId.slice(0, 8)}` : "")}
                    </td>
                    <td className="px-3 align-middle font-mono text-[10px] text-slate-400">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="max-w-[200px] truncate px-3 align-middle text-[11px] text-slate-600">
                      {row.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardPartialBody>
      </SurfaceCard>
    </>
  );
};

const stitchBacklogColors = {
  new: "bg-sky-500",
  open: "bg-[#1653cc]",
  pending: "bg-amber-500",
  onHold: "bg-slate-400",
  resolved: "bg-[#006b2d]"
} as const;

const SlaCountdown = ({ deadlineIso }: { deadlineIso: string }) => {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ms = new Date(deadlineIso).getTime() - tick;
  if (ms <= 0) {
    return <span className="font-mono text-xs font-bold text-red-600">Breached</span>;
  }
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <span className="font-mono text-xs font-semibold text-amber-800">
      {m}m {String(s).padStart(2, "0")}s left
    </span>
  );
};

const formatFirstResponse = (minutes: number | null | undefined) => {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

const SupportSegment = ({ data }: { data: SupportDash }) => {
  const backlog = data.stitchBacklog ?? {
    new: 0,
    open: 0,
    pending: 0,
    onHold: 0,
    resolved: 0
  };
  const backlogTotal =
    backlog.new + backlog.open + backlog.pending + backlog.onHold + backlog.resolved || 1;
  const urgentCount = (data.byPriority ?? [])
    .filter((r) => r.priority === "URGENT" || r.priority === "HIGH")
    .reduce((s, r) => s + r.count, 0);

  const slaRows = data.slaAtRiskTickets ?? [];

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StitchKpiMicro label="Open Tickets" value={data.summary?.openTickets ?? 0} barClass="bg-[#1653cc]" />
        <StitchKpiMicro label="Urgent / Breaching SLA" value={urgentCount} barClass="bg-rose-600" />
        <StitchKpiMicro
          label="Avg First Response Time"
          value={formatFirstResponse(data.summary?.avgFirstResponseMinutes)}
          barClass="bg-amber-500"
        />
        <StitchKpiMicro
          label="Resolution Rate"
          value={data.summary?.resolutionRatePct != null ? `${data.summary.resolutionRatePct}%` : "—"}
          barClass="bg-[#006b2d]"
        />
      </div>

      <SurfaceCard
        title="Ticket backlog by status"
        description="New · Open · Pending · On hold · Resolved (same reporting window)."
      >
        <div className="h-10 w-full overflow-hidden rounded-lg bg-slate-100">
          <div className="flex h-full w-full">
            {(
              [
                ["new", backlog.new] as const,
                ["open", backlog.open] as const,
                ["pending", backlog.pending] as const,
                ["onHold", backlog.onHold] as const,
                ["resolved", backlog.resolved] as const
              ] as const
            ).map(([key, count]) => (
              <div
                key={key}
                className={clsx("h-full transition-all", stitchBacklogColors[key])}
                style={{ width: `${(count / backlogTotal) * 100}%` }}
                title={`${key}: ${count}`}
              />
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1">
            <span className={clsx("h-2 w-2 rounded-full", stitchBacklogColors.new)} /> New ({backlog.new})
          </span>
          <span className="flex items-center gap-1">
            <span className={clsx("h-2 w-2 rounded-full", stitchBacklogColors.open)} /> Open ({backlog.open})
          </span>
          <span className="flex items-center gap-1">
            <span className={clsx("h-2 w-2 rounded-full", stitchBacklogColors.pending)} /> Pending ({backlog.pending})
          </span>
          <span className="flex items-center gap-1">
            <span className={clsx("h-2 w-2 rounded-full", stitchBacklogColors.onHold)} /> On hold ({backlog.onHold})
          </span>
          <span className="flex items-center gap-1">
            <span className={clsx("h-2 w-2 rounded-full", stitchBacklogColors.resolved)} /> Resolved ({backlog.resolved})
          </span>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard
          title="SLA breach risk"
          description="Next deadlines from policy-based SLA targets (priority → response window)."
        >
          {slaRows.length === 0 ? (
            <p className="text-sm text-slate-500">No open tickets in this window.</p>
          ) : (
            <ul className="space-y-3">
              {slaRows.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-page)] p-3 text-sm text-[var(--color-text-dark)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/admin/support/tickets/${t.id}`}
                      className="font-mono text-xs text-[var(--color-primary)] hover:underline"
                    >
                      #{t.id.slice(0, 8)}
                    </Link>
                    <SlaCountdown deadlineIso={t.slaDeadlineIso} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold">{t.subject}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t.priority.replace(/_/g, " ")} · {t.status.replace(/_/g, " ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
        <SurfaceCard title="Complaint queue summary" description="Keyword-classified subjects in the same window.">
          <DataTableShell
            columns={["Category", "Tickets"]}
            rows={(data.complaintCategories ?? [])
              .filter((r) => r.category !== "Other" || r.count > 0)
              .map((r) => [r.category, String(r.count)])}
            emptyState="No complaint categories in range."
          />
        </SurfaceCard>
      </div>
    </>
  );
};

const RiskSegment = ({ data }: { data: RiskDash }) => {
  const m = data.metrics;
  const events = data.recentSecurityEvents ?? [];
  const hours = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, i) => ({ i, c: 0 }));
    const windowStart = Date.now() - 24 * 60 * 60 * 1000;
    for (const e of events) {
      const t = new Date(e.createdAt).getTime();
      if (t < windowStart) continue;
      const slot = Math.min(23, Math.max(0, Math.floor((t - windowStart) / (60 * 60 * 1000))));
      buckets[slot].c += 1;
    }
    return buckets;
  }, [events]);
  const hourlyCounts = hours.map((b) => b.c);
  const alertsList = data.activeAlertsList ?? [];
  const incidentsList = data.openIncidentsList ?? [];

  return (
    <div className="rounded-[12px] border border-red-100/80 bg-slate-900/[0.03] p-4 shadow-sm sm:p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div
          className={clsx(
            "rounded-xl",
            (m?.openAlerts ?? 0) > 0 ? "ring-2 ring-red-300 ring-offset-2 ring-offset-[#f8fafc]" : ""
          )}
        >
          <StitchKpiMicro
            label="Active Alerts"
            value={m?.openAlerts ?? 0}
            barClass={(m?.openAlerts ?? 0) > 0 ? "bg-red-600" : "bg-[#1653cc]"}
          />
        </div>
        <StitchKpiMicro label="Open Incidents" value={m?.openIncidents ?? 0} barClass="bg-slate-700" />
        <StitchKpiMicro
          label="Flagged Transactions (24h)"
          value={m?.flaggedTransactionsLast24h ?? 0}
          barClass="bg-rose-600"
        />
        <StitchKpiMicro label="Suspended Accounts" value={m?.suspendedAccounts ?? 0} barClass="bg-amber-600" />
      </div>

      <SurfaceCard
        className="mt-6 border-red-100/60 bg-white/90"
        title="Security events spike"
        description="Line chart — events per hour (last 24h). Red dashed line at 65% of chart height."
      >
        <figure className="space-y-3">
          <TimeSeriesA11yTable
            caption="Security events per hour for the last 24 hours"
            valueColumnHeader="Events"
            rows={hours.map((b) => ({
              date: `Hour ${b.i + 1} of 24`,
              value: String(b.c),
              detail: "Sampled from latest security feed"
            }))}
          />
          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <div className="rounded-lg border border-slate-100 bg-white p-2">
              <SecurityHourlyLineChart counts={hourlyCounts} />
            </div>
          </div>
          <figcaption className="text-[10px] text-[var(--color-text-muted)]">
            Failed admin logins (24h): {m?.failedLoginsLast24Hours ?? 0}.
          </figcaption>
        </figure>
      </SurfaceCard>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard title="Active alerts" description="Open operational alerts with assignee.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="h-11 px-3">Type</th>
                  <th className="h-11 px-3">Severity</th>
                  <th className="h-11 px-3">Assigned</th>
                  <th className="h-11 px-3 text-right">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {alertsList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-sm text-slate-500">
                      No active alerts.
                    </td>
                  </tr>
                ) : (
                  alertsList.map((row) => (
                    <tr key={row.id} className="h-11">
                      <td className="px-3 align-middle text-xs font-semibold text-[#181b25]">{row.type}</td>
                      <td className="px-3 align-middle text-[10px] font-bold uppercase text-slate-600">{row.severity}</td>
                      <td className="px-3 align-middle font-mono text-[10px] text-slate-500">
                        {row.assignedToEmail ?? "—"}
                      </td>
                      <td className="px-3 text-right align-middle font-mono text-[10px] text-slate-400">
                        {formatTimeAgo(row.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
        <SurfaceCard title="Open incidents" description="Investigations in OPEN or INVESTIGATING.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="h-11 px-3">Title</th>
                  <th className="h-11 px-3">Status</th>
                  <th className="h-11 px-3">Created</th>
                  <th className="h-11 px-3">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {incidentsList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-sm text-slate-500">
                      No open incidents.
                    </td>
                  </tr>
                ) : (
                  incidentsList.map((row) => (
                    <tr key={row.id} className="h-11">
                      <td className="max-w-[200px] truncate px-3 align-middle text-xs font-semibold text-[#181b25]">
                        {row.title}
                      </td>
                      <td className="px-3 align-middle text-[10px] font-bold uppercase text-slate-600">
                        {row.status.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 align-middle font-mono text-[10px] text-slate-500">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 align-middle font-mono text-[10px] text-slate-500">
                        {row.ownerEmail ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

const formatProcessUptime = (totalSeconds: number) => {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 0)}m`;
};

const DEFAULT_WEBHOOK_HOURLY = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  received: 0,
  failed: 0
}));

const formatLatencyMs = (ms: number) => {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
};

const formatJobRunDuration = (startedAt: string, finishedAt: string | null) => {
  if (!finishedAt) return "—";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
};

type JobRunListItem = {
  id: string;
  jobName: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
};

type IntegrationsHealthLatencyPayload = {
  webhookProcessingLatency?: {
    windowHours: number;
    byProvider: Array<{ provider: string; sampleCount: number; avgMs: number; p50Ms: number }>;
  };
};

const HealthSegment = ({ data, accessToken }: { data: HealthDash; accessToken: string | null }) => {
  const deps = data.dependencies ?? [];
  const workload = data.workload24h;
  const runtime = data.runtime;
  const webhookBuckets = workload?.webhookHourly ?? DEFAULT_WEBHOOK_HOURLY;

  const [jobsQ, integrationsHealthQ] = useQueries({
    queries: [
      {
        queryKey: ["admin-dashboard", "health-live-jobs"],
        queryFn: () =>
          adminJsonGet<{ items: JobRunListItem[] }>("/api/admin/jobs?page=1&pageSize=8", accessToken),
        enabled: Boolean(accessToken),
        staleTime: 12_000,
        retry: false
      },
      {
        queryKey: ["admin-dashboard", "health-integrations-extended"],
        queryFn: () => adminJsonGet<IntegrationsHealthLatencyPayload>("/api/admin/integrations/health", accessToken),
        enabled: Boolean(accessToken),
        staleTime: 20_000,
        retry: false
      }
    ]
  });

  const jobSuccessMetaQ = useQueries({
    queries: (["SUCCEEDED", "FAILED"] as const).map((st) => ({
      queryKey: ["admin-dashboard", "health-job-success-split", st],
      queryFn: () =>
        adminJsonGet<{ items: unknown[] }>(`/api/admin/jobs?page=1&pageSize=1&status=${st}`, accessToken),
      enabled: Boolean(accessToken),
      staleTime: 15_000,
      retry: false
    }))
  });

  const latency = integrationsHealthQ.data?.data?.webhookProcessingLatency;
  const jobItems = jobsQ.data?.data?.items ?? [];

  const jobsPanelState = getDashboardPartialState({
    isLoading: jobsQ.isLoading,
    isError: jobsQ.isError,
    error: jobsQ.error,
    isEmpty: !jobsQ.isLoading && !jobsQ.isError && jobItems.length === 0
  });

  const integrationsLatencyState = getDashboardPartialState({
    isLoading: integrationsHealthQ.isLoading,
    isError: integrationsHealthQ.isError,
    error: integrationsHealthQ.error,
    isEmpty: false
  });

  const webhookLineChart = useMemo(() => {
    const n = webhookBuckets.length;
    const processedSeries = webhookBuckets.map((b) => Math.max(0, b.received - b.failed));
    const maxY = Math.max(
      1,
      ...webhookBuckets.map((b) => Math.max(b.received, b.failed, Math.max(0, b.received - b.failed)))
    );
    const w = 288;
    const h = 112;
    const padX = 6;
    const padY = 8;
    const innerW = w - padX * 2;
    const innerH = h - padY * 2;
    const xs = (i: number) => padX + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = (v: number) => padY + innerH - (v / maxY) * innerH;
    const toPoints = (vals: number[]) => vals.map((v, i) => `${xs(i)},${yAt(v)}`).join(" ");
    return {
      w,
      h,
      receivedPts: toPoints(webhookBuckets.map((b) => b.received)),
      processedPts: toPoints(processedSeries),
      failedPts: toPoints(webhookBuckets.map((b) => b.failed))
    };
  }, [webhookBuckets]);

  const failedJobs = workload?.failedJobs24h ?? 0;
  const failingProviders = workload?.failingIntegrationProviders ?? 0;

  const succTracked = Number(jobSuccessMetaQ[0]?.data?.meta?.total ?? 0);
  const failTracked = Number(jobSuccessMetaQ[1]?.data?.meta?.total ?? 0);
  const jobSuccessPct =
    succTracked + failTracked > 0
      ? `${((succTracked / (succTracked + failTracked)) * 100).toFixed(1)}%`
      : "—";

  const whReceived = webhookBuckets.reduce((s, b) => s + b.received, 0);
  const whFailed = webhookBuckets.reduce((s, b) => s + b.failed, 0);
  const webhookDeliveryPct =
    whReceived > 0 ? `${(((whReceived - whFailed) / whReceived) * 100).toFixed(1)}%` : "100.0%";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StitchKpiMicro
          label="Job success rate %"
          value={jobSuccessPct}
          footer={
            <Link
              to="/admin/system/jobs"
              className="text-[11px] font-bold uppercase tracking-tight text-[#1653cc] hover:underline"
            >
              Job runs
            </Link>
          }
          barClass="bg-[#006b2d]"
        />
        <StitchKpiMicro
          label="Webhook delivery rate %"
          value={webhookDeliveryPct}
          footer={
            <Link
              to="/admin/system/webhooks"
              className="text-[11px] font-bold uppercase tracking-tight text-[#1653cc] hover:underline"
            >
              Webhooks
            </Link>
          }
          barClass="bg-orange-400"
        />
        <StitchKpiMicro
          label="Failed jobs (24h)"
          value={String(failedJobs)}
          footer={<span className="text-[#ba1a1a]">Rolling window</span>}
          barClass="bg-[#ba1a1a]"
        />
        <StitchKpiMicro
          label="Failing integrations"
          value={String(failingProviders)}
          footer={
            <Link
              to="/admin/system/integrations-health"
              className="text-[11px] font-bold uppercase tracking-tight text-[#1653cc] hover:underline"
            >
              Integration health
            </Link>
          }
          barClass="bg-[#ba1a1a]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SurfaceCard title="API process" description="Node worker lifetime (this instance).">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-[#181b25]">
              {runtime ? formatProcessUptime(runtime.uptimeSeconds) : "—"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {runtime?.environment ?? "—"}
            </span>
          </div>
        </SurfaceCard>
        <SurfaceCard title="Readiness" description="Live probes for critical dependencies.">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                data.status === "ready" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
              }`}
            >
              {data.status}
            </div>
            <p className="text-[10px] text-slate-500">
              <span className="font-mono">{new Date(data.now).toLocaleTimeString()}</span>
            </p>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard
        title="Webhook processing throughput"
        description="Hourly series (last 24h): received, processed (received − hard failures), and failed."
      >
        <figure className="space-y-3">
          <TimeSeriesA11yTable
            caption="Webhook events per hour in the rolling 24 hour window"
            valueColumnHeader="Received"
            rows={webhookBuckets.map((b) => {
              const processed = Math.max(0, b.received - b.failed);
              return {
                date: `Hour slot ${b.hour + 1} of 24`,
                value: String(b.received),
                detail: `Processed ${processed}, failed ${b.failed}`
              };
            })}
          />
          <div className="mb-2 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-4 bg-[var(--color-primary)]" />
              Received
            </span>
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-4 bg-[#006b2d]" />
              Processed
            </span>
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-4 bg-[var(--color-danger)]" />
              Failed
            </span>
          </div>
          <div
            role="img"
            aria-label="Line chart of webhook received, processed, and failed counts per hour, last 24 hours"
            className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0"
          >
            <svg
              viewBox={`0 0 ${webhookLineChart.w} ${webhookLineChart.h}`}
              className="h-56 w-full min-w-[280px] text-[var(--color-primary)]"
            >
              <line
                x1={6}
                y1={webhookLineChart.h - 8}
                x2={webhookLineChart.w - 6}
                y2={webhookLineChart.h - 8}
                stroke="var(--color-border-light)"
                strokeWidth="1"
              />
              <polyline
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeLinejoin="round"
                points={webhookLineChart.receivedPts}
              />
              <polyline
                fill="none"
                stroke="#006b2d"
                strokeWidth="2"
                strokeLinejoin="round"
                points={webhookLineChart.processedPts}
              />
              <polyline
                fill="none"
                stroke="var(--color-danger)"
                strokeWidth="2"
                strokeLinejoin="round"
                points={webhookLineChart.failedPts}
              />
            </svg>
          </div>
          <figcaption className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
            <span>−24h</span>
            <span>−18h</span>
            <span>−12h</span>
            <span>−6h</span>
            <span>Now</span>
          </figcaption>
        </figure>
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard
          title="Live job runs"
          description="Latest tracked BullMQ runs (requires system.jobs.read)."
        >
          <DashboardPartialBody
            state={jobsPanelState}
            permissionsNeeded={["system.jobs.read"]}
            error={jobsQ.error}
            emptyLabel="No recorded job runs yet."
          >
            <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border-light)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    <th className="pb-2 pr-2">Job</th>
                    <th className="pb-2 pr-2">Status</th>
                    <th className="pb-2 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-light)]/50">
                  {jobItems.map((job) => (
                    <tr key={job.id} className="hover:bg-[var(--color-bg-page)]/80">
                      <td className="py-2 pr-2">
                        <Link
                          to={`/admin/system/jobs/${job.id}`}
                          className="font-mono text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
                        >
                          {job.jobName}
                        </Link>
                      </td>
                      <td className="py-2 pr-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            job.status === "FAILED"
                              ? "bg-red-100 text-red-800"
                              : job.status === "SUCCEEDED"
                                ? "bg-emerald-100 text-emerald-900"
                                : job.status === "RUNNING"
                                  ? "bg-blue-100 text-blue-900"
                                  : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {job.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono text-[11px] text-[var(--color-text-muted)]">
                        {formatJobRunDuration(job.startedAt, job.finishedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardPartialBody>
          <Link
            to="/admin/system/jobs"
            className="mt-4 inline-block text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] hover:underline"
          >
            View all job runs
          </Link>
        </SurfaceCard>

        <SurfaceCard
          title="Webhook processing latency"
          description={
            latency
              ? `SUCCEEDED attempts, last ${latency.windowHours}h (p50 / avg).`
              : "From integration health (requires system.integrations.read or related access)."
          }
        >
          <DashboardPartialBody
            state={integrationsLatencyState}
            permissionsNeeded={["system.integrations.read"]}
            error={integrationsHealthQ.error}
          >
            {!latency || latency.byProvider.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                No successful webhook attempts in the sampling window.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {latency.byProvider.map((row) => (
                  <div
                    key={row.provider}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-bg-page)] p-3 transition-colors hover:border-[var(--color-primary)]/25"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--color-text-dark)]">{row.provider}</span>
                      <span className="font-mono text-[9px] text-[var(--color-text-muted)]">n={row.sampleCount}</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-tighter text-[var(--color-text-muted)]">
                        p50 / avg
                      </p>
                      <p className="font-mono text-sm font-bold text-[var(--color-primary)]">
                        {formatLatencyMs(row.p50Ms)} / {formatLatencyMs(row.avgMs)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardPartialBody>
          <Link
            to="/admin/system/integrations-health"
            className="mt-4 inline-block text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] hover:underline"
          >
            Full integration health
          </Link>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {deps.length > 0 ? (
          deps.map((d) => (
            <SurfaceCard key={d.id} title={d.label} description={d.role}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.15)] ${
                      d.ok ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm font-semibold text-[#181b25]">{d.ok ? "Healthy" : "Unavailable"}</span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{d.id}</span>
              </div>
            </SurfaceCard>
          ))
        ) : (
          <SurfaceCard title="Dependencies" description="Probe details will appear after the next API refresh.">
            <p className="text-sm text-slate-500">Dependency checks will appear after the next refresh.</p>
          </SurfaceCard>
        )}
      </div>
    </div>
  );
};
