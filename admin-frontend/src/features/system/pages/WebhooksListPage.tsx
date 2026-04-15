import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";

import { preloadLazyNamedComponent } from "@/app/lazy-admin-routes";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { QueryError } from "@/components/primitives/QueryError";
import { SkeletonTable } from "@/components/primitives/Skeleton";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import {
  StitchFieldLabel,
  StitchFilterPanel,
  StitchGradientButton,
  StitchKpiMicro,
  StitchPageBody
} from "@/components/stitch";
import { stitchSelectClass } from "@/components/stitch/stitch-primitives";
import { requestAdminStepUpToken } from "@/features/auth/step-up";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { useAdminAction } from "@/lib/admin-actions/useAdminAction";
import {
  ApiError,
  getAdminWebhookEvent,
  listAdminWebhooks,
  retryAdminWebhookEvent,
  type WebhookEventRow
} from "@/features/system/api/admin-system.api";
import { adminJsonGet } from "@/lib/api/admin-get";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";
import { useAdminDetailPrefetch } from "@/lib/performance/useAdminDetailPrefetch";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { PageHeader } from "@/components/primitives/PageHeader";
import { formatDateTime } from "@/lib/format";
import { CACHE } from "@/lib/api/cache-strategy";
import { useListFilters } from "@/lib/hooks/useListFilters";

const WEBHOOK_LIST_DEFAULTS = {
  provider: "",
  event_type: "",
  status: "",
  received_after: "",
  received_before: ""
};

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
  const actorEmail = useAdminAuthStore((s) => s.actor?.email ?? null);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions);
  const queryClient = useQueryClient();
  const { filters, page, setPage, setMany } = useListFilters({ defaults: WEBHOOK_LIST_DEFAULTS });
  const [providerDraft, setProviderDraft] = useState("");
  const [eventDraft, setEventDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [receivedAfterDraft, setReceivedAfterDraft] = useState("");
  const [receivedBeforeDraft, setReceivedBeforeDraft] = useState("");

  useEffect(() => {
    setProviderDraft(filters.provider);
    setEventDraft(filters.event_type);
    setStatusDraft(filters.status);
    setReceivedAfterDraft(isoToDatetimeLocal(filters.received_after));
    setReceivedBeforeDraft(isoToDatetimeLocal(filters.received_before));
  }, [filters.provider, filters.event_type, filters.status, filters.received_after, filters.received_before]);

  const healthQuery = useAuthedQuery(
    ["admin-webhooks-health-strip"],
    (token) => adminJsonGet<HealthAgg>("/api/admin/integrations/health", token),
    { ...CACHE.OPERATIONAL, retry: false }
  );

  const listQuery = useAuthedQuery(
    [
      "admin-webhooks",
      page,
      filters.provider,
      filters.event_type,
      filters.status,
      filters.received_after,
      filters.received_before
    ],
    (token) =>
      listAdminWebhooks(token, {
        page,
        pageSize: 20,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.provider.trim() ? { provider: filters.provider.trim() } : {}),
        ...(filters.event_type.trim() ? { eventType: filters.event_type.trim() } : {}),
        ...(filters.received_after.trim() ? { receivedAfter: filters.received_after.trim() } : {}),
        ...(filters.received_before.trim() ? { receivedBefore: filters.received_before.trim() } : {})
      })
  );

  const canRetryWebhook = adminHasAnyPermission(actorPermissions, ["system.webhooks.retry", "integrations.webhooks.write"]);

  const retryMut = useAdminAction({
    mutationFn: async (id: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return retryAdminWebhookEvent(accessToken, id, stepUpToken);
    },
    isAllowed: canRetryWebhook,
    invalidate: [["admin-webhooks"], ["admin-webhooks-health-strip"]]
  });

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;
  const { prefetch: prefetchWebhook, prefetchMany: prefetchWebhooks } = useAdminDetailPrefetch({
    enabled: Boolean(accessToken),
    ...CACHE.OPERATIONAL,
    queryKeyFor: (webhookEventId: string) => ["admin-webhook-event", webhookEventId],
    queryFnFor: (webhookEventId: string) => getAdminWebhookEvent(accessToken!, webhookEventId),
    onPrefetch: () => preloadLazyNamedComponent("../features/system/pages/WebhookDetailPage.tsx", "WebhookDetailPage")
  });

  useEffect(() => {
    prefetchWebhooks(items.map((item) => item.id), 2);
  }, [items, prefetchWebhooks]);

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

  const rows = items.map((w) => {
    const ms = attemptDurationMs(w);
    const canRetryRow = w.status !== "INVALID_SIGNATURE" && canRetryWebhook;
    return [
      <Link
        key={`id-${w.id}`}
        to={`/admin/system/webhooks/${w.id}`}
        onMouseEnter={() => prefetchWebhook(w.id)}
        onFocus={() => prefetchWebhook(w.id)}
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
        {formatDateTime(w.receivedAt ?? w.updatedAt ?? w.createdAt)}
      </span>,
      <span key={`ms-${w.id}`} className="text-right font-mono text-xs text-[#374151]">
        {ms === null ? "—" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`}
      </span>,
      <span key={`rt-${w.id}`} className="text-right font-mono text-xs text-[#374151]">
        {w.latestAttempt?.attemptNo ?? w.attemptCount ?? "—"}
      </span>,
      <div key={`act-${w.id}`} className="flex flex-wrap items-center justify-end gap-2 text-right">
        <Link
          to={`/admin/system/webhooks/${w.id}`}
          onMouseEnter={() => prefetchWebhook(w.id)}
          onFocus={() => prefetchWebhook(w.id)}
          className="text-xs font-bold uppercase text-[#1653cc] hover:underline"
        >
          View
        </Link>
        {canRetryRow ? (
          <button
            type="button"
            disabled={retryMut.isPending || retryMut.blocked}
            onClick={() => retryMut.run(w.id)}
            className="text-xs font-bold uppercase text-[#434654] underline decoration-dotted hover:text-[#1653cc] disabled:opacity-50"
          >
            Replay
          </button>
        ) : (
          <span className="text-xs font-bold uppercase text-[#737685]">—</span>
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

      {listQuery.isError ? (
        <QueryError label="webhooks" error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : null}
      {retryMut.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {retryMut.error instanceof ApiError ? retryMut.error.message : String(retryMut.error)}
        </div>
      ) : null}
      {retryMut.isSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Replay queued. Refresh in a few seconds for updated status.
        </div>
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
          <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} className={stitchSelectClass}>
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
              const toIso = (local: string) => {
                if (!local.trim()) {
                  return "";
                }
                const t = new Date(local).getTime();
                return Number.isNaN(t) ? "" : new Date(t).toISOString();
              };
              setMany({
                provider: providerDraft.trim(),
                event_type: eventDraft.trim(),
                status: statusDraft,
                received_after: toIso(receivedAfterDraft),
                received_before: toIso(receivedBeforeDraft)
              });
            }}
          >
            Apply Filters
          </StitchGradientButton>
        </div>
      </StitchFilterPanel>

      {listQuery.isLoading ? (
        <SkeletonTable rows={8} cols={8} label="Loading webhooks" />
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
                onClick={() => setPage(Math.max(1, page - 1))}
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
                onClick={() => setPage(page + 1)}
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
