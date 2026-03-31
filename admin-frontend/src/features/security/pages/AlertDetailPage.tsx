import { useState } from "react";
import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Ban, ClipboardCopy, Share2 } from "lucide-react";

import { BusinessMetadataSection } from "@/features/security/components/BusinessMetadataSection";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { StitchBreadcrumbs, StitchPageBody } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";
import {
  ApiError,
  acknowledgeAdminAlert,
  assignAdminAlert,
  getAdminAlertDetail,
  resolveAdminAlert,
  type AdminAlertDetailResponse
} from "@/features/security/api/admin-alerts.api";
import { SecurityHubNav } from "@/features/security/components/SecurityHubNav";
import { requestSecurityEventIpBlock } from "@/features/security/api/admin-security.api";
import {
  downloadTextFile,
  formatAdminDateTimeLong,
  humanizeEnumLabel,
  metadataToBusinessRows,
  pickDeviceFromPayload,
  pickIpFromMetadata,
  stitchVisibleLinkClass,
  summarizeAdminActor,
  timelinePayloadLine
} from "@/features/security/lib/securityUiHelpers";

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

const severityBadgeClass = (s: string) => {
  if (s === "CRITICAL" || s === "HIGH") return "border-[#ba1a1a]/20 text-[#ba1a1a]";
  if (s === "MEDIUM") return "border-[#1653cc]/20 text-[#1653cc]";
  return "border-[#737685]/20 text-[#737685]";
};

export const AlertDetailPage = () => {
  const { alertId = "" } = useParams<{ alertId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions);
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [confirm, setConfirm] = useState<null | "ack" | "resolve" | "ip">(null);

  const detailQuery = useQuery({
    queryKey: ["admin-alert-detail", alertId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminAlertDetail(accessToken, alertId);
    },
    enabled: Boolean(accessToken) && Boolean(alertId)
  });

  const inv = () => queryClient.invalidateQueries({ queryKey: ["admin-alert-detail", alertId] });

  const assignMut = useMutation({
    mutationFn: (assignedToAdminUserId: string | null) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return assignAdminAlert(accessToken, alertId, {
        assignedToAdminUserId,
        note: note.trim() || undefined
      });
    },
    onSuccess: inv
  });

  const ackMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return acknowledgeAdminAlert(accessToken, alertId, { note: note.trim() || undefined });
    },
    onSuccess: inv
  });

  const resolveMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return resolveAdminAlert(accessToken, alertId, { note: note.trim() || undefined });
    },
    onSuccess: inv
  });

  const ipBlockMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const cached = queryClient.getQueryData<AdminAlertDetailResponse>(["admin-alert-detail", alertId]);
      const rel = cached?.data.entity.relatedSecurityEventId;
      if (!rel) {
        throw new Error("No linked security event.");
      }
      return requestSecurityEventIpBlock(accessToken, rel, {});
    },
    onSuccess: inv
  });

  const e = detailQuery.data?.data.entity;
  const err =
    detailQuery.error instanceof ApiError
      ? detailQuery.error.message
      : detailQuery.error instanceof Error
        ? detailQuery.error.message
        : null;

  const summaryLine = e ? timelinePayloadLine(e.metadata) : "—";
  const titleType = e ? humanizeEnumLabel(e.type.replace(/[._]/g, " ")) : "Alert";
  const canManageAlerts = adminHasAnyPermission(actorPermissions, ["security.alerts.manage"]);
  const canRequestIpBlock = adminHasAnyPermission(actorPermissions, ["security.events.manage"]);

  const exportSummaryTxt = () => {
    if (!e) {
      return;
    }
    const metaRows = metadataToBusinessRows(e.metadata, { maxRows: 40 });
    const lines = [
      "Alert summary (business view)",
      "",
      `Alert ID: ${e.id}`,
      `Type: ${e.type}`,
      `Status: ${e.status}`,
      `Severity: ${e.severity}`,
      `Created: ${e.createdAt}`,
      `Last updated: ${e.updatedAt}`,
      `Assigned to: ${summarizeAdminActor(e.assignedTo)}`,
      `Resolved by: ${summarizeAdminActor(e.resolvedBy)}`,
      e.relatedOrderId ? `Related order: ${e.relatedOrderId}` : null,
      e.relatedPaymentId ? `Related payment: ${e.relatedPaymentId}` : null,
      e.relatedSecurityEventId ? `Related security event: ${e.relatedSecurityEventId}` : null,
      pickIpFromMetadata(e.metadata) ? `Source IP: ${pickIpFromMetadata(e.metadata)}` : null,
      pickDeviceFromPayload(e.metadata) ? `Device / client: ${pickDeviceFromPayload(e.metadata)}` : null,
      "",
      metaRows.length ? "Context fields:" : "No extra context fields.",
      ...metaRows.map((r) => `${r.label}: ${r.value}`)
    ].filter(Boolean) as string[];
    downloadTextFile(`alert-${e.id.slice(0, 8)}-summary.txt`, lines.join("\n"));
  };

  return (
    <StitchPageBody className="w-full max-w-[1600px]">
      {!alertId ? <p className="text-sm text-red-700">Missing alert id.</p> : null}
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

      {detailQuery.isLoading ? (
        <p className="text-sm text-[#60626c]">Loading…</p>
      ) : e ? (
        <>
          <SecurityHubNav />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <StitchBreadcrumbs
                emphasizeLinks
                items={[
                  { label: "Alerts center", to: "/admin/security/alerts" },
                  { label: e.id.slice(0, 8).toUpperCase() }
                ]}
              />
              <h1 className="font-headline text-2xl font-bold tracking-tight text-[#181b25] sm:text-3xl">
                Alert · {titleType}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className={`flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider ${severityBadgeClass(e.severity)}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                  {humanizeEnumLabel(e.severity)} severity
                </span>
                <StatusBadge label={e.status.replace(/_/g, " ")} tone={stTone(e.status)} />
                <span className="flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-widest text-[#737685]">
                  Triggered · {formatAdminDateTimeLong(e.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row lg:w-auto lg:flex-col">
              <button
                type="button"
                onClick={exportSummaryTxt}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#1653cc]/30 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#1653cc] hover:bg-[#f2f3ff]"
              >
                <Share2 className="h-4 w-4 shrink-0" aria-hidden />
                Export summary
              </button>
              <button
                type="button"
                disabled={ipBlockMut.isPending || !e?.relatedSecurityEventId || !canRequestIpBlock}
                title={
                  !canRequestIpBlock
                    ? "Requires security.events.manage permission"
                    : e?.relatedSecurityEventId
                    ? "Record IP block request on linked security event (requires IP on event metadata)"
                    : "Link a security event from this alert to request an IP block"
                }
                onClick={() => setConfirm("ip")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ba1a1a]/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#ba1a1a] hover:bg-red-50 disabled:opacity-40"
              >
                <Ban className="h-4 w-4 shrink-0" aria-hidden />
                Blacklist IP
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <div className="rounded-sm border-l-4 border-[#1653cc] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                  Summary &amp; context
                </h2>
                <p className="text-sm leading-relaxed text-[#434654]">
                  {summaryLine !== "—" ? summaryLine : `This alert is classified as ${titleType}. Review related objects and timeline entries to determine the next operational step.`}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-sm bg-[#f2f3ff] p-3">
                    <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">
                      Alert type
                    </span>
                    <span className="font-mono text-sm font-semibold text-[#181b25]">{e.type}</span>
                  </div>
                  <div className="rounded-sm bg-[#f2f3ff] p-3">
                    <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">
                      Last updated
                    </span>
                    <span className="text-sm font-semibold text-[#181b25]">{formatAdminDateTimeLong(e.updatedAt)}</span>
                  </div>
                  <div className="rounded-sm bg-[#f2f3ff] p-3">
                    <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">
                      Assigned to
                    </span>
                    <span className="text-sm font-semibold text-[#181b25]">{summarizeAdminActor(e.assignedTo)}</span>
                  </div>
                  <div className="rounded-sm bg-[#f2f3ff] p-3">
                    <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">
                      Resolved by
                    </span>
                    <span className="text-sm font-semibold text-[#181b25]">{summarizeAdminActor(e.resolvedBy)}</span>
                  </div>
                  {pickIpFromMetadata(e.metadata) ? (
                    <div className="rounded-sm bg-[#f2f3ff] p-3">
                      <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">
                        Source IP
                      </span>
                      <span className="font-mono text-sm font-semibold text-[#181b25]">{pickIpFromMetadata(e.metadata)}</span>
                    </div>
                  ) : null}
                  {pickDeviceFromPayload(e.metadata) ? (
                    <div className="rounded-sm bg-[#f2f3ff] p-3 sm:col-span-2 lg:col-span-1">
                      <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-tighter text-[#737685]">
                        Device / client hint
                      </span>
                      <span className="break-words text-xs font-medium text-[#181b25]">{pickDeviceFromPayload(e.metadata)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-sm border border-[#e8eaf4] bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">Record identifiers</h2>
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
                <p className="mt-2 text-xs text-[#737685]">
                  Created {formatAdminDateTimeLong(e.createdAt)} · Internal reference for support and audit correlation.
                </p>
              </div>

              <div className="rounded-sm bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">Related records</h2>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {e.relatedOrderId ? (
                    <Link to={`/admin/orders/${e.relatedOrderId}`} className={stitchVisibleLinkClass}>
                      Open order
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </Link>
                  ) : null}
                  {e.relatedPaymentId ? (
                    <Link to={`/admin/payments/${e.relatedPaymentId}`} className={stitchVisibleLinkClass}>
                      Open payment
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </Link>
                  ) : null}
                  {e.relatedSecurityEventId ? (
                    <Link
                      to={`/admin/security/events/${e.relatedSecurityEventId}`}
                      className={stitchVisibleLinkClass}
                    >
                      Open security event
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </Link>
                  ) : null}
                  {!e.relatedOrderId && !e.relatedPaymentId && !e.relatedSecurityEventId ? (
                    <p className="text-sm text-[#737685]">No related records attached to this alert.</p>
                  ) : null}
                </div>
              </div>

              <BusinessMetadataSection
                metadata={e.metadata}
                title="Context from automation"
                subtitle="Fields captured when this alert was raised. Full provider event bodies are not shown here."
              />
            </div>

            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-xl bg-[#1a1d27] p-6 text-white shadow-xl">
                <h2 className="mb-4 text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">Workflow</h2>
                <label className="mb-2 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                  Resolution note
                </label>
                <textarea
                  value={note}
                  onChange={(ev) => setNote(ev.target.value)}
                  rows={3}
                  className="mb-4 w-full rounded-md border-none bg-[#13161e] p-3 text-xs text-white placeholder:text-slate-500 focus:ring-1 focus:ring-[#1653cc]"
                  placeholder="Optional note for assign, acknowledge, or resolve…"
                />
                <label className="mb-2 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                  Assignee user ID
                </label>
                <input
                  value={assigneeId}
                  onChange={(ev) => setAssigneeId(ev.target.value)}
                  className="mb-2 w-full rounded-md border-none bg-[#13161e] p-2.5 font-mono text-xs text-white focus:ring-1 focus:ring-[#1653cc]"
                  placeholder="Leave empty to unassign"
                />
                <button
                  type="button"
                  disabled={assignMut.isPending || !canManageAlerts}
                  onClick={() => {
                    const t = assigneeId.trim();
                    assignMut.mutate(t ? t : null);
                  }}
                  className="mb-6 w-full rounded-md bg-[#1653cc] py-2 text-[0.7rem] font-bold transition-all hover:brightness-110 disabled:opacity-50"
                  title={canManageAlerts ? undefined : "Requires security.alerts.manage permission"}
                >
                  Apply assignment
                </button>
                <div className="h-px bg-slate-800" />
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={ackMut.isPending || e.status === "RESOLVED" || !canManageAlerts}
                    onClick={() => setConfirm("ack")}
                    className="rounded-md border border-slate-600 py-2 text-[0.7rem] font-bold text-white hover:bg-white/5 disabled:opacity-50"
                    title={canManageAlerts ? undefined : "Requires security.alerts.manage permission"}
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    disabled={resolveMut.isPending || e.status === "RESOLVED" || !canManageAlerts}
                    onClick={() => setConfirm("resolve")}
                    className="rounded-md bg-[#006b2d] py-2 text-[0.7rem] font-bold text-white hover:brightness-110 disabled:opacity-50"
                    title={canManageAlerts ? undefined : "Requires security.alerts.manage permission"}
                  >
                    Resolve
                  </button>
                </div>
              </div>
              <Link
                to="/admin/security/alerts"
                className={`${stitchVisibleLinkClass} justify-center text-sm`}
              >
                ← Back to alerts center
              </Link>
            </div>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={confirm === "ack"}
        title="Acknowledge this alert?"
        body="The alert stays open but is marked acknowledged. Your note above is recorded when provided."
        confirmLabel="Acknowledge"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          ackMut.mutate();
        }}
      />
      <ConfirmDialog
        open={confirm === "resolve"}
        title="Resolve this alert?"
        body="Resolved alerts are closed for the operations queue. Add a resolution note above when your process requires it."
        confirmLabel="Resolve"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          resolveMut.mutate();
        }}
      />
      <ConfirmDialog
        open={confirm === "ip"}
        title="Request IP block?"
        body="This records a block request on the linked security event. Confirm only when policy allows blocking the source IP."
        confirmLabel="Request block"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          ipBlockMut.mutate();
        }}
      />
    </StitchPageBody>
  );
};
