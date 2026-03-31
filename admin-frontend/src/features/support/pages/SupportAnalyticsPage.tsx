import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Star, Timer, TrendingUp, Zap } from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { SupportWorkspaceNav } from "@/features/support/components/SupportWorkspaceNav";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getSupportReports, type SupportReportsData } from "@/features/support/api/admin-support.api";
import {
  countByPriority,
  countByStatus,
  formatMinutesLabel,
  totalTickets
} from "@/features/support/lib/supportPresentation";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

type Period = "daily" | "weekly" | "monthly";

const statusLabel = (s: string) => s.replace(/_/g, " ");

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-[#1653cc]",
  IN_PROGRESS: "bg-[#3b6de6]",
  PENDING_CUSTOMER: "bg-amber-500",
  CLOSED: "bg-slate-300"
};

const PRIORITY_BAR_COLORS: Record<string, string> = {
  URGENT: "bg-[#ba1a1a]",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-[#1653cc]",
  LOW: "bg-slate-300"
};

export const SupportAnalyticsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("weekly");

  const q = useQuery({
    queryKey: ["admin-support-reports", period],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getSupportReports(accessToken, period);
    },
    enabled: Boolean(accessToken)
  });

  const data = q.data?.data ?? null;

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const totals = useMemo(() => computePresentation(data), [data]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Support analytics"
          titleSize="deck"
          description="Operational performance and ticket distribution summary."
          autoBreadcrumbs
          actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-support-reports"])]}
        />
        <div className="flex items-center gap-1 rounded-xl border border-slate-100 bg-white p-1 shadow-sm">
          {(
            [
              ["daily", "Daily"],
              ["weekly", "Weekly"],
              ["monthly", "Monthly"]
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                period === key ? "bg-[#1653cc] text-white" : "text-[#181b25] hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <SupportWorkspaceNav />

      {data ? (
        <p className="text-xs text-[#60626c]">
          Reporting window ({period}):{" "}
          <span className="font-mono font-semibold text-[#181b25]">{totals.windowLabel}</span>
        </p>
      ) : null}

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[#60626c]">Loading analytics…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <AnalyticsKpi
              label="Avg first response"
              value={formatMinutesLabel(data?.averages.firstResponseMinutes ?? null)}
              hint="Tickets touched in this window with admin reply"
              icon={<Timer className="h-5 w-5 text-[#1653cc]" />}
              accent="bg-[#1653cc]"
              footer={<span className="text-[0.6875rem] text-slate-400">Period-scoped</span>}
            />
            <AnalyticsKpi
              label="Avg resolution time"
              value={formatMinutesLabel(data?.averages.resolutionMinutes ?? null)}
              hint="Tickets closed during this window"
              icon={<CheckCircle2 className="h-5 w-5 text-[#3b6de6]" />}
              accent="bg-[#3b6de6]"
              footer={<span className="text-[0.6875rem] text-slate-400">Created → closed</span>}
            />
            <AnalyticsKpi
              label="CSAT score"
              value={data?.csat.score != null ? `${Math.round(data.csat.score * 100) / 100}` : "—"}
              hint={data?.csat.note ?? "No survey pipeline"}
              icon={<Star className="h-5 w-5 fill-amber-500 text-amber-500" />}
              accent="bg-amber-400"
              footer={<span className="text-[0.6875rem] text-slate-400">Placeholder until stored</span>}
            />
            <AnalyticsKpi
              label="First-response SLA"
              value={
                data?.sla.firstResponseCompliancePercent != null
                  ? `${data.sla.firstResponseCompliancePercent}%`
                  : "—"
              }
              hint="Admin first reply vs policy due time (window sample)"
              icon={<Zap className="h-5 w-5 text-[#006b2d]" />}
              accent="bg-[#006b2d]"
              footer={
                totals.total > 0 ? (
                  <span className="flex items-center text-[0.6875rem] font-medium text-[#006b2d]">
                    <TrendingUp className="mr-1 h-4 w-4" />
                    Resolution rate (all-time): {totals.resolutionRateLabel}
                  </span>
                ) : (
                  <span className="text-[0.6875rem] text-slate-400">No tickets yet</span>
                )
              }
            />
          </div>

          <div className="rounded-[12px] bg-white p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-headline text-lg font-bold text-[#1a1d27]">Ticket volume by priority</h3>
                <p className="mt-1 text-[0.6875rem] font-medium uppercase tracking-wider text-slate-400">
                  All-time counts (not limited to the period above)
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Legend dot="bg-[#ba1a1a]" label="Urgent" />
                <Legend dot="bg-amber-500" label="High" />
                <Legend dot="bg-[#1653cc]" label="Medium" />
                <Legend dot="bg-slate-300" label="Low" />
              </div>
            </div>
            <PriorityVolumeBars byPriority={data?.byPriority ?? []} />
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-[12px] bg-white p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
              <h3 className="mb-8 font-headline text-lg font-bold text-[#1a1d27]">Backlog by status</h3>
              <p className="mb-4 text-xs text-[#60626c]">Lifetime totals from current database snapshot.</p>
              <StatusBacklogBar byStatus={data?.byStatus ?? []} />
              <div className="mt-8 grid grid-cols-2 gap-4">
                {(data?.byStatus ?? []).map((row) => (
                  <div
                    key={row.status}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-[#f2f3ff] p-3"
                  >
                    <div className="flex items-center">
                      <span
                        className={`mr-2 h-2 w-2 rounded-full ${STATUS_COLORS[row.status] ?? "bg-slate-400"}`}
                      />
                      <span className="text-xs font-semibold text-slate-600">{statusLabel(row.status)}</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-[#181b25]">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[12px] bg-white p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
              <h3 className="mb-4 font-headline text-lg font-bold text-[#1a1d27]">
                SLA performance <span className="text-sm font-normal text-slate-400">(% on-time first reply)</span>
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-[#60626c]">
                Per-priority compliance uses tickets in the reporting window that have at least one admin message.
              </p>
              <div className="space-y-4">
                {(data?.sla.byPriority ?? []).map((row) => (
                  <div key={row.priority}>
                    <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-wider text-[#737685]">
                      <span>{row.priority}</span>
                      <span className="font-mono">
                        {row.compliancePercent != null ? `${row.compliancePercent}%` : "—"}
                        <span className="ml-2 font-sans text-[10px] font-normal normal-case text-slate-400">
                          n={row.sampleSize}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${PRIORITY_BAR_COLORS[row.priority] ?? "bg-[#1653cc]"}`}
                        style={{
                          width: `${row.compliancePercent != null ? Math.min(100, Math.max(0, row.compliancePercent)) : 0}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[12px] bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-8">
              <h3 className="font-headline text-lg font-bold text-[#1a1d27]">Agent leaderboard</h3>
              <span className="text-xs text-[#60626c]">Resolutions in this window (assignee at close)</span>
            </div>
            {(data?.agentLeaderboard?.length ?? 0) === 0 ? (
              <div className="px-8 py-12 text-center text-sm text-[#60626c]">
                No attributed resolutions in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="border-b border-slate-100 bg-[#f8f9fb]">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#737685]">Agent</th>
                      <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#737685]">Resolved</th>
                      <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#737685]">
                        Avg resolution
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(data?.agentLeaderboard ?? []).map((row) => (
                      <tr key={row.adminUserId}>
                        <td className="px-6 py-3 font-mono text-xs text-[#181b25]">
                          {row.email ?? row.adminUserId.slice(0, 8)}
                        </td>
                        <td className="px-6 py-3 font-semibold">{row.resolved}</td>
                        <td className="px-6 py-3 text-[#60626c]">{formatMinutesLabel(row.avgResolutionMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const computePresentation = (data: SupportReportsData | null) => {
  if (!data) {
    return { total: 0, closed: 0, resolutionRateLabel: "—", windowLabel: "" };
  }
  const total = totalTickets(data.byStatus);
  const closed = countByStatus(data.byStatus, "CLOSED");
  const rate = data.totals.resolutionRatePercent;
  return {
    total,
    closed,
    resolutionRateLabel: rate != null ? `${rate}%` : total > 0 ? `${((closed / total) * 100).toFixed(1)}%` : "—",
    windowLabel: `${data.window.start.slice(0, 10)} → ${data.window.end.slice(0, 10)}`
  };
};

const AnalyticsKpi = ({
  label,
  value,
  hint,
  icon,
  accent,
  footer
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  accent: string;
  footer: ReactNode;
}) => (
  <div className="group relative overflow-hidden rounded-[12px] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
    <div className={`absolute bottom-0 left-0 top-0 w-1 ${accent}`} />
    <div className="mb-4 flex items-start justify-between">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      {icon}
    </div>
    <div className="font-headline text-3xl font-bold text-[#1a1d27]">{value}</div>
    <p className="mt-2 text-xs text-[#60626c]">{hint}</p>
    <div className="mt-4 flex items-center">{footer}</div>
  </div>
);

const Legend = ({ dot, label }: { dot: string; label: string }) => (
  <div className="flex items-center gap-2">
    <div className={`h-3 w-3 rounded-full ${dot}`} />
    <span className="text-xs font-medium text-slate-600">{label}</span>
  </div>
);

const PRIORITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;

const PriorityVolumeBars = ({ byPriority }: { byPriority: { priority: string; count: number }[] }) => {
  const max = Math.max(1, ...byPriority.map((p) => p.count), 1);
  return (
    <div className="flex h-64 items-end justify-center gap-4">
      {PRIORITY_ORDER.map((p) => {
        const n = countByPriority(byPriority, p);
        const pct = Math.max(4, Math.round((n / max) * 100));
        return (
          <div key={p} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span className="font-mono text-sm font-bold text-[#181b25]">{n}</span>
            <div
              className={`w-full max-w-[72px] rounded-t-md ${PRIORITY_BAR_COLORS[p] ?? "bg-slate-300"}`}
              style={{ height: `${pct}%` }}
              title={`${p}: ${n}`}
            />
            <span className="text-[10px] font-bold uppercase text-[#737685]">{p}</span>
          </div>
        );
      })}
    </div>
  );
};

const StatusBacklogBar = ({ byStatus }: { byStatus: { status: string; count: number }[] }) => {
  const total = totalTickets(byStatus);
  if (total === 0) {
    return <p className="text-sm text-[#60626c]">No tickets to chart.</p>;
  }
  return (
    <div className="relative flex h-10 w-full overflow-hidden rounded-full">
      {byStatus.map((row) => {
        const pct = (row.count / total) * 100;
        const bg = STATUS_COLORS[row.status] ?? "bg-slate-400";
        return (
          <div
            key={row.status}
            className={`${bg} flex items-center justify-center text-[10px] font-bold text-white`}
            style={{ width: `${pct}%` }}
            title={`${statusLabel(row.status)}: ${row.count}`}
          >
            {pct >= 8 ? `${Math.round(pct)}%` : ""}
          </div>
        );
      })}
    </div>
  );
};
