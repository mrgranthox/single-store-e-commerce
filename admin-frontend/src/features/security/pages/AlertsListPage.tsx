import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, CheckCheck, Download, FileWarning, Info, ShieldAlert, UserPlus } from "lucide-react";

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
import {
  ApiError,
  bulkAcknowledgeAdminAlerts,
  bulkAssignAdminAlerts,
  listAdminAlerts
} from "@/features/security/api/admin-alerts.api";
import { SecurityHubNav } from "@/features/security/components/SecurityHubNav";
import { getSecurityDashboard } from "@/features/security/api/admin-security.api";
import {
  downloadUtf8Csv,
  formatAdminDateTime,
  humanizeEnumLabel,
  securityTableScrollClass,
  stitchRecordLinkClass,
  stitchVisibleLinkClass
} from "@/features/security/lib/securityUiHelpers";

const STATUSES = ["", "OPEN", "ACKNOWLEDGED", "ASSIGNED", "RESOLVED"] as const;
const SEVERITIES = ["", "INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const stTone = (s: string): StatusBadgeTone => {
  switch (s) {
    case "RESOLVED":
      return "active";
    case "OPEN":
      return "danger";
    case "ASSIGNED":
    case "ACKNOWLEDGED":
      return "info";
    default:
      return "pending";
  }
};

const severityBorder = (s: string) => {
  if (s === "CRITICAL") return "border-l-4 border-[#ba1a1a]";
  if (s === "HIGH") return "border-l-4 border-amber-500";
  if (s === "MEDIUM") return "border-l-4 border-[#1653cc]";
  return "border-l-4 border-slate-400";
};

export const AlertsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkNote, setBulkNote] = useState("");
  const [assigneeBulkId, setAssigneeBulkId] = useState("");

  const queryKey = useMemo(
    () => ["admin-alerts", page, status, severity, typeFilter] as const,
    [page, status, severity, typeFilter]
  );

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
      return listAdminAlerts(accessToken, {
        page,
        page_size: 20,
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(typeFilter.trim() ? { type: typeFilter.trim() } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const bulkAckMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const ids = [...selected];
      if (ids.length === 0) {
        throw new Error("Select at least one alert.");
      }
      return bulkAcknowledgeAdminAlerts(accessToken, {
        alertIds: ids,
        note: bulkNote.trim() || undefined
      });
    },
    onSuccess: () => {
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["admin-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-security-dashboard-metrics"] });
    }
  });

  const bulkAssignMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const ids = [...selected];
      if (ids.length === 0) {
        throw new Error("Select at least one alert.");
      }
      const raw = assigneeBulkId.trim();
      return bulkAssignAdminAlerts(accessToken, {
        alertIds: ids,
        assignedToAdminUserId: raw.length > 0 ? raw : null,
        note: bulkNote.trim() || undefined
      });
    },
    onSuccess: () => {
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["admin-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-security-dashboard-metrics"] });
    }
  });

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;
  const sev = dashQuery.data?.data.metrics.alertsOpenBySeverity ?? {};

  const severityCounts = {
    CRITICAL: sev.CRITICAL ?? 0,
    HIGH: sev.HIGH ?? 0,
    MEDIUM: sev.MEDIUM ?? 0,
    LOW: (sev.LOW ?? 0) + (sev.INFO ?? 0)
  };
  const canManageAlerts = adminHasAnyPermission(actorPermissions, ["security.alerts.manage"]);

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllPage = () => {
    if (items.length === 0) {
      return;
    }
    const allSelected = items.every((a) => selected.has(a.id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const a of items) {
          next.delete(a.id);
        }
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const a of items) {
          next.add(a.id);
        }
        return next;
      });
    }
  };

  const exportPageCsv = () => {
    downloadUtf8Csv(
      `alerts-page-${page}.csv`,
      ["id", "type", "status", "severity", "relatedOrderId", "updatedAt"],
      items.map((a) => [
        a.id,
        a.type,
        a.status,
        a.severity,
        a.relatedOrderId ?? "",
        a.updatedAt
      ])
    );
  };

  const errorMessage =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error instanceof Error
        ? listQuery.error.message
        : null;

  const bulkErr =
    bulkAckMut.error instanceof Error
      ? bulkAckMut.error.message
      : bulkAssignMut.error instanceof Error
        ? bulkAssignMut.error.message
        : null;

  return (
    <StitchPageBody className="w-full max-w-[1600px] space-y-6">
      <StitchBreadcrumbs
        emphasizeLinks
        items={[
          { label: "Security & Audit", to: "/admin/security/alerts" },
          { label: "Alerts center" }
        ]}
      />

      <SecurityHubNav />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-[#181b25] sm:text-3xl">Alerts</h1>
          <p className="text-label mt-1 text-xs font-medium uppercase tracking-wide text-[#5b5e68] sm:text-sm sm:normal-case">
            Operational and security alerts command center
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportPageCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-[#c3c6d6]/30 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#1653cc] hover:bg-[#f2f3ff]"
          >
            <Download className="h-[18px] w-[18px] shrink-0" aria-hidden />
            Export page CSV
          </button>
        </div>
      </div>

      <div className="rounded-sm border border-[#e5e7eb] border-l-4 border-l-[#1653cc] bg-white p-5 shadow-[0px_8px_24px_rgba(24,27,37,0.06)] sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[#f1f3f9] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">Bulk operations</h2>
            <p className="mt-1 text-sm text-[#5b5e68]">Runs on every alert selected on this page. Adds an optional note to the audit trail.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-[#1653cc]/20 bg-[#f4f6ff] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0f3d99]">
            {selected.size} selected
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <StitchFieldLabel>Note for audit trail</StitchFieldLabel>
            <textarea
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              placeholder="Shown on acknowledge and assign actions…"
              rows={2}
              className={`${stitchInputClass} mt-1 w-full resize-y text-sm`}
            />
          </div>
          <div>
            <StitchFieldLabel>Assignee user ID</StitchFieldLabel>
            <input
              value={assigneeBulkId}
              onChange={(e) => setAssigneeBulkId(e.target.value)}
              placeholder="Used by Assign — leave empty to clear assignee"
              className={`${stitchInputClass} mt-1 w-full font-mono text-xs`}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={selected.size === 0 || bulkAckMut.isPending || !canManageAlerts}
            onClick={() => bulkAckMut.mutate()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#1653cc] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-40 sm:flex-none sm:min-w-[200px]"
            title={canManageAlerts ? undefined : "Requires security.alerts.manage permission"}
          >
            <CheckCheck className="h-4 w-4 shrink-0" aria-hidden />
            Acknowledge
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || bulkAssignMut.isPending || !canManageAlerts}
            onClick={() => bulkAssignMut.mutate()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border-2 border-[#1653cc] bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#1653cc] transition-colors hover:bg-[#f4f6ff] disabled:opacity-40 sm:flex-none sm:min-w-[200px]"
            title={canManageAlerts ? undefined : "Requires security.alerts.manage permission"}
          >
            <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
            Assign
          </button>
        </div>
        {bulkErr ? <p className="mt-3 text-sm font-medium text-red-700">{bulkErr}</p> : null}
      </div>

      <p className="text-[10px] font-medium uppercase tracking-wider text-[#737685]">
        Severity tiles reflect open / acknowledged / assigned alerts studio-wide (security dashboard). Table respects filters below.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <div className="flex items-center justify-between border-l-4 border-[#ba1a1a] bg-white p-4 shadow-sm">
          <div>
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-slate-500">Critical</p>
            <h3 className="font-mono text-2xl font-bold text-[#ba1a1a]">{String(severityCounts.CRITICAL).padStart(2, "0")}</h3>
          </div>
          <ShieldAlert className="h-8 w-8 text-[#ba1a1a]/30" aria-hidden />
        </div>
        <div className="flex items-center justify-between border-l-4 border-amber-500 bg-white p-4 shadow-sm">
          <div>
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-slate-500">High</p>
            <h3 className="font-mono text-2xl font-bold text-amber-600">{String(severityCounts.HIGH).padStart(2, "0")}</h3>
          </div>
          <AlertTriangle className="h-8 w-8 text-amber-500/30" aria-hidden />
        </div>
        <div className="flex items-center justify-between border-l-4 border-[#1653cc] bg-white p-4 shadow-sm">
          <div>
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-slate-500">Medium</p>
            <h3 className="font-mono text-2xl font-bold text-[#1653cc]">{String(severityCounts.MEDIUM).padStart(2, "0")}</h3>
          </div>
          <FileWarning className="h-8 w-8 text-[#1653cc]/30" aria-hidden />
        </div>
        <div className="flex items-center justify-between border-l-4 border-slate-400 bg-white p-4 shadow-sm">
          <div>
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-slate-500">Low / info</p>
            <h3 className="font-mono text-2xl font-bold text-slate-600">{String(severityCounts.LOW).padStart(2, "0")}</h3>
          </div>
          <Info className="h-8 w-8 text-slate-400/30" aria-hidden />
        </div>
      </div>

      <StitchFilterPanel className="grid grid-cols-1 gap-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <StitchFieldLabel>Type</StitchFieldLabel>
          <input
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by alert type code…"
            className={stitchInputClass}
          />
        </div>
        <div className="min-w-0">
          <StitchFieldLabel>Severity</StitchFieldLabel>
          <select
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
            className={stitchSelectClass}
          >
            {SEVERITIES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? humanizeEnumLabel(s) : "All severities"}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <StitchFieldLabel>Status</StitchFieldLabel>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={stitchSelectClass}
          >
            {STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? humanizeEnumLabel(s) : "All statuses"}
              </option>
            ))}
          </select>
        </div>
      </StitchFilterPanel>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {listQuery.isLoading ? (
        <p className="text-sm text-[#60626c]">Loading…</p>
      ) : (
        <div className={securityTableScrollClass}>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead className="border-b border-[#e5e7eb] bg-[#f8f9fb]">
                <tr>
                  <th className="h-11 w-10 px-2">
                    <input
                      type="checkbox"
                      aria-label="Select all on page"
                      checked={items.length > 0 && items.every((a) => selected.has(a.id))}
                      onChange={toggleAllPage}
                      className="rounded border-[#c3c6d6]"
                    />
                  </th>
                  {["Alert ID", "Type", "Status", "Severity", "Related order", "Updated"].map((h) => (
                    <th
                      key={h}
                      className="h-11 px-4 text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6b7280]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#6b7280]">
                      No alerts for these filters.
                    </td>
                  </tr>
                ) : (
                  items.map((a) => (
                    <tr
                      key={a.id}
                      className={`border-b border-[#f1f3f9] transition-colors hover:bg-[#f8f9fb] ${severityBorder(a.severity)}`}
                    >
                      <td className="px-2 align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(a.id)}
                          onChange={() => toggleRow(a.id)}
                          aria-label={`Select alert ${a.id.slice(0, 8)}`}
                          className="rounded border-[#c3c6d6]"
                        />
                      </td>
                      <td className="h-[52px] px-4 align-middle text-[13px] text-[#374151]">
                        <Link to={`/admin/security/alerts/${a.id}`} className={`${stitchRecordLinkClass} font-mono normal-case`}>
                          {a.id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="max-w-[200px] truncate px-4 align-middle text-[13px] text-[#374151]" title={a.type}>
                        {humanizeEnumLabel(a.type.replace(/[._]/g, " "))}
                      </td>
                      <td className="px-4 align-middle">
                        <StatusBadge label={a.status.replace(/_/g, " ")} tone={stTone(a.status)} />
                      </td>
                      <td className="px-4 align-middle text-[13px] font-semibold uppercase text-[#374151]">{a.severity}</td>
                      <td className="px-4 align-middle text-[13px]">
                        {a.relatedOrderId ? (
                          <Link className={stitchVisibleLinkClass} to={`/admin/orders/${a.relatedOrderId}`}>
                            View order
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        ) : (
                          <span className="text-[#9ca3af]">—</span>
                        )}
                      </td>
                      <td className="px-4 align-middle text-[13px] text-[#6b7280]">{formatAdminDateTime(a.updatedAt)}</td>
                    </tr>
                  ))
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
