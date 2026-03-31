import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BusinessMetadataSection } from "@/features/security/components/BusinessMetadataSection";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { StitchBreadcrumbs, StitchPageBody } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";
import {
  ApiError,
  closeAdminIncident,
  getAdminIncidentDetail,
  patchAdminIncident,
  type IncidentDetailResponse
} from "@/features/security/api/admin-incidents.api";
import { SecurityHubNav } from "@/features/security/components/SecurityHubNav";
import {
  actorAdminEmail,
  downloadTextFile,
  formatAdminDateTimeLong,
  humanizeEnumLabel,
  incidentSeverityFromMetadata,
  metadataToBusinessRows,
  pickDeviceFromPayload,
  pickIpFromMetadata,
  relativeShort,
  stitchVisibleLinkClass
} from "@/features/security/lib/securityUiHelpers";

type InvestigationNote = { at: string; text: string; by?: string };

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

export const IncidentDetailPage = () => {
  const { incidentId = "" } = useParams<{ incidentId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions);
  const queryClient = useQueryClient();
  const [closeNote, setCloseNote] = useState("");
  const [noteDraft, setNoteDraft] = useState("");

  const detailQuery = useQuery({
    queryKey: ["admin-incident-detail", incidentId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminIncidentDetail(accessToken, incidentId);
    },
    enabled: Boolean(accessToken) && Boolean(incidentId)
  });

  const inv = () => queryClient.invalidateQueries({ queryKey: ["admin-incident-detail", incidentId] });

  const closeMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return closeAdminIncident(accessToken, incidentId, { note: closeNote.trim() || undefined });
    },
    onSuccess: inv
  });

  const statusMut = useMutation({
    mutationFn: (next: "INVESTIGATING" | "RESOLVED") => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return patchAdminIncident(accessToken, incidentId, { status: next });
    },
    onSuccess: inv
  });

  const addNoteMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const text = noteDraft.trim();
      if (!text) {
        throw new Error("Enter a note.");
      }
      const cached = queryClient.getQueryData<IncidentDetailResponse>(["admin-incident-detail", incidentId]);
      const ent = cached?.data.entity;
      if (!ent) {
        throw new Error("Reload the incident and try again.");
      }
      const meta =
        ent.metadata && typeof ent.metadata === "object" && !Array.isArray(ent.metadata)
          ? { ...(ent.metadata as Record<string, unknown>) }
          : {};
      const prev = Array.isArray(meta.investigationNotes) ? [...(meta.investigationNotes as InvestigationNote[])] : [];
      prev.push({
        at: new Date().toISOString(),
        text,
        by: "admin"
      });
      return patchAdminIncident(accessToken, incidentId, {
        metadata: { ...meta, investigationNotes: prev }
      });
    },
    onSuccess: () => {
      setNoteDraft("");
      void inv();
    }
  });

  const e = detailQuery.data?.data.entity;
  const err =
    detailQuery.error instanceof ApiError
      ? detailQuery.error.message
      : detailQuery.error instanceof Error
        ? detailQuery.error.message
        : null;

  const canClose = e && e.status !== "CLOSED";
  const canManageIncidents = adminHasAnyPermission(actorPermissions, ["security.incidents.manage"]);

  const notes = useMemo((): InvestigationNote[] => {
    if (!e?.metadata || typeof e.metadata !== "object" || Array.isArray(e.metadata)) {
      return [];
    }
    const raw = (e.metadata as Record<string, unknown>).investigationNotes;
    return Array.isArray(raw) ? (raw as InvestigationNote[]) : [];
  }, [e]);

  const exportSummaryTxt = () => {
    if (!e) {
      return;
    }
    const metaRows = metadataToBusinessRows(e.metadata, { maxRows: 40, excludeKeys: ["investigationNotes"] });
    const lines = [
      "Incident summary",
      "",
      `ID: ${e.id}`,
      `Title: ${e.title}`,
      `Status: ${e.status}`,
      `Severity (metadata): ${incidentSeverityFromMetadata(e.metadata)}`,
      `Created: ${e.createdAt}`,
      `Last updated: ${e.updatedAt}`,
      e.closedAt ? `Closed: ${e.closedAt}` : null,
      `Opened by: ${actorAdminEmail(e.createdBy) !== "—" ? actorAdminEmail(e.createdBy) : "System"}`,
      `Investigation notes: ${notes.length} on file`,
      pickIpFromMetadata(e.metadata) ? `IP hint: ${pickIpFromMetadata(e.metadata)}` : null,
      pickDeviceFromPayload(e.metadata) ? `Device hint: ${pickDeviceFromPayload(e.metadata)}` : null,
      "",
      e.summary?.trim() ? `Summary:\n${e.summary.trim()}` : null,
      "",
      metaRows.length ? "Other context:" : null,
      ...metaRows.map((r) => `${r.label}: ${r.value}`)
    ].filter(Boolean) as string[];
    downloadTextFile(`incident-${e.id.slice(0, 8)}-summary.txt`, lines.join("\n"));
  };

  return (
    <StitchPageBody className="w-full max-w-[1600px]">
      <SecurityHubNav />
      {!incidentId ? <p className="text-sm text-red-700">Missing incident id.</p> : null}
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

      {detailQuery.isLoading ? (
        <p className="text-sm text-[#60626c]">Loading…</p>
      ) : e ? (
        <>
          <StitchBreadcrumbs
            emphasizeLinks
            items={[
              { label: "Incidents", to: "/admin/security/incidents" },
              { label: e.id.slice(0, 8).toUpperCase() }
            ]}
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <span className="rounded bg-[#e0e2f0] px-2 py-0.5 font-mono text-xs text-[#434654]">
                  {incidentId.slice(0, 8).toUpperCase()}…
                </span>
                <StatusBadge label={e.status.replace(/_/g, " ")} tone={tone(e.status)} />
                <span className="rounded border border-[#ba1a1a]/30 px-2 py-0.5 text-[10px] font-bold uppercase text-[#ba1a1a]">
                  Sev · {incidentSeverityFromMetadata(e.metadata)}
                </span>
              </div>
              <h1 className="font-headline text-2xl font-bold tracking-tight text-[#181b25]">{e.title}</h1>
              <p className="mt-1 text-xs text-[#737685]">
                Created · {formatAdminDateTimeLong(e.createdAt)} · Last updated · {relativeShort(e.updatedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportSummaryTxt}
                className="flex items-center gap-2 rounded border border-[#1653cc]/35 px-4 py-2 text-xs font-bold text-[#1653cc] underline decoration-[#1653cc]/40 underline-offset-2 hover:bg-[#f2f3ff]"
              >
                Export summary
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <div className="rounded-xl border border-[#e8eaf4] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">At a glance</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#737685]">Full incident ID</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-[#181b25]">{e.id}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#737685]">Severity</dt>
                    <dd className="mt-1 text-sm font-semibold text-[#181b25]">{incidentSeverityFromMetadata(e.metadata)}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#737685]">Opened</dt>
                    <dd className="mt-1 text-sm text-[#434654]">{formatAdminDateTimeLong(e.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#737685]">Last activity</dt>
                    <dd className="mt-1 text-sm text-[#434654]">
                      {relativeShort(e.updatedAt)} · {formatAdminDateTimeLong(e.updatedAt)}
                    </dd>
                  </div>
                  {e.closedAt ? (
                    <div>
                      <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#737685]">Closed</dt>
                      <dd className="mt-1 text-sm text-[#434654]">{formatAdminDateTimeLong(e.closedAt)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#737685]">Investigation notes</dt>
                    <dd className="mt-1 text-sm font-semibold text-[#181b25]">{notes.length} saved</dd>
                  </div>
                  {pickIpFromMetadata(e.metadata) ? (
                    <div className="sm:col-span-2">
                      <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#737685]">IP hint (from context)</dt>
                      <dd className="mt-1 font-mono text-sm text-[#181b25]">{pickIpFromMetadata(e.metadata)}</dd>
                    </div>
                  ) : null}
                  {pickDeviceFromPayload(e.metadata) ? (
                    <div className="sm:col-span-2">
                      <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#737685]">Device hint</dt>
                      <dd className="mt-1 break-words text-sm text-[#434654]">{pickDeviceFromPayload(e.metadata)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="flex flex-col gap-6 rounded-xl bg-white p-6 shadow-sm">
                <div>
                  <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                    Incident description
                  </h2>
                  <p className="text-sm leading-relaxed text-[#434654]">
                    {e.summary?.trim() ||
                      "No narrative summary was provided for this incident. Use investigation notes and related security tools to reconstruct what happened."}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-white p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                    Investigation workspace
                  </h2>
                  <span className="text-[0.65rem] font-medium text-[#9ca3af]">Notes are saved to the incident record</span>
                </div>
                <div className="space-y-3">
                  {notes.length === 0 ? (
                    <p className="text-sm text-[#737685]">No investigation notes yet.</p>
                  ) : (
                    <ul className="space-y-3 border-l-2 border-[#1653cc]/20 pl-4">
                      {notes.map((n, idx) => (
                        <li key={`${n.at}-${idx}`}>
                          <p className="font-mono text-[0.65rem] text-[#737685]">{formatAdminDateTimeLong(n.at)}</p>
                          <p className="text-sm text-[#181b25]">{n.text}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-4 border-t border-[#e5e7eb] pt-4">
                  <textarea
                    value={noteDraft}
                    onChange={(ev) => setNoteDraft(ev.target.value)}
                    rows={3}
                    placeholder="Post an investigation note…"
                    className="w-full rounded-lg border border-[#e5e7eb] p-3 text-sm text-[#181b25] placeholder:text-[#9ca3af]"
                  />
                  <button
                    type="button"
                    disabled={addNoteMut.isPending || !canManageIncidents}
                    onClick={() => addNoteMut.mutate()}
                    className="mt-2 rounded-lg bg-[#1653cc] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    title={canManageIncidents ? undefined : "Requires security.incidents.manage permission"}
                  >
                    Post note
                  </button>
                  {addNoteMut.error instanceof Error ? (
                    <p className="mt-2 text-sm text-red-700">{addNoteMut.error.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl bg-white p-6">
                <h2 className="mb-6 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">
                  Incident lifecycle
                </h2>
                <div className="relative space-y-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-px before:bg-[#c3c6d6]/40">
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1 h-4 w-4 rounded-full border-4 border-[#ba1a1a] bg-white" />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-tight">Opened</p>
                        <p className="mt-0.5 text-[0.7rem] text-[#737685]">Incident record created</p>
                      </div>
                      <span className="font-mono text-[0.6rem] text-[#737685]">{formatAdminDateTimeLong(e.createdAt)}</span>
                    </div>
                  </div>
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1 h-4 w-4 rounded-full border-4 border-[#1653cc] bg-white" />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-tight">Last activity</p>
                        <p className="mt-0.5 text-[0.7rem] text-[#737685]">Status · {humanizeEnumLabel(e.status)}</p>
                      </div>
                      <span className="font-mono text-[0.6rem] text-[#737685]">{relativeShort(e.updatedAt)}</span>
                    </div>
                  </div>
                  {e.closedAt ? (
                    <div className="relative pl-8">
                      <div className="absolute left-0 top-1 h-4 w-4 rounded-full border-4 border-[#006b2d] bg-white" />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-tight">Closed</p>
                          <p className="mt-0.5 text-[0.7rem] text-[#737685]">Incident marked closed</p>
                        </div>
                        <span className="font-mono text-[0.6rem] text-[#737685]">{formatAdminDateTimeLong(e.closedAt)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <BusinessMetadataSection
                metadata={e.metadata}
                title="Automation & system context"
                subtitle="Structured fields attached to this incident. Investigation notes stay in the workspace above."
                excludeKeys={["investigationNotes"]}
              />
            </div>

            <aside className="space-y-6 lg:col-span-4">
              <div className="rounded-xl border-l-4 border-[#1653cc] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">Ownership</h2>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1653cc]/10 text-sm font-bold text-[#1653cc]">
                    {actorAdminEmail(e.createdBy) !== "—"
                      ? actorAdminEmail(e.createdBy).slice(0, 2).toUpperCase()
                      : "?"}
                  </span>
                  <p className="text-sm text-[#434654]">
                    Reported by{" "}
                    <span className="font-semibold text-[#181b25]">
                      {actorAdminEmail(e.createdBy) !== "—" ? actorAdminEmail(e.createdBy) : "System automation"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685]">Status</h2>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={statusMut.isPending || e.status === "INVESTIGATING" || !canManageIncidents}
                    onClick={() => statusMut.mutate("INVESTIGATING")}
                    className="rounded-lg border border-[#1653cc] py-2 text-xs font-bold text-[#1653cc] hover:bg-[#f2f3ff] disabled:opacity-40"
                    title={canManageIncidents ? undefined : "Requires security.incidents.manage permission"}
                  >
                    Mark investigating
                  </button>
                  <button
                    type="button"
                    disabled={statusMut.isPending || e.status === "RESOLVED" || e.status === "CLOSED" || !canManageIncidents}
                    onClick={() => statusMut.mutate("RESOLVED")}
                    className="rounded-lg bg-[#006b2d] py-2 text-xs font-bold text-white hover:brightness-110 disabled:opacity-40"
                    title={canManageIncidents ? undefined : "Requires security.incidents.manage permission"}
                  >
                    Mark resolved
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[#1a1d27] p-6 text-white shadow-xl">
                <h2 className="mb-4 text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">Close incident</h2>
                {canClose ? (
                  <div className="space-y-3">
                    <textarea
                      value={closeNote}
                      onChange={(ev) => setCloseNote(ev.target.value)}
                      placeholder="Optional closing summary for the audit trail…"
                      rows={4}
                      className="w-full rounded-lg border-none bg-[#13161e] p-3 text-xs text-white placeholder:text-slate-500 focus:ring-1 focus:ring-[#1653cc]"
                    />
                    <button
                      type="button"
                      disabled={closeMut.isPending || !canManageIncidents}
                      onClick={() => closeMut.mutate()}
                      className="w-full rounded-md bg-[#ba1a1a]/90 py-2 text-[0.7rem] font-bold text-white hover:bg-[#ba1a1a] disabled:opacity-50"
                      title={canManageIncidents ? undefined : "Requires security.incidents.manage permission"}
                    >
                      Close incident
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">This incident is already closed.</p>
                )}
              </div>

              <Link to="/admin/security/incidents" className={`${stitchVisibleLinkClass} justify-center text-sm`}>
                ← Back to incidents list
              </Link>
            </aside>
          </div>
        </>
      ) : null}
    </StitchPageBody>
  );
};
