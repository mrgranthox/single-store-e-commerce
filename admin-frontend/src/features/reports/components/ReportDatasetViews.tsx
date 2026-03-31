import type { ReactNode } from "react";

import { DataTableShell } from "@/components/primitives/DataTableShell";
import { KpiCard } from "@/components/primitives/KpiCard";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import type { ReportDatasetSegment } from "@/features/reports/types/report-payloads";
import type {
  CustomerReportData,
  MarketingReportData,
  PostPurchaseReportData,
  ProductPerformanceReportData,
  SalesReportData,
  SupportReportData
} from "@/features/reports/types/report-payloads";

import { DualMetricTrendChart } from "@/features/reports/components/DualMetricTrendChart";
import { CategoryBarList, SingleSeriesLineChart } from "@/features/reports/components/ReportMiniCharts";

const money = (cents: number) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)}`;
  }
};

const formatMinutes = (m: number | null) => {
  if (m == null) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
};

const pctDeltaLabel = (cur: number, prev: number) => {
  if (prev === 0 && cur === 0) return "vs prior: flat";
  if (prev === 0) return "vs prior: new";
  const d = ((cur - prev) / prev) * 100;
  return `vs prior ${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
};

const downloadCsv = (filename: string, header: string[], lines: string[][]) => {
  const esc = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const body = [header.map(esc).join(","), ...lines.map((row) => row.map(esc).join(","))].join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const SimpleDonut = ({
  segments,
  format
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  format: (n: number) => string;
}) => {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No distribution data for this range.</p>;
  }
  const w = 160;
  const r = 58;
  const c = 80;
  let angle = -Math.PI / 2;
  const arcs: ReactNode[] = [];
  for (const seg of segments) {
    if (seg.value <= 0) continue;
    const slice = (seg.value / total) * Math.PI * 2;
    const x1 = c + r * Math.cos(angle);
    const y1 = c + r * Math.sin(angle);
    angle += slice;
    const x2 = c + r * Math.cos(angle);
    const y2 = c + r * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    arcs.push(
      <path
        key={seg.label}
        d={`M ${c} ${c} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={seg.color}
      >
        <title>{`${seg.label}: ${format(seg.value)}`}</title>
      </path>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg viewBox={`0 0 ${w} ${w}`} className="h-40 w-40 shrink-0" role="img" aria-label="Distribution chart">
        {arcs}
        <circle cx={c} cy={c} r={32} fill="white" />
        <text x={c} y={c + 4} textAnchor="middle" className="fill-[#0f1117] font-headline text-[11px] font-bold">
          {format(total)}
        </text>
      </svg>
      <ul className="min-w-[180px] space-y-2 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-mono text-xs font-semibold text-[#0f1117]">{format(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const PriorityVolumeBars = ({ byPriority }: { byPriority: SupportReportData["byPriority"] }) => {
  const order = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
  const colors: Record<string, string> = {
    URGENT: "bg-[#ba1a1a]",
    HIGH: "bg-amber-500",
    MEDIUM: "bg-[#1653cc]",
    LOW: "bg-slate-300"
  };
  const rows = order.map((p) => {
    const row = byPriority.find((x) => x.priority === p);
    return { priority: p, count: row?.count ?? 0 };
  });
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-10 w-full overflow-hidden rounded-lg bg-[#f1f3f9]">
        {rows.map((r) => (
          <div
            key={r.priority}
            className={`${colors[r.priority] ?? "bg-slate-400"} flex items-center justify-center text-[10px] font-bold text-white`}
            style={{ width: `${(r.count / total) * 100}%` }}
            title={`${r.priority}: ${r.count}`}
          >
            {r.count > 0 && (r.count / total) * 100 > 8 ? r.count : ""}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-[var(--color-text-muted)]">
        {rows.map((r) => (
          <span key={r.priority} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${colors[r.priority]}`} />
            {r.priority.replace(/_/g, " ")}: {r.count}
          </span>
        ))}
      </div>
    </div>
  );
};

const SalesView = ({
  data,
  compare,
  compareLoading
}: {
  data: SalesReportData;
  compare: SalesReportData | null;
  compareLoading: boolean;
}) => {
  const { summary, series } = data;
  const cs = compare?.summary;
  const refundImpactPct =
    summary.revenueCents > 0
      ? `${((summary.completedRefundsCents / summary.revenueCents) * 100).toFixed(1)}%`
      : "—";
  const discountPctLabel =
    summary.discountImpactPctOfSubtotal != null
      ? `${summary.discountImpactPctOfSubtotal}%`
      : summary.discountImpactPctOfGross != null
        ? `${summary.discountImpactPctOfGross}% (of gross)`
        : "—";

  const points = series.map((row) => ({
    date: row.date,
    grossCents: row.revenueCents,
    netCents: row.netRevenueCents
  }));

  const exportSalesCsv = () => {
    downloadCsv(
      "sales-report-series.csv",
      ["Date", "Orders", "Gross revenue (cents)", "Refunds (cents)", "Net revenue (cents)"],
      series.map((r) => [
        r.date,
        String(r.orderCount),
        String(r.revenueCents),
        String(r.refundsCents),
        String(r.netRevenueCents)
      ])
    );
  };

  const revenueByCategory = data.revenueByCategory ?? [];
  const paymentMix = data.paymentMethodMix ?? [];
  const topProducts = data.topProductsByRevenue ?? [];

  const payColors = ["#1653cc", "#3b6de6", "#94a3b8", "#f59e0b", "#22c55e", "#64748b"];

  return (
    <>
      {compareLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading comparison period…</p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Gross revenue"
          value={money(summary.revenueCents)}
          tone="primary"
          delta={cs ? pctDeltaLabel(summary.revenueCents, cs.revenueCents) : undefined}
        />
        <KpiCard
          label="Net revenue"
          value={money(summary.netRevenueCents)}
          tone="success"
          delta={cs ? pctDeltaLabel(summary.netRevenueCents, cs.netRevenueCents) : undefined}
        />
        <KpiCard
          label="Orders"
          value={String(summary.orderCount)}
          tone="neutral"
          delta={cs ? pctDeltaLabel(summary.orderCount, cs.orderCount) : undefined}
        />
        <KpiCard
          label="Average order value"
          value={money(summary.averageOrderValueCents)}
          tone="neutral"
          delta={cs ? pctDeltaLabel(summary.averageOrderValueCents, cs.averageOrderValueCents) : undefined}
        />
        <KpiCard
          label="Discount impact (checkout)"
          value={discountPctLabel}
          detail={`Coupon / promo savings from checkout snapshots · Refunds: ${refundImpactPct} of gross`}
          tone="warning"
        />
      </div>

      <SurfaceCard title="Revenue trend" description="Gross vs net by day for the selected range.">
        {points.length > 0 ? (
          <DualMetricTrendChart points={points} formatValue={money} />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">No series points for this range.</p>
        )}
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard title="Revenue by category" description="Line revenue attributed to the primary category on each product.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Category", "Revenue", "% of total", "Orders", "AOV"]}
            rows={revenueByCategory.map((r) => [
              r.categoryName,
              money(r.revenueCents),
              `${r.pctOfTotal}%`,
              String(r.orderCount),
              money(r.averageOrderValueCents)
            ])}
            rowKeys={revenueByCategory.map((r) => r.categoryName)}
            emptyState="No categorized order lines in this range."
          />
        </SurfaceCard>
        <SurfaceCard title="Payment method mix" description="Paid capture volume by payment provider code.">
          {paymentMix.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No payment rows in range.</p>
          ) : (
            <SimpleDonut
              segments={paymentMix.map((row, i) => ({
                label: row.provider,
                value: row.revenueCents,
                color: payColors[i % payColors.length]!
              }))}
              format={(n) => money(n)}
            />
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard
        title="Top products by revenue"
        description="Ranked catalog performance for the range."
        action={
          <button
            type="button"
            onClick={exportSalesCsv}
            className="no-print rounded-lg border border-[var(--color-border-light)] bg-white px-3 py-2 text-xs font-semibold text-[#0f1117] shadow-sm hover:bg-[#f8f9fb]"
          >
            Export CSV
          </button>
        }
      >
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">
          Use <strong>Print / Save as PDF</strong> in the page header for a PDF via your browser.
        </p>
        <DataTableShell
          variant="stitchOperational"
          embedded
          columns={["Rank", "Product", "Units", "Revenue", "% of total"]}
          rows={topProducts.map((r) => [
            String(r.rank),
            r.title,
            String(r.quantitySold),
            money(r.revenueCents),
            `${r.pctOfTotal}%`
          ])}
          rowKeys={topProducts.map((r) => r.productId)}
          emptyState="No product lines in this range."
        />
      </SurfaceCard>
    </>
  );
};

const ProductsView = ({
  data,
  compare,
  compareLoading
}: {
  data: ProductPerformanceReportData;
  compare: ProductPerformanceReportData | null;
  compareLoading: boolean;
}) => {
  const totalUnits = data.topProducts.reduce((s, p) => s + p.quantitySold, 0);
  const totalRev = data.topProducts.reduce((s, p) => s + p.revenueCents, 0);
  const cpUnits = compare?.topProducts.reduce((s, p) => s + p.quantitySold, 0) ?? 0;
  const cpRev = compare?.topProducts.reduce((s, p) => s + p.revenueCents, 0) ?? 0;
  const returnedUnits = data.topProducts.reduce(
    (s, p) => s + ((p.returnRatePct ?? 0) / 100) * p.quantitySold,
    0
  );
  const refundedCents = data.topProducts.reduce(
    (s, p) => s + ((p.refundRatePct ?? 0) / 100) * p.revenueCents,
    0
  );
  const avgReturn =
    totalUnits > 0 ? `${((returnedUnits / totalUnits) * 100).toFixed(2)}%` : "—";
  const avgRefund = totalRev > 0 ? `${((refundedCents / totalRev) * 100).toFixed(2)}%` : "—";
  const rows = data.topProducts.map((p, i) => {
    const pct = totalRev > 0 ? `${((p.revenueCents / totalRev) * 100).toFixed(1)}%` : "—";
    return [
      String(i + 1),
      p.title,
      String(p.quantitySold),
      money(p.revenueCents),
      `${p.returnRatePct ?? 0}%`,
      `${p.refundRatePct ?? 0}%`,
      pct
    ];
  });

  const catRows = data.categoryPerformance ?? [];
  const highReturn = data.highReturnProducts ?? [];

  return (
    <>
      {compareLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading comparison period…</p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Units sold (top catalog)"
          value={String(totalUnits)}
          tone="neutral"
          delta={compare ? pctDeltaLabel(totalUnits, cpUnits) : undefined}
        />
        <KpiCard
          label="Revenue (top products)"
          value={money(totalRev)}
          tone="primary"
          delta={compare ? pctDeltaLabel(totalRev, cpRev) : undefined}
        />
        <KpiCard
          label="Avg return rate (weighted)"
          value={avgReturn}
          detail="Return qty ÷ units sold on top list"
          tone="neutral"
        />
        <KpiCard
          label="Avg refund rate (weighted)"
          value={avgRefund}
          detail="Refund $ ÷ revenue on top list"
          tone="neutral"
        />
      </div>

      <SurfaceCard title="Top products" description="Rank, sales, and revenue for the selected window.">
        <DataTableShell
          variant="stitchOperational"
          embedded
          columns={["Rank", "Product", "Units sold", "Revenue", "Return rate", "Refund rate", "% of total"]}
          rows={rows}
          rowKeys={data.topProducts.map((p) => p.productId)}
          emptyState="No product sales in this range."
        />
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard title="Category performance" description="Revenue by primary product category.">
          {catRows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No categorized sales in range.</p>
          ) : (
            <CategoryBarList
              rows={catRows.map((r) => ({
                label: r.categoryName,
                value: r.revenueCents,
                pct: r.pctOfTotal
              }))}
              formatValue={(n) => money(n)}
            />
          )}
        </SurfaceCard>
        <SurfaceCard title="Highest return-rate products" description="Returned units vs units sold in range.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Product", "Return rate", "Returned", "Sold"]}
            rows={highReturn.map((r) => [
              r.title,
              `${r.returnRatePct}%`,
              String(r.returnedQuantity),
              String(r.quantitySold)
            ])}
            rowKeys={highReturn.map((r) => r.productId)}
            emptyState="No returns linked to products in this range."
          />
        </SurfaceCard>
      </div>
    </>
  );
};

const InventoryView = ({
  data,
  compare,
  compareLoading
}: {
  data: ProductPerformanceReportData;
  compare: ProductPerformanceReportData | null;
  compareLoading: boolean;
}) => {
  const totalSkus = data.warehouseHealth.reduce((s, w) => s + w.totalSkus, 0);
  const avgInStock =
    data.warehouseHealth.length > 0
      ? Math.round(
          data.warehouseHealth.reduce((s, w) => s + w.inStockPct, 0) / data.warehouseHealth.length
        )
      : 0;
  const lowEvents = data.warehouseHealth.reduce((s, w) => s + w.lowStockCount, 0);
  const stockout = data.stockoutMetrics;
  const cpSkus = compare?.warehouseHealth.reduce((s, w) => s + w.totalSkus, 0) ?? 0;
  const cpAvgInStock =
    compare && compare.warehouseHealth.length > 0
      ? Math.round(
          compare.warehouseHealth.reduce((s, w) => s + w.inStockPct, 0) / compare.warehouseHealth.length
        )
      : 0;
  const cpLow = compare?.warehouseHealth.reduce((s, w) => s + w.lowStockCount, 0) ?? 0;
  const cpStockout = compare?.stockoutMetrics;
  const trend = data.inventoryInStockTrend ?? [];
  const movementRows = data.movementBreakdown ?? [];
  const movementTotal = movementRows.reduce((s, m) => s + m.eventCount, 0);
  const adjusted = data.mostAdjustedSkus ?? [];

  return (
    <>
      {compareLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading comparison period…</p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Tracked SKU rows"
          value={String(totalSkus)}
          detail="Across warehouses"
          tone="neutral"
          delta={compare ? pctDeltaLabel(totalSkus, cpSkus) : undefined}
        />
        <KpiCard
          label="Avg in-stock rate"
          value={`${avgInStock}%`}
          tone="success"
          delta={compare ? pctDeltaLabel(avgInStock, cpAvgInStock) : undefined}
        />
        <KpiCard
          label="Low-stock rows"
          value={String(lowEvents)}
          tone="warning"
          delta={compare ? pctDeltaLabel(lowEvents, cpLow) : undefined}
        />
        <KpiCard
          label="Stockout revenue risk (est.)"
          value={money(stockout?.estimatedStockoutRevenueRiskCents ?? 0)}
          detail={`Catalog heuristic · ${stockout?.outOfStockLineCount ?? 0} zero-stock rows. OOS variant sales in range: ${money(stockout?.revenueFromCurrentlyOosVariantsCents ?? 0)} · daily run-rate: ${money(stockout?.oosSkuDailyRunRateRevenueCents ?? 0)}/day`}
          tone="neutral"
          delta={
            compare
              ? pctDeltaLabel(
                  stockout?.estimatedStockoutRevenueRiskCents ?? 0,
                  cpStockout?.estimatedStockoutRevenueRiskCents ?? 0
                )
              : undefined
          }
        />
      </div>

      <SurfaceCard
        title="In-stock rate trend"
        description="From automated inventory overview snapshots (warehouse-wide coverage)."
      >
        {trend.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No snapshots in this date window.</p>
        ) : (
          <SingleSeriesLineChart
            points={trend.map((row) => ({ date: row.date, value: row.inStockPct }))}
            formatY={(n) => `${n}%`}
            ariaLabel="In-stock percentage over time"
            stroke="#006b2d"
          />
        )}
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard title="Movement mix" description="Inventory movements captured in the range.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Movement type", "Events", "Units (abs)", "% of events"]}
            rows={movementRows.map((m) => [
              m.movementType.replace(/_/g, " "),
              String(m.eventCount),
              String(m.unitsDeltaAbs),
              movementTotal > 0 ? `${Math.round((m.eventCount / movementTotal) * 1000) / 10}%` : "—"
            ])}
            rowKeys={movementRows.map((m) => m.movementType)}
            emptyState="No inventory movements in range."
          />
        </SurfaceCard>
        <SurfaceCard title="Frequently adjusted SKUs" description="Manual increase/decrease events.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["SKU", "Product", "Warehouse", "Adjustments"]}
            rows={adjusted.map((r) => [
              <span key={r.sku} className="font-mono text-xs">
                {r.sku}
              </span>,
              r.productTitle,
              r.warehouseName,
              String(r.adjustmentCount)
            ])}
            rowKeys={adjusted.map((r) => r.sku)}
            emptyState="No manual adjustments in range."
          />
        </SurfaceCard>
      </div>

      <SurfaceCard title="Warehouse health" description="Coverage and low-stock counts by location.">
        <DataTableShell
          variant="stitchOperational"
          embedded
          columns={["Warehouse", "SKU rows", "In-stock %", "Low-stock rows"]}
          rows={data.warehouseHealth.map((w) => [
            w.warehouseName,
            String(w.totalSkus),
            `${w.inStockPct}%`,
            String(w.lowStockCount)
          ])}
          rowKeys={data.warehouseHealth.map((w) => w.warehouseName)}
          emptyState="No warehouse stock rows."
        />
      </SurfaceCard>

      <SurfaceCard
        title="Low-stock watchlist"
        description="Variants at or below reorder level."
      >
        <DataTableShell
          variant="stitchOperational"
          embedded
          columns={["Product", "SKU", "Warehouse", "On hand", "Reserved", "Reorder at"]}
          rows={data.lowStock.map((r) => [
            r.productTitle,
            <span key={r.sku} className="font-mono text-xs">
              {r.sku}
            </span>,
            r.warehouse?.name ?? "—",
            String(r.onHand),
            String(r.reserved),
            r.reorderLevel != null ? String(r.reorderLevel) : "—"
          ])}
          rowKeys={data.lowStock.map((r) => r.inventoryStockId)}
          emptyState="No low-stock variants in the snapshot."
        />
      </SurfaceCard>

      {data.fulfillment.avgHoursToDeliver != null ? (
        <SurfaceCard title="Fulfillment signal" description="Sampled from recent delivered shipments.">
          <p className="text-sm text-[#374151]">
            Average hours from order creation to delivery (sample):{" "}
            <strong>{data.fulfillment.avgHoursToDeliver}</strong>
          </p>
        </SurfaceCard>
      ) : null}
    </>
  );
};

const CustomersView = ({
  data,
  compare,
  compareLoading
}: {
  data: CustomerReportData;
  compare: CustomerReportData | null;
  compareLoading: boolean;
}) => {
  const s = data.summary;
  const cs = compare?.summary;
  const growth = data.growthSeries ?? [];
  const cohort = data.cohortRepeatPurchase ?? [];
  const ltv = data.ltvBuckets ?? [];
  const geo = data.geographicDistribution ?? [];

  const rows = data.topCustomers.map((c) => [
    c.name ?? "—",
    <span key={c.id} className="font-mono text-xs">
      {c.email}
    </span>,
    String(c.orderCount),
    money(c.spendCents),
    String(c.supportTicketCount),
    String(c.reviewCount)
  ]);

  return (
    <>
      {compareLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading comparison period…</p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Distinct buyers"
          value={String(s.totalBuyersInRange)}
          tone="neutral"
          delta={cs ? pctDeltaLabel(s.totalBuyersInRange, cs.totalBuyersInRange) : undefined}
        />
        <KpiCard
          label="New signups (range)"
          value={String(s.newSignupsInRange)}
          tone="success"
          delta={cs ? pctDeltaLabel(s.newSignupsInRange, cs.newSignupsInRange) : undefined}
        />
        <KpiCard
          label="Returning buyers"
          value={s.returningBuyersInRange != null ? String(s.returningBuyersInRange) : "—"}
          detail="Ordered in range but joined before period start"
          tone="primary"
          delta={
            cs && s.returningBuyersInRange != null && cs.returningBuyersInRange != null
              ? pctDeltaLabel(s.returningBuyersInRange, cs.returningBuyersInRange)
              : undefined
          }
        />
        <KpiCard
          label="Avg LTV (buyers)"
          value={money(s.avgLtvCentsAmongBuyers)}
          detail={`${s.totalOrdersInRange} orders · ${s.suspendedAmongBuyers} suspended among buyers`}
          tone="neutral"
          delta={cs ? pctDeltaLabel(s.avgLtvCentsAmongBuyers, cs.avgLtvCentsAmongBuyers) : undefined}
        />
      </div>

      <SurfaceCard title="Customer growth trend" description="Daily signups vs orders placed.">
        {growth.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Select a date range to populate this chart.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">New signups</p>
              <SingleSeriesLineChart
                points={growth.map((g) => ({ date: g.date, value: g.newSignups }))}
                formatY={(n) => String(n)}
                ariaLabel="Signups per day"
                stroke="#1653cc"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">Orders placed</p>
              <SingleSeriesLineChart
                points={growth.map((g) => ({ date: g.date, value: g.ordersPlaced }))}
                formatY={(n) => String(n)}
                ariaLabel="Orders per day"
                stroke="#64748b"
              />
            </div>
          </div>
        )}
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SurfaceCard title="Repeat purchase (30d)" description="Signup cohort → order within 30 days.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Cohort month", "Joined", "Repeat ≤30d"]}
            rows={cohort.map((r) => [
              r.cohortMonth,
              String(r.customersJoined),
              `${r.orderedAgainWithin30dPct}%`
            ])}
            rowKeys={cohort.map((r) => r.cohortMonth)}
            emptyState="No cohort samples for this window."
          />
        </SurfaceCard>
        <SurfaceCard title="LTV distribution" description="Buyers in range bucketed by spend.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Band", "Customers"]}
            rows={ltv.map((b) => [b.label, String(b.customerCount)])}
            rowKeys={ltv.map((b) => b.label)}
            emptyState="No buyer spend in range."
          />
        </SurfaceCard>
        <SurfaceCard title="Geography" description="Default shipping country for buyers.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Country", "Customers"]}
            rows={geo.map((g) => [g.country, String(g.customerCount)])}
            rowKeys={geo.map((g) => g.country)}
            emptyState="No default addresses on file for buyers."
          />
        </SurfaceCard>
      </div>

      <SurfaceCard title="Top customers by spend" description="Operational list for the selected window.">
        <DataTableShell
          variant="stitchOperational"
          embedded
          columns={["Name", "Email", "Orders", "Spend", "Tickets", "Reviews"]}
          rows={rows}
          rowKeys={data.topCustomers.map((c) => c.id)}
          emptyState="No customers in this range."
        />
      </SurfaceCard>
    </>
  );
};

const SupportView = ({
  data,
  compare,
  compareLoading
}: {
  data: SupportReportData;
  compare: SupportReportData | null;
  compareLoading: boolean;
}) => {
  const closed = data.byStatus.find((s) => s.status === "CLOSED")?.count ?? 0;
  const csatMeasured = data.summary.csatScorePercent != null;
  const csatDisplay = csatMeasured
    ? `${data.summary.csatScorePercent}%`
    : `${data.summary.csatProxyResolutionRatePct ?? data.summary.resolutionRatePct}%`;
  const slaRows = data.slaByPriority ?? [];
  const cpClosed = compare?.byStatus.find((s) => s.status === "CLOSED")?.count ?? 0;
  const cpCsatMeasured = compare?.summary.csatScorePercent != null;
  const cpCsat =
    compare?.summary.csatScorePercent ??
    compare?.summary.csatProxyResolutionRatePct ??
    compare?.summary.resolutionRatePct ??
    0;

  return (
    <>
      {compareLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading comparison period…</p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total tickets"
          value={String(data.summary.totalTickets)}
          tone="neutral"
          delta={compare ? pctDeltaLabel(data.summary.totalTickets, compare.summary.totalTickets) : undefined}
        />
        <KpiCard
          label="Resolved (closed)"
          value={String(closed)}
          tone="success"
          delta={compare ? pctDeltaLabel(closed, cpClosed) : undefined}
        />
        <KpiCard
          label="Avg first response"
          value={formatMinutes(data.summary.avgFirstResponseMinutes)}
          detail="Admin first reply vs ticket open"
          tone="primary"
          delta={
            compare &&
            data.summary.avgFirstResponseMinutes != null &&
            compare.summary.avgFirstResponseMinutes != null
              ? pctDeltaLabel(data.summary.avgFirstResponseMinutes, compare.summary.avgFirstResponseMinutes)
              : undefined
          }
        />
        <KpiCard
          label={csatMeasured ? "CSAT score" : "CSAT (proxy)"}
          value={csatDisplay}
          detail={
            csatMeasured
              ? `Survey-derived · ${data.summary.csatResponseCount ?? 0} response(s) in range (1–5 → %).`
              : "No CSAT responses in range — showing resolution rate as proxy."
          }
          tone="neutral"
          delta={
            compare && (csatMeasured || cpCsatMeasured)
              ? pctDeltaLabel(
                  csatMeasured ? (data.summary.csatScorePercent ?? 0) : data.summary.csatProxyResolutionRatePct,
                  cpCsatMeasured ? (compare.summary.csatScorePercent ?? 0) : cpCsat
                )
              : undefined
          }
        />
      </div>

      <SurfaceCard title="Ticket volume by priority" description="Stacked counts for the reporting window.">
        <PriorityVolumeBars byPriority={data.byPriority} />
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard title="Complaint categories" description="Heuristic grouping from ticket subjects.">
          <SimpleDonut
            segments={data.complaintCategories.map((c, i) => ({
              label: c.category,
              value: c.count,
              color: ["#1653cc", "#3b6de6", "#94a3b8", "#f59e0b", "#22c55e"][i % 5]!
            }))}
            format={(n) => String(n)}
          />
        </SurfaceCard>
        <SurfaceCard title="SLA watchlist" description="Open tickets with next SLA deadline.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Ticket", "Priority", "Status", "Created", "SLA due"]}
            rows={data.slaAtRiskTickets.map((t) => [
              t.subject,
              t.priority,
              t.status.replace(/_/g, " "),
              <span key={t.id} className="font-mono text-[11px] text-[#6b7280]">
                {new Date(t.createdAt).toLocaleString()}
              </span>,
              <span key={`d-${t.id}`} className="font-mono text-[11px] text-[#6b7280]">
                {new Date(t.slaDeadlineIso).toLocaleString()}
              </span>
            ])}
            rowKeys={data.slaAtRiskTickets.map((t) => t.id)}
            emptyState="No open tickets in range or all ahead of SLA."
          />
        </SurfaceCard>
      </div>

      <SurfaceCard
        title="SLA performance by priority"
        description="First admin response vs policy window (samples with at least one admin reply)."
      >
        <DataTableShell
          variant="stitchOperational"
          embedded
          columns={["Priority", "Tickets", "Samples", "On-time %", "Avg first response", "Breaches"]}
          rows={slaRows.map((r) => [
            r.priority,
            String(r.ticketsInPriority),
            String(r.firstResponseSamples),
            r.onTimePct != null ? `${r.onTimePct}%` : "—",
            formatMinutes(r.avgFirstResponseMinutes),
            String(r.breachCount)
          ])}
          rowKeys={slaRows.map((r) => r.priority)}
          emptyState="No SLA samples in this range."
        />
      </SurfaceCard>

      <SurfaceCard title="Status breakdown" description="Tickets grouped by status.">
        <div className="flex flex-wrap gap-2">
          {data.byStatus.map((s) => (
            <StatusBadge key={s.status} label={`${s.status.replace(/_/g, " ")} (${s.count})`} tone="draft" />
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Resolution rate: <strong>{data.summary.resolutionRatePct}%</strong> (closed ÷ total in range)
        </p>
      </SurfaceCard>

      <SurfaceCard title="Backlog overview" description="Approximate new, open, pending, and resolved ticket counts.">
        <ul className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <li className="rounded-lg border border-[var(--color-border-light)] bg-[#f8f9fb] px-3 py-2">
            <div className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">New</div>
            <div className="font-headline text-xl font-bold">{data.stitchBacklog.new}</div>
          </li>
          <li className="rounded-lg border border-[var(--color-border-light)] bg-[#f8f9fb] px-3 py-2">
            <div className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">Open</div>
            <div className="font-headline text-xl font-bold">{data.stitchBacklog.open}</div>
          </li>
          <li className="rounded-lg border border-[var(--color-border-light)] bg-[#f8f9fb] px-3 py-2">
            <div className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">Pending</div>
            <div className="font-headline text-xl font-bold">{data.stitchBacklog.pending}</div>
          </li>
          <li className="rounded-lg border border-[var(--color-border-light)] bg-[#f8f9fb] px-3 py-2">
            <div className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">On hold</div>
            <div className="font-headline text-xl font-bold">{data.stitchBacklog.onHold}</div>
          </li>
          <li className="rounded-lg border border-[var(--color-border-light)] bg-[#f8f9fb] px-3 py-2">
            <div className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">Resolved</div>
            <div className="font-headline text-xl font-bold">{data.stitchBacklog.resolved}</div>
          </li>
        </ul>
      </SurfaceCard>
    </>
  );
};

const RefundsView = ({
  data,
  compare,
  compareLoading
}: {
  data: PostPurchaseReportData;
  compare: PostPurchaseReportData | null;
  compareLoading: boolean;
}) => {
  const returnRows = data.returns.byStatus.map((r) => [
    r.status.replace(/_/g, " "),
    String(r.count)
  ]);
  const refundTrend = data.refundTrend ?? [];
  const reasons = data.returnReasons ?? [];
  const topReturned = data.topReturnedProducts ?? [];
  const proc = data.processing;

  const avgProcLabel =
    proc?.avgRefundProcessingHours != null ? `${proc.avgRefundProcessingHours}h (refunds)` : "—";
  const avgReturnLabel =
    proc?.avgReturnCompletionHours != null ? `${proc.avgReturnCompletionHours}h (returns)` : "—";

  return (
    <>
      {compareLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading comparison period…</p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Refund records"
          value={String(data.refunds.total)}
          tone="neutral"
          delta={compare ? pctDeltaLabel(data.refunds.total, compare.refunds.total) : undefined}
        />
        <KpiCard
          label="Refund amount (completed)"
          value={money(data.refunds.completedCents)}
          tone="warning"
          delta={compare ? pctDeltaLabel(data.refunds.completedCents, compare.refunds.completedCents) : undefined}
        />
        <KpiCard
          label="Return requests"
          value={String(data.returns.total)}
          tone="neutral"
          delta={compare ? pctDeltaLabel(data.returns.total, compare.returns.total) : undefined}
        />
        <KpiCard
          label="Avg processing"
          value={avgProcLabel}
          detail={`Returns completed: ${avgReturnLabel}`}
          tone="neutral"
          delta={
            compare &&
            proc?.avgRefundProcessingHours != null &&
            compare.processing?.avgRefundProcessingHours != null
              ? pctDeltaLabel(proc.avgRefundProcessingHours, compare.processing.avgRefundProcessingHours)
              : undefined
          }
        />
      </div>

      <SurfaceCard title="Refunds trend" description="Completed refund amount booked by completion day.">
        {refundTrend.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No completed refunds in this range.</p>
        ) : (
          <SingleSeriesLineChart
            points={refundTrend.map((row) => ({ date: row.date, value: row.refundCents }))}
            formatY={(n) => money(n)}
            ariaLabel="Refund amount trend"
          />
        )}
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard title="Return reasons" description="Customer-provided reason text (grouped).">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Reason", "Count"]}
            rows={reasons.map((r) => [r.reason, String(r.count)])}
            rowKeys={reasons.map((r) => r.reason)}
            emptyState="No return reasons captured in range."
          />
        </SurfaceCard>
        <SurfaceCard title="Products with highest return volume" description="Returned units in range.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Product", "Returned units"]}
            rows={topReturned.map((r) => [r.productTitle, String(r.returnedQty)])}
            rowKeys={topReturned.map((r) => r.productId)}
            emptyState="No return line items in range."
          />
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard title="Returns by status" description="Pipeline health.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Status", "Count"]}
            rows={returnRows}
            rowKeys={data.returns.byStatus.map((r) => r.status)}
            emptyState="No returns in range."
          />
        </SurfaceCard>
        <SurfaceCard title="Reviews (same window)" description="Published vs pending moderation.">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between border-b border-[#f1f3f9] py-2">
              <span className="text-[var(--color-text-muted)]">Total reviews</span>
              <span className="font-semibold">{data.reviews.total}</span>
            </li>
            <li className="flex justify-between border-b border-[#f1f3f9] py-2">
              <span className="text-[var(--color-text-muted)]">Published</span>
              <span className="font-semibold">{data.reviews.published}</span>
            </li>
            <li className="flex justify-between py-2">
              <span className="text-[var(--color-text-muted)]">Pending</span>
              <span className="font-semibold">{data.reviews.pending}</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">Units requested for return: {data.returns.quantityRequested}</p>
        </SurfaceCard>
      </div>
    </>
  );
};

const MarketingView = ({
  data,
  compare,
  compareLoading
}: {
  data: MarketingReportData;
  compare: MarketingReportData | null;
  compareLoading: boolean;
}) => {
  const channels = data.channelAttribution ?? [];
  const topCoupons = data.topCouponsByRedemption ?? [];
  const roi = data.campaignRoi ?? [];
  const disc = data.discounts?.totalCentsFromCheckout ?? 0;
  const cpDisc = compare?.discounts?.totalCentsFromCheckout ?? 0;
  const couponRev = channels.find((c) => c.channel === "Coupons")?.revenueCents ?? 0;
  const cpChannels = compare?.channelAttribution ?? [];
  const cpCouponRev = cpChannels.find((c) => c.channel === "Coupons")?.revenueCents ?? 0;

  return (
    <>
      {compareLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading comparison period…</p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Coupon redemptions"
          value={String(data.coupons.redemptions)}
          tone="primary"
          delta={compare ? pctDeltaLabel(data.coupons.redemptions, compare.coupons.redemptions) : undefined}
        />
        <KpiCard
          label="Revenue (coupon orders)"
          value={money(couponRev)}
          detail="Order line totals where a coupon was redeemed"
          tone="success"
          delta={compare ? pctDeltaLabel(couponRev, cpCouponRev) : undefined}
        />
        <KpiCard
          label="Discount given (checkout)"
          value={money(disc)}
          detail={`Latest checkout snapshot discountCents · ${data.discounts?.ordersWithDiscountSnapshotCount ?? 0} orders with discount > 0`}
          tone="warning"
          delta={compare ? pctDeltaLabel(disc, cpDisc) : undefined}
        />
        <KpiCard label="Active coupons" value={String(data.coupons.active)} tone="neutral" />
        <KpiCard label="Active campaigns" value={String(data.campaigns.active)} tone="neutral" />
      </div>

      <SurfaceCard title="Channel attribution" description="Order revenue split: coupon checkout vs organic.">
        {channels.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No orders in range.</p>
        ) : (
          <SimpleDonut
            segments={channels.map((c, i) => ({
              label: c.channel,
              value: c.revenueCents,
              color: ["#1653cc", "#94a3b8", "#f59e0b", "#22c55e"][i % 4]!
            }))}
            format={(n) => money(n)}
          />
        )}
        <div className="mt-4">
        <DataTableShell
          variant="stitchOperational"
          embedded
          columns={["Channel", "Revenue", "Orders", "% of revenue"]}
          rows={channels.map((c) => [
            c.channel,
            money(c.revenueCents),
            String(c.orderCount),
            `${c.pctOfRevenue}%`
          ])}
          rowKeys={channels.map((c) => c.channel)}
          emptyState="No channel rows."
        />
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard title="Top performing coupons" description="Redemption counts in range.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Rank", "Code", "Redemptions"]}
            rows={topCoupons.map((c) => [
              String(c.rank),
              <span key={`${c.rank}-${c.code}`} className="font-mono text-xs">
                {c.code}
              </span>,
              String(c.redemptions)
            ])}
            rowKeys={topCoupons.map((c) => `${c.rank}-${c.code}`)}
            emptyState="No coupon redemptions in range."
          />
        </SurfaceCard>
        <SurfaceCard title="Campaign ROI" description="Revenue from orders with campaignId in range; ROI when costCents is set on the campaign.">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Campaign", "Banners", "Revenue", "Cost", "ROI %"]}
            rows={roi.map((c) => [
              c.name,
              String(c.bannerCount),
              money(c.attributedRevenueCents),
              c.costCents != null ? money(c.costCents) : "—",
              c.roiPct != null ? `${c.roiPct}%` : "—"
            ])}
            rowKeys={roi.map((c) => c.campaignId)}
            emptyState="No campaigns in range."
          />
        </SurfaceCard>
      </div>

      <SurfaceCard title="Program inventory" description="Totals for coupons, promotions, and campaigns.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--color-border-light)] bg-[#f8f9fb] p-4">
            <div className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">Coupons</div>
            <p className="mt-2 text-sm text-[#374151]">
              Total {data.coupons.total} · Active {data.coupons.active} · Disabled {data.coupons.disabled}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--color-border-light)] bg-[#f8f9fb] p-4">
            <div className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">Promotions</div>
            <p className="mt-2 text-sm text-[#374151]">
              Total {data.promotions.total} · Active {data.promotions.active} · Rules {data.promotions.ruleCount}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--color-border-light)] bg-[#f8f9fb] p-4">
            <div className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">Campaigns</div>
            <p className="mt-2 text-sm text-[#374151]">
              Total {data.campaigns.total} · Active {data.campaigns.active} · Banners {data.campaigns.bannerCount}
            </p>
          </div>
        </div>
      </SurfaceCard>
    </>
  );
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asSales(data: unknown): SalesReportData | null {
  if (!isRecord(data)) return null;
  const summary = data.summary;
  const series = data.series;
  if (!isRecord(summary) || !Array.isArray(series)) return null;
  return data as SalesReportData;
}

function asProduct(data: unknown): ProductPerformanceReportData | null {
  if (!isRecord(data) || !Array.isArray(data.topProducts)) return null;
  return data as ProductPerformanceReportData;
}

function asCustomer(data: unknown): CustomerReportData | null {
  if (!isRecord(data) || !isRecord(data.summary) || !Array.isArray(data.topCustomers)) return null;
  return data as CustomerReportData;
}

function asSupport(data: unknown): SupportReportData | null {
  if (!isRecord(data) || !isRecord(data.summary)) return null;
  return data as SupportReportData;
}

function asPostPurchase(data: unknown): PostPurchaseReportData | null {
  if (!isRecord(data) || !isRecord(data.refunds) || !isRecord(data.returns)) return null;
  return data as PostPurchaseReportData;
}

function asMarketing(data: unknown): MarketingReportData | null {
  if (!isRecord(data) || !isRecord(data.coupons)) return null;
  return data as MarketingReportData;
}

export const ReportDatasetViews = ({
  segment,
  payload,
  comparePayload = null,
  compareLoading = false
}: {
  segment: ReportDatasetSegment;
  payload: unknown;
  comparePayload?: unknown;
  compareLoading?: boolean;
}) => {
  if (payload == null) {
    return <p className="text-sm text-[var(--color-text-muted)]">No data returned.</p>;
  }

  let body: ReactNode;
  switch (segment) {
    case "sales": {
      const parsed = asSales(payload);
      const compareParsed = comparePayload != null ? asSales(comparePayload) : null;
      body = parsed ? (
        <SalesView data={parsed} compare={compareParsed} compareLoading={compareLoading} />
      ) : (
        <ReportParseFallback segment={segment} />
      );
      break;
    }
    case "products": {
      const parsed = asProduct(payload);
      const compareParsed = comparePayload != null ? asProduct(comparePayload) : null;
      body = parsed ? (
        <ProductsView data={parsed} compare={compareParsed} compareLoading={compareLoading} />
      ) : (
        <ReportParseFallback segment={segment} />
      );
      break;
    }
    case "inventory": {
      const parsed = asProduct(payload);
      const compareParsed = comparePayload != null ? asProduct(comparePayload) : null;
      body = parsed ? (
        <InventoryView data={parsed} compare={compareParsed} compareLoading={compareLoading} />
      ) : (
        <ReportParseFallback segment={segment} />
      );
      break;
    }
    case "customers": {
      const parsed = asCustomer(payload);
      const compareParsed = comparePayload != null ? asCustomer(comparePayload) : null;
      body = parsed ? (
        <CustomersView data={parsed} compare={compareParsed} compareLoading={compareLoading} />
      ) : (
        <ReportParseFallback segment={segment} />
      );
      break;
    }
    case "support": {
      const parsed = asSupport(payload);
      const compareParsed = comparePayload != null ? asSupport(comparePayload) : null;
      body = parsed ? (
        <SupportView data={parsed} compare={compareParsed} compareLoading={compareLoading} />
      ) : (
        <ReportParseFallback segment={segment} />
      );
      break;
    }
    case "refunds-returns": {
      const parsed = asPostPurchase(payload);
      const compareParsed = comparePayload != null ? asPostPurchase(comparePayload) : null;
      body = parsed ? (
        <RefundsView data={parsed} compare={compareParsed} compareLoading={compareLoading} />
      ) : (
        <ReportParseFallback segment={segment} />
      );
      break;
    }
    case "marketing": {
      const parsed = asMarketing(payload);
      const compareParsed = comparePayload != null ? asMarketing(comparePayload) : null;
      body = parsed ? (
        <MarketingView data={parsed} compare={compareParsed} compareLoading={compareLoading} />
      ) : (
        <ReportParseFallback segment={segment} />
      );
      break;
    }
    default:
      body = <ReportParseFallback segment={segment} />;
  }

  return (
    <div className="flex flex-col gap-8">
      {body}
      <TechnicalJsonDisclosure data={payload} label="Exportable dataset (full structure)" defaultOpen={false} />
    </div>
  );
};

const ReportParseFallback = ({ segment }: { segment: ReportDatasetSegment }) => (
  <SurfaceCard title="Report layout unavailable" description="The API returned an unexpected shape for this report.">
    <p className="text-sm text-amber-800">
      Could not map <strong>{segment}</strong> data to the standard report layout. Open <strong>Advanced details</strong>{" "}
      at the bottom of the page, or contact engineering if this persists.
    </p>
  </SurfaceCard>
);
