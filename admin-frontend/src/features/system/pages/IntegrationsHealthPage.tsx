import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueries, useQueryClient } from "@tanstack/react-query";

import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { PageHeader } from "@/components/primitives/PageHeader";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { StitchKpiMicro, StitchPageBody, StitchSecondaryButton } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { adminJsonGet } from "@/lib/api/admin-get";
import { ApiError } from "@/lib/api/http";
import type { PageActionItem } from "@/components/primitives/PageHeader";

type HealthPayload = {
  providers?: Record<string, boolean>;
  queues?: { prefix?: string; names?: string[] };
  webhookEvents?: {
    byStatus?: Array<{ status: string; count: number }>;
    failuresLast24Hours?: number;
  };
  notifications?: {
    byStatus?: Array<{ status: string; count: number }>;
    failuresLast24Hours?: number;
  };
  webhookProcessingLatency?: {
    windowHours: number;
    byProvider: Array<{ provider: string; sampleCount: number; avgMs: number; p50Ms: number }>;
  };
};

type ProvidersPayload = {
  configuredProviders?: Record<string, string | boolean>;
  webhooks?: Array<{
    id: string;
    provider: string;
    eventType: string;
    status: string;
    receivedAt: string;
  }>;
  notificationDeliveries?: Array<{
    id: string;
    status: string;
    sentAt: string | null;
    createdAt: string;
    notification?: { id: string; type: string; channel: string };
  }>;
};

type ExceptionsPayload = {
  summary?: {
    failedWebhookCount: number;
    failedNotificationCount: number;
    openFinancialExceptionCount: number;
  };
  failedWebhooks?: Array<{
    id: string;
    provider: string;
    eventType: string;
    status: string;
    receivedAt: string;
  }>;
  failedNotifications?: Array<{
    id: string;
    type: string;
    channel: string;
    recipientEmail: string | null;
    updatedAt: string;
  }>;
  financialExceptions?: Array<{
    id: string;
    exceptionType: string;
    status: string;
    orderId: string | null;
    paymentId: string | null;
    refundId: string | null;
    updatedAt: string;
  }>;
};

const webhookTone = (s: string): StatusBadgeTone => {
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

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

type DrawerState =
  | { kind: "webhook"; row: NonNullable<ExceptionsPayload["failedWebhooks"]>[number] }
  | { kind: "notif"; row: NonNullable<ExceptionsPayload["failedNotifications"]>[number] }
  | { kind: "finance"; row: NonNullable<ExceptionsPayload["financialExceptions"]>[number] };

const PROVIDER_CARD_LABELS: Record<string, { title: string; hint: string }> = {
  clerk: { title: "Clerk", hint: "Staff sign-in & sessions" },
  payments: { title: "Paystack", hint: "Checkout & payment webhooks" },
  email: { title: "Brevo", hint: "Transactional email" },
  storage: { title: "Cloudinary", hint: "Product media & CDN" },
  sentry: { title: "Sentry", hint: "Error monitoring" }
};

const LatencyTrendSvg = ({
  series
}: {
  series: Array<{ provider: string; avgMs: number }>;
}) => {
  const sorted = [...series].sort((a, b) => a.provider.localeCompare(b.provider));
  if (sorted.length === 0) {
    return null;
  }
  const max = Math.max(...sorted.map((s) => s.avgMs), 1);
  const w = 360;
  const h = 140;
  const padX = 12;
  const padY = 16;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const n = sorted.length;
  const points = sorted.map((s, i) => {
    const x = n === 1 ? w / 2 : padX + (i / (n - 1)) * innerW;
    const y = padY + innerH - (s.avgMs / max) * innerH;
    return `${x},${y}`;
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-36 w-full max-w-xl text-[#1653cc]"
      role="img"
      aria-label="Average webhook latency trend by provider"
    >
      <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="#e0e2f0" strokeWidth="1" />
      <line x1={padX} y1={padY} x2={padX} y2={h - padY} stroke="#e0e2f0" strokeWidth="1" />
      <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" points={points.join(" ")} />
      {sorted.map((s, i) => {
        const x = n === 1 ? w / 2 : padX + (i / Math.max(n - 1, 1)) * innerW;
        const y = padY + innerH - (s.avgMs / max) * innerH;
        return <circle key={s.provider} cx={x} cy={y} r="4" fill="currentColor" />;
      })}
    </svg>
  );
};

export const IntegrationsHealthPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const [healthQ, providersQ, exceptionsQ] = useQueries({
    queries: [
      {
        queryKey: ["admin-integrations-health"],
        queryFn: () => adminJsonGet<HealthPayload>("/api/admin/integrations/health", accessToken),
        enabled: Boolean(accessToken),
        staleTime: 20_000
      },
      {
        queryKey: ["admin-integrations-providers"],
        queryFn: () => adminJsonGet<ProvidersPayload>("/api/admin/integrations/providers", accessToken),
        enabled: Boolean(accessToken),
        staleTime: 20_000
      },
      {
        queryKey: ["admin-integrations-exceptions"],
        queryFn: () => adminJsonGet<ExceptionsPayload>("/api/admin/integrations/exceptions", accessToken),
        enabled: Boolean(accessToken),
        staleTime: 20_000
      }
    ]
  });

  const err =
    healthQ.error instanceof ApiError
      ? healthQ.error.message
      : providersQ.error instanceof ApiError
        ? providersQ.error.message
        : exceptionsQ.error instanceof ApiError
          ? exceptionsQ.error.message
          : null;

  const refreshAll: PageActionItem = {
    id: "refresh-integrations",
    label: "Refresh data",
    onSelect: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-integrations-health"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-integrations-providers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-integrations-exceptions"] });
    }
  };

  const health = healthQ.data?.data;
  const providers = providersQ.data?.data;
  const exceptions = exceptionsQ.data?.data;

  const providerEntries = Object.entries(health?.providers ?? {}).map(([key, ok]) => {
    const meta = PROVIDER_CARD_LABELS[key];
    return {
      key,
      label: meta?.title ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
      hint: meta?.hint ?? "Integration dependency",
      ok: Boolean(ok)
    };
  });

  const latencyByProvider = health?.webhookProcessingLatency?.byProvider ?? [];

  const latencyRows =
    latencyByProvider.map((row) => [
      <span key={row.provider} className="font-mono text-xs">
        {row.provider}
      </span>,
      <span key={`s-${row.provider}`}>{row.sampleCount.toLocaleString()}</span>,
      <span key={`a-${row.provider}`} className="font-mono text-xs">
        {row.avgMs}ms
      </span>,
      <span key={`p-${row.provider}`} className="font-mono text-xs">
        {row.p50Ms}ms
      </span>
    ]) ?? [];

  const webhookStatusRows =
    health?.webhookEvents?.byStatus?.map((b) => [
      <span key={b.status} className="font-medium">
        {b.status.replace(/_/g, " ")}
      </span>,
      <span key={`c-${b.status}`}>{b.count.toLocaleString()}</span>
    ]) ?? [];

  const recentWebhookRows =
    providers?.webhooks?.map((w) => [
      <span key={w.id} className="font-mono text-[11px]">
        {w.id.slice(0, 8)}…
      </span>,
      w.provider,
      <span key={`e-${w.id}`} className="max-w-[180px] truncate font-mono text-[11px]">
        {w.eventType}
      </span>,
      <StatusBadge key={`s-${w.id}`} label={w.status.replace(/_/g, " ")} tone={webhookTone(w.status)} />,
      <span key={`t-${w.id}`} className="text-xs text-[#737685]">
        {formatWhen(w.receivedAt)}
      </span>
    ]) ?? [];

  const deliveryRows =
    providers?.notificationDeliveries?.map((d) => [
      <span key={d.id} className="font-mono text-[11px]">
        {d.id.slice(0, 8)}…
      </span>,
      d.notification?.type ?? "—",
      d.notification?.channel ?? "—",
      <StatusBadge key={`ds-${d.id}`} label={d.status} tone={d.status === "SENT" ? "active" : "pending"} />,
      <span key={`dt-${d.id}`} className="text-xs text-[#737685]">
        {formatWhen(d.sentAt ?? d.createdAt)}
      </span>
    ]) ?? [];

  const exSummary = exceptions?.summary;

  const failedWhRows =
    exceptions?.failedWebhooks?.map((w) => [
      <span key={w.id} className="font-mono text-[11px]">
        {w.id.slice(0, 8)}…
      </span>,
      w.provider,
      <span key={`ev-${w.id}`} className="max-w-[160px] truncate text-xs">
        {w.eventType}
      </span>,
      <StatusBadge key={`st-${w.id}`} label={w.status.replace(/_/g, " ")} tone="danger" />,
      <span key={`rt-${w.id}`} className="text-xs text-[#737685]">
        {formatWhen(w.receivedAt)}
      </span>,
      <button
        key={`ex-${w.id}`}
        type="button"
        onClick={() => setDrawer({ kind: "webhook", row: w })}
        className="text-left text-[11px] font-bold uppercase tracking-tight text-[#1653cc] hover:underline"
      >
        Inspect
      </button>
    ]) ?? [];

  const failedNotifRows =
    exceptions?.failedNotifications?.map((n) => [
      <span key={n.id} className="font-mono text-[11px]">
        {n.id.slice(0, 8)}…
      </span>,
      n.type,
      n.channel,
      <span key={`em-${n.id}`} className="max-w-[160px] truncate text-xs">
        {n.recipientEmail ?? "—"}
      </span>,
      <span key={`nt-${n.id}`} className="text-xs text-[#737685]">
        {formatWhen(n.updatedAt)}
      </span>,
      <button
        key={`nx-${n.id}`}
        type="button"
        onClick={() => setDrawer({ kind: "notif", row: n })}
        className="text-left text-[11px] font-bold uppercase tracking-tight text-[#1653cc] hover:underline"
      >
        Inspect
      </button>
    ]) ?? [];

  const finExcRows =
    exceptions?.financialExceptions?.map((x) => [
      <span key={x.id} className="font-mono text-[11px]">
        {x.id.slice(0, 8)}…
      </span>,
      x.exceptionType.replace(/_/g, " "),
      <StatusBadge key={`xs-${x.id}`} label={x.status} tone={x.status === "OPEN" ? "warning" : "pending"} />,
      <span key={`xo-${x.id}`} className="text-xs">
        {x.orderId ? `Order ${x.orderId.slice(0, 8)}…` : x.paymentId ? `Pay ${x.paymentId.slice(0, 8)}…` : "—"}
      </span>,
      <span key={`xt-${x.id}`} className="text-xs text-[#737685]">
        {formatWhen(x.updatedAt)}
      </span>,
      <button
        key={`fx-${x.id}`}
        type="button"
        onClick={() => setDrawer({ kind: "finance", row: x })}
        className="text-left text-[11px] font-bold uppercase tracking-tight text-[#1653cc] hover:underline"
      >
        Inspect
      </button>
    ]) ?? [];

  const loading = healthQ.isLoading || providersQ.isLoading || exceptionsQ.isLoading;

  const refresh = () => {
    refreshAll.onSelect?.();
  };

  const configuredRows =
    providers?.configuredProviders != null
      ? Object.entries(providers.configuredProviders).map(([k, v]) => [
          <span key={k} className="font-medium capitalize text-[#374151]">
            {k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
          </span>,
          <span key={`v-${k}`} className="font-mono text-xs text-[#181b25]">
            {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
          </span>
        ])
      : [];

  return (
    <StitchPageBody>
      <PageHeader
        title="Integration health"
        description="Real-time monitoring of external API nodes, delivery pipelines, and open exceptions."
        titleSize="deck"
        autoBreadcrumbs
        actionMenuItems={[refreshAll]}
        actions={
          <StitchSecondaryButton type="button" onClick={refresh}>
            Refresh all
          </StitchSecondaryButton>
        }
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#737685]">Loading…</p>
      ) : (
        <>
          {configuredRows.length > 0 ? (
            <section className="overflow-hidden rounded-xl bg-white shadow-sm">
              <header className="border-b border-slate-100 px-5 py-3">
                <h3 className="font-headline text-sm font-bold text-[#181b25]">Configured providers</h3>
                <p className="text-xs text-[#737685]">Environment-selected stacks for this deployment.</p>
              </header>
              <DataTableShell
                variant="stitchOperational"
                embedded
                columns={["Integration", "Value"]}
                rows={configuredRows}
                emptyState="—"
              />
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(providerEntries.length > 0 ? providerEntries : []).map((p) => (
              <StitchKpiMicro
                key={p.key}
                label={p.label}
                value={p.ok ? "Connected" : "Not configured"}
                footer={
                  <span className={p.ok ? "text-[#006b2d]" : "text-[#737685]"}>
                    {p.ok ? p.hint : "Check environment keys"}
                  </span>
                }
                barClass={p.ok ? "bg-[#006b2d]" : "bg-[#737685]"}
              />
            ))}
          </div>

          {health?.queues?.names?.length ? (
            <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="font-headline text-sm font-bold uppercase tracking-wider text-[#737685]">Queue fabric</h3>
              <p className="mt-1 text-xs text-[#434654]">
                Prefix <span className="font-mono font-semibold">{health.queues.prefix ?? "—"}</span>
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {health.queues.names.map((n) => (
                  <li
                    key={n}
                    className="rounded-full bg-[#f2f3ff] px-3 py-1 font-mono text-[11px] font-semibold text-[#181b25]"
                  >
                    {n}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="overflow-hidden rounded-xl bg-white shadow-sm">
              <header className="border-b border-slate-100 px-5 py-3">
                <h3 className="font-headline text-sm font-bold text-[#181b25]">Webhook processing latency</h3>
                <p className="text-xs text-[#737685]">
                  Window: last {health?.webhookProcessingLatency?.windowHours ?? "—"} hours (successful attempts)
                </p>
              </header>
              <div className="border-b border-slate-100 px-5 py-4">
                <LatencyTrendSvg
                  series={latencyByProvider.map((r) => ({ provider: r.provider, avgMs: r.avgMs }))}
                />
                {latencyByProvider.length === 0 ? (
                  <p className="text-xs text-[#737685]">No points to plot.</p>
                ) : null}
              </div>
              <DataTableShell
                variant="stitchOperational"
                embedded
                columns={["Provider", "Samples", "Avg", "P50"]}
                rows={latencyRows}
                emptyState="No latency samples yet."
              />
            </section>

            <section className="overflow-hidden rounded-xl bg-white shadow-sm">
              <header className="border-b border-slate-100 px-5 py-3">
                <h3 className="font-headline text-sm font-bold text-[#181b25]">Webhook events by status</h3>
                <p className="text-xs text-[#737685]">
                  Failures (24h): {health?.webhookEvents?.failuresLast24Hours?.toLocaleString() ?? "—"}
                </p>
              </header>
              <DataTableShell
                variant="stitchOperational"
                embedded
                columns={["Status", "Count"]}
                rows={webhookStatusRows}
                emptyState="No webhook status data."
              />
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="overflow-hidden rounded-xl bg-white shadow-sm">
              <header className="border-b border-slate-100 px-5 py-3">
                <h3 className="font-headline text-sm font-bold text-[#181b25]">Recent webhook events</h3>
              </header>
              <DataTableShell
                variant="stitchOperational"
                embedded
                columns={["ID", "Provider", "Event", "Status", "Received"]}
                rows={recentWebhookRows}
                rowKeys={providers?.webhooks?.map((w) => w.id)}
                emptyState="No recent webhooks."
              />
            </section>
            <section className="overflow-hidden rounded-xl bg-white shadow-sm">
              <header className="border-b border-slate-100 px-5 py-3">
                <h3 className="font-headline text-sm font-bold text-[#181b25]">Recent notification deliveries</h3>
              </header>
              <DataTableShell
                variant="stitchOperational"
                embedded
                columns={["ID", "Type", "Channel", "Status", "When"]}
                rows={deliveryRows}
                rowKeys={providers?.notificationDeliveries?.map((d) => d.id)}
                emptyState="No deliveries."
              />
            </section>
          </div>

          <section className="overflow-hidden rounded-xl bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h3 className="font-headline text-lg font-bold text-[#181b25]">Active integration exceptions</h3>
              <div className="flex flex-wrap gap-3 text-[11px] font-bold uppercase tracking-wider text-[#737685]">
                <span>Failed webhooks: {exSummary?.failedWebhookCount ?? 0}</span>
                <span>Failed notifications: {exSummary?.failedNotificationCount ?? 0}</span>
                <span>Open finance: {exSummary?.openFinancialExceptionCount ?? 0}</span>
              </div>
            </header>
            <div className="space-y-6 p-5">
              <div>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#737685]">Failed webhooks</h4>
                <DataTableShell
                  variant="stitchOperational"
                  embedded
                  columns={["ID", "Provider", "Event", "Status", "Last event", ""]}
                  rows={failedWhRows}
                  rowKeys={exceptions?.failedWebhooks?.map((w) => w.id)}
                  emptyState="None."
                />
              </div>
              <div>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#737685]">
                  Failed notifications
                </h4>
                <DataTableShell
                  variant="stitchOperational"
                  embedded
                  columns={["ID", "Type", "Channel", "Recipient", "Updated", ""]}
                  rows={failedNotifRows}
                  rowKeys={exceptions?.failedNotifications?.map((n) => n.id)}
                  emptyState="None."
                />
              </div>
              <div>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#737685]">
                  Open financial exceptions
                </h4>
                <DataTableShell
                  variant="stitchOperational"
                  embedded
                  columns={["ID", "Type", "Status", "Linked", "Updated", ""]}
                  rows={finExcRows}
                  rowKeys={exceptions?.financialExceptions?.map((x) => x.id)}
                  emptyState="None."
                />
              </div>
            </div>
          </section>

          {drawer ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 bg-[#181b25]/40"
                aria-label="Close exception drawer"
                onClick={() => setDrawer(null)}
              />
              <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#e0e2f0] bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-[#e0e2f0] px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">
                      {drawer.kind === "webhook"
                        ? "Failed webhook"
                        : drawer.kind === "notif"
                          ? "Failed notification"
                          : "Financial exception"}
                    </p>
                    <h3 className="font-headline mt-1 text-lg font-bold text-[#181b25]">
                      {drawer.kind === "webhook"
                        ? drawer.row.eventType
                        : drawer.kind === "notif"
                          ? `${drawer.row.type} · ${drawer.row.channel}`
                          : drawer.row.exceptionType.replace(/_/g, " ")}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawer(null)}
                    className="rounded-sm px-2 py-1 text-xs font-bold uppercase text-[#737685] hover:bg-[#f2f3ff]"
                  >
                    Close
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-[#374151]">
                  {drawer.kind === "webhook" ? (
                    <div className="space-y-5">
                      <div className="rounded-sm border border-[#ba1a1a]/25 bg-[#fff5f5] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#ba1a1a]">Severity</p>
                        <p className="mt-1 text-sm font-semibold text-[#181b25]">Payment pipeline risk</p>
                        <p className="mt-1 text-xs leading-relaxed text-[#434654]">
                          A provider webhook did not complete successfully. Money movement may be out of sync until this is
                          resolved.
                        </p>
                      </div>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">Provider</dt>
                          <dd className="mt-0.5 font-medium text-[#181b25]">{drawer.row.provider}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">What failed</dt>
                          <dd className="mt-0.5">{drawer.row.eventType.replace(/[._]/g, " ")}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">Processing state</dt>
                          <dd className="mt-0.5">{drawer.row.status.replace(/_/g, " ")}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">Last received</dt>
                          <dd className="mt-0.5">{formatWhen(drawer.row.receivedAt)}</dd>
                        </div>
                      </dl>
                      <div className="rounded-sm bg-[#f2f3ff] px-3 py-3">
                        <p className="text-[10px] font-bold uppercase text-[#1653cc]">Recommended next steps</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-[#374151]">
                          <li>Open the event in webhooks to replay after verifying the Paystack secret.</li>
                          <li>Confirm the charge or transfer in the Paystack dashboard.</li>
                          <li>If signatures fail, rotate keys and redeploy the webhook URL.</li>
                        </ul>
                      </div>
                      <Link
                        to={`/admin/system/webhooks/${drawer.row.id}`}
                        className="inline-flex text-[11px] font-bold uppercase text-[#1653cc] hover:underline"
                      >
                        Open in webhooks monitor →
                      </Link>
                    </div>
                  ) : null}
                  {drawer.kind === "notif" ? (
                    <div className="space-y-5">
                      <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">Customer impact</p>
                        <p className="mt-1 text-xs text-[#434654]">
                          The customer may not have received this message. Check spam folders and provider quotas.
                        </p>
                      </div>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">Template / type</dt>
                          <dd className="mt-0.5 font-medium">{drawer.row.type}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">Channel</dt>
                          <dd className="mt-0.5">{drawer.row.channel}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">Recipient</dt>
                          <dd className="mt-0.5">{drawer.row.recipientEmail ?? "Not captured"}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">Last update</dt>
                          <dd className="mt-0.5">{formatWhen(drawer.row.updatedAt)}</dd>
                        </div>
                      </dl>
                      <div className="rounded-sm bg-[#f2f3ff] px-3 py-3 text-xs text-[#374151]">
                        <span className="font-bold text-[#1653cc]">Operator note: </span>
                        Retry from the notifications workspace when your permissions allow; otherwise escalate to the team
                        owning Brevo templates.
                      </div>
                    </div>
                  ) : null}
                  {drawer.kind === "finance" ? (
                    <div className="space-y-5">
                      <div className="rounded-sm border border-[#1653cc]/20 bg-[#f2f3ff] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-[#1653cc]">Reconciliation</p>
                        <p className="mt-1 text-xs text-[#434654]">
                          Financial exceptions need a human decision before payouts or refunds proceed.
                        </p>
                      </div>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">Exception type</dt>
                          <dd className="mt-0.5 font-medium">{drawer.row.exceptionType.replace(/_/g, " ")}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">Workflow status</dt>
                          <dd className="mt-0.5">{drawer.row.status}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">Linked record</dt>
                          <dd className="mt-0.5">
                            {drawer.row.orderId
                              ? `Order ${drawer.row.orderId.slice(0, 8)}…`
                              : drawer.row.paymentId
                                ? `Payment ${drawer.row.paymentId.slice(0, 8)}…`
                                : drawer.row.refundId
                                  ? `Refund ${drawer.row.refundId.slice(0, 8)}…`
                                  : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase text-[#737685]">Updated</dt>
                          <dd className="mt-0.5">{formatWhen(drawer.row.updatedAt)}</dd>
                        </div>
                      </dl>
                      <Link
                        to="/admin/finance/exceptions"
                        className="inline-flex text-[11px] font-bold uppercase text-[#1653cc] hover:underline"
                      >
                        Open finance exceptions →
                      </Link>
                    </div>
                  ) : null}
                </div>
              </aside>
            </>
          ) : null}

          <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#737685]">
              Technical reference — full API responses
            </summary>
            <div className="space-y-4 border-t border-slate-100 p-4">
              <TechnicalJsonDisclosure data={health} label="Overall health response" defaultOpen={false} />
              <TechnicalJsonDisclosure data={providers} label="Provider status response" defaultOpen={false} />
              <TechnicalJsonDisclosure data={exceptions} label="Exceptions response" defaultOpen={false} />
            </div>
          </details>
        </>
      )}
    </StitchPageBody>
  );
};
