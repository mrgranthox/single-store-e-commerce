import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Download, Plus } from "lucide-react";

import {
  StitchBreadcrumbs,
  StitchFieldLabel,
  StitchFilterPanel,
  StitchPageBody,
  stitchInputClass,
  stitchSelectClass
} from "@/components/stitch";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";
import { ApiError, createAdminIncident, listAdminIncidents } from "@/features/security/api/admin-incidents.api";
import { getSecurityDashboard } from "@/features/security/api/admin-security.api";
import { SecurityHubNav } from "@/features/security/components/SecurityHubNav";
import {
  actorAdminEmail,
  downloadUtf8Csv,
  formatAdminDateTime,
  humanizeEnumLabel,
  incidentSeverityFromMetadata,
  initialsFromEmail,
  securityTableScrollClass,
  stitchRecordLinkClass
} from "@/features/security/lib/securityUiHelpers";

const INCIDENT_STATUSES = ["", "OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"] as const;
const SEVERITY_PRESETS = ["MEDIUM", "HIGH", "CRITICAL"] as const;

const tone = (s: string): StatusBadgeTone => {
  switch (s) {
    case "RESOLVED":
    case "CLOSED":
      return "active";
    case "INVESTIGATING":
      return "info";
    default:
      return "pending";
  }
};

const ownerLabel = (createdBy: unknown) => {
  const email = actorAdminEmail(createdBy);
  return email !== "—" ? email : "Unassigned";
};

export const IncidentsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newSeverity, setNewSeverity] = useState<string>("HIGH");
  const [createErr, setCreateErr] = useState<string | null>(null);

  const queryKey = useMemo(() => ["admin-incidents", page, q, status] as const, [page, q, status]);

  const dashQuery = useQuery({
    queryKey: ["admin-security-dashboard-metrics"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getSecurityDashboard(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminIncidents(accessToken, {
        page,
        page_size: 20,
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(status ? { status } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const title = newTitle.trim();
      if (!title) {
        throw new Error("Title is required.");
      }
      return createAdminIncident(accessToken, {
        title,
        summary: newSummary.trim() || undefined,
        metadata: { severity: newSeverity }
      });
    },
    onSuccess: () => {
      setCreateOpen(false);
      setNewTitle("");
      setNewSummary("");
      setCreateErr(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-incidents"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-security-dashboard-metrics"] });
    },
    onError: (e: Error) => {
      setCreateErr(e.message);
    }
  });

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;
  const ops = dashQuery.data?.data.metrics.incidentsOps;

  const errorMessage =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error instanceof Error
        ? listQuery.error.message
        : null;
  const canCreateIncidents = adminHasAnyPermission(actorPermissions, ["security.incidents.create"]);

  const exportCsv = () => {
    downloadUtf8Csv(
      `incidents-page-${page}.csv`,
      ["id", "title", "status", "severityMetadata", "ownerEmail", "createdAt", "updatedAt"],
      items.map((row) => [
        row.id,
        row.title,
        row.status,
        incidentSeverityFromMetadata(row.metadata),
        ownerLabel(row.createdBy),
        row.createdAt,
        row.updatedAt
      ])
    );
  };

  return (
    <StitchPageBody className="w-full max-w-[1600px]">
      <SecurityHubNav />
      <StitchBreadcrumbs
        emphasizeLinks
        items={[{ label: "Alerts", to: "/admin/security/alerts" }, { label: "Incidents" }]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-[#0f1117]">Incidents</h1>
          <p className="text-[0.8125rem] text-slate-500">
            Track active security and operations escalations across the platform.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-2 rounded border border-[#1653cc]/35 bg-white px-4 py-2 text-[0.75rem] font-bold text-[#1653cc] underline decoration-[#1653cc]/40 underline-offset-2 hover:bg-[#f2f3ff]"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export data
          </button>
          <button
            type="button"
            disabled={!canCreateIncidents}
            onClick={() => {
              setCreateErr(null);
              setCreateOpen(true);
            }}
            className="flex items-center gap-2 rounded bg-[#1653cc] px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-wider text-white hover:bg-[#3b6de6]"
            title={canCreateIncidents ? undefined : "Requires security.incidents.create permission"}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create incident
          </button>
        </div>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="font-headline text-lg font-bold text-[#181b25]">Create incident</h2>
            <p className="mt-1 text-xs text-[#737685]">Title and severity are saved on the incident. Severity appears on the list and detail views.</p>
            <div className="mt-4 space-y-3">
              <div>
                <StitchFieldLabel>Title</StitchFieldLabel>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={stitchInputClass}
                  placeholder="Short incident title…"
                />
              </div>
              <div>
                <StitchFieldLabel>Summary</StitchFieldLabel>
                <textarea
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  rows={3}
                  className={stitchInputClass}
                  placeholder="Optional narrative…"
                />
              </div>
              <div>
                <StitchFieldLabel>Severity</StitchFieldLabel>
                <select value={newSeverity} onChange={(e) => setNewSeverity(e.target.value)} className={stitchSelectClass}>
                  {SEVERITY_PRESETS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {createErr ? <p className="mt-3 text-sm text-red-700">{createErr}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-[#434654]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createMut.isPending || !canCreateIncidents}
                onClick={() => createMut.mutate()}
                className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                title={canCreateIncidents ? undefined : "Requires security.incidents.create permission"}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-[10px] font-medium uppercase tracking-wider text-[#737685]">
        Summary tiles use studio-wide incident operations from the security dashboard (last 7 days for throughput / MTTR).
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl border-l-4 border-[#ba1a1a] bg-white p-4">
          <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">Open</span>
          <span className="mt-2 font-headline text-3xl font-bold text-[#181b25]">
            {String(ops?.open ?? 0).padStart(2, "0")}
          </span>
        </div>
        <div className="flex flex-col justify-between rounded-xl border-l-4 border-[#1653cc] bg-white p-4">
          <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">In progress</span>
          <span className="mt-2 font-headline text-3xl font-bold text-[#181b25]">
            {String(ops?.investigating ?? 0).padStart(2, "0")}
          </span>
        </div>
        <div className="flex flex-col justify-between rounded-xl border-l-4 border-[#006b2d] bg-white p-4">
          <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">Closed (7d)</span>
          <span className="mt-2 font-headline text-3xl font-bold text-[#181b25]">
            {String(ops?.resolvedOrClosedLast7Days ?? 0).padStart(2, "0")}
          </span>
        </div>
        <div className="flex flex-col justify-between rounded-xl border-l-4 border-slate-400 bg-white p-4">
          <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500">Avg MTTR (7d, h)</span>
          <span className="mt-2 font-headline text-3xl font-bold text-[#181b25]">
            {ops?.avgMttrHoursLast7Days != null ? ops.avgMttrHoursLast7Days.toFixed(1) : "—"}
          </span>
        </div>
      </div>

      <StitchFilterPanel className="flex flex-col gap-4 p-3 md:flex-row md:flex-wrap md:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1 md:min-w-[200px]">
          <StitchFieldLabel>Search</StitchFieldLabel>
          <input
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setQ(qDraft);
              }
            }}
            placeholder="Title or keywords…"
            className={stitchInputClass}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1 md:max-w-[220px]">
          <StitchFieldLabel>Status</StitchFieldLabel>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={stitchSelectClass}
          >
            {INCIDENT_STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? humanizeEnumLabel(s) : "All statuses"}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setQ(qDraft);
          }}
          className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white md:self-stretch md:px-6"
        >
          Apply
        </button>
      </StitchFilterPanel>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {listQuery.isLoading ? (
        <p className="text-sm text-[#60626c]">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className={securityTableScrollClass}>
            <table className="min-w-[960px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#c3c6d6]/10 bg-[#f2f3ff]">
                  {[
                    "Incident #",
                    "Title",
                    "Severity",
                    "Status",
                    "Owner",
                    "Created",
                    "Last updated",
                    "Actions"
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-3 text-[0.6875rem] font-bold uppercase tracking-widest text-slate-500 ${
                        h === "Actions" ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#60626c]">
                      No incidents for these filters.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const sev = incidentSeverityFromMetadata(row.metadata);
                    const email = actorAdminEmail(row.createdBy);
                    const initials = email !== "—" ? initialsFromEmail(email) : "?";
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-[#e6e7f6]">
                        <td className="px-6 py-4 font-mono text-[0.75rem] font-medium">
                          <Link to={`/admin/security/incidents/${row.id}`} className={`${stitchRecordLinkClass} font-mono normal-case`}>
                            {row.id.slice(0, 8).toUpperCase()}…
                          </Link>
                        </td>
                        <td className="max-w-xs px-6 py-4">
                          <p className="text-[0.8125rem] font-semibold text-[#181b25]">{row.title}</p>
                          {row.summary ? (
                            <p className="mt-0.5 truncate text-[0.6875rem] text-slate-500" title={row.summary}>
                              {row.summary}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-[0.6875rem] font-bold text-slate-600">{sev}</td>
                        <td className="px-6 py-4">
                          <StatusBadge label={row.status.replace(/_/g, " ")} tone={tone(row.status)} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-[0.75rem] text-[#181b25]">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1653cc]/10 text-[10px] font-bold text-[#1653cc]">
                              {initials}
                            </span>
                            {ownerLabel(row.createdBy)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[0.75rem] text-slate-500">{formatAdminDateTime(row.createdAt)}</td>
                        <td className="px-6 py-4 text-[0.75rem] text-slate-500">{formatAdminDateTime(row.updatedAt)}</td>
                        <td className="px-6 py-4 text-right">
                          <Link to={`/admin/security/incidents/${row.id}`} className={`${stitchRecordLinkClass} justify-end`}>
                            Workspace
                          </Link>
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
        <div className="flex flex-wrap justify-between gap-3 text-sm text-[#60626c]">
          <span>
            Page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </StitchPageBody>
  );
};
