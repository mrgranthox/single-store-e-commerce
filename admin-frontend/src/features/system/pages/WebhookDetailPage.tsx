import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { WorkspaceStateCard } from "@/components/primitives/WorkspaceStateCard";
import { requestAdminStepUpToken } from "@/features/auth/step-up";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { useAdminAction } from "@/lib/admin-actions/useAdminAction";
import {
  ApiError,
  getAdminWebhookEvent,
  retryAdminWebhookEvent
} from "@/features/system/api/admin-system.api";
import { buildWebhookBusinessSummary } from "@/features/system/lib/webhookBusinessSummary";
import { StitchPageBody } from "@/components/stitch";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";
import { formatDateTime } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";

type WebhookAttempt = {
  id: string;
  attemptNo: number;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error?: unknown;
  retryCount?: number;
};

type WebhookDetail = {
  id: string;
  provider: string;
  eventType: string;
  status: string;
  signatureValid: boolean;
  receivedAt: string;
  createdAt: string;
  payload: unknown;
  attempts?: WebhookAttempt[];
};

const tone = (s: string): StatusBadgeTone => {
  if (s === "PROCESSED") return "active";
  if (s === "FAILED" || s === "DEAD_LETTERED" || s === "INVALID_SIGNATURE") return "danger";
  if (s === "PROCESSING" || s === "QUEUED" || s === "RECEIVED" || s === "VERIFIED") return "info";
  return "pending";
};


const humanizeAttemptError = (error: unknown): string | null => {
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
  }
  return "Processing error (see support logs)";
};

export const WebhookDetailPage = () => {
  const { webhookEventId = "" } = useParams<{ webhookEventId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorEmail = useAdminAuthStore((s) => s.actor?.email ?? null);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions);
  const [retryOpen, setRetryOpen] = useState(false);
  const canRetryByPermission = adminHasAnyPermission(actorPermissions, ["system.webhooks.retry", "integrations.webhooks.write"]);

  const detailQuery = useQuery({
    queryKey: ["admin-webhook-event", webhookEventId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminWebhookEvent(accessToken, webhookEventId);
    },
    enabled: Boolean(accessToken) && Boolean(webhookEventId)
  });

  const retryMut = useAdminAction({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return retryAdminWebhookEvent(accessToken, webhookEventId, stepUpToken);
    },
    isAllowed: canRetryByPermission,
    invalidate: [["admin-webhook-event", webhookEventId], ["admin-webhooks"], ["admin-webhooks-health-strip"]]
  });

  const raw = detailQuery.data?.data as WebhookDetail | undefined;
  const err =
    detailQuery.error instanceof ApiError
      ? detailQuery.error.message
      : detailQuery.error instanceof Error
        ? detailQuery.error.message
        : null;

  const canRetry = raw?.signatureValid === true && canRetryByPermission;

  const attempts = [...(raw?.attempts ?? [])].sort((a, b) => b.attemptNo - a.attemptNo);
  const businessLines =
    raw != null ? buildWebhookBusinessSummary(raw.payload, raw.provider, raw.eventType) : [];

  if (detailQuery.isLoading) {
    return (
      <StitchPageBody>
        <div className="space-y-6">
          <PageHeader title="Webhook event" description="Inbound webhook record, verification, and processing attempts." />
          <SurfaceCard title="Loading webhook">
            <div className="space-y-3" aria-busy="true">
              <div className="h-5 w-40 animate-pulse rounded bg-[#eef1f8]" />
              <div className="h-4 w-full animate-pulse rounded bg-[#f4f6fb]" />
              <div className="h-32 animate-pulse rounded-xl bg-[#f4f6fb]" />
            </div>
          </SurfaceCard>
        </div>
      </StitchPageBody>
    );
  }

  if (!raw) {
    return (
      <WorkspaceStateCard
        eyebrow="System webhooks"
        title="Webhook event unavailable"
        description="The webhook record could not be loaded, or it is no longer accessible with your current permissions."
        primaryActionLabel="Return to webhooks"
        onPrimaryAction={() => window.history.back()}
      />
    );
  }

  return (
    <StitchPageBody>
    <div className="space-y-6">
      <PageHeader
        title={raw ? `${raw.provider} · ${raw.eventType}` : "Webhook event"}
        description="Inbound webhook record, verification, and processing attempts."
        breadcrumbItems={
          raw
            ? [
                { label: "SYSTEM", to: "/admin/system/webhooks" },
                { label: raw.id.slice(0, 8).toUpperCase() }
              ]
            : undefined
        }
        meta={
          <Link to="/admin/system/webhooks" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
            ← All webhooks
          </Link>
        }
      />

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

      {
        <>
          <SurfaceCard title="Event overview" description="Operational summary. The full provider message is not shown on this screen.">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {businessLines.map((line) => (
                <div key={line.label} className="rounded-sm border border-[#e0e2f0]/50 bg-[#fafbff] px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">{line.label}</dt>
                  <dd className="mt-1 text-sm font-medium text-[#181b25]">{line.value}</dd>
                </div>
              ))}
            </dl>
          </SurfaceCard>

          <div className="flex flex-wrap items-center gap-3 rounded-sm border border-[#e0e2f0]/40 bg-white px-4 py-3 shadow-sm">
            <StatusBadge label={raw.status.replace(/_/g, " ")} tone={tone(raw.status)} />
            <span className="text-xs text-[#737685]">
              Signature: {raw.signatureValid ? "Verified" : "Failed or not verified"}
            </span>
            <span className="text-xs text-[#737685]">Received {formatDateTime(raw.receivedAt)}</span>
            <span className="font-mono text-[10px] text-[#5b5e68]">Ref {raw.id.slice(0, 13)}…</span>
          </div>

          <SurfaceCard title="Replay">
            <p className="mb-3 text-sm text-[#434654]">
              Re-queues processing when the signature is valid. Invalid-signature events cannot be retried.
            </p>
            <button
              type="button"
              disabled={!canRetry || retryMut.isPending || retryMut.blocked}
              onClick={() => setRetryOpen(true)}
              className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {retryMut.isPending ? "Queuing…" : "Retry processing"}
            </button>
            {retryMut.isError ? (
              <p className="mt-2 text-sm text-red-700">
                {retryMut.error instanceof ApiError ? retryMut.error.message : String(retryMut.error)}
              </p>
            ) : null}
            {retryMut.isSuccess ? (
              <p className="mt-2 text-sm text-[#006b2d]">Replay queued. Refresh in a few seconds for updated status.</p>
            ) : null}
          </SurfaceCard>

          <SurfaceCard title="Attempts">
            {attempts.length === 0 ? (
              <p className="text-sm text-[#737685]">No attempts recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e0e2f0] text-[10px] font-bold uppercase tracking-wider text-[#737685]">
                      <th className="pb-2 pr-2">#</th>
                      <th className="pb-2 pr-2">Status</th>
                      <th className="pb-2 pr-2">Started</th>
                      <th className="pb-2 pr-2">Finished</th>
                      <th className="pb-2">Retries / note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e0e2f0]/60">
                    {attempts.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-2 font-mono">{a.attemptNo}</td>
                        <td className="py-2 pr-2">
                          <StatusBadge label={a.status} tone={a.status === "SUCCEEDED" ? "active" : "danger"} />
                        </td>
                        <td className="py-2 pr-2 text-[#374151]">{formatDateTime(a.startedAt)}</td>
                        <td className="py-2 pr-2 text-[#374151]">{a.finishedAt ? formatDateTime(a.finishedAt) : "—"}</td>
                        <td className="py-2 align-top text-[#374151]">
                          <span className="font-mono text-[11px] text-[#5b5e68]">{a.retryCount ?? 0}</span>
                          {humanizeAttemptError(a.error) ? (
                            <p className="mt-1 max-w-[220px] text-[11px] leading-snug text-[#ba1a1a]">
                              {humanizeAttemptError(a.error)}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SurfaceCard>

        </>
      }

      <ConfirmDialog
        open={retryOpen}
        title="Retry webhook processing?"
        body="Processing will be re-queued for this verified event. Confirm when duplicates and side effects are acceptable for your runbook."
        confirmLabel="Queue replay"
        confirmDisabled={!canRetry || retryMut.isPending || retryMut.blocked}
        onClose={() => setRetryOpen(false)}
        onConfirm={() => {
          setRetryOpen(false);
          retryMut.run(undefined);
        }}
      />
    </div>
    </StitchPageBody>
  );
};
