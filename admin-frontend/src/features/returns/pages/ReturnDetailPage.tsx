import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  approveAdminReturn,
  completeAdminReturn,
  getAdminReturnDetail,
  markReturnReceivedAdmin,
  rejectAdminReturn
} from "@/features/returns/api/admin-returns.api";

const returnRef = (id: string) => `RET-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const formatCreated = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatMoney = (cents: number, cur: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
};

export const ReturnDetailPage = () => {
  const { returnId = "" } = useParams<{ returnId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [rejectNote, setRejectNote] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [internalNoteDraft, setInternalNoteDraft] = useState("");

  const detailQuery = useQuery({
    queryKey: ["admin-return-detail", returnId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminReturnDetail(accessToken, returnId);
    },
    enabled: Boolean(accessToken) && Boolean(returnId)
  });

  const inv = () => queryClient.invalidateQueries({ queryKey: ["admin-return-detail", returnId] });

  const approveMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return approveAdminReturn(accessToken, returnId, { note: actionNote.trim() || undefined });
    },
    onSuccess: inv
  });

  const rejectMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return rejectAdminReturn(accessToken, returnId, { note: rejectNote.trim() || "Rejected" });
    },
    onSuccess: inv
  });

  const receivedMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return markReturnReceivedAdmin(accessToken, returnId, { note: actionNote.trim() || undefined });
    },
    onSuccess: inv
  });

  const completeMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return completeAdminReturn(accessToken, returnId, { note: actionNote.trim() || undefined });
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

  const primaryRefund = e?.refunds[0];
  const status = e?.status ?? "";

  const stepActive = (() => {
    if (status === "REQUESTED") {
      return 0;
    }
    if (status === "APPROVED") {
      return 1;
    }
    if (status === "RECEIVED") {
      return 2;
    }
    if (status === "COMPLETED") {
      return 3;
    }
    return 0;
  })();

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="hidden text-sm text-slate-400 md:flex md:items-center md:gap-2"
            aria-label="Breadcrumb"
          >
            <span>Returns</span>
            <MaterialIcon name="chevron_right" className="text-sm" />
            <span className="border-b-2 border-[#4f7ef8] pb-1 font-semibold text-[#4f7ef8]">
              {e ? returnRef(e.id) : "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/returns" className="text-sm font-semibold text-[#1653cc] hover:underline">
            ← All returns
          </Link>
        </div>
      </div>

      {!returnId ? <p className="text-sm text-red-700">Missing return id.</p> : null}
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

      {detailQuery.isLoading ? (
        <p className="text-sm text-[#737685]">Loading…</p>
      ) : e ? (
        <>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">
                Return <span className="font-mono text-[#1653cc]">#{returnRef(e.id)}</span>
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[#5b5e68]">
                <div className="flex items-center">
                  <MaterialIcon name="link" className="mr-1 text-sm" />
                  Order{" "}
                  <Link className="ml-1 font-mono font-medium text-[#1653cc] hover:underline" to={`/admin/orders/${e.orderId}`}>
                    #{e.orderNumber}
                  </Link>
                </div>
                <span className="text-[#c3c6d6]">|</span>
                <div className="flex items-center">
                  <MaterialIcon name="calendar_today" className="mr-1 text-sm" />
                  Created {formatCreated(e.requestedAt)}
                </div>
                <div className="flex items-center rounded-full border border-[#c3c6d6] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                  <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#006b2d]" />
                  {e.status.replace(/_/g, " ")}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-10">
            <div className="space-y-8 xl:col-span-6">
              <section className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#5b5e68]">Customer profile</h3>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ecedfb] text-sm font-bold text-[#1653cc]">
                    {(e.customer.name ?? e.customer.email ?? "G").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-[#181b25]">
                      {e.customer.name ?? e.customer.email ?? "Guest"}
                    </p>
                    <p className="text-sm text-[#5b5e68]">{e.customer.email ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-[#737685]">Account</span>
                    <p className="text-sm font-semibold text-[#006b2d]">{e.customer.guest ? "Guest" : "Registered"}</p>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="p-6 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#5b5e68]">Return items</h3>
                </div>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#f2f3ff]">
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]">Product</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]">Variant / SKU</th>
                      <th className="px-6 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-[#737685]">Qty</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]">Reason</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(e.items ?? []).map((it) => (
                      <tr key={it.id} className="transition-colors hover:bg-[#f2f3ff]">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-100 bg-[#ecedfb] text-[10px] font-bold text-[#1653cc]">
                              {it.productTitle.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium">{it.productTitle}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-[#60626c]">
                          <span className="text-[#181b25]">{it.sku || it.variantId.slice(0, 8)}</span>
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-sm">{String(it.quantity).padStart(2, "0")}</td>
                        <td className="px-6 py-4">
                          <span className="rounded bg-[#ecedfb] px-2 py-1 text-xs text-[#181b25]">
                            {e.customerReason ?? "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-xs">
                            <span className="mr-2 h-2 w-2 rounded-full bg-[#1653cc]" />
                            {it.status.replace(/_/g, " ")}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <section className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#5b5e68]">Refund settlement</h3>
                  <div className="space-y-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[#5b5e68]">Reference</span>
                      {primaryRefund ? (
                        <Link
                          to={`/admin/refunds/${primaryRefund.id}`}
                          className="font-mono text-sm font-medium text-[#1653cc] hover:underline"
                        >
                          {primaryRefund.id.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#5b5e68]">Total amount</span>
                      <span className="font-mono text-lg font-bold text-[#181b25]">
                        {primaryRefund
                          ? formatMoney(primaryRefund.amountCents, primaryRefund.currency)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#5b5e68]">Status</span>
                      <span className="flex items-center rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-600">
                        <MaterialIcon name="hourglass_empty" className="mr-1 text-sm" />
                        {primaryRefund ? primaryRefund.state.replace(/_/g, " ") : "Pending"}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#5b5e68]">Return timeline</h3>
                  <div className="space-y-5">
                    <div className="relative border-l-2 border-slate-100 pb-2 pl-6">
                      <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-4 border-[#006b2d] bg-white" />
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">Return requested</p>
                        <span className="font-mono text-[10px] text-[#737685]">{formatCreated(e.requestedAt)}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#5b5e68]">Logged when the customer submitted the return.</p>
                    </div>
                    <div className="relative border-l-2 border-slate-100 pl-6">
                      <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-4 border-slate-200 bg-white" />
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${e.approvedAt ? "text-[#181b25]" : "text-slate-400"}`}>
                          {e.rejectedAt ? "Rejected" : e.approvedAt ? "Approved" : "Awaiting approval"}
                        </p>
                        <span className="font-mono text-[10px] text-[#737685]">
                          {e.rejectedAt
                            ? formatCreated(e.rejectedAt)
                            : e.approvedAt
                              ? formatCreated(e.approvedAt)
                              : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="space-y-8 xl:col-span-4">
              <section className="rounded-xl border-l-4 border-[#1653cc] bg-white p-8 shadow-sm">
                <h3 className="mb-8 text-xs font-bold uppercase tracking-widest text-[#5b5e68]">Return progress</h3>
                <div className="relative space-y-8">
                  <div className="absolute bottom-2 left-[15px] top-2 w-0.5 bg-slate-100" />
                  {(
                    [
                      { label: "Requested", sub: "Customer submission", icon: "description" },
                      { label: "Approved", sub: "Warehouse signal", icon: "check_circle" },
                      { label: "Item received", sub: "Physical inspection", icon: "inbox" },
                      { label: "Completed", sub: "Refund disbursed", icon: "done_all" }
                    ] as const
                  ).map((step, i) => {
                    const active = i === stepActive && e.status !== "REJECTED";
                    const past = i < stepActive && e.status !== "REJECTED";
                    const dim = !active && !past;
                    return (
                      <div key={step.label} className={`relative flex items-center gap-4 ${dim ? "opacity-50" : ""}`}>
                        <div
                          className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-white ring-4 ring-[#dbe1ff] ${
                            active || past ? "bg-[#1653cc]" : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          <MaterialIcon name={step.icon} className="text-lg" />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${active ? "text-[#1653cc]" : ""}`}>{step.label}</p>
                          <p className="text-[11px] text-[#5b5e68]">{step.sub}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <label className="mt-8 block text-xs text-[#5b5e68]">
                  Action note (approve / received / complete)
                  <textarea
                    value={actionNote}
                    onChange={(ev) => setActionNote(ev.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>

                <div className="mt-6 space-y-3">
                  {e.status === "REQUESTED" ? (
                    <>
                      <button
                        type="button"
                        disabled={approveMut.isPending}
                        onClick={() => approveMut.mutate()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#006b2d] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        <MaterialIcon name="check_circle" className="text-lg" />
                        Approve return
                      </button>
                      <input
                        value={rejectNote}
                        onChange={(ev) => setRejectNote(ev.target.value)}
                        placeholder="Reject reason (required)"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={rejectMut.isPending || !rejectNote.trim()}
                        onClick={() => rejectMut.mutate()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#ba1a1a] py-3 text-sm font-bold text-[#ba1a1a] transition-colors hover:bg-[#ffdad6] disabled:opacity-50"
                      >
                        <MaterialIcon name="cancel" className="text-lg" />
                        Reject return request
                      </button>
                    </>
                  ) : null}
                  {e.status === "APPROVED" ? (
                    <button
                      type="button"
                      disabled={receivedMut.isPending}
                      onClick={() => receivedMut.mutate()}
                      className="w-full rounded-lg bg-[#ecedfb] py-2.5 text-xs font-semibold text-[#181b25] disabled:opacity-50"
                    >
                      Mark as received
                    </button>
                  ) : null}
                  {e.status === "RECEIVED" ? (
                    <button
                      type="button"
                      disabled={completeMut.isPending}
                      onClick={() => completeMut.mutate()}
                      className="w-full rounded-lg bg-[#ecedfb] py-2.5 text-xs font-semibold text-[#181b25] disabled:opacity-50"
                    >
                      Complete
                    </button>
                  ) : null}
                  {e.status === "REJECTED" || e.status === "COMPLETED" ? (
                    <p className="text-center text-xs text-[#737685]">No further actions for this state.</p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#5b5e68]">Internal notes</h3>
                <textarea
                  value={internalNoteDraft}
                  onChange={(ev) => setInternalNoteDraft(ev.target.value)}
                  placeholder="Add a private note for the logistics team…"
                  className="h-32 w-full resize-none rounded-lg border-none bg-[#f2f3ff] p-3 text-sm focus:ring-1 focus:ring-[#1653cc]"
                />
                <button
                  type="button"
                  disabled
                  title="Persisted notes use approve/reject actions today."
                  className="mt-2 flex items-center text-xs font-bold text-slate-400"
                >
                  <MaterialIcon name="add" className="mr-1 text-sm" />
                  Save note
                </button>
                {e.adminNote ? (
                  <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-[#5b5e68]">
                    <span className="font-semibold text-[#181b25]">On record: </span>
                    {e.adminNote}
                  </p>
                ) : null}
              </section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
