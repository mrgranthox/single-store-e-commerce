import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { ProductAdminNav } from "@/components/catalog/ProductAdminNav";
import { KpiCard } from "@/components/primitives/KpiCard";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  getAdminCatalogProduct,
  getAdminCatalogProductAnalytics
} from "@/features/catalog/api/admin-catalog.api";
import { formatMoney } from "@/features/catalog/lib/catalogFormat";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const periodOptions = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" }
] as const;

const ProductSalesTrendChart = ({
  points,
  formatRevenue,
  maxUnits
}: {
  points: Array<{ date: string; revenueCents: number; unitsSold: number }>;
  formatRevenue: (cents: number) => string;
  maxUnits: number;
}) => {
  if (points.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 text-sm text-[var(--color-text-muted)]">
        Trend data will appear when analytics is enabled for this product.
      </div>
    );
  }

  const w = 720;
  const h = 220;
  const padL = 44;
  const padR = 44;
  const padT = 16;
  const padB = 32;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxRev = Math.max(...points.map((p) => p.revenueCents), 1);
  const maxU = Math.max(maxUnits, 1);
  const n = points.length;
  const step = n <= 1 ? innerW : innerW / (n - 1);

  const revCoords = points.map((p, i) => {
    const x = padL + i * step;
    const y = padT + innerH - (p.revenueCents / maxRev) * innerH;
    return { x, y, ...p };
  });

  const unitCoords = points.map((p, i) => {
    const x = padL + i * step;
    const y = padT + innerH - (p.unitsSold / maxU) * innerH;
    return { x, y, ...p };
  });

  const revLine = revCoords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const unitLine = unitCoords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");

  return (
    <svg className="h-auto w-full max-w-full" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Sales trend">
      <defs>
        <linearGradient id="prodRevFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1653cc" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#1653cc" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={padL}
          x2={w - padR}
          y1={padT + (innerH / 3) * i}
          y2={padT + (innerH / 3) * i}
          stroke="#94a3b8"
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      ))}
      <path
        d={`${revLine} L ${revCoords[revCoords.length - 1]!.x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${revCoords[0]!.x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`}
        fill="url(#prodRevFill)"
      />
      <path d={revLine} fill="none" stroke="#1653cc" strokeWidth={2.25} strokeLinejoin="round" />
      <path
        d={unitLine}
        fill="none"
        stroke="#64748b"
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinejoin="round"
      />
      <text x={padL} y={12} className="fill-[#1653cc] text-[10px] font-semibold">
        Revenue
      </text>
      <text x={w - padR} y={12} textAnchor="end" className="fill-slate-600 text-[10px] font-semibold">
        Units sold
      </text>
      <text x={padL} y={h - 8} className="fill-[#94a3b8] font-mono text-[9px]">
        {points[0]?.date ?? ""}
      </text>
      <text x={w - padR} y={h - 8} textAnchor="end" className="fill-[#94a3b8] font-mono text-[9px]">
        {points[points.length - 1]?.date ?? ""}
      </text>
      {revCoords.map((c) => (
        <circle key={`r-${c.date}`} cx={c.x} cy={c.y} r={3} fill="#1653cc">
          <title>{`${c.date} — ${formatRevenue(c.revenueCents)}`}</title>
        </circle>
      ))}
    </svg>
  );
};

const ReviewDistributionBars = ({
  distribution
}: {
  distribution: {
    star1: number;
    star2: number;
    star3: number;
    star4: number;
    star5: number;
  } | null;
}) => {
  if (!distribution) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">Review breakdown is not available for this product yet.</p>
    );
  }
  const rows = [
    { label: "5★", count: distribution.star5 },
    { label: "4★", count: distribution.star4 },
    { label: "3★", count: distribution.star3 },
    { label: "2★", count: distribution.star2 },
    { label: "1★", count: distribution.star1 }
  ];
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3 text-sm">
          <span className="w-8 shrink-0 font-medium text-slate-600">{row.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#4f7ef8]"
              style={{ width: `${Math.round((row.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right tabular-nums text-slate-600">{row.count}</span>
        </li>
      ))}
    </ul>
  );
};

const RevenueShareDonut = ({
  share,
  productTitle
}: {
  share: { productPercent: number; restPercent: number } | null;
  productTitle: string;
}) => {
  if (!share) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Revenue share for “{productTitle}” versus the rest of the catalog is not available yet.
      </p>
    );
  }
  const { productPercent, restPercent } = share;
  const circumference = 2 * Math.PI * 36;
  const dash = (productPercent / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
      <svg width="120" height="120" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="36" fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          stroke="#1653cc"
          strokeWidth="14"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="text-center text-sm sm:text-left">
        <div className="font-semibold text-slate-800">This product</div>
        <div className="text-2xl font-bold text-[#1653cc]">{productPercent.toFixed(1)}%</div>
        <div className="mt-1 text-[var(--color-text-muted)]">Rest of catalog: {restPercent.toFixed(1)}%</div>
      </div>
    </div>
  );
};

export const CatalogProductAnalyticsPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<(typeof periodOptions)[number]["value"]>("30d");

  const productQ = useQuery({
    queryKey: ["admin-catalog-product", productId],
    queryFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return getAdminCatalogProduct(accessToken, productId);
    },
    enabled: Boolean(accessToken && productId)
  });

  const q = useQuery({
    queryKey: ["admin-catalog-product-analytics", productId, period],
    queryFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return getAdminCatalogProductAnalytics(accessToken, productId, period);
    },
    enabled: Boolean(accessToken && productId)
  });

  const entity = q.data?.data.entity;
  const productTitle = productQ.data?.data.entity.title ?? "Product";

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const currency = entity?.primaryCurrency ?? "GHS";
  const formatRev = useMemo(() => (cents: number) => formatMoney(cents, currency), [currency]);

  const metrics = entity?.metrics;
  const trend = entity?.salesTrend ?? [];
  const maxUnits = useMemo(() => Math.max(...trend.map((p) => p.unitsSold), 1), [trend]);

  if (!productId) {
    return <p className="text-sm text-[var(--color-text-muted)]">Missing product id.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title={productQ.isLoading ? "Loading…" : productTitle}
          description="Sales performance, reviews, and catalog contribution for this product."
          actionMenuItems={[
            refreshDataMenuItem(queryClient, ["admin-catalog-product-analytics", productId])
          ]}
        />
        <div className="flex shrink-0 flex-col gap-1 lg:items-end">
          <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Date range
          </label>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as (typeof periodOptions)[number]["value"])}
            aria-label="Reporting period"
          >
            {periodOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--color-text-muted)]">
            KPIs and trend reflect paid orders in {entity?.primaryCurrency ?? "the primary currency"} for this window.
          </span>
        </div>
      </div>
      <ProductAdminNav />
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}
      {q.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : entity ? (
        <>
          {!entity.implemented ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Limited analytics mode — some panels may be empty until supporting data exists.
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Revenue (period)"
              value={formatRev(metrics?.revenueCents ?? 0)}
              detail={entity.periodLabel}
              tone="primary"
            />
            <KpiCard
              label="Units sold"
              value={String(metrics?.unitsSold ?? 0)}
              detail="Shippable units"
              tone="neutral"
            />
            <KpiCard
              label="Return rate"
              value={
                metrics?.returnRatePercent != null ? `${metrics.returnRatePercent.toFixed(1)}%` : "—"
              }
              detail="Of fulfilled units"
              tone="warning"
            />
            <KpiCard
              label="Refund rate"
              value={
                metrics?.refundRatePercent != null ? `${metrics.refundRatePercent.toFixed(1)}%` : "—"
              }
              detail="Of paid orders"
              tone="neutral"
            />
          </div>

          <SurfaceCard title="Sales trend" description="Revenue (solid) and units sold (dashed).">
            <ProductSalesTrendChart points={trend} formatRevenue={formatRev} maxUnits={maxUnits} />
          </SurfaceCard>

          <div className="grid gap-4 lg:grid-cols-3">
            <SurfaceCard title="Stockout events" description="When this product had no sellable stock.">
              {entity.stockoutEvents.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No stockout events on record.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {entity.stockoutEvents.map((ev, idx) => (
                    <li
                      key={`${ev.startedAt}-${idx}`}
                      className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                    >
                      <div className="font-medium text-slate-800">
                        {new Date(ev.startedAt).toLocaleDateString()}
                        {ev.endedAt ? ` → ${new Date(ev.endedAt).toLocaleDateString()}` : " → Ongoing"}
                      </div>
                      {ev.durationLabel ? (
                        <div className="text-[var(--color-text-muted)]">Duration: {ev.durationLabel}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </SurfaceCard>
            <SurfaceCard title="Review distribution" description="Star ratings from published reviews.">
              <ReviewDistributionBars distribution={entity.reviewDistribution} />
            </SurfaceCard>
            <SurfaceCard title="Revenue contribution" description="This product vs rest of catalog.">
              <RevenueShareDonut share={entity.revenueShare} productTitle={productTitle} />
            </SurfaceCard>
          </div>
        </>
      ) : null}
    </div>
  );
};
