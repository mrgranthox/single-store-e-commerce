import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DataTableShell } from "@/components/primitives/DataTableShell";
import { PageHeader } from "@/components/primitives/PageHeader";
import { MarketingWorkspaceNav, StitchPageBody } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getAdminCouponAnalytics } from "@/features/marketing/api/admin-marketing.api";
import {
  formatCentsMoney,
  humanizeLabel,
  statusCount,
  sumStatusCounts
} from "@/features/marketing/lib/marketingPresentation";
import { downloadCsv } from "@/lib/csvDownload";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

const PERIOD_OPTIONS = [7, 30, 90] as const;

export const CouponAnalyticsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [periodDays, setPeriodDays] = useState<(typeof PERIOD_OPTIONS)[number]>(30);
  const [abuseThreshold, setAbuseThreshold] = useState(10);

  const q = useQuery({
    queryKey: ["admin-marketing-coupon-analytics", periodDays, abuseThreshold],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminCouponAnalytics(accessToken, {
        period_days: periodDays,
        abuse_threshold: abuseThreshold
      });
    },
    enabled: Boolean(accessToken)
  });

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const data = q.data?.data;
  const sc = data?.statusCounts ?? [];
  const redemptionCountAllTime = data?.redemptionCount ?? 0;
  const activeCoupons = statusCount(sc, "ACTIVE");
  const totalCoupons = sumStatusCounts(sc);

  const daily = data?.dailyRedemptions ?? [];
  const maxDaily = useMemo(() => Math.max(1, ...daily.map((d) => d.count)), [daily]);

  const statusRows = sc.map((row) => [
    <span key={row.status} className="font-medium text-[#181b25]">
      {humanizeLabel(row.status)}
    </span>,
    <span key={`${row.status}-c`} className="tabular-nums text-slate-700">
      {row.count.toLocaleString()}
    </span>
  ]);

  const topRows = (data?.topCouponsInPeriod ?? []).map((t) => {
      const totalR = Math.max(1, data?.redemptionsInPeriod ?? 1);
      const shareRev = Math.round(
        (t.redemptionCount / totalR) * (data?.estimatedRevenueAttributedCentsInPeriod ?? 0)
      );
      return [
        <span key={t.couponId} className="font-mono text-xs font-bold text-[#181b25]">
          {t.code}
        </span>,
        <span key={`ty-${t.couponId}`} className="text-xs font-medium text-slate-600">
          {humanizeLabel(t.discountType)}
        </span>,
        <span key={`r-${t.couponId}`} className="text-right text-xs font-bold tabular-nums">
          {t.redemptionCount.toLocaleString()}
        </span>,
        <span key={`d-${t.couponId}`} className="text-right font-mono text-xs text-slate-700">
          {formatCentsMoney(t.estimatedDiscountCents)}
        </span>,
        <span key={`rev-${t.couponId}`} className="text-right font-mono text-xs font-semibold text-[#1653cc]">
          {formatCentsMoney(shareRev)}
        </span>
      ];
    });

  const abuseRows = (data?.abuseSignals ?? []).map((a) => [
    <span key={a.userId} className="font-mono text-xs text-[#181b25]">
      {a.userId.slice(0, 8)}…
    </span>,
    <span key={`c-${a.userId}`} className="text-right text-xs font-bold tabular-nums text-[#ba1a1a]">
      {a.redemptionCount.toLocaleString()}
    </span>,
    <span key={`d-${a.userId}`} className="text-xs text-slate-600">
      {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(a.lastRedeemedAt))}
    </span>
  ]);

  const exportReport = () => {
    if (!data) {
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `coupon-analytics-daily-${stamp}.csv`,
      ["Date", "Redemptions"],
      daily.map((d) => [d.date, d.count])
    );
    downloadCsv(
      `coupon-analytics-top-${stamp}.csv`,
      ["Code", "Type", "Redemptions", "Est discount (GHS)"],
      data.topCouponsInPeriod.map((t) => [
        t.code,
        t.discountType,
        t.redemptionCount,
        (t.estimatedDiscountCents / 100).toFixed(2)
      ])
    );
    downloadCsv(
      `coupon-analytics-abuse-${stamp}.csv`,
      ["User ID", "Redemptions in window", "Last redeemed"],
      data.abuseSignals.map((a) => [a.userId, a.redemptionCount, a.lastRedeemedAt])
    );
  };

  const windowLabel = data?.window
    ? `${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(data.window.from))} – ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(data.window.to))}`
    : "";

  return (
    <StitchPageBody>
      <MarketingWorkspaceNav />
      <PageHeader
        title="Coupon analytics"
        titleSize="deck"
        description="Redemption volume, modeled savings, and operational risk signals for the selected window."
        actionMenuItems={[
          {
            id: "refresh-coupon-analytics",
            label: "Refresh data",
            onSelect: () => {
              void queryClient.invalidateQueries({ queryKey: ["admin-marketing-coupon-analytics"] });
            }
          }
        ]}
        actions={
          <button
            type="button"
            onClick={exportReport}
            disabled={!data}
            className="flex items-center gap-2 rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3b6de6] disabled:opacity-40"
          >
            <MaterialIcon name="download" className="text-sm text-white" />
            Export CSV packs
          </button>
        }
      />

      <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950">
        <p className="font-semibold text-amber-950">How these numbers are built</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/90">
          <li>
            Discount and revenue figures are modeled from order line totals and coupon type or value — they are not
            payment-settled promotional ledger lines.
          </li>
          <li>
            The &quot;revenue share&quot; column on top coupons allocates total attributed window revenue by each
            code&apos;s share of redemptions; it is not per-code ledger truth.
          </li>
          <li>
            Abuse signals only consider signed-in users (user IDs on redemptions). Use the abuse threshold control below to
            match how strict you want that review queue to be (default 10 redemptions in the window).
          </li>
        </ul>
      </div>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
          <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#737685]">Window</span>
          {PERIOD_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setPeriodDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                periodDays === d ? "bg-[#1653cc] text-white shadow-sm" : "text-[#434654] hover:bg-slate-100"
              }`}
            >
              {d}D
            </button>
          ))}
          <div className="border-l border-slate-200 pl-4 text-sm font-semibold text-[#181b25]">{windowLabel}</div>
          <label className="flex items-center gap-2 border-l border-slate-200 pl-4 text-xs font-semibold text-[#434654]">
            <span className="whitespace-nowrap">Abuse threshold</span>
            <input
              type="number"
              min={2}
              max={500}
              value={abuseThreshold}
              onChange={(e) => setAbuseThreshold(Math.min(500, Math.max(2, Number(e.target.value) || 10)))}
              className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs"
            />
          </label>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-[#737685]">
          <span>All-time redemptions: {redemptionCountAllTime.toLocaleString()}</span>
          <button
            type="button"
            className="rounded-full p-2 transition-colors hover:bg-slate-100"
            aria-label="Refresh analytics"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-marketing-coupon-analytics"] })}
          >
            <MaterialIcon name="refresh" className="text-sm" />
          </button>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading analytics…</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="group relative overflow-hidden rounded-xl border-l-4 border-[#1653cc] bg-white p-5 shadow-sm">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#737685]">Redemptions (window)</p>
              <div className="flex items-baseline gap-2">
                <h3 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">
                  {data.redemptionsInPeriod.toLocaleString()}
                </h3>
              </div>
              <MaterialIcon
                name="confirmation_number"
                className="pointer-events-none absolute -right-2.5 -top-2.5 text-8xl text-[#1653cc] opacity-[0.06]"
              />
            </div>
            <div className="group relative overflow-hidden rounded-xl border-l-4 border-[#006b2d] bg-white p-5 shadow-sm">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#737685]">Est. discount (window)</p>
              <div className="flex items-baseline gap-2">
                <h3 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">
                  {formatCentsMoney(data.estimatedDiscountGivenCentsInPeriod)}
                </h3>
              </div>
              <p className="mt-2 text-[11px] text-[#737685]">
                Modeled from order lines tied to redemptions (not payment-settled promo lines).
              </p>
              <MaterialIcon
                name="savings"
                className="pointer-events-none absolute -right-2.5 -top-2.5 text-8xl text-[#006b2d] opacity-[0.06]"
              />
            </div>
            <div className="group relative overflow-hidden rounded-xl border-l-4 border-[#3b6de6] bg-white p-5 shadow-sm">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#737685]">Revenue attributed</p>
              <div className="flex items-baseline gap-2">
                <h3 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">
                  {formatCentsMoney(data.estimatedRevenueAttributedCentsInPeriod)}
                </h3>
              </div>
              <p className="mt-2 text-[11px] text-[#737685]">
                Merchandise subtotals on coupon-linked orders; top-code &quot;revenue&quot; uses proportional allocation.
              </p>
              <MaterialIcon
                name="payments"
                className="pointer-events-none absolute -right-2.5 -top-2.5 text-8xl text-[#3b6de6] opacity-[0.06]"
              />
            </div>
            <div className="group relative overflow-hidden rounded-xl border-l-4 border-[#737685] bg-white p-5 shadow-sm">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#737685]">Avg order (coupon orders)</p>
              <div className="flex items-baseline gap-2">
                <h3 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">
                  {data.averageOrderValueCouponCentsInPeriod != null
                    ? formatCentsMoney(data.averageOrderValueCouponCentsInPeriod)
                    : "—"}
                </h3>
              </div>
              <p className="mt-2 text-[11px] font-medium text-[#737685]">Active SKUs in catalog: {activeCoupons}</p>
              <MaterialIcon
                name="shopping_bag"
                className="pointer-events-none absolute -right-2.5 -top-2.5 text-8xl text-[#737685] opacity-[0.06]"
              />
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="font-headline font-bold text-[#181b25]">Redemption trend</h4>
                <p className="text-xs font-medium text-[#737685]">Daily coupon usage over the selected period</p>
              </div>
            </div>
            {daily.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-[#f8f9fb] px-4 py-8 text-center text-sm text-slate-600">
                No redemptions in this window.
              </p>
            ) : (
              <div className="flex h-56 gap-0.5 border-b border-slate-100 pb-1">
                {daily.map((d) => (
                  <div
                    key={d.date}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end"
                    title={`${d.date}: ${d.count}`}
                  >
                    <div
                      className="w-full min-h-[3px] rounded-t-sm bg-[#1653cc]/85 transition-colors hover:bg-[#1653cc]"
                      style={{ height: `${Math.max(2, Math.round((d.count / maxDaily) * 100))}%` }}
                    />
                    <span className="mt-1 truncate text-center text-[9px] font-bold text-[#737685]">
                      {d.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 p-6">
                <h4 className="font-headline font-bold text-[#181b25]">Top coupons by redemption</h4>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1653cc]">In window</span>
              </div>
              <div className="overflow-x-auto">
                <DataTableShell
                  variant="stitchOperational"
                  embedded
                  columns={["Code", "Type", "Redemptions", "Discount total (est.)", "Revenue share (est.)"]}
                  rows={topRows}
                  rowKeys={data.topCouponsInPeriod.map((t) => t.couponId)}
                  emptyState="No coupon activity in this window."
                />
              </div>
              <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                Revenue column splits attributed window revenue across codes by share of redemptions (operational estimate).
              </p>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 p-6">
                <h4 className="font-headline font-bold text-[#181b25]">High-velocity customers</h4>
                <span className="text-xs font-bold uppercase tracking-wider text-[#737685]">Review queue</span>
              </div>
              <div className="overflow-x-auto">
                <DataTableShell
                  variant="stitchOperational"
                  embedded
                  columns={["Customer", "Redemptions", "Last activity"]}
                  rows={abuseRows}
                  rowKeys={data.abuseSignals.map((a) => a.userId)}
                  emptyState="No accounts exceeded the threshold in this window."
                />
              </div>
              <div className="border-t border-slate-100 px-6 py-4">
                <p className="text-xs text-slate-500">
                  Rows are signed-in user IDs at or above the abuse threshold for this window (default 10). Guest checkouts
                  without a user ID never appear here. Use the threshold control in the toolbar above.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="border-b border-slate-100 p-6">
              <h4 className="font-headline font-bold text-[#181b25]">Coupons by status</h4>
              <p className="text-xs text-[#737685]">Catalog inventory ({totalCoupons} total)</p>
            </div>
            <DataTableShell
              variant="stitchOperational"
              embedded
              columns={["Status", "Coupons"]}
              rows={statusRows}
              rowKeys={sc.map((r) => r.status)}
              emptyState="No status breakdown."
            />
          </div>

        </>
      ) : null}
    </StitchPageBody>
  );
};
