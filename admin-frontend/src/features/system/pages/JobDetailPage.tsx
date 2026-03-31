import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getAdminJobRun, retryAdminJobRun } from "@/features/system/api/admin-jobs.api";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";

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

const summarizeError = (error: unknown): string | null => {
  if (error == null) {
    return null;
  }
  if (typeof error === "string") {
    return error.trim() || null;
  }
  if (typeof error === "object" && !Array.isArray(error)) {
    const r = error as Record<string, unknown>;
    if (typeof r.message === "string" && r.message.trim()) {
      return r.message.trim();
    }
    if (typeof r.error === "string" && r.error.trim()) {
      return r.error.trim();
    }
    if (typeof r.code === "string") {
      return r.code;
    }
  }
  return null;
};

export const JobDetailPage = () => {
  const { jobRunId = "" } = useParams<{ jobRunId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions);
  const queryClient = useQueryClient();
  const [retryOpen, setRetryOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["admin-job-run", jobRunId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminJobRun(accessToken, jobRunId);
    },
    enabled: Boolean(accessToken) && Boolean(jobRunId)
  });

  const retryMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return retryAdminJobRun(accessToken, jobRunId, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-job-run", jobRunId] })
  });

  const row = detailQuery.data?.data;
  const err =
    detailQuery.error instanceof ApiError
      ? detailQuery.error.message
      : detailQuery.error instanceof Error
        ? detailQuery.error.message
        : null;

  const canRetryByPermission = adminHasAnyPermission(actorPermissions, ["system.jobs.retry", "system.jobs.run"]);
  const canRetry = row?.status === "FAILED" && canRetryByPermission;
  const errorSummary = summarizeError(row?.error);

  return (
    <div className="space-y-6">
      <PageHeader
        title={row ? row.jobName : "Job run"}
        description="Job run record and retry."
        breadcrumbItems={
          row
            ? [
                { label: "SYSTEM", to: "/admin/system/jobs" },
                { label: `${row.jobName}`.toUpperCase().slice(0, 48) }
              ]
            : undefined
        }
        meta={
          <Link to="/admin/system/jobs" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
            ← All runs
          </Link>
        }
      />

      {!jobRunId ? <p className="text-sm text-red-700">Missing job run id.</p> : null}
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

      {detailQuery.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : row ? (
        <div className="grid gap-6">
          <SurfaceCard title="Summary">
            <dl className="flex flex-wrap gap-6 text-sm">
              <div>
                <dt className="text-[var(--color-text-muted)]">Status</dt>
                <dd className="mt-1">
                  <StatusBadge label={row.status.replace(/_/g, " ")} tone={tone(row.status)} />
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-muted)]">Job id</dt>
                <dd className="mt-1 font-mono text-xs">{row.jobId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-muted)]">Run id</dt>
                <dd className="mt-1 font-mono text-[10px] break-all">{row.id}</dd>
              </div>
            </dl>
            {canRetry ? (
              <button
                type="button"
                disabled={retryMut.isPending}
                onClick={() => setRetryOpen(true)}
                className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Retry
              </button>
            ) : null}
          </SurfaceCard>
          <SurfaceCard title="Error" description="What went wrong, in plain language first.">
            {row.error == null ? (
              <p className="text-sm text-slate-500">No error recorded.</p>
            ) : (
              <div className="space-y-3">
                {errorSummary ? (
                  <p className="rounded-lg border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-900">
                    {errorSummary}
                  </p>
                ) : (
                  <p className="text-sm text-slate-600">An error was recorded. Expand the section below for full details.</p>
                )}
                <TechnicalJsonDisclosure data={row.error} label="Technical error details" defaultOpen={false} />
              </div>
            )}
          </SurfaceCard>
          <SurfaceCard title="Metadata" description="Job input snapshot and correlation keys.">
            {row.metadata == null ? (
              <p className="text-sm text-slate-500">No metadata.</p>
            ) : (
              <TechnicalJsonDisclosure data={row.metadata} label="Job input and metadata" defaultOpen={false} />
            )}
          </SurfaceCard>
        </div>
      ) : null}

      <ConfirmDialog
        open={retryOpen}
        title="Retry this job run?"
        body="A new run will be queued. Use only when you understand the failure and want to re-execute the same workload."
        confirmLabel="Queue retry"
        onClose={() => setRetryOpen(false)}
        onConfirm={() => {
          setRetryOpen(false);
          retryMut.mutate();
        }}
      />
    </div>
  );
};
