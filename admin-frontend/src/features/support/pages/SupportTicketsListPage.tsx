import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  CheckCircle2,
  DraftingCompass,
  Eye,
  Inbox,
  UserPlus
} from "lucide-react";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { PageHeader } from "@/components/primitives/PageHeader";
import {
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
  bulkAssignSupportTickets,
  bulkStatusSupportTickets,
  getSupportReports,
  listSupportTickets,
  type SupportTicketListItem
} from "@/features/support/api/admin-support.api";
import {
  countByPriority,
  countByStatus,
  formatSlaCountdown,
  formatTicketNumber,
  priorityChipClass,
  priorityDotClass,
  totalTickets
} from "@/features/support/lib/supportPresentation";

const STATUSES = ["", "OPEN", "IN_PROGRESS", "PENDING_CUSTOMER", "CLOSED"] as const;
const PRIORITIES = ["", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const ASSIGNMENTS = ["any", "unassigned", "me"] as const;

const SlaDueCell = ({ t }: { t: SupportTicketListItem }) => {
  if (t.status === "CLOSED") {
    return (
      <span className={`text-xs font-semibold ${t.slaMet ? "text-[#006b2d]" : "text-[#60626c]"}`}>
        {t.slaMet ? "Met (closed)" : "Closed"}
      </span>
    );
  }
  if (t.firstAdminReplyAt) {
    return <span className="text-xs font-bold text-[#006b2d]">Responded</span>;
  }
  if (t.slaBreached) {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-[#ba1a1a]">
        <AlarmClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Breached ({formatSlaCountdown(t.slaSecondsRemaining)})
      </span>
    );
  }
  if (t.slaSecondsRemaining === null) {
    return <span className="text-xs text-[#60626c]">—</span>;
  }
  return (
    <span className="text-xs font-bold text-amber-600">{formatSlaCountdown(t.slaSecondsRemaining)} left</span>
  );
};

export const SupportTicketsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actor = useAdminAuthStore((s) => s.actor);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [ticketDraft, setTicketDraft] = useState("");
  const [subjectDraft, setSubjectDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignment, setAssignment] = useState<(typeof ASSIGNMENTS)[number]>("any");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkCloseDialogOpen, setBulkCloseDialogOpen] = useState(false);

  const queryKey = useMemo(
    () => ["admin-support-tickets", page, appliedSearch, status, priority, assignment] as const,
    [page, appliedSearch, status, priority, assignment]
  );

  const ticketsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listSupportTickets(accessToken, {
        page,
        page_size: 20,
        ...(appliedSearch.trim() ? { q: appliedSearch.trim() } : {}),
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(assignment !== "any" ? { assignment } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const reportsQuery = useQuery({
    queryKey: ["admin-support-reports", "tickets-list-kpis", "weekly"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getSupportReports(accessToken, "weekly");
    },
    enabled: Boolean(accessToken)
  });

  const bulkAssignMut = useMutation({
    mutationFn: async (assignedToAdminUserId: string | null) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return bulkAssignSupportTickets(accessToken, {
        ticketIds: [...selected],
        assignedToAdminUserId
      });
    },
    onSuccess: () => {
      setSelected(new Set());
      setAssignModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-support-reports"] });
    }
  });

  const bulkCloseMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return bulkStatusSupportTickets(accessToken, {
        ticketIds: [...selected],
        status: "CLOSED"
      });
    },
    onSuccess: () => {
      setSelected(new Set());
      setBulkCloseDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-support-reports"] });
    }
  });

  const items = ticketsQuery.data?.data.items ?? [];
  const meta = ticketsQuery.data?.meta;
  const rep = reportsQuery.data?.data;

  const applyFilters = () => {
    setPage(1);
    const parts = [ticketDraft.trim(), subjectDraft.trim()].filter(Boolean);
    setAppliedSearch(parts.join(" "));
  };

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

  const toggleAllOnPage = () => {
    if (items.length === 0) {
      return;
    }
    const allSelected = items.every((t) => selected.has(t.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        items.forEach((t) => next.delete(t.id));
      } else {
        items.forEach((t) => next.add(t.id));
      }
      return next;
    });
  };

  const errorMessage =
    ticketsQuery.error instanceof ApiError
      ? ticketsQuery.error.message
      : ticketsQuery.error instanceof Error
        ? ticketsQuery.error.message
        : null;

  const urgentCount = rep ? countByPriority(rep.byPriority, "URGENT") : null;
  const closedTotal = rep ? countByStatus(rep.byStatus, "CLOSED") : null;
  const allTotal = rep ? totalTickets(rep.byStatus) : null;

  const start = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const end = meta ? Math.min(meta.page * meta.limit, meta.totalItems) : 0;

  return (
    <StitchPageBody>
      <PageHeader
        title="Support tickets"
        titleSize="deck"
        description="Operational queue — search, filter by status and priority, and open tickets for full context."
        autoBreadcrumbs
        actionMenuItems={[
          {
            id: "refresh-support-lists",
            label: "Refresh data",
            onSelect: () => {
              void queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
              void queryClient.invalidateQueries({ queryKey: ["admin-support-reports"] });
            }
          }
        ]}
      />

      <SupportWorkspaceNav />

      <ConfirmDialog
        open={bulkCloseDialogOpen}
        title="Close selected tickets?"
        body={`This will set ${selected.size} ticket(s) to closed. Customers will see tickets as resolved where applicable.`}
        confirmLabel="Close tickets"
        cancelLabel="Cancel"
        danger
        confirmDisabled={bulkCloseMut.isPending}
        onClose={() => setBulkCloseDialogOpen(false)}
        onConfirm={() => bulkCloseMut.mutate()}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="group relative flex h-24 flex-col justify-between overflow-hidden border-l-4 border-[#1653cc] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#5b5e68]">Open tickets</span>
            <DraftingCompass
              className="absolute -bottom-2 -right-2 h-10 w-10 text-[#1653cc]/20 transition-transform group-hover:scale-110"
              aria-hidden
            />
          </div>
          <div className="font-headline text-2xl font-bold text-[#181b25]">{rep?.openCount ?? "—"}</div>
        </div>
        <div className="group relative flex h-24 flex-col justify-between overflow-hidden border-l-4 border-[#ba1a1a] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#5b5e68]">Urgent priority</span>
            <Inbox
              className="absolute -bottom-2 -right-2 h-10 w-10 text-[#ba1a1a]/20 transition-transform group-hover:scale-110"
              aria-hidden
            />
          </div>
          <div className="font-headline text-2xl font-bold text-[#181b25]">{urgentCount ?? "—"}</div>
        </div>
        <div className="group relative flex h-24 flex-col justify-between overflow-hidden border-l-4 border-amber-500 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#5b5e68]">SLA attention</span>
            <AlarmClock
              className="absolute -bottom-2 -right-2 h-10 w-10 text-amber-500/25 transition-transform group-hover:scale-110"
              aria-hidden
            />
          </div>
          <div className="font-headline text-2xl font-bold text-[#181b25]">
            {rep?.openSlaBreachedCount ?? "—"}
            {rep?.openSlaSampleCapped ? (
              <span className="ml-2 text-[10px] font-medium normal-case text-amber-700">(sample cap)</span>
            ) : (
              <span className="ml-2 text-xs font-medium normal-case text-[#60626c]">open breaches</span>
            )}
          </div>
        </div>
        <div className="group relative flex h-24 flex-col justify-between overflow-hidden border-l-4 border-[#006b2d] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#5b5e68]">Closed (all time)</span>
            <CheckCircle2
              className="absolute -bottom-2 -right-2 h-10 w-10 text-[#006b2d]/20 transition-transform group-hover:scale-110"
              aria-hidden
            />
          </div>
          <div className="font-headline text-2xl font-bold text-[#181b25]">{closedTotal ?? "—"}</div>
          {allTotal != null ? (
            <p className="text-[10px] text-[#60626c]">of {allTotal} total tickets</p>
          ) : null}
        </div>
      </div>

      <StitchFilterPanel className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-7 lg:items-end">
          <div>
            <StitchFieldLabel>Ticket # / ID</StitchFieldLabel>
            <input
              value={ticketDraft}
              onChange={(e) => setTicketDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyFilters();
                }
              }}
              placeholder="Search id fragment…"
              className={stitchInputClass}
            />
          </div>
          <div className="md:col-span-2">
            <StitchFieldLabel>Subject keyword</StitchFieldLabel>
            <input
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyFilters();
                }
              }}
              placeholder="Search subject or body…"
              className={stitchInputClass}
            />
          </div>
          <div>
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
                  {s ? s.replace(/_/g, " ") : "All statuses"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <StitchFieldLabel>Priority</StitchFieldLabel>
            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
              className={stitchSelectClass}
            >
              {PRIORITIES.map((p) => (
                <option key={p || "all"} value={p}>
                  {p || "All priority"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <StitchFieldLabel>Assigned to</StitchFieldLabel>
            <select
              value={assignment}
              onChange={(e) => {
                setAssignment(e.target.value as (typeof ASSIGNMENTS)[number]);
                setPage(1);
              }}
              className={stitchSelectClass}
            >
              <option value="any">Any agent</option>
              <option value="unassigned">Unassigned</option>
              <option value="me">Me</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={applyFilters}
              className="w-full rounded-lg bg-[#0f1117] px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-black"
            >
              Apply filters
            </button>
          </div>
        </div>
      </StitchFilterPanel>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {assignModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-headline text-lg font-bold text-[#181b25]">Assign selected tickets</h3>
            <p className="mt-1 text-sm text-[#60626c]">{selected.size} ticket(s) selected.</p>
            <label className="mt-4 block text-xs font-semibold text-[#60626c]">Assignee user ID</label>
            <input
              value={bulkAssigneeId}
              onChange={(e) => setBulkAssigneeId(e.target.value)}
              placeholder={actor?.id ?? "User ID"}
              className="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 font-mono text-sm"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-[#1653cc] px-3 py-2 text-sm font-semibold text-white"
                disabled={!actor?.id || bulkAssignMut.isPending}
                onClick={() => {
                  if (actor?.id) {
                    bulkAssignMut.mutate(actor.id);
                  }
                }}
              >
                Assign to me
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm font-semibold"
                disabled={bulkAssignMut.isPending || !bulkAssigneeId.trim()}
                onClick={() => bulkAssignMut.mutate(bulkAssigneeId.trim())}
              >
                Assign to user
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-[#60626c]"
                onClick={() => setAssignModalOpen(false)}
              >
                Cancel
              </button>
            </div>
            {bulkAssignMut.isError ? (
              <p className="mt-2 text-sm text-red-700">
                {bulkAssignMut.error instanceof ApiError
                  ? bulkAssignMut.error.message
                  : "Bulk assign failed."}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-t-xl border border-b-0 border-[#e0e2f0]/60 bg-[#ecedfb] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-[#60626c]">
              {selected.size} selected
            </span>
            <button
              type="button"
              disabled={selected.size === 0 || bulkAssignMut.isPending}
              onClick={() => {
                setBulkAssigneeId(actor?.id ?? "");
                setAssignModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded bg-white px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-[#181b25] shadow-sm disabled:opacity-40"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Assign selected
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || bulkCloseMut.isPending}
              onClick={() => setBulkCloseDialogOpen(true)}
              className="flex items-center gap-1.5 rounded bg-white px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-[#181b25] shadow-sm disabled:opacity-40"
            >
              Close selected
            </button>
          </div>
          {meta ? (
            <div className="flex items-center gap-2 text-xs text-[#5b5e68]">
              <span>
                Showing {start}-{end} of {meta.totalItems}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded bg-white p-1.5 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Previous page"
                >
                  ‹
                </button>
                <button
                  type="button"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded bg-white p-1.5 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {ticketsQuery.isLoading ? (
        <div className="rounded-b-xl border border-t-0 border-[#e0e2f0] bg-white p-8 text-center text-sm text-[#60626c]">
          Loading tickets…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-b-xl border border-[#e0e2f0] bg-white shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-[#c3c6d6]/20 bg-white">
              <tr>
                <th className="w-10 p-4">
                  <input
                    type="checkbox"
                    className="rounded-sm border-slate-300"
                    checked={items.length > 0 && items.every((t) => selected.has(t.id))}
                    onChange={toggleAllOnPage}
                    aria-label="Select all on page"
                  />
                </th>
                {["Ticket #", "Subject", "Customer", "Priority", "Status", "SLA due", "Actions"].map((h) => (
                  <th
                    key={h}
                    className={`p-4 text-left text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-[#5b5e68] ${h === "Actions" ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d6]/10">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-sm text-[#60626c]">
                    No tickets match filters.
                  </td>
                </tr>
              ) : (
                items.map((t) => (
                  <tr key={t.id} className="group transition-colors hover:bg-[#f2f3ff]">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        className="rounded-sm border-slate-300"
                        checked={selected.has(t.id)}
                        onChange={() => toggleRow(t.id)}
                        aria-label={`Select ${t.subject}`}
                      />
                    </td>
                    <td className="p-4">
                      <Link
                        to={`/admin/support/tickets/${t.id}`}
                        className="font-mono text-sm font-medium text-[#1653cc] hover:underline"
                      >
                        {formatTicketNumber(t.id)}
                      </Link>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-0.5">
                        <Link
                          to={`/admin/support/tickets/${t.id}`}
                          className="text-sm font-semibold text-[#181b25] hover:text-[#1653cc]"
                        >
                          {t.subject}
                        </Link>
                        {t.summary ? (
                          <span className="line-clamp-2 text-xs text-[#5b5e68]">{t.summary}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-[#181b25]">{t.customer.name ?? t.customer.email ?? "—"}</td>
                    <td className="p-4">
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-full border border-[#c3c6d6]/30 px-2 py-0.5 text-[10px] font-bold uppercase ${priorityChipClass(t.priority)}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${priorityDotClass(t.priority)}`} />
                        {t.priority}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center rounded border border-[#c3c6d6]/30 px-2 py-0.5 text-[10px] font-bold uppercase text-[#434654]">
                        {t.status.replace(/_/g, " ")}
                      </div>
                    </td>
                    <td className="p-4">
                      <SlaDueCell t={t} />
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <Link
                          to={`/admin/support/tickets/${t.id}`}
                          className="text-[#5b5e68] hover:text-[#1653cc]"
                          aria-label="View ticket"
                        >
                          <Eye className="h-5 w-5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#60626c]">
          <span>
            Page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </StitchPageBody>
  );
};
