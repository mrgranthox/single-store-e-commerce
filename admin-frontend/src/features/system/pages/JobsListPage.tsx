import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { type UseQueryResult } from "@tanstack/react-query";
import { useAuthedQueries } from "@/lib/api/useAuthedQueries";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";

import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { QueryError } from "@/components/primitives/QueryError";
import { SkeletonTable } from "@/components/primitives/Skeleton";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { listAdminJobRuns, type JobRunsListResponse } from "@/features/system/api/admin-jobs.api";
import {
  StitchFieldLabel,
  StitchFilterPanel,
  StitchGradientButton,
  StitchKpiMicro,
  StitchPageBody
} from "@/components/stitch";
import { stitchSelectClass } from "@/components/stitch/stitch-primitives";
import { formatDateTime } from "@/lib/format";
import { CACHE } from "@/lib/api/cache-strategy";
import { useListFilters } from "@/lib/hooks/useListFilters";

const JOB_LIST_DEFAULTS = { job_name: "", status: "", started_after: "", started_before: "" };

const STATUSES = ["", "QUEUED", "RUNNING", "SUCCEEDED", "FAILED"] as const;

const isoToDatetimeLocal = (iso: string) => {
  if (!iso.trim()) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const tone = (s: string): StatusBadgeTone => {
  switch (s) {
    case "SUCCEEDED":
      return "active";
    case "FAILED":
      return "danger";
    case "RUNNING":
    case "QUEUED":
      return "info";
    default:
      return "pending";
  }
};


const formatJobRunDuration = (startedAt: string, finishedAt: string | null) => {
  if (!finishedAt) {
    return "—";
  }
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) {
    return "—";
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
};

export const JobsListPage = () => {
  const { filters, page, set, setPage, setMany, setDebounced } = useListFilters({ defaults: JOB_LIST_DEFAULTS });
  const [startedAfterDraft, setStartedAfterDraft] = useState("");
  const [startedBeforeDraft, setStartedBeforeDraft] = useState("");

  useEffect(() => {
    setStartedAfterDraft(isoToDatetimeLocal(filters.started_after));
    setStartedBeforeDraft(isoToDatetimeLocal(filters.started_before));
  }, [filters.started_after, filters.started_before]);

  const queryKey = useMemo(
    () =>
      [
        "admin-job-runs",
        page,
        filters.job_name,
        filters.status,
        filters.started_after,
        filters.started_before
      ] as const,
    [page, filters.job_name, filters.status, filters.started_after, filters.started_before]
  );

  const listQuery = useAuthedQuery(queryKey, (token) =>
    listAdminJobRuns(token, {
      page,
      pageSize: 20,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.job_name.trim() ? { jobName: filters.job_name.trim() } : {}),
      ...(filters.started_after.trim() ? { startedAfter: filters.started_after.trim() } : {}),
      ...(filters.started_before.trim() ? { startedBefore: filters.started_before.trim() } : {})
    })
  );

  type JobRunCountQuery = UseQueryResult<JobRunsListResponse, Error>;

  const countQueries = useAuthedQueries((token) =>
    (["SUCCEEDED", "FAILED", "RUNNING", "QUEUED"] as const).map((st) => ({
      queryKey: ["admin-job-runs-count", st],
      queryFn: () => listAdminJobRuns(token, { page: 1, pageSize: 1, status: st }),
      ...CACHE.OPERATIONAL
    }))
  ) as [JobRunCountQuery, JobRunCountQuery, JobRunCountQuery, JobRunCountQuery];

  const [succT, failT, runT, queueT] = countQueries.map((q) => q.data?.meta.total ?? 0);
  const jobSuccessPct =
    succT + failT > 0 ? `${((succT / (succT + failT)) * 100).toFixed(1)}%` : succT > 0 ? "100.0%" : "—";

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  const rows = items.map((row) => [
    <Link
      key={row.id}
      to={`/admin/system/jobs/${row.id}`}
      className="font-mono text-xs font-semibold text-[#1653cc] hover:underline"
    >
      {row.id.slice(0, 8)}…
    </Link>,
    <span key={`jn-${row.id}`} className="text-[13px] text-[#374151]">
      {row.jobName}
    </span>,
    <StatusBadge key={`st-${row.id}`} label={row.status.replace(/_/g, " ")} tone={tone(row.status)} />,
    <span key={`stt-${row.id}`} className="text-xs text-[#737685]">
      {formatDateTime(row.startedAt)}
    </span>,
    <span key={`du-${row.id}`} className="font-mono text-xs text-[#374151]">
      {formatJobRunDuration(row.startedAt, row.finishedAt)}
    </span>,
    <span key={`qu-${row.id}`} className="font-mono text-xs text-[#5b5e68]">
      {row.jobId ?? "—"}
    </span>,
    <span key={`rt-${row.id}`} className="text-center font-mono text-xs text-[#737685]">
      —
    </span>,
    <span key={`ac-${row.id}`} className="text-right text-xs text-[#737685]">
      <Link to={`/admin/system/jobs/${row.id}`} className="font-bold text-[#1653cc] hover:underline">
        Open
      </Link>
    </span>
  ]);

  return (
    <StitchPageBody>
      <PageHeader
        title="Background jobs"
        description="Real-time async job health and worker execution monitor."
        titleSize="deck"
        autoBreadcrumbs
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StitchKpiMicro
          label="Successful (tracked)"
          value={succT.toLocaleString()}
          footer={
            <span className="flex items-center gap-1 text-[#006b2d]">
              Success rate {jobSuccessPct}
            </span>
          }
          barClass="bg-[#006b2d]"
        />
        <StitchKpiMicro
          label="Failed (tracked)"
          value={failT.toLocaleString()}
          footer={<span className="text-[#ba1a1a]">All monitored runs</span>}
          barClass="bg-[#ba1a1a]"
        />
        <StitchKpiMicro
          label="Running now"
          value={runT.toLocaleString()}
          footer={<span className="text-[#1653cc]">Active workers</span>}
          barClass="bg-[#1653cc]"
        />
        <StitchKpiMicro
          label="Queued"
          value={queueT.toLocaleString()}
          footer={<span className="text-[#5b5e68]">Waiting</span>}
          barClass="bg-[#737685]"
        />
      </div>

      <StitchFilterPanel className="mb-0 flex flex-wrap items-end gap-4">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-bold uppercase tracking-wider text-[#737685]">
          Filter by job name
          <input
            value={filters.job_name}
            onChange={(e) => setDebounced("job_name", e.target.value)}
            placeholder="e.g. SyncOrderWorker"
            className={stitchSelectClass}
          />
        </label>
        <label className="flex w-48 flex-col gap-1">
          <StitchFieldLabel className="mb-0 text-xs">Status</StitchFieldLabel>
          <select
            value={filters.status}
            onChange={(e) => set("status", e.target.value)}
            className={stitchSelectClass}
          >
            {STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? s.replace(/_/g, " ") : "All statuses"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[160px] flex-col gap-1">
          <StitchFieldLabel className="mb-0 text-xs">Started after</StitchFieldLabel>
          <input
            type="datetime-local"
            value={startedAfterDraft}
            onChange={(e) => setStartedAfterDraft(e.target.value)}
            className={stitchSelectClass}
          />
        </label>
        <label className="flex min-w-[160px] flex-col gap-1">
          <StitchFieldLabel className="mb-0 text-xs">Started before</StitchFieldLabel>
          <input
            type="datetime-local"
            value={startedBeforeDraft}
            onChange={(e) => setStartedBeforeDraft(e.target.value)}
            className={stitchSelectClass}
          />
        </label>
        <div className="flex items-end pb-0.5">
          <StitchGradientButton
            type="button"
            onClick={() => {
              const toIso = (local: string) => {
                if (!local.trim()) {
                  return "";
                }
                const t = new Date(local).getTime();
                return Number.isNaN(t) ? "" : new Date(t).toISOString();
              };
              setMany({
                started_after: toIso(startedAfterDraft),
                started_before: toIso(startedBeforeDraft)
              });
            }}
          >
            Apply Filters
          </StitchGradientButton>
        </div>
      </StitchFilterPanel>

      {listQuery.isError ? (
        <QueryError label="job runs" error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : null}

      {listQuery.isLoading ? (
        <SkeletonTable rows={8} cols={8} label="Loading job runs" />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <DataTableShell
              variant="stitchOperational"
              embedded
              columns={["Job ID", "Job Name", "Status", "Started", "Duration", "Queue", "Retry #", "Actions"]}
              rows={rows}
              rowKeys={items.map((r) => r.id)}
              emptyState="No job runs."
            />
          </div>
          {meta && totalPages > 1 ? (
            <div className="flex flex-wrap justify-between gap-3 text-sm text-[#737685]">
              <span>
                Page {meta.page} of {totalPages} · {meta.total} runs
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(Math.max(1, page - 1))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </StitchPageBody>
  );
};
