import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Ban, Bell, ClipboardCopy, RefreshCw } from "lucide-react";

import { BusinessMetadataSection } from "@/features/security/components/BusinessMetadataSection";
import { StitchBreadcrumbs, StitchPageBody } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  getSecurityEventDetail,
  notifySecurityEvent,
  postSecurityEventStatus,
  requestSecurityEventIpBlock
} from "@/features/security/api/admin-security.api";
import { SecurityHubNav } from "@/features/security/components/SecurityHubNav";
import {
  formatAdminDateTimeLong,
  humanizeEnumLabel,
  pickDeviceFromPayload,
  pickIpFromMetadata,
  stitchVisibleLinkClass,
  summarizeUserRef,
  timelinePayloadLine
} from "@/features/security/lib/securityUiHelpers";

export const SecurityEventDetailPage = () => {
  const { securityEventId } = useParams<{ securityEventId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-security-event-detail", securityEventId],
    queryFn: async () => {
      if (!accessToken || !securityEventId) {
        throw new Error("Missing context.");
      }
      return getSecurityEventDetail(accessToken, securityEventId);
    },
    enabled: Boolean(accessToken && securityEventId)
  });

  const resolveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !securityEventId) {
        throw new Error("Missing context.");
      }
      return postSecurityEventStatus(accessToken, securityEventId, { nextStatus: "RESOLVED" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-security-event-detail", securityEventId] })
  });

  const notifyMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !securityEventId) {
        throw new Error("Missing context.");
      }
      return notifySecurityEvent(accessToken, securityEventId, {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-security-event-detail", securityEventId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-security-events"] });
    }
  });

  const ipBlockMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !securityEventId) {
        throw new Error("Missing context.");
      }
      return requestSecurityEventIpBlock(accessToken, securityEventId, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-security-event-detail", securityEventId] })
  });

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  if (!securityEventId) {
    return (
      <StitchPageBody className="w-full max-w-[1600px]">
        <SecurityHubNav />
        <p className="text-sm text-[#60626c]">Missing event id.</p>
      </StitchPageBody>
    );
  }

  const e = q.data?.data.entity;

  return (
    <StitchPageBody className="w-full max-w-[1600px]">
      <SecurityHubNav />
      <StitchBreadcrumbs
        emphasizeLinks
        items={[
          { label: "Security events", to: "/admin/security/events" },
          { label: securityEventId.slice(0, 8).toUpperCase() }
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="font-headline text-2xl font-bold text-[#181b25]">Security event</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-security-event-detail", securityEventId] })}
            className="flex items-center gap-2 rounded-lg border border-[#c3c6d6] bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#434654] hover:bg-[#f2f3ff]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
          <Link to="/admin/security/events" className={`${stitchVisibleLinkClass} text-sm`}>
            ← Back to security events
          </Link>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[#60626c]">Loading…</p>
      ) : e ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <div className="rounded-sm border-l-4 border-[#1653cc] bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">What happened</h2>
              <p className="text-sm leading-relaxed text-[#434654]">{timelinePayloadLine(e.metadata)}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-sm bg-[#f2f3ff] p-3">
                  <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">Type</span>
                  <span className="font-mono text-sm font-semibold">{e.type}</span>
                </div>
                <div className="rounded-sm bg-[#f2f3ff] p-3">
                  <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">Severity</span>
                  <span className="text-sm font-semibold">{humanizeEnumLabel(e.severity)}</span>
                </div>
                <div className="rounded-sm bg-[#f2f3ff] p-3">
                  <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">Status</span>
                  <span className="text-sm font-semibold">{e.status.replace(/_/g, " ")}</span>
                </div>
                <div className="rounded-sm bg-[#f2f3ff] p-3">
                  <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">Detected at</span>
                  <span className="text-sm font-semibold">{formatAdminDateTimeLong(e.createdAt)}</span>
                </div>
                {e.resolvedAt ? (
                  <div className="rounded-sm bg-[#f2f3ff] p-3">
                    <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">
                      Resolved at
                    </span>
                    <span className="text-sm font-semibold">{formatAdminDateTimeLong(e.resolvedAt)}</span>
                  </div>
                ) : null}
                {pickIpFromMetadata(e.metadata) ? (
                  <div className="rounded-sm bg-[#f2f3ff] p-3 sm:col-span-2">
                    <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">
                      Source IP
                    </span>
                    <span className="font-mono text-sm font-semibold">{pickIpFromMetadata(e.metadata)}</span>
                  </div>
                ) : null}
                {pickDeviceFromPayload(e.metadata) ? (
                  <div className="rounded-sm bg-[#f2f3ff] p-3 sm:col-span-2">
                    <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">
                      Device / client hint
                    </span>
                    <span className="break-words text-xs font-medium text-[#181b25]">{pickDeviceFromPayload(e.metadata)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-sm border border-[#e8eaf4] bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">Event record</h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-all font-mono text-xs text-[#434654]">{e.id}</span>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(e.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#c3c6d6]/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1653cc] hover:bg-[#f2f3ff]"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                  Copy ID
                </button>
              </div>
              <p className="mt-2 text-xs text-[#737685]">Use this identifier when correlating with alerts, tickets, or payment reviews.</p>
            </div>

            <div className="rounded-sm bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">Subject</h2>
              <p className="text-sm text-[#434654]">
                <span className="font-semibold text-[#181b25]">Customer / user: </span>
                {e.user ? (
                  <Link to={`/admin/customers/${e.user.id}`} className={stitchVisibleLinkClass}>
                    {summarizeUserRef(e.user)}
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Link>
                ) : (
                  summarizeUserRef(e.user)
                )}
              </p>
              {e.user?.id ? (
                <p className="mt-2 font-mono text-[11px] text-[#737685]">
                  Customer ID: <span className="text-[#181b25]">{e.user.id}</span>
                </p>
              ) : null}
            </div>

            <BusinessMetadataSection
              metadata={e.metadata}
              title="Supporting context"
              subtitle="Fields captured with this event. Sensitive values are omitted."
            />
          </div>

          <div className="lg:col-span-4">
            <div className="rounded-xl bg-[#1a1d27] p-6 text-white shadow-lg">
              <h2 className="mb-4 text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">Actions</h2>
              <p className="mb-4 text-xs text-slate-400">
                Mark this event resolved once mitigation or review is complete. This is recorded on the audit trail.
              </p>
              <button
                type="button"
                disabled={notifyMut.isPending}
                onClick={() => notifyMut.mutate()}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-md border border-slate-600 py-2.5 text-[0.7rem] font-bold hover:bg-white/5 disabled:opacity-50"
              >
                <Bell className="h-4 w-4" aria-hidden />
                Notify (follow-up alert)
              </button>
              <button
                type="button"
                disabled={ipBlockMut.isPending || !pickIpFromMetadata(e.metadata)}
                title={pickIpFromMetadata(e.metadata) ? "Record IP block request on this event" : "No IP on event metadata"}
                onClick={() => ipBlockMut.mutate()}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-md border border-[#ba1a1a]/50 py-2.5 text-[0.7rem] font-bold text-[#fecaca] hover:bg-[#ba1a1a]/20 disabled:opacity-40"
              >
                <Ban className="h-4 w-4" aria-hidden />
                Request IP block
              </button>
              <button
                type="button"
                disabled={resolveMut.isPending || e.status === "RESOLVED"}
                onClick={() => resolveMut.mutate()}
                className="w-full rounded-md bg-[#006b2d] py-2.5 text-[0.7rem] font-bold hover:brightness-110 disabled:opacity-50"
              >
                Mark resolved
              </button>
              {e.resolvedAt ? (
                <p className="mt-3 text-[0.65rem] text-slate-400">Resolved at {formatAdminDateTimeLong(e.resolvedAt)}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </StitchPageBody>
  );
};
