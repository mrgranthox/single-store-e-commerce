import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Download, ExternalLink, Filter, RefreshCw } from "lucide-react";

import {
  StitchBreadcrumbs,
  StitchFieldLabel,
  StitchFilterPanel,
  StitchPageBody,
  stitchInputClass,
  stitchSelectClass
} from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { AuditLogContextCell } from "@/features/security/components/AuditLogContextCell";
import { SecurityHubNav } from "@/features/security/components/SecurityHubNav";
import { ApiError, listAdminAuditLogs } from "@/features/security/api/admin-audit.api";
import {
  actorAdminEmail,
  adminActionEntityHref,
  downloadUtf8Csv,
  formatAdminDateTimeLong,
  humanizeEnumLabel,
  pickIpFromMetadata,
  securityTableScrollClass,
  stitchRecordLinkClass,
  stitchVisibleLinkClass
} from "@/features/security/lib/securityUiHelpers";

const ACTION_PRESETS = ["", "CREATE", "UPDATE", "DELETE", "LOGIN"] as const;

export const AuditLogsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [actionCode, setActionCode] = useState("");
  const [actionPreset, setActionPreset] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [actorAdminUserId, setActorAdminUserId] = useState("");
  const [actorEmailContains, setActorEmailContains] = useState("");

  const searchKey = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const et = params.get("entityType");
    const eid = params.get("entityId");
    if (et != null && et !== "") {
      setEntityType(et);
    }
    if (eid != null && eid !== "") {
      setEntityId(eid);
    }
    setPage(1);
  }, [searchKey]);

  const effectiveAction = actionPreset || actionCode.trim();

  const queryKey = useMemo(
    () => ["admin-audit-logs", page, effectiveAction, entityType, entityId, actorAdminUserId, actorEmailContains] as const,
    [page, effectiveAction, entityType, entityId, actorAdminUserId, actorEmailContains]
  );

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminAuditLogs(accessToken, {
        page,
        page_size: 25,
        ...(effectiveAction ? { actionCode: effectiveAction } : {}),
        ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
        ...(entityId.trim() ? { entityId: entityId.trim() } : {}),
        ...(actorAdminUserId.trim() ? { actorAdminUserId: actorAdminUserId.trim() } : {}),
        ...(actorEmailContains.trim() ? { actorEmailContains: actorEmailContains.trim() } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;

  const errorMessage =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error instanceof Error
        ? listQuery.error.message
        : null;

  return (
    <StitchPageBody className="w-full max-w-[1600px]">
      <StitchBreadcrumbs
        emphasizeLinks
        items={[
          { label: "Security & Audit", to: "/admin/security/alerts" },
          { label: "Audit Logs" }
        ]}
      />

      <SecurityHubNav />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-[#181b25] sm:text-[2rem]">Audit Logs</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#5b5e68]">
            Immutable trail of administrative actions and security-related events. Use filters to narrow by actor, action,
            or entity.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const rows = items.map((log) => [
                log.id,
                log.createdAt,
                actorAdminEmail(log.actorAdmin),
                log.actorType,
                log.actionCode,
                log.entityType,
                log.entityId,
                pickIpFromMetadata(log.metadata) ?? "",
                log.reason?.trim() ?? ""
              ]);
              downloadUtf8Csv(
                `audit-logs-page-${page}.csv`,
                ["id", "createdAt", "actorEmail", "actorType", "actionCode", "entityType", "entityId", "ip", "reason"],
                rows
              );
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[#c3c6d6]/40 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#1653cc] underline-offset-2 transition-colors hover:border-[#1653cc]/30 hover:bg-[#f2f3ff]"
          >
            <Download className="h-4 w-4 shrink-0 text-[#1653cc]" aria-hidden />
            CSV Export
          </button>
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] })}
            className="inline-flex items-center gap-2 rounded-lg border border-[#c3c6d6]/40 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#1653cc] transition-colors hover:bg-[#f2f3ff]"
          >
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
            Reload
          </button>
        </div>
      </div>

      <StitchFilterPanel className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div>
            <StitchFieldLabel>Actor user ID</StitchFieldLabel>
            <input
              value={actorAdminUserId}
              onChange={(e) => {
                setActorAdminUserId(e.target.value);
                setPage(1);
              }}
              placeholder="User ID"
              className={`${stitchInputClass} font-mono text-xs`}
            />
          </div>
          <div>
            <StitchFieldLabel>Actor email contains</StitchFieldLabel>
            <input
              value={actorEmailContains}
              onChange={(e) => {
                setActorEmailContains(e.target.value);
                setPage(1);
              }}
              placeholder="Substring match…"
              className={stitchInputClass}
            />
          </div>
          <div>
            <StitchFieldLabel>Action type</StitchFieldLabel>
            <select
              value={actionPreset}
              onChange={(e) => {
                setActionPreset(e.target.value);
                if (e.target.value) setActionCode("");
                setPage(1);
              }}
              className={stitchSelectClass}
            >
              <option value="">All actions</option>
              {ACTION_PRESETS.filter(Boolean).map((a) => (
                <option key={a} value={a}>
                  {humanizeEnumLabel(a)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <StitchFieldLabel>Action code</StitchFieldLabel>
            <input
              value={actionCode}
              disabled={Boolean(actionPreset)}
              onChange={(e) => {
                setActionCode(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. orders.update…"
              className={stitchInputClass}
            />
          </div>
          <div>
            <StitchFieldLabel>Entity type</StitchFieldLabel>
            <input
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              placeholder="ORDER, USER…"
              className={stitchInputClass}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <StitchFieldLabel>Entity ID</StitchFieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                value={entityId}
                onChange={(e) => {
                  setEntityId(e.target.value);
                  setPage(1);
                }}
                placeholder="Record ID"
                className={`${stitchInputClass} min-w-0 flex-1 font-mono text-xs`}
              />
              <button
                type="button"
                className="flex h-[42px] w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1653cc] px-4 text-white transition-opacity hover:opacity-90 sm:h-auto sm:w-11 sm:px-0"
                title="Apply filters"
                aria-label="Apply filters"
                onClick={() => void listQuery.refetch()}
              >
                <Filter className="h-5 w-5" />
                <span className="text-xs font-bold uppercase sm:sr-only">Apply</span>
              </button>
            </div>
          </div>
        </div>
      </StitchFilterPanel>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {listQuery.isLoading ? (
        <p className="text-sm text-[#60626c]">Loading…</p>
      ) : (
        <div className={securityTableScrollClass}>
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead className="border-b border-[#c3c6d6]/30 bg-[#ecedfb]">
                <tr>
                  {[
                    "Timestamp",
                    "Actor",
                    "Role",
                    "Action",
                    "Entity",
                    "Entity ID",
                    "IP",
                    "Result",
                    "Open",
                    "Context"
                  ].map((h) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685] sm:px-4 ${
                        h === "Context" || h === "Open" ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-[#60626c]">
                      No audit records for these filters.
                    </td>
                  </tr>
                ) : (
                  items.map((log) => {
                    const deep = adminActionEntityHref(log.entityType, log.entityId);
                    const filterHref =
                      log.entityId.trim() && log.entityType
                        ? `/admin/security/audit-logs?entityType=${encodeURIComponent(log.entityType)}&entityId=${encodeURIComponent(log.entityId)}`
                        : null;
                    return (
                      <tr key={log.id} className="align-top transition-colors hover:bg-[#faf8ff]/80">
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-[#5b5e68] sm:px-4">
                          {formatAdminDateTimeLong(log.createdAt)}
                        </td>
                        <td className="max-w-[140px] px-3 py-3 text-xs font-semibold text-[#181b25] sm:max-w-[180px] sm:px-4">
                          <span className="break-words">{actorAdminEmail(log.actorAdmin)}</span>
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <span className="inline-flex rounded border border-[#1653cc]/20 px-2 py-0.5 text-[10px] font-bold text-[#1653cc]">
                            {humanizeEnumLabel(log.actorType)}
                          </span>
                        </td>
                        <td className="max-w-[200px] break-words px-3 py-3 text-xs font-bold text-[#181b25] sm:px-4">
                          {log.actionCode}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-[11px] font-medium text-[#5b5e68] sm:px-4">
                          {log.entityType}
                        </td>
                        <td className="max-w-[160px] px-3 py-3 font-mono text-[11px] sm:max-w-[200px] sm:px-4">
                          {log.entityId.trim() && filterHref ? (
                            <Link className={stitchVisibleLinkClass} title={log.entityId} to={filterHref}>
                              <span className="truncate">{log.entityId.length > 14 ? `${log.entityId.slice(0, 14)}…` : log.entityId}</span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-[#60626c] sm:px-4">
                          {pickIpFromMetadata(log.metadata) ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-[#181b25] sm:px-4">
                          {log.reason?.trim() ? (
                            <span className="font-medium">{log.reason}</span>
                          ) : (
                            <span className="text-[#006b2d]">Recorded</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right sm:px-4">
                          {deep ? (
                            <Link className={stitchRecordLinkClass} to={deep}>
                              Open
                            </Link>
                          ) : filterHref ? (
                            <Link className={stitchRecordLinkClass} to={filterHref}>
                              Trace
                            </Link>
                          ) : (
                            <span className="text-xs text-[#9ca3af]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right align-top sm:px-4">
                          <AuditLogContextCell metadata={log.metadata} />
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
        <div className="flex flex-col gap-3 text-sm text-[#60626c] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.totalItems} rows
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-[#1653cc] hover:bg-[#f8fafc] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-[#1653cc] hover:bg-[#f8fafc] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </StitchPageBody>
  );
};
