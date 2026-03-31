import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download, Filter, MoreVertical, RefreshCw } from "lucide-react";

import {
  StitchBreadcrumbs,
  StitchFieldLabel,
  StitchFilterPanel,
  StitchPageBody,
  stitchInputClass,
  stitchSelectClass
} from "@/components/stitch";
import { SupportWorkspaceNav } from "@/features/support/components/SupportWorkspaceNav";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  getSupportReports,
  listSupportComplaintsQueue,
  listSupportPrePurchaseQueue,
  listSupportSlaQueue,
  type SupportTicketListItem
} from "@/features/support/api/admin-support.api";
import {
  formatSlaCountdown,
  formatTicketNumber,
  humanizeSupportType,
  initialsFromCustomer,
  priorityChipClass,
  relativeShort
} from "@/features/support/lib/supportPresentation";
const STATUSES = ["", "OPEN", "IN_PROGRESS", "PENDING_CUSTOMER", "CLOSED"] as const;
const PRIORITIES = ["", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const SUPPORT_TYPES = ["", "GENERAL", "PRODUCT_INQUIRY", "CONTACT_REQUEST"] as const;
const ASSIGNMENTS = ["any", "unassigned", "me"] as const;

export type SupportQueueMode = "sla" | "prePurchase" | "complaints";

const statusDotClass = (s: string) => {
  if (s === "CLOSED") {
    return "bg-[#006b2d]";
  }
  if (s === "OPEN") {
    return "bg-[#1653cc]";
  }
  if (s === "IN_PROGRESS") {
    return "bg-amber-500";
  }
  return "bg-slate-300";
};

export const SupportQueuePage = ({ mode }: { mode: SupportQueueMode }) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [prePage, setPrePage] = useState(1);
  const [compPage, setCompPage] = useState(1);

  const [preStatus, setPreStatus] = useState("");
  const [prePriority, setPrePriority] = useState("");
  const [preSupportType, setPreSupportType] = useState("");
  const [preAssignment, setPreAssignment] = useState<(typeof ASSIGNMENTS)[number]>("any");
  const [preQDraft, setPreQDraft] = useState("");
  const [preQApplied, setPreQApplied] = useState("");

  const [compStatus, setCompStatus] = useState("");
  const [compPriority, setCompPriority] = useState("");
  const [compSupportType, setCompSupportType] = useState("");
  const [compAssignment, setCompAssignment] = useState<(typeof ASSIGNMENTS)[number]>("any");
  const [compQDraft, setCompQDraft] = useState("");
  const [compQApplied, setCompQApplied] = useState("");

  useEffect(() => {
    setPrePage(1);
    setCompPage(1);
  }, [mode]);

  const queueReportsQuery = useQuery({
    queryKey: ["admin-support-reports", "queue-kpis", "weekly"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getSupportReports(accessToken, "weekly");
    },
    enabled: Boolean(accessToken) && (mode === "prePurchase" || mode === "complaints")
  });

  const rep = queueReportsQuery.data?.data;

  const slaQuery = useQuery({
    queryKey: ["admin-support-queue-sla"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listSupportSlaQueue(accessToken);
    },
    enabled: Boolean(accessToken) && mode === "sla"
  });

  const preExtra = useMemo(
    () => ({
      ...(preStatus ? { status: preStatus } : {}),
      ...(prePriority ? { priority: prePriority } : {}),
      ...(preSupportType ? { supportType: preSupportType } : {}),
      ...(preAssignment !== "any" ? { assignment: preAssignment } : {}),
      ...(preQApplied.trim() ? { q: preQApplied.trim() } : {})
    }),
    [preStatus, prePriority, preSupportType, preAssignment, preQApplied]
  );

  const compExtra = useMemo(
    () => ({
      ...(compStatus ? { status: compStatus } : {}),
      ...(compPriority ? { priority: compPriority } : {}),
      ...(compSupportType ? { supportType: compSupportType } : {}),
      ...(compAssignment !== "any" ? { assignment: compAssignment } : {}),
      ...(compQApplied.trim() ? { q: compQApplied.trim() } : {})
    }),
    [compStatus, compPriority, compSupportType, compAssignment, compQApplied]
  );

  const preQuery = useQuery({
    queryKey: ["admin-support-queue-pre", prePage, preExtra],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listSupportPrePurchaseQueue(accessToken, prePage, 20, preExtra);
    },
    enabled: Boolean(accessToken) && mode === "prePurchase"
  });

  const compQuery = useQuery({
    queryKey: ["admin-support-queue-complaints", compPage, compExtra],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listSupportComplaintsQueue(accessToken, compPage, 20, compExtra);
    },
    enabled: Boolean(accessToken) && mode === "complaints"
  });

  const activeError = mode === "sla" ? slaQuery.error : mode === "prePurchase" ? preQuery.error : compQuery.error;
  const err =
    activeError instanceof ApiError
      ? activeError.message
      : activeError instanceof Error
        ? activeError.message
        : null;

  const loading =
    mode === "sla" ? slaQuery.isLoading : mode === "prePurchase" ? preQuery.isLoading : compQuery.isLoading;

  const slaItems = slaQuery.data?.data.items ?? [];
  const slaMetrics = slaQuery.data?.data.metrics;

  const preItems = preQuery.data?.data.items ?? [];
  const preMeta = preQuery.data?.meta;

  const compItems = compQuery.data?.data.items ?? [];
  const compMeta = compQuery.data?.meta;

  const guestOnPage = useMemo(
    () => preItems.filter((t) => !t.customer.id).length,
    [preItems]
  );

  if (mode === "sla") {
    return (
      <StitchPageBody>
        <SupportWorkspaceNav />

        <StitchBreadcrumbs
          items={[
            { label: "Support", to: "/admin/support/tickets" },
            { label: "Support Queue" }
          ]}
        />

        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">Support Queue</h1>
                <p className="mt-1 text-sm text-[#5b5e68]">
                  Operational view prioritized by SLA urgency and ticket priority.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-support-queue-sla"] })}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-[#c3c6d6] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#434654] transition-colors hover:bg-[#ecedfb] active:scale-[0.98]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Refresh
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 rounded-xl border border-[#c3c6d6]/10 bg-white p-4 shadow-sm md:max-w-none md:shrink-0">
            <div className="flex items-center gap-2 border-r border-[#c3c6d6]/30 pr-4">
              <span className="h-3 w-3 rounded-full bg-[#ba1a1a]" />
              <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#181b25]">Breached SLA</span>
            </div>
            <div className="flex items-center gap-2 border-r border-[#c3c6d6]/30 pr-4">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#181b25]">&lt;1h Remaining</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#006b2d]" />
              <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#181b25]">On Track</span>
            </div>
          </div>
        </div>

        {slaMetrics ? (
          <p className="text-sm text-[#60626c]">
            <span className="font-semibold text-[#181b25]">{slaMetrics.openCount}</span> open tickets ·{" "}
            <span className="font-semibold text-[#ba1a1a]">{slaMetrics.overdueCount}</span> first-response SLA breached ·{" "}
            <span className="font-semibold text-amber-600">{slaMetrics.atRiskCount}</span> under 1h to deadline
          </p>
        ) : null}

        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#60626c]">Loading queue…</p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#c3c6d6]/20 bg-[#f2f3ff]">
                    {[
                      "#",
                      "Ticket #",
                      "Subject",
                      "Customer",
                      "Priority",
                      "Status",
                      "Assigned to",
                      "SLA remaining",
                      "Actions"
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-[#60626c] ${
                          h === "Priority" ? "text-center" : ""
                        } ${h === "Actions" ? "text-right" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d6]/10">
                  {slaItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-sm text-[#60626c]">
                        No tickets breaching or within 1h of first-response SLA.
                      </td>
                    </tr>
                  ) : (
                    slaItems.map((t, idx) => (
                      <SlaQueueRow key={t.id} t={t} index={idx} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[#c3c6d6]/10 px-6 py-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#5b5e68]">
                Showing {slaItems.length} ticket{slaItems.length === 1 ? "" : "s"} needing attention
              </p>
            </div>
          </div>
        )}
      </StitchPageBody>
    );
  }

  if (mode === "prePurchase") {
    return (
      <StitchPageBody>
        <SupportWorkspaceNav />

        <StitchBreadcrumbs
          items={[
            { label: "Support", to: "/admin/support/tickets" },
            { label: "Pre-Purchase" }
          ]}
        />

        <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">Pre-purchase inquiries</h1>
            <p className="mt-1 text-sm text-[#5b5e68]">
              Manage and respond to buying questions before customer checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["admin-support-queue-pre"] });
              void queryClient.invalidateQueries({ queryKey: ["admin-support-reports"] });
            }}
            className="flex items-center gap-2 rounded-lg border border-[#c3c6d6] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#434654] transition-colors hover:bg-[#ecedfb] active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Active inquiries"
            value={rep?.prePurchase.activeCount != null ? String(rep.prePurchase.activeCount) : "—"}
            border="primary"
          />
          <KpiCard
            label="Avg. response time"
            value={
              rep?.prePurchase.avgFirstResponseMinutes != null
                ? `${Math.round(rep.prePurchase.avgFirstResponseMinutes)}m`
                : "—"
            }
            sub="Closed pre-purchase tickets (sample)"
            border="tertiary"
          />
          <KpiCard
            label="Guests (open)"
            value={rep?.prePurchase.guestCount != null ? String(rep.prePurchase.guestCount) : "—"}
            sub="All open pre-purchase"
            border="amber"
          />
          <KpiCard
            label="SLA breach risk"
            value={rep?.prePurchase.slaAtRiskCount != null ? String(rep.prePurchase.slaAtRiskCount) : "—"}
            sub="Open tickets past first-response due"
            border="error"
          />
        </div>

        <StitchFilterPanel className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <StitchFieldLabel>Status</StitchFieldLabel>
              <select
                value={preStatus}
                onChange={(e) => {
                  setPreStatus(e.target.value);
                  setPrePage(1);
                }}
                className={stitchSelectClass}
              >
                {STATUSES.map((s) => (
                  <option key={s || "all"} value={s}>
                    {s ? s.replace(/_/g, " ") : "Open (excl. closed default)"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <StitchFieldLabel>Priority</StitchFieldLabel>
              <select
                value={prePriority}
                onChange={(e) => {
                  setPrePriority(e.target.value);
                  setPrePage(1);
                }}
                className={stitchSelectClass}
              >
                {PRIORITIES.map((p) => (
                  <option key={p || "all"} value={p}>
                    {p || "All priorities"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <StitchFieldLabel>Category</StitchFieldLabel>
              <select
                value={preSupportType}
                onChange={(e) => {
                  setPreSupportType(e.target.value);
                  setPrePage(1);
                }}
                className={stitchSelectClass}
              >
                {SUPPORT_TYPES.map((c) => (
                  <option key={c || "all"} value={c}>
                    {c ? humanizeSupportType(c) : "All categories"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <StitchFieldLabel>Assigned</StitchFieldLabel>
              <select
                value={preAssignment}
                onChange={(e) => {
                  setPreAssignment(e.target.value as (typeof ASSIGNMENTS)[number]);
                  setPrePage(1);
                }}
                className={stitchSelectClass}
              >
                <option value="any">Any</option>
                <option value="unassigned">Unassigned</option>
                <option value="me">Me</option>
              </select>
            </div>
            <div>
              <StitchFieldLabel>Search</StitchFieldLabel>
              <div className="flex gap-2">
                <input
                  value={preQDraft}
                  onChange={(e) => setPreQDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPreQApplied(preQDraft);
                      setPrePage(1);
                    }
                  }}
                  placeholder="Email, order #, subject…"
                  className={`min-w-0 flex-1 ${stitchInputClass}`}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-[#1653cc] px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                  onClick={() => {
                    setPreQApplied(preQDraft);
                    setPrePage(1);
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <span className="flex items-center gap-2 text-xs text-[#5b5e68]">
              <Filter className="h-4 w-4 text-[#1653cc]" aria-hidden />
              Sort: <span className="font-semibold text-[#1653cc]">Newest activity</span>
            </span>
            <span className="text-[10px] text-[#60626c]">Guests on this page: {guestOnPage}</span>
          </div>
        </StitchFilterPanel>

        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#60626c]">Loading inquiries…</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-[#f2f3ff]">
                    <tr>
                      {[
                        "Ticket #",
                        "Customer / guest",
                        "Question subject",
                        "Product linked",
                        "Status",
                        "Created",
                        "Actions"
                      ].map((h) => (
                        <th
                          key={h}
                          className={`px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-[#737685] ${
                            h === "Actions" ? "text-right" : ""
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c3c6d6]/15">
                    {preItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-sm text-[#60626c]">
                          No pre-purchase inquiries in this queue.
                        </td>
                      </tr>
                    ) : (
                      preItems.map((t) => <PrePurchaseRow key={t.id} t={t} />)
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {preMeta && preMeta.totalPages > 1 ? (
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  disabled={prePage <= 1}
                  className="rounded-lg border border-[#e5e7eb] px-3 py-1 disabled:opacity-40"
                  onClick={() => setPrePage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="text-[#60626c]">
                  {preMeta.page} / {preMeta.totalPages}
                </span>
                <button
                  type="button"
                  disabled={prePage >= preMeta.totalPages}
                  className="rounded-lg border border-[#e5e7eb] px-3 py-1 disabled:opacity-40"
                  onClick={() => setPrePage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </StitchPageBody>
    );
  }

  return (
    <StitchPageBody>
      <SupportWorkspaceNav />

      <StitchBreadcrumbs
        items={[
          { label: "Support", to: "/admin/support/tickets" },
          { label: "Complaints Queue" }
        ]}
      />

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">Complaints queue</h1>
          <p className="mt-1 text-sm text-[#5b5e68]">
            Manage and resolve high-priority post-purchase customer issues.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            title="Export will be available in a future release."
            className="flex items-center gap-2 rounded-lg border border-[#c3c6d6] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#181b25] opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-[#1653cc] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:opacity-95 active:scale-[0.98]"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["admin-support-queue-complaints"] });
              void queryClient.invalidateQueries({ queryKey: ["admin-support-reports"] });
              void compQuery.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh queue
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Open (filtered)"
          value={compMeta?.totalItems != null ? String(compMeta.totalItems) : "—"}
          sub="List respects filters below"
          border="primary"
        />
        <KpiCard
          label="At risk (SLA)"
          value={rep?.complaints.slaAtRiskCount != null ? String(rep.complaints.slaAtRiskCount) : "—"}
          sub="High/urgent open, past first-response due"
          border="error"
        />
        <KpiCard
          label="Resolution rate"
          value={
            rep?.complaints.resolutionRatePercent != null ? `${rep.complaints.resolutionRatePercent}%` : "—"
          }
          sub="Weekly window (reports API)"
          border="tertiary"
        />
        <KpiCard
          label="Resolved (period)"
          value={rep?.complaints.resolvedInPeriod != null ? String(rep.complaints.resolvedInPeriod) : "—"}
          sub="Complaints closed in window"
          border="secondary"
        />
      </div>

      <StitchFilterPanel className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <StitchFieldLabel>Category</StitchFieldLabel>
            <select
              value={compSupportType}
              onChange={(e) => {
                setCompSupportType(e.target.value);
                setCompPage(1);
              }}
              className={stitchSelectClass}
            >
              {SUPPORT_TYPES.map((c) => (
                <option key={c || "all"} value={c}>
                  {c ? humanizeSupportType(c) : "All categories"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <StitchFieldLabel>Status</StitchFieldLabel>
            <select
              value={compStatus}
              onChange={(e) => {
                setCompStatus(e.target.value);
                setCompPage(1);
              }}
              className={stitchSelectClass}
            >
              {STATUSES.map((s) => (
                <option key={s || "all"} value={s}>
                  {s ? s.replace(/_/g, " ") : "Open (default)"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <StitchFieldLabel>Priority</StitchFieldLabel>
            <select
              value={compPriority}
              onChange={(e) => {
                setCompPriority(e.target.value);
                setCompPage(1);
              }}
              className={stitchSelectClass}
            >
              <option value="">High & urgent (default)</option>
              <option value="URGENT">Urgent only</option>
              <option value="HIGH">High only</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div>
            <StitchFieldLabel>Assigned</StitchFieldLabel>
            <select
              value={compAssignment}
              onChange={(e) => {
                setCompAssignment(e.target.value as (typeof ASSIGNMENTS)[number]);
                setCompPage(1);
              }}
              className={stitchSelectClass}
            >
              <option value="any">Any</option>
              <option value="unassigned">Unassigned</option>
              <option value="me">Me</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <StitchFieldLabel>Search</StitchFieldLabel>
            <div className="flex gap-2">
              <input
                value={compQDraft}
                onChange={(e) => setCompQDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setCompQApplied(compQDraft);
                    setCompPage(1);
                  }
                }}
                placeholder="Customer, order #, subject…"
                className={`min-w-0 flex-1 ${stitchInputClass}`}
              />
              <button
                type="button"
                className="shrink-0 rounded-lg bg-[#1653cc] px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                onClick={() => {
                  setCompQApplied(compQDraft);
                  setCompPage(1);
                }}
              >
                Apply
              </button>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-[#c3c6d6] bg-white p-2.5 text-[#1653cc] transition-colors hover:bg-[#ecedfb]"
                aria-label="Refresh list"
                onClick={() => void compQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </StitchFilterPanel>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#60626c]">Loading complaints…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-[#c3c6d6]/10 bg-[#f2f3ff]">
                  <tr>
                    {["Ticket #", "Customer", "Category", "Order #", "Priority", "Status", "Created", "Actions"].map(
                      (h) => (
                        <th
                          key={h}
                          className={`px-4 py-4 text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685] ${
                            h === "Priority" || h === "Status" ? "text-center" : ""
                          } ${h === "Ticket #" ? "pl-6" : ""} ${h === "Actions" ? "pr-6 text-right" : ""}`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d6]/10">
                  {compItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#60626c]">
                        No complaints in this queue.
                      </td>
                    </tr>
                  ) : (
                    compItems.map((t) => <ComplaintRow key={t.id} t={t} />)
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {compMeta && compMeta.totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                disabled={compPage <= 1}
                className="rounded-lg border px-3 py-1 disabled:opacity-40"
                onClick={() => setCompPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>
                {compMeta.page} / {compMeta.totalPages}
              </span>
              <button
                type="button"
                disabled={compPage >= compMeta.totalPages}
                className="rounded-lg border px-3 py-1 disabled:opacity-40"
                onClick={() => setCompPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </StitchPageBody>
  );
};

const KpiCard = ({
  label,
  value,
  sub,
  border
}: {
  label: string;
  value: string;
  sub?: string;
  border: "primary" | "tertiary" | "amber" | "error" | "secondary";
}) => {
  const b =
    border === "primary"
      ? "border-[#1653cc]"
      : border === "tertiary"
        ? "border-[#006b2d]"
        : border === "amber"
          ? "border-amber-500"
          : border === "error"
            ? "border-[#ba1a1a]"
            : "border-[#5b5e68]";
  return (
    <div className={`relative overflow-hidden rounded-xl border-l-4 ${b} bg-white p-6 shadow-sm`}>
      <div className="flex h-full flex-col justify-between">
        <span className="text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-[#737685]">{label}</span>
        <h3 className="mt-2 font-mono text-2xl font-bold text-[#181b25]">{value}</h3>
        {sub ? <p className="mt-1 text-[10px] text-[#60626c]">{sub}</p> : null}
      </div>
    </div>
  );
};

const slaQueueRemainingCell = (t: SupportTicketListItem) => {
  if (t.firstAdminReplyAt) {
    return <span className="text-xs font-semibold text-[#006b2d]">Responded</span>;
  }
  if (t.slaBreached) {
    return <span className="font-mono text-xs font-bold text-[#ba1a1a]">Breached · {formatSlaCountdown(t.slaSecondsRemaining)}</span>;
  }
  if (t.slaSecondsRemaining != null && t.slaSecondsRemaining <= 3600) {
    return <span className="font-mono text-xs font-bold text-amber-600">{formatSlaCountdown(t.slaSecondsRemaining)} left</span>;
  }
  return <span className="text-xs text-[#60626c]">—</span>;
};

const SlaQueueRow = ({ t, index }: { t: SupportTicketListItem; index: number }) => (
  <tr className="group transition-colors hover:bg-[#e6e7f6]">
    <td className="px-6 py-3 font-mono text-sm text-[#434654]">{String(index + 1).padStart(2, "0")}</td>
    <td className="px-6 py-3 font-mono text-sm font-bold text-[#ba1a1a]">
      <Link to={`/admin/support/tickets/${t.id}`} className="hover:underline">
        {formatTicketNumber(t.id)}
      </Link>
    </td>
    <td className="px-6 py-3 text-sm font-medium text-[#181b25]">{t.subject}</td>
    <td className="px-6 py-3 text-sm text-[#5b5e68]">{t.customer.name ?? t.customer.email ?? "—"}</td>
    <td className="px-6 py-3 text-center">
      <span
        className={`rounded-sm px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-tighter ${priorityChipClass(t.priority)}`}
      >
        {t.priority}
      </span>
    </td>
    <td className="px-6 py-3">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(t.status)}`} />
        <span className="text-[11px] font-semibold text-[#181b25]">{t.status.replace(/_/g, " ")}</span>
      </div>
    </td>
    <td className="px-6 py-3">
      {t.assignee ? (
        <span className="text-xs font-medium text-[#434654]">{t.assignee.email ?? "Assigned"}</span>
      ) : (
        <span className="rounded border border-amber-200 bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
          Unassigned
        </span>
      )}
    </td>
    <td className="px-6 py-3">{slaQueueRemainingCell(t)}</td>
    <td className="px-6 py-3 text-right">
      <Link
        to={`/admin/support/tickets/${t.id}`}
        className="text-xs font-semibold text-[#1653cc] hover:underline"
      >
        View
      </Link>
    </td>
  </tr>
);

const PrePurchaseRow = ({ t }: { t: SupportTicketListItem }) => {
  const initials = initialsFromCustomer(t.customer.name, t.customer.email);
  const guest = !t.customer.id;
  return (
    <tr className="group transition-colors hover:bg-[#e6e7f6]">
      <td className="px-6 py-4">
        <Link
          to={`/admin/support/tickets/${t.id}`}
          className="inline-block rounded bg-[#ecedfb] px-2 py-0.5 font-mono text-xs font-medium text-[#181b25] hover:bg-[#dbe1ff]"
        >
          {formatTicketNumber(t.id)}
        </Link>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1653cc]/10 text-[10px] font-bold text-[#1653cc]">
            {guest ? <span className="text-[#737685]">?</span> : initials}
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="truncate text-sm font-semibold text-[#181b25]">
              {guest ? `Guest — ${t.customer.email ?? "unknown"}` : (t.customer.name ?? t.customer.email ?? "—")}
            </span>
            <span className="text-[10px] text-[#5b5e68]">
              {guest ? "No account associated" : (t.customer.email ?? "")}
            </span>
          </div>
        </div>
      </td>
      <td className="max-w-xs px-6 py-4">
        <Link to={`/admin/support/tickets/${t.id}`} className="line-clamp-2 text-sm text-[#181b25] hover:text-[#1653cc]">
          {t.subject}
        </Link>
      </td>
      <td className="px-6 py-4">
        {t.productContext?.productTitle ? (
          <span className="text-xs font-medium text-[#5b5e68]">{t.productContext.productTitle}</span>
        ) : (
          <span className="text-xs italic text-[#737685]">Not linked</span>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(t.status)}`} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1653cc]">
            {t.status.replace(/_/g, " ")}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 text-xs text-[#5b5e68]">{relativeShort(t.createdAt)}</td>
      <td className="px-6 py-4 text-right">
        <Link to={`/admin/support/tickets/${t.id}`} className="inline-flex p-1 text-[#737685] hover:text-[#1653cc]">
          <MoreVertical className="h-[18px] w-[18px]" aria-label="Open ticket" />
        </Link>
      </td>
    </tr>
  );
};

const ComplaintRow = ({ t }: { t: SupportTicketListItem }) => {
  const atRisk =
    t.slaBreached ||
    (t.slaSecondsRemaining != null && t.slaSecondsRemaining > 0 && t.slaSecondsRemaining <= 3600);
  return (
    <tr className={`h-11 transition-colors hover:bg-[#e6e7f6] ${atRisk ? "border-l-4 border-l-[#ba1a1a]" : ""}`}>
      <td className="px-6 py-2 font-mono text-[0.75rem] font-medium tracking-tight text-[#1653cc]">
        <Link to={`/admin/support/tickets/${t.id}`} className="hover:underline">
          {t.id.slice(0, 8).toUpperCase()}
        </Link>
      </td>
      <td className="px-4 py-2 text-sm font-medium text-[#181b25]">{t.customer.name ?? t.customer.email ?? "—"}</td>
      <td className="px-4 py-2">
        <span className="flex w-fit items-center rounded border border-[#ba1a1a]/30 bg-[#ffdad6]/30 px-2 py-0.5 text-[10px] font-bold text-[#ba1a1a]">
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#ba1a1a]" />
          {humanizeSupportType(t.supportType)}
        </span>
      </td>
      <td className="px-4 py-2 font-mono text-[0.75rem] text-[#737685]">{t.order?.orderNumber ?? "—"}</td>
      <td className="px-4 py-2 text-center">
        <span className="text-[10px] font-bold uppercase tracking-tighter text-[#ba1a1a]">{t.priority}</span>
      </td>
      <td className="px-4 py-2 text-center">
        <span className="rounded-full border border-[#c3c6d6] px-2 py-0.5 text-[10px] font-bold text-[#737685]">
          {t.status.replace(/_/g, " ")}
        </span>
      </td>
      <td className="px-4 py-2 text-[0.75rem] text-[#737685]">{relativeShort(t.createdAt)}</td>
      <td className="px-6 py-2 text-right">
        <div className="flex justify-end gap-2 text-xs font-semibold">
          <Link to={`/admin/support/tickets/${t.id}`} className="text-[#1653cc] hover:underline">
            View
          </Link>
          <span className="text-[#c3c6d6]">|</span>
          <span className="cursor-default text-[#737685]" title="Escalation is managed from ticket detail">
            Escalate
          </span>
        </div>
      </td>
    </tr>
  );
};
