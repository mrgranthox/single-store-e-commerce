import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataTableShell } from "@/components/primitives/DataTableShell";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import {
  StitchFieldLabel,
  StitchFilterPanel,
  StitchGradientButton,
  StitchKpiMicro,
  StitchPageBody
} from "@/components/stitch";
import { stitchSelectClass } from "@/components/stitch/stitch-primitives";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  listAdminWebhooks,
  retryAdminWebhookEvent,
  type WebhookEventRow
} from "@/features/system/api/admin-system.api";
import { adminJsonGet } from "@/lib/api/admin-get";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { PageHeader } from "@/components/primitives/PageHeader";

const tone = (s: string): StatusBadgeTone => {
  if (s === "PROCESSED") {
    return "active";
  }
  if (s === "FAILED" || s === "DEAD_LETTERED" || s === "INVALID_SIGNATURE") {
    return "danger";
  }
  if (s === "PROCESSING" || s === "QUEUED" || s === "RECEIVED" || s === "VERIFIED") {
    return "info";
  }
  return "pending";
};

type HealthAgg = {
  webhookEvents?: { byStatus?: Array<{ status: string; count: number }>; failuresLast24Hours?: number };
};

const formatWhen = (iso: string | undefined) => {
  if (!iso) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const attemptDurationMs = (w: WebhookEventRow): number | null => {
  const a = w.latestAttempt;
  if (!a?.finishedAt) {
    return null;
  }
  const ms = new Date(a.finishedAt).getTime() - new Date(a.startedAt).getTime();
  return ms >= 0 ? ms : null;
};

const WEBHOOK_STATUSES = [
  "",
  "RECEIVED",
  "VERIFIED",
  "INVALID_SIGNATURE",
  "QUEUED",
  "PROCESSING",
  "PROCESSED",
  "FAILED",
  "DEAD_LETTERED"
] as const;

export const WebhooksListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [providerDraft, setProviderDraft] = useState("");
  const [eventDraft, setEventDraft] = useState("");
  const [status, setStatus] = useState("");
  const [appliedProvider, setAppliedProvider] = useState("");
  const [appliedEvent, setAppliedEvent] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [receivedAfterDraft, setReceivedAfterDraft] = useState("");
  const [receivedBeforeDraft, setReceivedBeforeDraft] = useState("");
  const [appliedReceivedAfter, setAppliedReceivedAfter] = useState("");
  const [appliedReceivedBefore, setAppliedReceivedBefore] = useState("");

  const healthQuery = useQuery({
    queryKey: ["admin-webhooks-health-strip"],
    queryFn: () => adminJsonGet<HealthAgg>("/api/admin/integrations/health", accessToken),
    enabled: Boolean(accessToken),
    staleTime: 20_000,
    retry: false
  });

  const listQuery = useQuery({
    queryKey: [
      "admin-webhooks",
      page,
      appliedProvider,
      appliedEvent,
      appliedStatus,
      appliedReceivedAfter,
      appliedReceivedBefore
    ],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminWebhooks(accessToken, {
        page,
        pageSize: 20,
        ...(appliedStatus ? { status: appliedStatus } : {}),
        ...(appliedProvider.trim() ? { provider: appliedProvider.trim() } : {}),
        ...(appliedEvent.trim() ? { eventType: appliedEvent.trim() } : {}),
        ...(appliedReceivedAfter.trim() ? { receivedAfter: appliedReceivedAfter.trim() } : {}),
        ...(appliedReceivedBefore.trim() ? { receivedBefore: appliedReceivedBefore.trim() } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const retryMut = useMutation({
    mutationFn: (id: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return retryAdminWebhookEvent(accessToken, id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-webhooks-health-strip"] });
    }
  });

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  const err =
    listQuery.error instanceof ApiError ? listQuery.error.message : listQuery.error instanceof Error ? listQuery.error.message : null;

  const kpis = useMemo(() => {
    const byStatus = healthQuery.data?.data?.webhookEvents?.byStatus ?? [];
    const sum = (codes: string[]) =>
      byStatus.filter((b) => codes.includes(b.status)).reduce((s, b) => s + b.count, 0);
    const total = byStatus.reduce((s, b) => s + b.count, 0);
    const processed = sum(["PROCESSED"]);
    const failed = sum(["FAILED", "DEAD_LETTERED", "INVALID_SIGNATURE"]);
    const pending = sum(["RECEIVED", "QUEUED", "PROCESSING"]);
    const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");
    return {
      received: total,
      processed,
      processedRate: pct(processed, total),
      failed,
      failedNote: pct(failed, total),
      retryQ: pending
    };
  }, [healthQuery.data?.data]);

  const canRetryWebhook = adminHasAnyPermission(actorPermissions, ["system.webhooks.retry", "integrations.webhooks.write"]);

  const rows = items.map((w) => {
    const ms = attemptDurationMs(w);
    const canRetryRow = w.status !== "INVALID_SIGNATURE" && canRetryWebhook;
    return [
      <Link
        key={`id-${w.id}`}
        to={`/admin/system/webhooks/${w.id}`}
        className="font-mono text-xs font-semibold text-[#1653cc] hover:underline"
      >
        {w.id.slice(0, 10)}…
      </Link>,
      <span key={`pr-${w.id}`} className="text-[13px] text-[#374151]">
        {w.provider}
      </span>,
      <span key={`ev-${w.id}`} className="max-w-[200px] truncate font-mono text-[12px] text-[#374151]">
        {w.eventType}
      </span>,
      <StatusBadge key={`st-${w.id}`} label={w.status.replace(/_/g, " ")} tone={tone(w.status)} />,
      <span key={`u-${w.id}`} className="text-xs text-[#737685]">
        {formatWhen(w.receivedAt ?? w.updatedAt ?? w.createdAt)}
      </span>,
      <span key={`ms-${w.id}`} className="text-right font-mono text-xs text-[#374151]">
        {ms === null ? "—" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`}
      </span>,
      <span key={`rt-${w.id}`} className="text-right font-mono text-xs text-[#374151]">
        {w.latestAttempt?.attemptNo ?? w.attemptCount ?? "—"}
      </span>,
      <div key={`act-${w.id}`} className="flex flex-wrap items-center justify-end gap-2 text-right">
        <Link to={`/admin/system/webhooks/${w.id}`} className="text-[11px] font-bold uppercase text-[#1653cc] hover:underline">
          View
        </Link>
        {canRetryRow ? (
          <button
            type="button"
            disabled={retryMut.isPending}
            onClick={() => retryMut.mutate(w.id)}
            className="text-[11px] font-bold uppercase text-[#434654] underline decoration-dotted hover:text-[#1653cc] disabled:opacity-50"
          >
            Replay
          </button>
        ) : (
          <span className="text-[10px] font-bold uppercase text-[#737685]">—</span>
        )}
      </div>
    ];
  });

  return (
    <StitchPageBody>
      <PageHeader
        title="Webhooks monitoring"
        description="Inbound provider events, processing attempts, and delivery outcomes."
        titleSize="deck"
        autoBreadcrumbs
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-webhooks", "admin-webhooks-health-strip"])]}
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StitchKpiMicro
          label="Received (all time)"
          value={kpis.received.toLocaleString()}
          footer={<span className="text-[#006b2d]">Live total</span>}
          barClass="bg-[#1653cc]"
        />
        <StitchKpiMicro
          label="Processed"
          value={kpis.processed.toLocaleString()}
          footer={<span className="text-[#006b2d]">{kpis.processedRate} of total</span>}
          barClass="bg-[#006b2d]"
        />
        <StitchKpiMicro
          label="Failed (known states)"
          value={kpis.failed.toLocaleString()}
          footer={<span className="text-[#ba1a1a]">{kpis.failedNote}</span>}
          barClass="bg-[#ba1a1a]"
        />
        <StitchKpiMicro
          label="Retry / in flight"
          value={kpis.retryQ.toLocaleString()}
          footer={<span className="text-[#5b5e68]">Pending pipeline</span>}
          barClass="bg-[#737685]"
        />
      </div>

      <StitchFilterPanel className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-[140px] flex-col gap-1">
          <StitchFieldLabel className="mb-0">Provider</StitchFieldLabel>
          <input
            value={providerDraft}
            onChange={(e) => setProviderDraft(e.target.value)}
            placeholder="Contains…"
            className={stitchSelectClass}
          />
        </label>
        <label className="flex min-w-[160px] flex-col gap-1">
          <StitchFieldLabel className="mb-0">Event type</StitchFieldLabel>
          <input
            value={eventDraft}
            onChange={(e) => setEventDraft(e.target.value)}
            placeholder="Contains…"
            className={stitchSelectClass}
          />
        </label>
        <label className="flex min-w-[140px] flex-col gap-1">
          <StitchFieldLabel className="mb-0">Status</StitchFieldLabel>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={stitchSelectClass}>
            {WEBHOOK_STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? s.replace(/_/g, " ") : "All statuses"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[160px] flex-col gap-1">
          <StitchFieldLabel className="mb-0">Received after</StitchFieldLabel>
          <input
            type="datetime-local"
            value={receivedAfterDraft}
            onChange={(e) => setReceivedAfterDraft(e.target.value)}
            className={stitchSelectClass}
          />
        </label>
        <label className="flex min-w-[160px] flex-col gap-1">
          <StitchFieldLabel className="mb-0">Received before</StitchFieldLabel>
          <input
            type="datetime-local"
            value={receivedBeforeDraft}
            onChange={(e) => setReceivedBeforeDraft(e.target.value)}
            className={stitchSelectClass}
          />
        </label>
        <div className="ml-auto flex items-end">
          <StitchGradientButton
            type="button"
            onClick={() => {
              setAppliedProvider(providerDraft);
              setAppliedEvent(eventDraft);
              setAppliedStatus(status);
              const toIso = (local: string) => {
                if (!local.trim()) {
                  return "";
                }
                const t = new Date(local).getTime();
                return Number.isNaN(t) ? "" : new Date(t).toISOString();
              };
              setAppliedReceivedAfter(toIso(receivedAfterDraft));
              setAppliedReceivedBefore(toIso(receivedBeforeDraft));
              setPage(1);
            }}
          >
            Apply Filters
          </StitchGradientButton>
        </div>
      </StitchFilterPanel>

      {listQuery.isLoading ? (
        <p className="text-sm text-[#737685]">Loading…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <DataTableShell
              variant="stitchOperational"
              embedded
              columns={[
                "Webhook ID",
                "Provider",
                "Event Type",
                "Status",
                "Received (UTC)",
                "Time (ms)",
                "Retry",
                "Actions"
              ]}
              rows={rows}
              rowKeys={items.map((w) => w.id)}
              emptyState="No webhook events."
            />
          </div>
          {meta && totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm text-[#737685]">
              <button
                type="button"
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>
                Page {meta.page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40"
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </StitchPageBody>
  );
};
