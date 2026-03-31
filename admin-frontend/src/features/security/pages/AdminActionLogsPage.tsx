import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ExternalLink, RefreshCw } from "lucide-react";

import {
  StitchBreadcrumbs,
  StitchFieldLabel,
  StitchFilterPanel,
  StitchPageBody,
  stitchInputClass
} from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { SecurityHubNav } from "@/features/security/components/SecurityHubNav";
import { ApiError, listAdminActionLogs } from "@/features/security/api/admin-audit.api";
import {
  actorAdminEmail,
  adminActionEntityHref,
  businessSnapshot,
  formatAdminDateTimeLong,
  humanizeEnumLabel,
  initialsFromEmail,
  securityTableScrollClass,
  stitchRecordLinkClass
} from "@/features/security/lib/securityUiHelpers";

export const AdminActionLogsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [screen, setScreen] = useState("");
  const [actionCode, setActionCode] = useState("");
  const [adminUserId, setAdminUserId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");

  const queryKey = useMemo(
    () => ["admin-action-logs", page, screen, actionCode, adminUserId, entityType, entityId] as const,
    [page, screen, actionCode, adminUserId, entityType, entityId]
  );

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminActionLogs(accessToken, {
        page,
        page_size: 25,
        ...(screen.trim() ? { screen: screen.trim() } : {}),
        ...(actionCode.trim() ? { actionCode: actionCode.trim() } : {}),
        ...(adminUserId.trim() ? { adminUserId: adminUserId.trim() } : {}),
        ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
        ...(entityId.trim() ? { entityId: entityId.trim() } : {})
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
          { label: "Admin Action Logs" }
        ]}
      />

      <SecurityHubNav />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-[#181b25] sm:text-[2rem]">Admin Action Logs</h1>
          <p className="mt-1 text-sm font-medium leading-relaxed text-[#5b5e68]">
            Real-time monitoring of sensitive operational mutations performed in the admin console.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 rounded-lg border border-[#c3c6d6]/20 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#5b5e68]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#006b2d]" />
            System status: Nominal
          </span>
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-action-logs"] })}
            className="inline-flex items-center gap-2 rounded-lg border border-[#c3c6d6]/40 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#1653cc] hover:bg-[#f2f3ff]"
          >
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
            Reload
          </button>
        </div>
      </div>

      <StitchFilterPanel className="border border-[#c3c6d6]/10 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex flex-col gap-2">
            <StitchFieldLabel>Actor user ID</StitchFieldLabel>
            <input
              value={adminUserId}
              onChange={(e) => {
                setAdminUserId(e.target.value);
                setPage(1);
              }}
              placeholder="User ID"
              className={`${stitchInputClass} font-mono text-xs`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <StitchFieldLabel>Action code</StitchFieldLabel>
            <input
              value={actionCode}
              onChange={(e) => {
                setActionCode(e.target.value);
                setPage(1);
              }}
              className={stitchInputClass}
            />
          </div>
          <div className="flex flex-col gap-2">
            <StitchFieldLabel>Screen</StitchFieldLabel>
            <input
              value={screen}
              onChange={(e) => {
                setScreen(e.target.value);
                setPage(1);
              }}
              className={stitchInputClass}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void listQuery.refetch()}
              className="w-full rounded-lg bg-[#e6e7f6] py-2.5 text-xs font-bold uppercase tracking-widest text-[#181b25] transition-colors hover:bg-[#e0e2f0]"
            >
              Apply filters
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <StitchFieldLabel>Entity type</StitchFieldLabel>
            <input
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className={stitchInputClass}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <StitchFieldLabel>Entity ID</StitchFieldLabel>
            <input
              value={entityId}
              onChange={(e) => {
                setEntityId(e.target.value);
                setPage(1);
              }}
              className={`${stitchInputClass} font-mono text-xs`}
            />
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
          <div className="overflow-hidden rounded-xl border border-[#c3c6d6]/10 bg-white">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#c3c6d6]/10 bg-[#ecedfb]/30">
                  {["Timestamp", "Admin actor", "What changed", "Record", "Previous state", "New state", "Reason", "Open"].map(
                    (h) => (
                    <th
                      key={h || "actions"}
                      className={`px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685] sm:px-6 sm:py-4 ${
                        h === "Open" ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d6]/10">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#60626c]">
                      No admin actions for these filters.
                    </td>
                  </tr>
                ) : (
                  items.map((log, i) => {
                    const email = actorAdminEmail(log.adminUser);
                    const initials = email !== "—" ? initialsFromEmail(email) : "?";
                    const deep = adminActionEntityHref(log.entityType, log.entityId);
                    return (
                      <tr
                        key={log.id}
                        className={`transition-colors hover:bg-[#e6e7f6]/30 ${i % 2 === 1 ? "bg-[#faf8ff]/50" : ""}`}
                      >
                        <td className="whitespace-nowrap px-6 py-3 font-mono text-[0.75rem] text-[#60626c]">
                          {formatAdminDateTimeLong(log.createdAt)}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1653cc]/10 text-[10px] font-bold text-[#1653cc]">
                              {initials}
                            </div>
                            <span className="text-xs font-medium text-[#181b25]">{email}</span>
                          </div>
                        </td>
                        <td className="max-w-[200px] px-6 py-3">
                          <p className="text-sm font-semibold leading-snug text-[#181b25]">
                            {humanizeEnumLabel(log.actionCode.replace(/\./g, " ").replace(/_/g, " "))}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-[#9ca3af]" title={log.actionCode}>
                            {log.actionCode.length > 42 ? `${log.actionCode.slice(0, 42)}…` : log.actionCode}
                          </p>
                        </td>
                        <td className="max-w-[160px] px-6 py-3 text-xs text-[#181b25]">
                          {log.entityType || log.entityId ? (
                            <span className="block">
                              <span className="font-semibold text-[#181b25]">
                                {log.entityType ? humanizeEnumLabel(log.entityType.replace(/_/g, " ")) : "Record"}
                              </span>
                              {log.entityId ? (
                                <span className="mt-0.5 block truncate font-mono text-[10px] text-[#737685]" title={log.entityId}>
                                  {log.entityId.length > 20 ? `${log.entityId.slice(0, 20)}…` : log.entityId}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td
                          className="max-w-[min(200px,28vw)] truncate px-6 py-3 text-sm leading-snug text-[#7f1d1d]"
                          title={businessSnapshot(log.before, 400)}
                        >
                          {businessSnapshot(log.before)}
                        </td>
                        <td
                          className="max-w-[min(200px,28vw)] truncate px-6 py-3 text-sm leading-snug text-[#14532d]"
                          title={businessSnapshot(log.after, 400)}
                        >
                          {businessSnapshot(log.after)}
                        </td>
                        <td className="max-w-[160px] truncate px-6 py-3 text-xs text-[#5b5e68]" title={log.reason ?? ""}>
                          {log.reason?.trim() || "—"}
                        </td>
                        <td className="px-4 py-3 text-right sm:px-6">
                          {deep ? (
                            <Link to={deep} className={stitchRecordLinkClass} title="Open related record">
                              Open
                            </Link>
                          ) : log.entityType && log.entityId ? (
                            <Link
                              to={`/admin/security/audit-logs?entityType=${encodeURIComponent(log.entityType)}&entityId=${encodeURIComponent(log.entityId)}`}
                              className={`${stitchRecordLinkClass} gap-1`}
                              title="Search audit trail for this entity"
                            >
                              Trace
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                            </Link>
                          ) : (
                            <span className="text-xs text-[#9ca3af]" title="No entity reference">
                              —
                            </span>
                          )}
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
