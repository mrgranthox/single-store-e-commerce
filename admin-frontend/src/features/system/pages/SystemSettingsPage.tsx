import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell, Lock, Network, ShoppingCart, Star, Headphones, Shield } from "lucide-react";

import { DataTableShell } from "@/components/primitives/DataTableShell";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { StitchBreadcrumbs, StitchPageBody } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { requestAdminStepUpToken } from "@/features/auth/step-up";
import { adminJsonGet } from "@/lib/api/admin-get";
import { ApiError, listAdminSystemSettings, patchAdminSystemSettings, type SystemSettingRow } from "@/features/system/api/admin-system.api";
import { listAdminActionLogs, type AdminActionLogItem } from "@/features/security/api/admin-audit.api";
import { humanizeSettingKey, summarizeSettingValue } from "@/features/system/lib/settingsValueSummary";

const formatApiUptime = (totalSeconds: number) => {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 0)}m`;
};

type SettingsHubHealthPayload = {
  status: string;
  runtime?: { uptimeSeconds: number; environment: string };
  workload24h?: {
    webhookDeliveryRate24hPct?: number | null;
    jobSuccessRate24hPct?: number | null;
  };
  deployment?: { cell: string | null; release: string | null };
};

const formatRelative = (iso: string) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return iso;
  }
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const actionLabel = (code: string) =>
  code
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "Action";

export const SystemSettingsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorEmail = useAdminAuthStore((s) => s.actor?.email ?? null);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SystemSettingRow | null>(null);
  const [draftJson, setDraftJson] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["admin-system-settings"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminSystemSettings(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const recentQuery = useQuery({
    queryKey: ["admin-settings-hub-recent-actions"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminActionLogs(accessToken, { page: 1, page_size: 8 });
    },
    enabled: Boolean(accessToken)
  });

  const healthQuery = useQuery({
    queryKey: ["admin-settings-hub-health"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return adminJsonGet<SettingsHubHealthPayload>("/api/admin/dashboard/system-health", accessToken);
    },
    enabled: Boolean(accessToken),
    retry: false,
    staleTime: 60_000
  });

  const patchMut = useMutation({
    mutationFn: async (payload: { key: string; value: unknown }) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const stepUpToken = await requestAdminStepUpToken({
        accessToken,
        email: actorEmail
      });
      return patchAdminSystemSettings(accessToken, [payload], stepUpToken);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-system-settings"] })
  });

  const items = settingsQuery.data?.data.items ?? [];

  const recentRows = useMemo(() => {
    const logs = recentQuery.data?.data.items ?? [];
    return logs.map((log: AdminActionLogItem) => {
      const initials =
        log.adminUser?.email
          ?.split("@")[0]
          ?.slice(0, 2)
          .toUpperCase() ?? "AD";
      return [
        <div key={`u-${log.id}`} className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#dedfeb] text-[10px] font-bold text-[#60626c]">
            {initials}
          </div>
          <span className="text-[13px] font-medium text-[#374151]">{log.adminUser?.email ?? "System"}</span>
        </div>,
        <span key={`s-${log.id}`} className="text-[13px] text-[#374151]">
          {log.screen ?? "—"}
        </span>,
        <div key={`a-${log.id}`} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1653cc]" />
          <span className="text-[13px] text-[#374151]">{actionLabel(log.actionCode)}</span>
        </div>,
        <span key={`t-${log.id}`} className="text-xs text-[#737685]">
          {formatRelative(log.createdAt)}
        </span>,
        <span key={`i-${log.id}`} className="text-right font-mono text-[10px] text-[#5b5e68]">
          {log.entityId ? `${log.entityId.slice(0, 8)}…` : "—"}
        </span>
      ];
    });
  }, [recentQuery.data?.data.items]);

  const errorMessage =
    settingsQuery.error instanceof ApiError
      ? settingsQuery.error.message
      : settingsQuery.error instanceof Error
        ? settingsQuery.error.message
        : null;

  const hubCard = (
    to: string,
    accent: string,
    iconBg: string,
    Icon: typeof ShoppingCart,
    title: string,
    body: string,
    cta: string
  ) => (
    <Link
      to={to}
      className="group relative flex flex-col justify-between overflow-hidden bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className={`absolute bottom-0 left-0 top-0 w-1 ${accent}`} />
      <div>
        <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-md ${iconBg}`}>
          <Icon className="h-5 w-5 text-[#1653cc]" aria-hidden />
        </div>
        <h2 className="mb-2 font-headline text-sm font-bold text-[#181b25]">{title}</h2>
        <p className="mb-6 text-xs leading-relaxed text-[#434654]">{body}</p>
      </div>
      <span className="flex items-center text-xs font-bold text-[#1653cc] group-hover:underline">
        {cta}
        <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
      </span>
    </Link>
  );

  const lockedCard = (
    Icon: typeof Bell,
    title: string,
    badge: string,
    body: string
  ) => (
    <div className="flex cursor-not-allowed flex-col justify-between bg-[#f2f3ff] p-6 opacity-60 grayscale">
      <div>
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-gray-200 text-gray-500">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-headline text-sm font-bold text-gray-500">{title}</h2>
          <span className="rounded bg-[#ecedfb] px-2 py-0.5 text-[10px] font-bold tracking-tight text-gray-500">
            {badge}
          </span>
        </div>
        <p className="mb-6 text-xs leading-relaxed text-gray-400">{body}</p>
      </div>
      <span className="flex items-center text-xs font-bold text-gray-400">
        Locked
        <Lock className="ml-1 h-3.5 w-3.5" aria-hidden />
      </span>
    </div>
  );

  const healthPayload = healthQuery.data?.data;
  const sysStatus =
    healthQuery.isError || !healthPayload
      ? "Unavailable"
      : healthPayload.status === "ready"
        ? "Operational"
        : "Check services";
  const hubUptime =
    healthPayload?.runtime?.uptimeSeconds != null ? formatApiUptime(healthPayload.runtime.uptimeSeconds) : null;
  const webhookPct = healthPayload?.workload24h?.webhookDeliveryRate24hPct;
  const jobPct = healthPayload?.workload24h?.jobSuccessRate24hPct;
  const dc = healthPayload?.deployment?.cell?.trim() || null;
  const release = healthPayload?.deployment?.release?.trim() || null;

  return (
    <StitchPageBody>
      <div className="flex flex-col gap-1">
        <StitchBreadcrumbs items={[{ label: "System" }, { label: "Control Center" }]} />
          <h1 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">Settings</h1>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {hubCard(
          "/admin/system/settings/checkout",
          "bg-[#1653cc]",
          "bg-[#dbe1ff]/50",
          ShoppingCart,
          "Checkout & Commerce",
          "Manage global transactional flows, tax, and Ghana Cedis (GHS) checkout rules.",
          "Configure"
        )}
        {hubCard(
          "/admin/system/settings/reviews",
          "bg-[#006b2d]",
          "bg-[#6bff8f]/20",
          Star,
          "Reviews & Moderation",
          "Control customer feedback pipelines and automated content filtering rules.",
          "Configure"
        )}
        {hubCard(
          "/admin/system/settings/support",
          "bg-[#3b6de6]",
          "bg-[#dbe1ff]/50",
          Headphones,
          "Support & SLA",
          "Define response thresholds, escalation paths, and support tiering.",
          "Configure"
        )}
        {lockedCard(Bell, "Notifications", "COMING SOON", "Webhook management and cross-channel alerting infrastructure.")}
        {hubCard(
          "/admin/system/integrations-health",
          "bg-[#1653cc]",
          "bg-[#dbe1ff]/50",
          Network,
          "Integrations",
          "Monitor API health, connected services, and data synchronization status.",
          "Integration Health"
        )}
        {lockedCard(Shield, "Roles & Permissions", "COMING SOON", "Granular RBAC controls and custom policy definition engine.")}
      </div>

      <div className="overflow-hidden bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e0e2f0]/50 px-6 py-4">
          <h2 className="font-headline text-xs font-bold uppercase tracking-widest text-[#181b25]">
            Recent System Modifications
          </h2>
          <Link
            to="/admin/security/admin-actions"
            className="text-[10px] font-bold uppercase tracking-tight text-[#1653cc] hover:text-[#3b6de6]"
          >
            View Full Audit Log
          </Link>
        </div>
        {recentQuery.isLoading ? (
          <p className="px-6 py-4 text-sm text-[#737685]">Loading recent activity…</p>
        ) : recentQuery.isError ? (
          <p className="px-6 py-4 text-sm text-[#737685]">Recent activity requires admin action log access.</p>
        ) : (
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["User", "Section", "Action Type", "Timestamp", "Identifier"]}
            rows={recentRows}
            rowKeys={(recentQuery.data?.data.items ?? []).map((r) => r.id)}
            emptyState="No recent admin actions."
          />
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e0e2f0]/50 bg-white px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#737685]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center">
            <span
              className={`mr-2 h-2 w-2 rounded-full ${
                healthQuery.isError || !healthPayload ? "bg-[#737685]" : "bg-[#006b2d]"
              }`}
            />
            System Status: {sysStatus}
          </div>
          {hubUptime && !healthQuery.isError ? (
            <span className="normal-case text-[#434654]">
              API uptime <span className="font-mono font-bold text-[#181b25]">{hubUptime}</span>
            </span>
          ) : null}
          {webhookPct != null && !healthQuery.isError ? (
            <span className="normal-case text-[#434654]">
              Webhooks OK (24h){" "}
              <span className="font-mono font-bold text-[#181b25]">{webhookPct}%</span>
            </span>
          ) : null}
          {jobPct != null && !healthQuery.isError ? (
            <span className="normal-case text-[#434654]">
              Jobs OK (24h) <span className="font-mono font-bold text-[#181b25]">{jobPct}%</span>
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 normal-case text-gray-400">
          {dc ? (
            <span>
              DC <span className="font-mono text-[#374151]">{dc}</span>
            </span>
          ) : null}
          {release ? (
            <span>
              Build <span className="font-mono text-[#374151]">{release}</span>
            </span>
          ) : null}
          <span className="uppercase tracking-wider text-[#737685]">Admin settings hub</span>
        </div>
      </footer>

      <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer select-none px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#737685]">
          All setting keys
        </summary>
        <div className="space-y-4 border-t border-slate-100 p-4">
          <p className="text-xs text-[#737685]">
            Direct access to every configuration key. Use the scoped settings workspaces above when they cover your change.
          </p>
          {settingsQuery.isLoading ? (
            <p className="text-sm text-[#737685]">Loading…</p>
          ) : (
            <DataTableShell
              variant="stitchOperational"
              columns={["Key", "Summary", "Updated"]}
              rows={items.map((row) => [
                <button
                  type="button"
                  key={row.id}
                  onClick={() => {
                    setSelected(row);
                    setDraftJson(JSON.stringify(row.value, null, 2));
                    setParseError(null);
                  }}
                  className="text-left font-mono text-xs font-semibold text-[#1653cc] hover:underline"
                >
                  {row.key}
                </button>,
                <span className="text-[13px] text-[#374151]">{summarizeSettingValue(row.value)}</span>,
                <span className="text-xs text-[#737685]">{formatRelative(row.updatedAt)}</span>
              ])}
              rowKeys={items.map((r) => r.id)}
              emptyState="No settings."
            />
          )}
          {selected ? (
            <SurfaceCard title={`Edit · ${humanizeSettingKey(selected.key)}`}>
              <p className="mb-2 text-xs text-[#737685]">
                Use structured text: object, array, string, number, boolean, or null.
              </p>
              <textarea
                value={draftJson}
                onChange={(e) => {
                  setDraftJson(e.target.value);
                  setParseError(null);
                }}
                rows={8}
                className="w-full rounded-lg border border-[#e5e7eb] bg-[#13161e] p-3 font-mono text-xs text-slate-100"
              />
              {parseError ? <p className="mt-2 text-sm text-red-700">{parseError}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={patchMut.isPending}
                  onClick={() => {
                    try {
                      const value = JSON.parse(draftJson) as unknown;
                      setParseError(null);
                      patchMut.mutate({ key: selected.key, value });
                    } catch {
                      setParseError("Use valid structured text (JSON).");
                    }
                  }}
                  className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
              {patchMut.isError ? (
                <p className="mt-2 text-sm text-red-700">
                  {patchMut.error instanceof Error ? patchMut.error.message : "Save failed."}
                </p>
              ) : null}
            </SurfaceCard>
          ) : null}
        </div>
      </details>
    </StitchPageBody>
  );
};
