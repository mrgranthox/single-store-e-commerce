import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";
import {
  ApiError,
  approveAdminRefund,
  completeAdminRefund,
  getAdminRefundDetail,
  rejectAdminRefund
} from "@/features/refunds/api/admin-refunds.api";
import { PAYSTACK_RAILS_COMPACT, formatPaymentGatewayLabel } from "@/features/payments/lib/paystackRails";
import { customerInitials } from "@/features/payments/ui/stitchPaymentsUi";

const refundRefLabel = (id: string) => `REF-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
const returnRefLabel = (id: string) => `RET-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const money = (cents: number, cur: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
};

const formatWhen = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const headlineStatus = (state: string) => {
  switch (state) {
    case "PENDING_APPROVAL":
      return "IN REVIEW";
    case "APPROVED":
      return "APPROVED";
    case "PENDING_PROVIDER":
      return "PROCESSING";
    case "COMPLETED":
      return "COMPLETED";
    case "REJECTED":
      return "REJECTED";
    case "FAILED":
      return "FAILED";
    default:
      return state.replace(/_/g, " ");
  }
};

export const RefundDetailPage = () => {
  const { refundId = "" } = useParams<{ refundId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions);
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "complete" | null>(null);

  const detailQuery = useQuery({
    queryKey: ["admin-refund-detail", refundId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminRefundDetail(accessToken, refundId);
    },
    enabled: Boolean(accessToken) && Boolean(refundId)
  });

  const inv = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-refund-detail", refundId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
    if (e?.payment.id) {
      void queryClient.invalidateQueries({ queryKey: ["admin-payment-detail", e.payment.id] });
    }
    if (e?.order.id) {
      void queryClient.invalidateQueries({ queryKey: ["admin-order-detail", e.order.id] });
    }
  };

  const approveMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return approveAdminRefund(accessToken, refundId, { note: note.trim() || undefined });
    },
    onSuccess: inv
  });

  const rejectMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return rejectAdminRefund(accessToken, refundId, { note: rejectNote.trim() || "Rejected" });
    },
    onSuccess: inv
  });

  const completeMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return completeAdminRefund(accessToken, refundId, {
        note: note.trim() || undefined,
        ...(providerRef.trim() ? { providerRefundRef: providerRef.trim() } : {})
      });
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

  const reasonPrimary = e?.return?.customerReason?.trim() || "No shopper reason on file.";
  const reasonSecondary = e?.internalNote?.trim() || "—";
  const canManageRefund = adminHasAnyPermission(actorPermissions, ["refunds.approve"]);
  const confirmTitle =
    confirmAction === "approve"
      ? "Approve this refund?"
      : confirmAction === "reject"
        ? "Reject this refund?"
        : confirmAction === "complete"
          ? "Mark this refund completed?"
          : "";
  const confirmBody =
    confirmAction === "approve"
      ? `This records approval for ${e ? money(e.amountCents, e.currency) : "this refund"} and advances provider processing.`
      : confirmAction === "reject"
        ? `This stops the refund request${rejectNote.trim() ? ` with reason "${rejectNote.trim()}".` : "."}`
        : confirmAction === "complete"
          ? `This records the refund as completed${providerRef.trim() ? ` with provider reference ${providerRef.trim()}` : ""}.`
          : undefined;
  const confirmDisabled =
    confirmAction === "approve"
      ? approveMut.isPending
      : confirmAction === "reject"
        ? rejectMut.isPending || !rejectNote.trim()
        : confirmAction === "complete"
          ? completeMut.isPending
          : false;

  const submitConfirmedAction = () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "approve") {
      approveMut.mutate();
      return;
    }
    if (action === "reject") {
      rejectMut.mutate();
      return;
    }
    if (action === "complete") {
      completeMut.mutate();
    }
  };

  const providerEngineCopy = useMemo(() => {
    if (!e) return { title: "—", sub: "—" };
    if (e.state === "COMPLETED") {
      return { title: "Settled via Paystack", sub: "Gateway confirmation recorded." };
    }
    if (e.state === "PENDING_PROVIDER" || e.state === "APPROVED") {
      return { title: "Syncing with Paystack", sub: "Awaiting provider refund confirmation." };
    }
    if (e.state === "REJECTED" || e.state === "FAILED") {
      return { title: "Refund halted", sub: "No provider debit will be attempted for this request." };
    }
    return { title: "Queued for review", sub: "Approval required before Paystack is instructed." };
  }, [e]);

  const lifecycle = useMemo(() => {
    if (!e) return [];
    const st = e.state;
    const steps = [
      { key: "req", label: "Requested", when: formatWhen(e.createdAt), done: true, current: false },
      {
        key: "rev",
        label: "In Review",
        when: st === "PENDING_APPROVAL" ? "Current state" : "Passed",
        done: st !== "PENDING_APPROVAL" && st !== "REJECTED" && st !== "FAILED",
        current: st === "PENDING_APPROVAL"
      },
      {
        key: "app",
        label: "Approved",
        when: st === "APPROVED" || st === "PENDING_PROVIDER" || st === "COMPLETED" ? formatWhen(e.approvedAt ?? e.updatedAt) : "TBD",
        done: st === "APPROVED" || st === "PENDING_PROVIDER" || st === "COMPLETED",
        current: st === "APPROVED"
      },
      {
        key: "proc",
        label: "Processing",
        when: st === "PENDING_PROVIDER" ? "With gateway" : st === "COMPLETED" ? "Done" : "TBD",
        done: st === "PENDING_PROVIDER" || st === "COMPLETED",
        current: st === "PENDING_PROVIDER"
      },
      {
        key: "done",
        label: "Completed",
        when: st === "COMPLETED" ? formatWhen(e.updatedAt) : "TBD",
        done: st === "COMPLETED",
        current: st === "COMPLETED"
      }
    ];
    if (st === "REJECTED" || st === "FAILED") {
      return [
        steps[0]!,
        {
          key: "halt",
          label: st === "REJECTED" ? "Rejected" : "Failed",
          when: formatWhen(e.updatedAt),
          done: true,
          current: true
        }
      ];
    }
    return steps;
  }, [e]);

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 pb-12">
      {!refundId ? <p className="text-sm text-red-700">Missing refund id.</p> : null}
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

      {detailQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading refund…</div>
      ) : e ? (
        <>
          <header className="sticky top-0 z-10 -mx-4 mb-2 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 bg-[#f8f9fb]/95 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Financial Reconciliation</span>
              <MaterialIcon name="chevron_right" className="text-xs" />
              <span className="font-semibold text-slate-900">Refund Details</span>
            </div>
            <Link to="/admin/refunds" className="text-xs font-bold uppercase tracking-widest text-[#1653cc] hover:underline">
              ← All refunds
            </Link>
          </header>

          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Refund #{refundRefLabel(e.id)}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <span className="font-headline text-2xl font-bold text-[#1653cc]">{money(e.amountCents, e.currency)}</span>
                <div className="flex items-center gap-1.5 rounded-full border border-[#006b2d] px-3 py-1 text-xs font-semibold text-[#006b2d]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#006b2d]" />
                  {headlineStatus(e.state)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/admin/orders/${e.order.id}`}
                className="flex items-center gap-2 rounded-lg bg-[#f2f3ff] px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-[#e6e7f6]"
              >
                <MaterialIcon name="link" className="text-sm" />
                Order #{e.order.orderNumber}
              </Link>
              {e.return ? (
                <Link
                  to={`/admin/returns/${e.return.id}`}
                  className="flex items-center gap-2 rounded-lg bg-[#f2f3ff] px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-[#e6e7f6]"
                >
                  <MaterialIcon name="assignment_return" className="text-sm" />
                  Return #{returnRefLabel(e.return.id)}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 space-y-8 lg:col-span-8">
              <section className="relative grid grid-cols-2 gap-6 overflow-hidden rounded-xl bg-white p-6 shadow-sm md:grid-cols-4">
                <div className="absolute left-0 top-0 h-full w-1 bg-[#1653cc]" />
                <div className="space-y-1">
                  <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">Amount</div>
                  <div className="font-mono text-lg font-bold">{money(e.amountCents, e.currency)}</div>
                  <div className="text-xs italic text-slate-400">
                    {e.approvedAmountCents != null && e.approvedAmountCents !== e.amountCents
                      ? `Approved ${money(e.approvedAmountCents, e.currency)}`
                      : "Full amount"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">Reason</div>
                  <div className="text-sm font-medium">{reasonPrimary}</div>
                  <div className="line-clamp-1 text-xs text-slate-400">{reasonSecondary}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">Requested By</div>
                  <div className="text-sm font-medium">
                    {e.order.customer.name ?? e.order.customer.email ?? "Guest"} (Customer)
                  </div>
                  <div className="text-xs text-slate-400">Via portal · {formatWhen(e.createdAt)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">Original Payment</div>
                  <div className="font-mono text-sm font-medium">{e.payment.providerPaymentRef?.trim() || e.payment.id.slice(0, 12)}</div>
                  <Link to={`/admin/payments/${e.payment.id}`} className="cursor-pointer text-xs italic text-[#1653cc] underline">
                    View payment
                  </Link>
                </div>
              </section>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-900">
                    <MaterialIcon name="shopping_bag" className="text-[#1653cc]" />
                    Order Context
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Order</span>
                      <Link className="font-medium text-[#1653cc] hover:underline" to={`/admin/orders/${e.order.id}`}>
                        {e.order.orderNumber}
                      </Link>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span className="font-medium">{e.order.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Line items</span>
                      <span className="font-medium">{e.items.length} allocation{e.items.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-900">
                    <MaterialIcon name="account_balance_wallet" className="text-[#1653cc]" />
                    Provider Details
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Processor</span>
                      <span className="flex items-center gap-1 font-medium">
                        {formatPaymentGatewayLabel(e.payment.provider ?? null)}
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Paystack rails</span>
                      <span className="text-xs font-medium text-slate-600">{PAYSTACK_RAILS_COMPACT}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">External refund ref</span>
                      <span className="max-w-[55%] break-all font-mono text-xs">{e.providerRefundRef?.trim() || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment state</span>
                      <span className="font-medium">{e.payment.paymentState.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                </div>
              </div>

              <section className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-900">
                  <MaterialIcon name="history_edu" className="text-[#1653cc]" />
                  Approval History
                </h3>
                <div className="relative space-y-6 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-px before:bg-[#c3c6d6]">
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white bg-[#dbe1ff]">
                      <MaterialIcon name="check" className="text-[10px] text-[#1653cc]" filled />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">Request recorded</span>
                        <span className="text-[10px] text-slate-400">{formatWhen(e.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Refund request created and linked to the order payment.</p>
                    </div>
                  </div>
                  {e.state === "PENDING_APPROVAL" ? (
                    <div className="relative pl-8">
                      <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white bg-[#e6e7f6]">
                        <MaterialIcon name="pending" className="text-[10px] text-slate-400" filled />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">Pending manager approval</span>
                          <span className="text-[10px] text-slate-400">Awaiting…</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Manual review required before Paystack refund is released.</p>
                      </div>
                    </div>
                  ) : null}
                  {e.approvedAt ? (
                    <div className="relative pl-8">
                      <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white bg-[#dbe1ff]">
                        <MaterialIcon name="verified" className="text-[10px] text-[#1653cc]" filled />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">Approved</span>
                          <span className="text-[10px] text-slate-400">{formatWhen(e.approvedAt)}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Refund approved for provider processing.</p>
                      </div>
                    </div>
                  ) : null}
                  {e.state === "REJECTED" ? (
                    <div className="relative pl-8">
                      <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white bg-red-100">
                        <MaterialIcon name="cancel" className="text-[10px] text-red-700" filled />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-red-800">Rejected</span>
                        <p className="mt-1 text-xs text-slate-500">{formatWhen(e.updatedAt)}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              {e.items.length > 0 ? (
                <section className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900">Line allocation</h3>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <th className="py-2">Order line</th>
                        <th className="py-2 text-right">Refund portion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {e.items.map((it) => (
                        <tr key={it.id}>
                          <td className="py-3 font-mono text-xs">{it.orderItemId.slice(0, 10)}…</td>
                          <td className="py-3 text-right font-mono font-semibold">{money(it.amountCents, e.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ) : null}

              <section className="relative overflow-hidden rounded-xl bg-slate-900 p-8 text-white">
                <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-[#1653cc]/20 blur-3xl" />
                <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
                  <div>
                    <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">
                      Provider Refund Engine
                    </h3>
                    <div className="mb-1 flex items-center gap-2 text-xl font-bold">
                      <MaterialIcon name="cloud_sync" className="text-[#3b6de6]" />
                      {providerEngineCopy.title}
                    </div>
                    <p className="text-xs text-slate-400">{providerEngineCopy.sub}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">Provider ID</span>
                    <span className="mt-1 rounded bg-slate-800 px-2 py-1 font-mono text-sm">
                      {e.providerRefundRef?.trim() || "—"}
                    </span>
                  </div>
                </div>
              </section>

              {e.providerPayload != null ? (
                <TechnicalJsonDisclosure label="Provider response details" data={e.providerPayload} defaultOpen={false} />
              ) : null}
            </div>

            <aside className="col-span-12 space-y-8 lg:col-span-4">
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-slate-900">Process Lifecycle</h3>
                <div className="relative space-y-8 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-0.5 before:bg-slate-100">
                  {lifecycle.map((step) => {
                    const icon =
                      step.key === "halt"
                        ? "cancel"
                        : step.current
                          ? "hourglass_empty"
                          : step.done
                            ? "check"
                            : "rebase_edit";
                    return (
                    <div key={step.key} className="relative flex gap-4">
                      <div
                        className={`z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-lg ${
                          step.key === "halt"
                            ? "bg-red-600 text-white shadow-red-600/20"
                            : step.done
                              ? step.current
                                ? "border-2 border-white bg-[#dbe1ff] text-[#1653cc]"
                                : "bg-[#1653cc] text-white shadow-[#1653cc]/20"
                              : "bg-slate-100 text-slate-400 opacity-40"
                        }`}
                      >
                        <MaterialIcon
                          name={icon}
                          className="text-sm"
                          filled={step.key === "halt" || (step.done && !step.current)}
                        />
                      </div>
                      <div className={step.done && !step.current ? "" : step.current ? "" : "opacity-40"}>
                        <div className={`text-sm font-bold ${step.current ? "text-[#1653cc]" : ""}`}>{step.label}</div>
                        <div className="text-[10px] text-slate-400">{step.when}</div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-900">Executive Actions</h3>
                <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Note (approve / complete)
                  <textarea
                    value={note}
                    onChange={(ev) => setNote(ev.target.value)}
                    rows={3}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case"
                  />
                </label>
                {e.state === "PENDING_APPROVAL" ? (
                  <>
                    <button
                      type="button"
                      disabled={approveMut.isPending || !canManageRefund}
                      onClick={() => setConfirmAction("approve")}
                      className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[#006b2d] to-[#00873b] py-3 px-4 font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                      title={canManageRefund ? undefined : "Requires refunds.approve permission"}
                    >
                      <MaterialIcon name="verified_user" className="text-lg transition-transform group-hover:rotate-12" />
                      Approve Refund
                    </button>
                    <input
                      value={rejectNote}
                      onChange={(ev) => setRejectNote(ev.target.value)}
                      placeholder="Rejection reason"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={rejectMut.isPending || !rejectNote.trim() || !canManageRefund}
                      onClick={() => setConfirmAction("reject")}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-600 bg-transparent py-3 px-4 font-bold text-red-600 transition-all hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
                      title={canManageRefund ? undefined : "Requires refunds.approve permission"}
                    >
                      <MaterialIcon name="cancel" className="text-lg" />
                      Reject Refund
                    </button>
                  </>
                ) : null}
                {e.state === "APPROVED" || e.state === "PENDING_PROVIDER" ? (
                  <>
                    <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Provider refund reference
                      <input
                        value={providerRef}
                        onChange={(ev) => setProviderRef(ev.target.value)}
                        placeholder="Gateway confirmation id"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={completeMut.isPending || !canManageRefund}
                      onClick={() => setConfirmAction("complete")}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-3 px-4 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                      title={canManageRefund ? undefined : "Requires refunds.approve permission"}
                    >
                      <MaterialIcon name="done_all" className="text-lg" />
                      Mark Completed
                    </button>
                  </>
                ) : null}
                {e.state !== "PENDING_APPROVAL" && e.state !== "APPROVED" && e.state !== "PENDING_PROVIDER" ? (
                  <p className="text-center text-[10px] text-slate-400">No workflow actions for this state.</p>
                ) : null}
                <p className="mt-2 px-4 text-center text-[10px] text-slate-400">
                  Actions are logged. High-value refunds may require additional controls per policy.
                </p>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">
                    {customerInitials(e.order.customer.name, e.order.customer.email)}
                  </div>
                  <div>
                    <div className="text-sm font-bold">{e.order.customer.name ?? e.order.customer.email ?? "Guest"}</div>
                    <div className="text-[10px] font-medium text-slate-500">{e.order.customer.email ?? "—"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-[#faf8ff] p-3 text-center">
                    <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Refund state</div>
                    <div className="text-lg font-bold text-slate-900">{e.state.replace(/_/g, " ")}</div>
                  </div>
                  <div className="rounded-lg bg-[#faf8ff] p-3 text-center">
                    <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Updated</div>
                    <div className="text-lg font-bold text-slate-900">{formatWhen(e.updatedAt)}</div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </>
      ) : null}
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmTitle}
        body={confirmBody}
        confirmLabel={
          confirmAction === "approve"
            ? "Confirm approval"
            : confirmAction === "reject"
              ? "Confirm rejection"
              : "Confirm completion"
        }
        danger={confirmAction === "reject"}
        confirmDisabled={confirmDisabled}
        onClose={() => setConfirmAction(null)}
        onConfirm={submitConfirmedAction}
      />
    </div>
  );
};
