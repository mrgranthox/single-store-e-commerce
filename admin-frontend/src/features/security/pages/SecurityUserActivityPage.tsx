import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Download, RefreshCw, UserSearch } from "lucide-react";

import {
  StitchBreadcrumbs,
  StitchFieldLabel,
  StitchFilterPanel,
  StitchPageBody,
  stitchInputClass,
  stitchSelectClass
} from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getUserActivityExplorer } from "@/features/security/api/admin-security.api";
import { SecurityHubNav } from "@/features/security/components/SecurityHubNav";
import {
  adminActionEntityHref,
  downloadUtf8Csv,
  formatAdminDateTimeLong,
  humanizeEnumLabel,
  pickDeviceFromPayload,
  pickIpFromMetadata,
  securityTableScrollClass,
  stitchRecordLinkClass,
  timelinePayloadLine
} from "@/features/security/lib/securityUiHelpers";

const ACTIVITY_TYPES = ["", "LOGIN", "ORDER", "SECURITY", "SUPPORT", "REFUND"] as const;

export const SecurityUserActivityPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [entityTypeDraft, setEntityTypeDraft] = useState("");
  const [entityIdDraft, setEntityIdDraft] = useState("");
  const [eventTypeDraft, setEventTypeDraft] = useState("");
  const [activityPreset, setActivityPreset] = useState("");
  const [occurredFrom, setOccurredFrom] = useState("");
  const [occurredTo, setOccurredTo] = useState("");
  const [applied, setApplied] = useState({
    entityType: "",
    entityId: "",
    eventType: "",
    occurredAtFrom: "",
    occurredAtTo: ""
  });

  const queryKey = useMemo(() => ["admin-security-user-activity", page, applied] as const, [page, applied]);

  const q = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getUserActivityExplorer(accessToken, {
        page,
        page_size: 25,
        ...(applied.entityType.trim() ? { entityType: applied.entityType.trim() } : {}),
        ...(applied.entityId.trim() ? { entityId: applied.entityId.trim() } : {}),
        ...(applied.eventType.trim() ? { eventType: applied.eventType.trim() } : {}),
        ...(applied.occurredAtFrom.trim() ? { occurredAtFrom: applied.occurredAtFrom.trim() } : {}),
        ...(applied.occurredAtTo.trim() ? { occurredAtTo: applied.occurredAtTo.trim() } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = q.data?.data.items ?? [];
  const meta = q.data?.meta;

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const applyFilters = () => {
    setPage(1);
    const et = (activityPreset || eventTypeDraft).trim();
    setApplied({
      entityType: entityTypeDraft,
      entityId: entityIdDraft,
      eventType: et,
      occurredAtFrom: occurredFrom.trim(),
      occurredAtTo: occurredTo.trim()
    });
  };

  return (
    <StitchPageBody className="w-full max-w-[1600px]">
      <SecurityHubNav />
      <StitchBreadcrumbs
        emphasizeLinks
        items={[
          { label: "Audit logs", to: "/admin/security/audit-logs" },
          { label: "User activity" }
        ]}
      />

      <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">User Activity</h1>
          <p className="mt-1 text-sm text-[#5b5e68]">
            Investigation view for customer- and system-facing timeline events across the platform.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              downloadUtf8Csv(
                `user-activity-page-${page}.csv`,
                ["id", "occurredAt", "actorType", "eventType", "entityType", "entityId", "description"],
                items.map((row) => [
                  row.id,
                  row.occurredAt,
                  row.actorType,
                  row.eventType,
                  row.entityType,
                  row.entityId,
                  timelinePayloadLine(row.payload)
                ])
              );
            }}
            className="flex items-center gap-2 rounded-lg border border-[#1653cc]/35 bg-white px-4 py-2 text-xs font-bold text-[#1653cc] underline decoration-[#1653cc]/40 underline-offset-2 hover:bg-[#f2f3ff]"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-security-user-activity"] })}
            className="flex items-center gap-2 rounded-lg bg-[#3b6de6] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#1653cc]/20 transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh logs
          </button>
        </div>
      </div>

      <StitchFilterPanel className="grid grid-cols-1 gap-6 border border-white shadow-sm md:grid-cols-12">
        <div className="md:col-span-12 lg:col-span-4">
          <StitchFieldLabel>Customer / entity scope</StitchFieldLabel>
          <div className="relative">
            <UserSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737685]" aria-hidden />
            <input
              value={entityIdDraft}
              onChange={(e) => setEntityIdDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
              placeholder="Customer or account ID"
              className={`${stitchInputClass} pl-10 font-mono text-xs`}
            />
          </div>
          <input
            value={entityTypeDraft}
            onChange={(e) => setEntityTypeDraft(e.target.value)}
            placeholder="Entity type (e.g. User)"
            className={`${stitchInputClass} mt-2 font-mono text-xs`}
          />
        </div>
        <div className="space-y-2 md:col-span-12 lg:col-span-3">
          <StitchFieldLabel>Occurred between (UTC)</StitchFieldLabel>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737685]" aria-hidden />
            <input
              type="datetime-local"
              value={occurredFrom}
              onChange={(e) => setOccurredFrom(e.target.value)}
              className={`${stitchInputClass} pl-10 font-mono text-xs`}
            />
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737685]" aria-hidden />
            <input
              type="datetime-local"
              value={occurredTo}
              onChange={(e) => setOccurredTo(e.target.value)}
              className={`${stitchInputClass} pl-10 font-mono text-xs`}
            />
          </div>
          <p className="text-[10px] text-[#737685]">Apply filters to query the server. Results stay newest-first within the window.</p>
        </div>
        <div className="md:col-span-12 lg:col-span-3">
          <StitchFieldLabel>Activity type</StitchFieldLabel>
          <select
            value={activityPreset}
            onChange={(e) => {
              setActivityPreset(e.target.value);
              if (e.target.value) setEventTypeDraft("");
            }}
            className={stitchSelectClass}
          >
            <option value="">All activities</option>
            {ACTIVITY_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {humanizeEnumLabel(t)}
              </option>
            ))}
          </select>
          <input
            value={eventTypeDraft}
            disabled={Boolean(activityPreset)}
            onChange={(e) => setEventTypeDraft(e.target.value)}
            placeholder="Or exact event type code…"
            className={`${stitchInputClass} mt-2 font-mono text-xs`}
          />
        </div>
        <div className="flex items-end md:col-span-12 lg:col-span-2">
          <button
            type="button"
            onClick={applyFilters}
            className="w-full rounded-lg bg-[#dedfeb] py-2.5 text-xs font-bold uppercase tracking-widest text-[#181b24] transition-colors hover:bg-[#c3c6d6]/40"
          >
            Filter results
          </button>
        </div>
      </StitchFilterPanel>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[#60626c]">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white bg-white shadow-sm">
          <div className={securityTableScrollClass}>
            <table className="min-w-[1000px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#c3c6d6]/10 bg-[#e6e7f6]/50">
                  {[
                    "Timestamp",
                    "User / actor",
                    "Type",
                    "Description",
                    "Entity",
                    "Open",
                    "IP address",
                    "Device"
                  ].map((h) => (
                    <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#737685]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d6]/10">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#60626c]">
                      No activity events for these filters.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const ip = pickIpFromMetadata(row.payload);
                    const dev = pickDeviceFromPayload(row.payload);
                    const entityHref = adminActionEntityHref(row.entityType, row.entityId);
                    return (
                      <tr key={row.id} className="hover:bg-[#f2f3ff]/60">
                        <td className="whitespace-nowrap px-6 py-3 font-mono text-xs text-[#60626c]">
                          {formatAdminDateTimeLong(row.occurredAt)}
                        </td>
                        <td className="px-6 py-3 text-xs font-medium text-[#181b25]">
                          {row.actorType === "ADMIN" && row.actorAdminUserId
                            ? `Admin ${row.actorAdminUserId.slice(0, 8)}…`
                            : humanizeEnumLabel(row.actorType)}
                        </td>
                        <td className="px-6 py-3 text-xs font-semibold text-[#1653cc]">
                          {humanizeEnumLabel(row.eventType)}
                        </td>
                        <td className="max-w-xs truncate px-6 py-3 text-sm text-[#434654]" title={timelinePayloadLine(row.payload)}>
                          {timelinePayloadLine(row.payload)}
                        </td>
                        <td className="px-6 py-3 text-xs text-[#5b5e68]">
                          <span className="font-mono">
                            {row.entityType}:{row.entityId.slice(0, 8)}…
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-3">
                          {entityHref ? (
                            <Link to={entityHref} className={stitchRecordLinkClass}>
                              Open
                            </Link>
                          ) : (
                            <span className="text-xs text-[#737685]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3 font-mono text-[11px] text-[#5b5e68]">{ip ?? "—"}</td>
                        <td className="max-w-[200px] truncate px-6 py-3 text-xs text-[#737685]" title={dev ?? ""}>
                          {dev ?? "—"}
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
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.totalItems} events
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              className="rounded-lg border px-3 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              className="rounded-lg border px-3 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </StitchPageBody>
  );
};
