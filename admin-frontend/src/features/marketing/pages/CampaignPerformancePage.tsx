import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DataTableShell } from "@/components/primitives/DataTableShell";
import { PageHeader } from "@/components/primitives/PageHeader";
import { MarketingWorkspaceNav, StitchPageBody } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  getCampaignPerformance,
  type CampaignPerformanceItem
} from "@/features/marketing/api/admin-marketing.api";
import { formatAdminDate, humanizeLabel } from "@/features/marketing/lib/marketingPresentation";
import { downloadCsv } from "@/lib/csvDownload";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

const periodLabels = ["24H", "7D", "30D", "ALL"] as const;

const toApiPeriod = (p: (typeof periodLabels)[number]): "24h" | "7d" | "30d" | "all" => {
  if (p === "24H") {
    return "24h";
  }
  if (p === "7D") {
    return "7d";
  }
  if (p === "30D") {
    return "30d";
  }
  return "all";
};

const CampaignStatusPill = ({ status }: { status: string }) => {
  const u = status.toUpperCase();
  const active = u === "ACTIVE";
  return (
    <div
      className={`inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${active ? "text-[#006b2d]" : "text-[#434654]"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#006b2d]" : "bg-slate-400"}`} />
      {humanizeLabel(status)}
    </div>
  );
};

export const CampaignPerformancePage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [periodUi, setPeriodUi] = useState<(typeof periodLabels)[number]>("30D");

  const apiPeriod = toApiPeriod(periodUi);

  const q = useQuery({
    queryKey: ["admin-campaign-performance", apiPeriod],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getCampaignPerformance(accessToken, { period: apiPeriod });
    },
    enabled: Boolean(accessToken)
  });

  const data = q.data?.data;
  const items = data?.items ?? [];
  const summary = data?.summary;
  const channelMix = data?.channelMix ?? [];

  const channelMax = useMemo(() => Math.max(1, ...channelMix.map((c) => c.bannerCount)), [channelMix]);

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const rows = items.map((row: CampaignPerformanceItem) => [
    <div key={`n-${row.id}`} className="font-semibold text-[#181b25]">
      {row.name}
    </div>,
    <span key={`s-${row.id}`} className="font-mono text-xs text-[#434654]">
      {row.slug}
    </span>,
    <CampaignStatusPill key={`st-${row.id}`} status={row.status} />,
    <span key={`p-${row.id}`} className="text-sm text-[#434654]">
      {row.promotion?.name ?? "—"}
    </span>,
    <span key={`b-${row.id}`} className="tabular-nums text-sm font-medium text-[#181b25]">
      {row.bannerCount}
    </span>,
    <span key={`u-${row.id}`} className="text-xs text-[#434654]">
      {formatAdminDate(row.updatedAt)}
    </span>,
    <div key={`a-${row.id}`} className="flex justify-end gap-1">
      <button
        type="button"
        title="View details"
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-[#1653cc]"
      >
        <MaterialIcon name="visibility" className="text-lg" />
      </button>
    </div>
  ]);

  const exportPerformance = () => {
    if (!data) {
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `campaigns-${data.period}-${stamp}.csv`,
      ["Campaign", "Slug", "Status", "Promotion", "Banners", "Updated"],
      items.map((row) => [
        row.name,
        row.slug,
        row.status,
        row.promotion?.name ?? "",
        row.bannerCount,
        formatAdminDate(row.updatedAt)
      ])
    );
    downloadCsv(
      `campaign-channel-mix-${data.period}-${stamp}.csv`,
      ["Placement", "Banners"],
      channelMix.map((c) => [c.placement, c.bannerCount])
    );
  };

  return (
    <StitchPageBody className="mx-auto w-full max-w-[1600px]">
      <MarketingWorkspaceNav />
      <PageHeader
        title="Campaign performance"
        titleSize="deck"
        description="Campaign roster and banner counts by placement for the selected window. Not paid-media ROAS or reconciled revenue."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-campaign-performance"])]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportPerformance}
              disabled={!data || items.length === 0}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
            >
              <MaterialIcon name="download" className="text-lg" />
              Export CSV
            </button>
            <div className="flex gap-2 rounded-lg bg-[#e6e7f6] p-1">
              {periodLabels.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodUi(p)}
                  className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
                    periodUi === p
                      ? "bg-white text-[#1653cc] shadow-sm"
                      : "text-[#434654] hover:text-[#181b25]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {data?.windowFrom ? (
        <p className="text-xs text-slate-500">
          Window start (UTC):{" "}
          <span className="font-medium text-[#181b25]">
            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(data.windowFrom)
            )}
          </span>
        </p>
      ) : data?.period === "all" ? (
        <p className="text-xs text-slate-500">Showing the most recently updated campaigns (up to 100).</p>
      ) : null}

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading campaign performance…</p>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-xl border-l-4 border-[#1653cc] bg-white p-6 shadow-sm">
              <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-[#434654]">
                Campaigns in window
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-2xl font-bold tracking-tighter text-[#181b25]">
                  {summary.campaignsInView}
                </span>
              </div>
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[#ecedfb]">
                <div
                  className="h-full bg-[#1653cc]"
                  style={{
                    width: `${summary.campaignsInView > 0 ? (summary.activeCampaignsInView / summary.campaignsInView) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border-l-4 border-[#00873b] bg-white p-6 shadow-sm">
              <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-[#434654]">
                Active in window
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-2xl font-bold tracking-tighter text-[#181b25]">
                  {summary.activeCampaignsInView}
                </span>
                <span className="text-[0.6875rem] font-bold text-[#434654]">
                  / {summary.campaignsInView} loaded
                </span>
              </div>
              <p className="mt-3 text-[0.6rem] font-medium text-[#434654]">
                Activation rate: {summary.activationRatePercent}%
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl border-l-4 border-[#5b5e68] bg-white p-6 shadow-sm">
              <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-[#434654]">
                Linked promotions
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-2xl font-bold tracking-tighter text-[#181b25]">
                  {summary.campaignsWithPromotionInView}
                </span>
              </div>
              <p className="mt-4 text-[0.6rem] font-medium text-[#434654]">
                Campaigns with a promotion record in this result set.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl border-l-4 border-[#ba1a1a] bg-white p-6 shadow-sm">
              <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-[#434654]">
                Banner placements
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-2xl font-bold tracking-tighter text-[#181b25]">
                  {summary.bannerPlacementsInView}
                </span>
                <span className="text-[0.6875rem] font-bold text-[#434654]">In window</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#181b25]">
                <span className="h-4 w-1 bg-[#1653cc]" />
                Performance by placement
              </h3>
              <span className="text-xs text-[#737685]">
                Counts banners linked to campaigns by placement — not revenue, attribution, or creative performance
              </span>
            </div>
            {channelMix.length === 0 ? (
              <p className="text-sm text-slate-500">No banner placements for campaigns in this window.</p>
            ) : (
              <div className="flex h-48 items-end justify-between gap-2">
                {channelMix.map((c) => (
                  <div key={c.placement} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <div
                      className="w-full min-h-[6px] rounded-t-sm bg-[#1653cc]/85"
                      style={{ height: `${Math.max(8, (c.bannerCount / channelMax) * 100)}%` }}
                      title={`${c.placement}: ${c.bannerCount}`}
                    />
                    <span className="max-w-full truncate text-center text-[10px] font-bold uppercase tracking-tighter text-[#434654]">
                      {c.placement}
                    </span>
                    <span className="text-xs font-semibold text-[#181b25]">{c.bannerCount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#181b25]">
                <span className="h-4 w-1 bg-[#1653cc]" />
                Campaign roster
              </h3>
              <p className="mt-1 text-xs text-[#737685]">Sorted by last update within the selected window.</p>
            </div>
            <DataTableShell
              variant="stitchOperational"
              embedded
              columns={["Campaign", "Slug", "Status", "Promotion", "Banners", "Updated", "Actions"]}
              rows={rows}
              rowKeys={items.map((i) => i.id)}
              emptyState="No campaigns returned for this window."
            />
          </div>

          <p className="text-xs text-slate-500">
            Paid media spend, ROAS, and session conversion are not in this view. The placement chart is banner inventory
            counts by slot, not revenue or lift. Use finance and analytics tools for reconciled revenue and ad network
            performance.
          </p>

        </>
      ) : null}
    </StitchPageBody>
  );
};
