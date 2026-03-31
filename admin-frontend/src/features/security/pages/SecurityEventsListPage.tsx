import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Bell, CheckCircle, RefreshCw } from "lucide-react";

import {
  StitchBreadcrumbs,
  StitchFieldLabel,
  StitchFilterPanel,
  StitchPageBody,
  stitchInputClass,
  stitchSelectClass
} from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  listSecurityEvents,
  notifySecurityEvent,
  postSecurityEventStatus
} from "@/features/security/api/admin-security.api";
import { SecurityHubNav } from "@/features/security/components/SecurityHubNav";
import {
  formatAdminDateTimeLong,
  humanizeEnumLabel,
  pickIpFromMetadata,
  securityTableScrollClass,
  stitchRecordLinkClass,
  stitchVisibleLinkClass,
  summarizeUserRef,
  timelinePayloadLine
} from "@/features/security/lib/securityUiHelpers";

const SEVERITY_OPTS = ["", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;

export const SecurityEventsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const queryKey = useMemo(
    () => ["admin-security-events", page, severity, status, typeFilter] as const,
    [page, severity, status, typeFilter]
  );

  const q = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listSecurityEvents(accessToken, {
        page,
        page_size: 20,
        ...(severity ? { severity } : {}),
        ...(status.trim() ? { status: status.trim() } : {}),
        ...(typeFilter.trim() ? { type: typeFilter.trim() } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const notifyMut = useMutation({
    mutationFn: async (eventId: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return notifySecurityEvent(accessToken, eventId, {});
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-security-events"] })
  });

  const resolveMut = useMutation({
    mutationFn: async (eventId: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return postSecurityEventStatus(accessToken, eventId, { nextStatus: "RESOLVED" });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-security-events"] })
  });

  const items = q.data?.data.items ?? [];
  const meta = q.data?.meta;
  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const sevDot = (s: string) => {
    if (s === "CRITICAL") return "bg-[#ba1a1a]";
    if (s === "HIGH") return "bg-orange-500";
    if (s === "MEDIUM") return "bg-amber-500";
    return "bg-[#737685]";
  };

  const pillClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
      active ? "border-[#1653cc] bg-[#1653cc]/10 text-[#1653cc]" : "border-[#e5e7eb] bg-white text-[#737685] hover:border-[#c3c6d6]"
    }`;

  return (
    <StitchPageBody className="w-full max-w-[1600px]">
      <SecurityHubNav />
      <StitchBreadcrumbs
        emphasizeLinks
        items={[{ label: "Alerts", to: "/admin/security/alerts" }, { label: "Security events" }]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[#181b25]">Security Events</h1>
          <p className="mt-1 text-sm text-slate-500">
            Stream of suspicious patterns and access violations surfaced for analyst review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-security-events"] })}
          className="flex items-center gap-2 rounded-lg border border-[#c3c6d6] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#434654] hover:bg-[#f2f3ff]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Severity</span>
        {SEVERITY_OPTS.map((s) => (
          <button
            key={s || "all"}
            type="button"
            className={pillClass(severity === s)}
            onClick={() => {
              setSeverity(s);
              setPage(1);
            }}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <StitchFilterPanel className="mb-2 grid grid-cols-1 gap-4 shadow-[0px_4px_12px_rgba(0,0,0,0.02)] sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <div className="min-w-0 flex-1 lg:min-w-[200px]">
          <StitchFieldLabel>Event type</StitchFieldLabel>
          <input
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Contains / equals type code…"
            className={stitchInputClass}
          />
        </div>
        <div className="min-w-0 sm:min-w-[140px]">
          <StitchFieldLabel>Severity</StitchFieldLabel>
          <select
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
            className={stitchSelectClass}
          >
            {SEVERITY_OPTS.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "All severities"}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 sm:min-w-[140px]">
          <StitchFieldLabel>Status</StitchFieldLabel>
          <input
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. OPEN"
            className={stitchInputClass}
          />
        </div>
      </StitchFilterPanel>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[#60626c]">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-[0px_24px_48px_rgba(24,27,37,0.04)]">
          <div className={securityTableScrollClass}>
            <table className="min-w-[1080px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#c3c6d6]/20 bg-[#f2f3ff]">
                  {[
                    "Timestamp",
                    "Event type",
                    "Severity",
                    "Description",
                    "Customer",
                    "IP address",
                    "Status",
                    "Actions"
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 ${
                        h === "Actions" ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d6]/10 text-[13px]">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#60626c]">
                      No security events for these filters.
                    </td>
                  </tr>
                ) : (
                  items.map((ev) => {
                    const desc = timelinePayloadLine(ev.metadata);
                    const ip = pickIpFromMetadata(ev.metadata);
                    const busy = notifyMut.isPending || resolveMut.isPending;
                    return (
                      <tr key={ev.id} className="transition-colors hover:bg-[#f2f3ff]/50">
                        <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-slate-600">
                          {formatAdminDateTimeLong(ev.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="whitespace-nowrap rounded border border-[#1653cc]/10 bg-[#1653cc]/5 px-2 py-0.5 text-[10px] font-bold text-[#1653cc]">
                            {humanizeEnumLabel(ev.type.replace(/[._]/g, " ")).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${sevDot(ev.severity)}`} />
                            <span className="text-[11px] font-bold text-[#181b25]">{ev.severity}</span>
                          </div>
                        </td>
                        <td className="max-w-xs truncate px-6 py-4 font-medium text-[#181b25]" title={desc}>
                          {desc}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {ev.user ? (
                            <Link
                              to={`/admin/customers/${ev.user.id}`}
                              className={stitchVisibleLinkClass}
                            >
                              {summarizeUserRef(ev.user)}
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            </Link>
                          ) : (
                            <span className="italic text-slate-400">Unlinked</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{ip ?? "—"}</td>
                        <td className="px-6 py-4">
                          <span className="text-[11px] font-bold uppercase text-orange-600">{ev.status.replace(/_/g, " ")}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                            <Link to={`/admin/security/events/${ev.id}`} className={stitchRecordLinkClass}>
                              Detail
                            </Link>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => notifyMut.mutate(ev.id)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#1653cc] underline decoration-[#1653cc]/40 underline-offset-2 disabled:opacity-40"
                              >
                                <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                Notify
                              </button>
                              <button
                                type="button"
                                disabled={busy || ev.resolvedAt != null}
                                onClick={() => resolveMut.mutate(ev.id)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#006b2d] underline decoration-[#006b2d]/40 underline-offset-2 disabled:opacity-40"
                              >
                                <CheckCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                Resolve
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#60626c]">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded-lg border px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span>
            {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= meta.totalPages}
            className="rounded-lg border px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </StitchPageBody>
  );
};
