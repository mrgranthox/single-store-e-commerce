import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/primitives/PageHeader";
import { QueryError } from "@/components/primitives/QueryError";
import { SkeletonChart, SkeletonKpiRow, SkeletonTable } from "@/components/primitives/Skeleton";
import { ReportDatasetViews } from "@/features/reports/components/ReportDatasetViews";
import { getAdminReportsDataset, type ReportsOverviewQuery } from "@/features/reports/api/admin-reports.api";
import type { ReportDatasetSegment } from "@/features/reports/types/report-payloads";
import { StitchFieldLabel, StitchFilterPanel, StitchPageBody, stitchInputClass } from "@/components/stitch";
import { CACHE } from "@/lib/api/cache-strategy";

export type { ReportDatasetSegment };

const previousPeriodRange = (fromStr: string, toStr: string): { from: string; to: string } | null => {
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  };
  const fromD = parse(fromStr);
  const toD = parse(toStr);
  if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) return null;
  const len = toD.getTime() - fromD.getTime();
  if (len < 0) return null;
  const prevTo = new Date(fromD.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - len);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(prevFrom), to: fmt(prevTo) };
};

type ReportDatasetPageProps = {
  segment: ReportDatasetSegment;
  title: string;
  description: string;
};

export const ReportDatasetPage = ({ segment, title, description }: ReportDatasetPageProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";

  const [from, setFrom] = useState(fromParam);
  const [to, setTo] = useState(toParam);

  useEffect(() => {
    setFrom(fromParam);
    setTo(toParam);
  }, [fromParam, toParam]);

  const range: ReportsOverviewQuery = useMemo(
    () => ({
      ...(from.trim() ? { from: from.trim() } : {}),
      ...(to.trim() ? { to: to.trim() } : {})
    }),
    [from, to]
  );

  const applyRangeToUrl = useCallback((nextFrom: string, nextTo: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextFrom.trim()) next.set("from", nextFrom.trim());
        else next.delete("from");
        if (nextTo.trim()) next.set("to", nextTo.trim());
        else next.delete("to");
        return next;
      },
      { replace: true }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [comparePrevious, setComparePrevious] = useState(false);

  const compareRange = useMemo(() => {
    if (!comparePrevious || !from.trim() || !to.trim()) return null;
    return previousPeriodRange(from.trim(), to.trim());
  }, [comparePrevious, from, to]);

  const filtersActive = Boolean(from.trim() || to.trim());

  const queryKey = useMemo(
    () => ["admin-report-dataset", segment, from, to] as const,
    [segment, from, to],
  );

  const reportQuery = useAuthedQuery(queryKey, (token) => getAdminReportsDataset(token, segment, range), {
    ...CACHE.ANALYTICS
  });

  const compareQuery = useAuthedQuery(
    ["admin-report-dataset", "compare", segment, compareRange?.from, compareRange?.to],
    (token) =>
      compareRange
        ? getAdminReportsDataset(token, segment, { from: compareRange.from, to: compareRange.to })
        : Promise.reject(new Error("No compare range")),
    {
      ...CACHE.ANALYTICS,
      enabled: filtersActive && comparePrevious && Boolean(compareRange),
    },
  );

  const handlePrint = () => {
    const prev = document.title;
    document.title = title;
    window.print();
    document.title = prev;
  };

  return (
    <StitchPageBody className="report-print-root">
      <PageHeader
        title={title}
        titleSize="screen"
        description={description}
        actions={
          <button
            type="button"
            onClick={handlePrint}
            className="no-print rounded-lg border border-[var(--color-border-light)] bg-white px-3 py-2 text-xs font-semibold text-[#0f1117] shadow-sm hover:bg-[#f8f9fb]"
          >
            Print / Save as PDF
          </button>
        }
      />

      <StitchFilterPanel className="no-print flex flex-wrap items-end gap-4">
        <label className="flex min-w-[160px] flex-1 flex-col gap-1">
          <StitchFieldLabel>From</StitchFieldLabel>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              applyRangeToUrl(e.target.value, to);
            }}
            className={stitchInputClass}
          />
        </label>
        <label className="flex min-w-[160px] flex-1 flex-col gap-1">
          <StitchFieldLabel>To</StitchFieldLabel>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              applyRangeToUrl(from, e.target.value);
            }}
            className={stitchInputClass}
          />
        </label>
        {filtersActive ? (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
              applyRangeToUrl("", "");
            }}
            className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-[#1653cc] hover:underline"
          >
            Clear filters
          </button>
        ) : null}
        {filtersActive ? (
          <label className="mb-0.5 flex cursor-pointer items-center gap-2 text-xs font-medium text-[#374151]">
            <input
              type="checkbox"
              checked={comparePrevious}
              onChange={(e) => setComparePrevious(e.target.checked)}
              className="rounded border-slate-300"
            />
            Compare to previous period
          </label>
        ) : null}
      </StitchFilterPanel>

      {reportQuery.isError ? (
        <QueryError label="report" error={reportQuery.error} onRetry={() => void reportQuery.refetch()} />
      ) : null}

      {reportQuery.isLoading ? (
        <div className="space-y-6">
          <SkeletonKpiRow count={4} />
          <SkeletonChart height="h-56" label="Loading chart" />
          <SkeletonTable rows={8} cols={6} label="Loading report table" />
        </div>
      ) : (
        <ReportDatasetViews
          segment={segment}
          payload={reportQuery.data?.data ?? null}
          comparePayload={comparePrevious && filtersActive ? (compareQuery.data?.data ?? null) : null}
          compareLoading={comparePrevious && filtersActive && Boolean(compareRange) && compareQuery.isLoading}
        />
      )}
    </StitchPageBody>
  );
};
