import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Bold,
  CheckCircle2,
  CircleUser,
  Italic,
  Link2,
  Lock,
  Package,
  Paperclip,
  Send,
  Share2,
  ShoppingCart,
  Timer,
  Undo2,
  XCircle
} from "lucide-react";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { PageHeader } from "@/components/primitives/PageHeader";
import { StitchBreadcrumbs, StitchPageBody } from "@/components/stitch";
import { SupportWorkspaceNav } from "@/features/support/components/SupportWorkspaceNav";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  addSupportTicketInternalNote,
  ApiError,
  assignSupportTicket,
  getSupportTicketDetail,
  recordSupportTicketCsat,
  replySupportTicket,
  updateSupportTicketStatus,
  type SupportTicketAttachment,
  type SupportTicketStatus
} from "@/features/support/api/admin-support.api";
import {
  formatSlaCountdown,
  formatTicketNumber,
  humanizeSupportType
} from "@/features/support/lib/supportPresentation";

const TICKET_STATUSES: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "PENDING_CUSTOMER", "CLOSED"];

type ThreadFilter = "all" | "internal";

type FeedItem =
  | {
      kind: "message";
      id: string;
      createdAt: string;
      authorType: string;
      body: string;
      attachments: SupportTicketAttachment[];
    }
  | { kind: "internal"; id: string; createdAt: string; note: string };

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const isCustomerAuthor = (authorType: string) => authorType.toUpperCase().includes("CUSTOMER");

const safeAttachmentUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
};

export const SupportTicketDetailPage = () => {
  const { ticketId = "" } = useParams<{ ticketId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [replyBody, setReplyBody] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [statusPick, setStatusPick] = useState<SupportTicketStatus>("IN_PROGRESS");
  const [statusNote, setStatusNote] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>("all");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [csatPick, setCsatPick] = useState(5);

  const detailQuery = useQuery({
    queryKey: ["admin-support-ticket", ticketId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getSupportTicketDetail(accessToken, ticketId);
    },
    enabled: Boolean(accessToken) && Boolean(ticketId)
  });

  const e = detailQuery.data?.data.entity;

  useEffect(() => {
    if (!e || e.status === "CLOSED" || e.firstAdminReplyAt) {
      return;
    }
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [e?.id, e?.status, e?.firstAdminReplyAt]);

  useEffect(() => {
    if (e?.status && TICKET_STATUSES.includes(e.status as SupportTicketStatus)) {
      setStatusPick(e.status as SupportTicketStatus);
    }
  }, [e?.status]);

  useEffect(() => {
    if (!e) {
      return;
    }
    setAssigneeId(e.assignee?.id ?? "");
  }, [e?.assignee?.id, e?.id]);

  useEffect(() => {
    if (e?.csatScore != null && e.csatScore >= 1 && e.csatScore <= 5) {
      setCsatPick(e.csatScore);
    } else {
      setCsatPick(5);
    }
  }, [e?.csatScore, e?.id]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-support-ticket", ticketId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
  };

  const replyMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return replySupportTicket(accessToken, ticketId, { body: replyBody.trim() });
    },
    onSuccess: () => {
      setReplyBody("");
      setMsg({ type: "ok", text: "Reply sent to customer." });
      invalidate();
    },
    onError: (err: unknown) => {
      setMsg({ type: "err", text: err instanceof ApiError ? err.message : "Reply failed." });
    }
  });

  const noteMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return addSupportTicketInternalNote(accessToken, ticketId, { note: internalNote.trim() });
    },
    onSuccess: () => {
      setInternalNote("");
      setMsg({ type: "ok", text: "Internal note added." });
      invalidate();
    },
    onError: (err: unknown) => {
      setMsg({ type: "err", text: err instanceof ApiError ? err.message : "Note failed." });
    }
  });

  const assignMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const t = assigneeId.trim();
      return assignSupportTicket(accessToken, ticketId, {
        assignedToAdminUserId: t ? t : null
      });
    },
    onSuccess: () => {
      setMsg({ type: "ok", text: "Assignment updated." });
      invalidate();
    },
    onError: (err: unknown) => {
      setMsg({ type: "err", text: err instanceof ApiError ? err.message : "Assign failed." });
    }
  });

  const csatMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return recordSupportTicketCsat(accessToken, ticketId, { csatScore: csatPick });
    },
    onSuccess: () => {
      setMsg({ type: "ok", text: "CSAT score saved." });
      invalidate();
    },
    onError: (err: unknown) => {
      setMsg({ type: "err", text: err instanceof ApiError ? err.message : "Could not save CSAT." });
    }
  });

  const statusMut = useMutation({
    mutationFn: (next: SupportTicketStatus) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return updateSupportTicketStatus(accessToken, ticketId, {
        status: next,
        ...(statusNote.trim() ? { note: statusNote.trim() } : {})
      });
    },
    onSuccess: (_, next) => {
      setStatusPick(next);
      setStatusNote("");
      setMsg({ type: "ok", text: "Ticket status updated." });
      invalidate();
    },
    onError: (err: unknown) => {
      setMsg({ type: "err", text: err instanceof ApiError ? err.message : "Status update failed." });
    }
  });

  const feedItems: FeedItem[] = useMemo(() => {
    if (!e) {
      return [];
    }
    const messages: FeedItem[] = e.messages.map((m) => ({
      kind: "message",
      id: m.id,
      createdAt: m.createdAt,
      authorType: m.authorType,
      body: m.body,
      attachments: e.attachments.filter((a) => a.messageId === m.id)
    }));
    const notes: FeedItem[] = e.internalNotes.map((n) => ({
      kind: "internal",
      id: n.id,
      createdAt: n.createdAt,
      note: n.note
    }));
    return [...messages, ...notes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [e]);

  const visibleFeed = useMemo(() => {
    if (threadFilter === "internal") {
      return feedItems.filter((i) => i.kind === "internal");
    }
    return feedItems;
  }, [feedItems, threadFilter]);

  const errorMessage =
    detailQuery.error instanceof ApiError
      ? detailQuery.error.message
      : detailQuery.error instanceof Error
        ? detailQuery.error.message
        : null;

  const customerName = e?.customer.name ?? e?.customer.email ?? "Customer";
  const customerSub = e?.customer.id
    ? "Registered customer"
    : e?.customer.email
      ? "Guest — no account linked"
      : "—";

  const slaLive = useMemo(() => {
    if (!e || e.firstAdminReplyAt || e.status === "CLOSED") {
      return null;
    }
    const due = new Date(e.slaDueAt).getTime();
    const sec = Math.round((due - nowTick) / 1000);
    const created = new Date(e.createdAt).getTime();
    const totalMs = Math.max(1, due - created);
    const remainingMs = due - nowTick;
    const pct = Math.min(100, Math.max(0, (remainingMs / totalMs) * 100));
    return { sec, breached: sec < 0, pct };
  }, [e, nowTick]);

  const copyPermalink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMsg({ type: "ok", text: "Link copied to clipboard." });
    } catch {
      setMsg({ type: "err", text: "Could not copy link." });
    }
  };

  return (
    <StitchPageBody>
      <SupportWorkspaceNav />

      <ConfirmDialog
        open={archiveDialogOpen}
        title="Archive this thread?"
        body="Archiving closes the ticket. Customers will see it as resolved where applicable."
        confirmLabel="Archive and close"
        cancelLabel="Cancel"
        danger
        confirmDisabled={statusMut.isPending}
        onClose={() => setArchiveDialogOpen(false)}
        onConfirm={() => {
          setArchiveDialogOpen(false);
          statusMut.mutate("CLOSED");
        }}
      />

      {e ? (
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-3">
              <span className="rounded bg-[#3b6de6] px-2 py-0.5 text-[10px] font-bold text-white">TICKET</span>
              <span className="font-mono text-sm font-medium text-[#5b5e68]">{formatTicketNumber(e.id)}</span>
            </div>
            <h1 className="font-headline text-2xl font-bold tracking-tight text-[#181b25]">{e.subject}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void copyPermalink()}
              className="flex items-center gap-2 rounded-lg border border-[#c3c6d6] bg-white px-4 py-2 text-sm font-semibold text-[#434654] transition-colors hover:bg-[#ecedfb]"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              Share
            </button>
            <button
              type="button"
              disabled={statusMut.isPending || !e.allowedActions.canUpdateStatus || e.status === "CLOSED"}
              onClick={() => statusMut.mutate("CLOSED")}
              className="flex items-center gap-2 rounded-lg bg-[#ba1a1a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ba1a1a]/90 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" aria-hidden />
              Close Ticket
            </button>
          </div>
        </div>
      ) : (
        <PageHeader
          title="Ticket"
          description="Loading ticket…"
          breadcrumbItems={[{ label: "SUPPORT", to: "/admin/support/tickets" }, { label: "DETAIL" }]}
          meta={
            <Link to="/admin/support/tickets" className="text-sm font-semibold text-[#1653cc] hover:underline">
              ← All tickets
            </Link>
          }
        />
      )}

      {e ? (
        <StitchBreadcrumbs
          items={[
            { label: "Support", to: "/admin/support/tickets" },
            { label: (e.subject ?? ticketId).slice(0, 56) }
          ]}
        />
      ) : null}

      {!ticketId ? <p className="text-sm text-red-700">Missing ticket id.</p> : null}
      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}
      {msg ? (
        <div
          className={
            msg.type === "ok"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          }
        >
          {msg.text}
        </div>
      ) : null}

      {detailQuery.isLoading ? (
        <p className="text-sm text-[#60626c]">Loading…</p>
      ) : e ? (
        <div className="grid grid-cols-12 items-start gap-6">
          <div className="col-span-12 flex flex-col gap-6 lg:col-span-7">
            <div className="flex max-h-[min(700px,72vh)] flex-col overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e0e2f0] bg-[#f2f3ff] p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm font-semibold uppercase tracking-wider text-[#5b5e68]">
                    Conversation Thread
                  </span>
                  <div className="flex items-center rounded-full border border-[#c3c6d6] bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setThreadFilter("all")}
                      className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                        threadFilter === "all" ? "bg-[#1653cc] text-white" : "text-[#5b5e68] hover:bg-[#e0e2f0]"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setThreadFilter("internal")}
                      className={`flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold ${
                        threadFilter === "internal"
                          ? "bg-[#1653cc] text-white"
                          : "text-[#5b5e68] hover:bg-[#e0e2f0]"
                      }`}
                    >
                      Internal
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                    </button>
                  </div>
                </div>
                <span className="font-mono text-xs text-[#5b5e68]">{formatWhen(new Date().toISOString())}</span>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                {visibleFeed.length === 0 ? (
                  <p className="text-center text-sm text-[#60626c]">No messages in this view.</p>
                ) : (
                  visibleFeed.map((item) => {
                    if (item.kind === "internal") {
                      return (
                        <div key={item.id} className="flex w-full justify-start px-2">
                          <div className="flex w-full gap-3 rounded-lg border border-amber-200/50 bg-amber-50/60 p-3">
                            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-tight text-amber-900">
                                  Internal note
                                </span>
                                <span className="font-mono text-[10px] text-amber-800/70">
                                  {formatWhen(item.createdAt)}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap text-xs italic text-amber-950/90">{item.note}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const customer = isCustomerAuthor(item.authorType);
                    return (
                      <div key={item.id} className={`flex ${customer ? "justify-end" : "justify-start"}`}>
                        <div className={`flex max-w-[80%] flex-col ${customer ? "items-end" : "items-start"}`}>
                          <div
                            className={
                              customer
                                ? "rounded-2xl rounded-tr-none bg-[#3b6de6] px-5 py-3 text-sm leading-relaxed text-white shadow-sm"
                                : "rounded-2xl rounded-tl-none border border-[#e0e2f0] bg-[#e0e2f0] px-5 py-3 text-sm leading-relaxed text-[#181b25]"
                            }
                          >
                            <p className="whitespace-pre-wrap">{item.body}</p>
                            {item.attachments.length > 0 ? (
                              <ul
                                className={`mt-2 space-y-1 border-t pt-2 text-xs ${
                                  customer ? "border-white/30" : "border-black/10"
                                }`}
                              >
                                {item.attachments.map((a) => {
                                  const href = safeAttachmentUrl(a.url);
                                  return (
                                    <li key={a.id}>
                                      {href ? (
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline ${
                                            customer ? "text-white/95" : "text-[#1653cc]"
                                          }`}
                                        >
                                          <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                          {a.originalFilename ?? "Attachment"}
                                        </a>
                                      ) : (
                                        <span
                                          className={`inline-flex items-center gap-1 font-semibold ${
                                            customer ? "text-white/80" : "text-[#5b5e68]"
                                          }`}
                                        >
                                          <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                          {a.originalFilename ?? "Attachment"}
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : null}
                          </div>
                          <span className="mt-1 text-[10px] font-medium text-[#5b5e68]">
                            {customer ? customerName : "Support"} · {formatWhen(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {e.allowedActions.canReply ? (
                <div className="border-t border-[#e0e2f0] bg-white p-4">
                  <div className="mb-2 flex flex-wrap gap-1 border-b border-[#e0e2f0]/80 pb-2">
                    {(
                      [
                        [Bold, "Bold"],
                        [Italic, "Italic"],
                        [Link2, "Link"],
                        [Paperclip, "Attach"]
                      ] as const
                    ).map(([Icon, label]) => (
                      <button
                        key={label}
                        type="button"
                        disabled
                        title="Rich formatting and attachments from the composer are not enabled yet."
                        className="rounded p-1.5 text-[#5b5e68] opacity-40"
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        <span className="sr-only">{label}</span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={replyBody}
                    onChange={(ev) => setReplyBody(ev.target.value)}
                    rows={3}
                    placeholder="Type your response to the customer…"
                    className="w-full resize-none border-0 bg-transparent text-sm outline-none placeholder:text-[#9ca3af]"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={replyMut.isPending || !replyBody.trim()}
                      onClick={() => replyMut.mutate()}
                      className="flex items-center gap-2 rounded-lg bg-[#1653cc] px-6 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-[#1653cc]/90 active:scale-[0.98] disabled:opacity-50"
                    >
                      Send Response
                      <Send className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-[#e0e2f0] bg-white p-4 text-xs text-[#60626c]">
                  Replies are disabled for this ticket state or your role.
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 hidden flex-col items-center gap-8 pt-4 lg:col-span-1 lg:flex">
            {e.order ? (
              <>
                <Link
                  to={`/admin/orders/${e.order.id}`}
                  className="flex flex-col items-center gap-1 text-center group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c3c6d6] bg-white text-[#1653cc] transition-colors group-hover:bg-[#1653cc] group-hover:text-white">
                    <ShoppingCart className="h-5 w-5" aria-hidden />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-tighter text-[#5b5e68]">Order</span>
                  <span className="font-mono text-[10px] font-medium text-[#181b25]">{e.order.orderNumber}</span>
                </Link>
                <div className="h-8 w-px bg-[#c3c6d6]/40" />
              </>
            ) : null}
            {e.customer.id ? (
              <Link
                to={`/admin/customers/${e.customer.id}`}
                className="flex flex-col items-center gap-1 text-center group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c3c6d6] bg-white text-[#1653cc] transition-colors group-hover:bg-[#1653cc] group-hover:text-white">
                  <CircleUser className="h-5 w-5" aria-hidden />
                </div>
                  <span className="text-[9px] font-bold uppercase tracking-tighter text-[#5b5e68]">User</span>
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-1 opacity-40">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c3c6d6] bg-white text-[#5b5e68]">
                  <CircleUser className="h-5 w-5" aria-hidden />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-tighter text-[#5b5e68]">Guest</span>
              </div>
            )}
            <div className="h-8 w-px bg-[#c3c6d6]/40" />
            <div className="flex flex-col items-center gap-1 opacity-30">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c3c6d6] bg-white text-[#5b5e68]">
                <Undo2 className="h-5 w-5" aria-hidden />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-tighter text-[#5b5e68]">Return</span>
            </div>
          </div>

          <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
            <div
              className={`rounded-xl border-l-4 bg-white p-6 shadow-sm ${
                e.priority === "URGENT" ? "border-[#ba1a1a]" : "border-[#1653cc]"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#5b5e68]">SLA / Response</span>
                <span className="rounded bg-[#ffdad6] px-2 py-0.5 text-[10px] font-bold text-[#ba1a1a]">
                  {e.priority}
                </span>
              </div>
              <div
                className={`flex items-center gap-2 font-mono font-bold text-[#181b25] ${
                  slaLive && e.status !== "CLOSED" && !e.firstAdminReplyAt ? "text-3xl" : "text-xl"
                }`}
              >
                <Timer className={`h-7 w-7 shrink-0 ${e.priority === "URGENT" ? "text-[#ba1a1a]" : "text-[#1653cc]"}`} />
                {e.firstAdminReplyAt ? (
                  <span className="text-[#006b2d]">First response met</span>
                ) : e.status === "CLOSED" ? (
                  <span className="text-[#60626c]">Closed</span>
                ) : slaLive?.breached ? (
                  <span className="text-[#ba1a1a]">Breached · {formatSlaCountdown(slaLive.sec)}</span>
                ) : slaLive ? (
                  <span className="text-amber-700">{formatSlaCountdown(slaLive.sec)} left</span>
                ) : (
                  <span>—</span>
                )}
              </div>
              <p className="mt-2 font-mono text-[10px] text-[#60626c]">Due {formatWhen(e.slaDueAt)}</p>
              <p className="mt-3 text-xs text-[#60626c]">
                First-response SLA from ticket creation ({e.priority} priority). Timer updates every second until an
                admin replies or the ticket closes.
              </p>
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[#e0e2f0]">
                <div
                  className={`h-full transition-all ${slaLive?.breached ? "bg-[#ba1a1a]" : "bg-[#1653cc]"}`}
                  style={{
                    width: e.firstAdminReplyAt || e.status === "CLOSED" ? "100%" : `${slaLive?.pct ?? 0}%`
                  }}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e0e2f0] p-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#5b5e68]">Ticket Metadata</h3>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-medium text-[#5b5e68]">Status</span>
                  <select
                    value={statusPick}
                    onChange={(ev) => setStatusPick(ev.target.value as SupportTicketStatus)}
                    disabled={!e.allowedActions.canUpdateStatus}
                    className="w-full rounded-lg border border-[#e0e2f0] px-3 py-2 text-sm disabled:opacity-50 sm:max-w-[200px]"
                  >
                    {TICKET_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-medium text-[#5b5e68]">Priority</span>
                  <span className="text-xs font-semibold uppercase text-[#181b25]">{e.priority}</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-medium text-[#5b5e68]">Category</span>
                  <span className="text-xs font-semibold text-[#181b25]">{humanizeSupportType(e.supportType)}</span>
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-medium text-[#5b5e68]">Assigned to</span>
                  <p className="text-sm text-[#181b25]">{e.assignee?.email ?? "Unassigned"}</p>
                  <details className="rounded-lg border border-dashed border-[#c3c6d6] bg-[#f8f9fb] p-3 text-xs">
                    <summary className="cursor-pointer font-semibold text-[#434654]">Set assignee by user ID</summary>
                    <input
                      value={assigneeId}
                      onChange={(ev) => setAssigneeId(ev.target.value)}
                      placeholder="User ID, or leave empty to unassign"
                      className="mt-2 w-full rounded border border-[#e0e2f0] px-2 py-1.5 font-mono text-[11px] disabled:opacity-50"
                      disabled={!e.allowedActions.canAssign}
                    />
                    <button
                      type="button"
                      disabled={assignMut.isPending || !e.allowedActions.canAssign}
                      onClick={() => assignMut.mutate()}
                      className="mt-2 rounded-lg border border-[#c3c6d6] bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {assignMut.isPending ? "Saving…" : "Save assignment"}
                    </button>
                  </details>
                </div>
                <textarea
                  value={statusNote}
                  onChange={(ev) => setStatusNote(ev.target.value)}
                  rows={2}
                  placeholder="Optional note with status change (internal)"
                  className="w-full rounded-lg border border-[#e0e2f0] px-3 py-2 text-sm disabled:opacity-50"
                  disabled={!e.allowedActions.canUpdateStatus}
                />
                <button
                  type="button"
                  disabled={statusMut.isPending || !e.allowedActions.canUpdateStatus}
                  onClick={() => statusMut.mutate(statusPick)}
                  className="w-full rounded-lg border border-[#c3c6d6] bg-white py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {statusMut.isPending ? "Saving…" : "Update status"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-[#e0e2f0] bg-[#f2f3ff] px-5 py-4">
                <div>
                  <p className="text-[9px] font-bold uppercase text-[#5b5e68]">Created</p>
                  <p className="text-xs font-medium text-[#181b25]">{formatWhen(e.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-[#5b5e68]">Last updated</p>
                  <p className="text-xs font-medium text-[#181b25]">{formatWhen(e.updatedAt)}</p>
                </div>
              </div>
            </div>

            {e.status === "CLOSED" ? (
              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="border-b border-[#e0e2f0] p-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#5b5e68]">CSAT (1–5)</h3>
                  <p className="mt-1 text-xs text-[#60626c]">
                    Post-close survey score. Feeds support reports as % satisfaction.
                  </p>
                </div>
                <div className="space-y-3 p-5">
                  {e.csatScore != null ? (
                    <p className="text-sm text-[#181b25]">
                      Last recorded: <strong>{e.csatScore}</strong> / 5
                      {e.csatSubmittedAt ? (
                        <span className="text-[#60626c]"> · {formatWhen(e.csatSubmittedAt)}</span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-sm text-[#60626c]">No score recorded yet for this ticket.</p>
                  )}
                  <label className="block text-xs font-medium text-[#5b5e68]" htmlFor="csat-score">
                    Score
                  </label>
                  <select
                    id="csat-score"
                    value={String(csatPick)}
                    onChange={(ev) => setCsatPick(Number(ev.target.value))}
                    disabled={e.allowedActions.canRecordCsat === false}
                    className="w-full rounded-lg border border-[#e0e2f0] px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={csatMut.isPending || e.allowedActions.canRecordCsat === false}
                    onClick={() => csatMut.mutate()}
                    className="w-full rounded-lg bg-[#1653cc] py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {csatMut.isPending ? "Saving…" : "Save CSAT"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#5b5e68]">Add Internal Note</h4>
              <textarea
                value={internalNote}
                onChange={(ev) => setInternalNote(ev.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[#e0e2f0] px-3 py-2 text-sm disabled:opacity-50"
                disabled={!e.allowedActions.canAddInternalNote}
                placeholder="Visible only to your team"
              />
              <button
                type="button"
                disabled={noteMut.isPending || !internalNote.trim() || !e.allowedActions.canAddInternalNote}
                onClick={() => noteMut.mutate()}
                className="mt-2 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {noteMut.isPending ? "Saving…" : "Add internal note"}
              </button>
            </div>

            <div className="flex items-center gap-5 rounded-xl border border-transparent bg-white p-6 shadow-sm transition-colors hover:border-[#1653cc]/20 hover:shadow-md">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e0e2f0] ring-4 ring-[#ecedfb]">
                <Package className="h-8 w-8 text-[#5b5e68]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-bold text-[#181b25]">{customerName}</h4>
                </div>
                <p className="mb-3 text-xs text-[#5b5e68]">{customerSub}</p>
                <div className="flex gap-2">
                  {e.customer.id ? (
                    <Link
                      to={`/admin/customers/${e.customer.id}`}
                      className="flex-1 rounded bg-[#ecedfb] py-1.5 text-center text-[10px] font-bold uppercase text-[#181b25] transition-colors hover:bg-[#e0e2f0]"
                    >
                      Profile
                    </Link>
                  ) : (
                    <span className="flex-1 rounded bg-[#f8f9fb] py-1.5 text-center text-[10px] font-bold uppercase text-[#9ca3af]">
                      Profile
                    </span>
                  )}
                  <Link
                    to="/admin/support/tickets"
                    className="flex-1 rounded bg-[#ecedfb] py-1.5 text-center text-[10px] font-bold uppercase text-[#181b25] transition-colors hover:bg-[#e0e2f0]"
                  >
                    History
                  </Link>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={statusMut.isPending || !e.allowedActions.canUpdateStatus || e.status === "CLOSED"}
                onClick={() => statusMut.mutate("CLOSED")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00873b] py-3 font-bold text-white shadow-lg shadow-[#00873b]/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                Resolve Ticket
              </button>
              <button
                type="button"
                disabled={statusMut.isPending || !e.allowedActions.canUpdateStatus || e.status === "CLOSED"}
                title="Archiving closes the ticket (same as resolve)."
                onClick={() => setArchiveDialogOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#c3c6d6] bg-white py-3 font-bold text-[#5b5e68] transition-colors hover:bg-[#ecedfb] disabled:opacity-50"
              >
                <Archive className="h-5 w-5" aria-hidden />
                Archive Thread
              </button>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-12">
            <div className="flex justify-end">
              <Link to="/admin/support/tickets" className="text-sm font-semibold text-[#1653cc] hover:underline">
                ← All tickets
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </StitchPageBody>
  );
};
