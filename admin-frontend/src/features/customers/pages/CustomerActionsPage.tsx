import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { CustomerWorkspaceNav } from "@/components/stitch/CustomerWorkspaceNav";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createAdminCustomerNote,
  getAdminCustomerDetail,
  postAdminCustomerInternalAction,
  reactivateAdminCustomer,
  restoreAdminCustomer,
  suspendAdminCustomer
} from "@/features/customers/api/admin-customers.api";
import { displayCustomerName } from "@/features/customers/lib/customerDisplay";
import { CustomerWorkspaceHeader } from "@/features/customers/ui/CustomerWorkspaceHeader";

const userStatusTone = (s: string): StatusBadgeTone => {
  switch (s) {
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
    case "LOCKED":
    case "DEACTIVATED":
      return "danger";
    default:
      return "pending";
  }
};

export const CustomerActionsPage = () => {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [escalatePreset, setEscalatePreset] = useState("FRAUD_REVIEW");
  const [escalateCategoryCustom, setEscalateCategoryCustom] = useState("");
  const [escalateObservation, setEscalateObservation] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const detailQ = useQuery({
    queryKey: ["admin-customer-detail", customerId],
    queryFn: async () => {
      if (!accessToken || !customerId) {
        throw new Error("Missing context.");
      }
      return getAdminCustomerDetail(accessToken, customerId);
    },
    enabled: Boolean(accessToken && customerId)
  });

  const entity = detailQ.data?.data.entity;
  const customerName = entity ? displayCustomerName(entity) : "Customer";

  const err =
    detailQ.error instanceof ApiError
      ? detailQ.error.message
      : detailQ.error instanceof Error
        ? detailQ.error.message
        : null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-customer-detail", customerId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-customer-risk", customerId] });
  };

  const suspendM = useMutation({
    mutationFn: () => {
      if (!accessToken || !customerId) {
        throw new Error("Missing context.");
      }
      const r = reason.trim();
      if (!r) {
        throw new Error("Reason is required.");
      }
      return suspendAdminCustomer(accessToken, customerId, {
        reason: r,
        ...(note.trim() ? { note: note.trim() } : {})
      });
    },
    onSuccess: () => {
      setMsg("Account suspended.");
      invalidate();
    },
    onError: (e: unknown) => setMsg(e instanceof ApiError ? e.message : "Failed")
  });

  const reactM = useMutation({
    mutationFn: () => {
      if (!accessToken || !customerId) {
        throw new Error("Missing context.");
      }
      const r = reason.trim();
      if (!r) {
        throw new Error("Reason is required.");
      }
      return reactivateAdminCustomer(accessToken, customerId, {
        reason: r,
        ...(note.trim() ? { note: note.trim() } : {})
      });
    },
    onSuccess: () => {
      setMsg("Account restored to active.");
      invalidate();
    },
    onError: (e: unknown) => setMsg(e instanceof ApiError ? e.message : "Failed")
  });

  const restoreM = useMutation({
    mutationFn: () => {
      if (!accessToken || !customerId) {
        throw new Error("Missing context.");
      }
      const r = reason.trim();
      if (!r) {
        throw new Error("Reason is required.");
      }
      return restoreAdminCustomer(accessToken, customerId, {
        reason: r,
        ...(note.trim() ? { note: note.trim() } : {})
      });
    },
    onSuccess: () => {
      setMsg("Account restored to active.");
      invalidate();
    },
    onError: (e: unknown) => setMsg(e instanceof ApiError ? e.message : "Failed")
  });

  const internalM = useMutation({
    mutationFn: () => {
      if (!accessToken || !customerId) {
        throw new Error("Missing context.");
      }
      const n = internalNote.trim();
      if (!n) {
        throw new Error("Note text is required.");
      }
      return createAdminCustomerNote(accessToken, customerId, { note: n });
    },
    onSuccess: () => {
      setInternalNote("");
      setMsg("Internal note saved.");
      invalidate();
    },
    onError: (e: unknown) => setMsg(e instanceof ApiError ? e.message : "Failed")
  });

  const escalateM = useMutation({
    mutationFn: () => {
      if (!accessToken || !customerId) {
        throw new Error("Missing context.");
      }
      const category =
        escalatePreset === "CUSTOM"
          ? escalateCategoryCustom.trim()
          : escalatePreset.trim();
      const observation = escalateObservation.trim();
      if (!category) {
        throw new Error("Category is required.");
      }
      if (!observation) {
        throw new Error("Observation is required.");
      }
      return postAdminCustomerInternalAction(accessToken, customerId, {
        kind: "ESCALATE",
        category,
        observation
      });
    },
    onSuccess: () => {
      setEscalateObservation("");
      if (escalatePreset === "CUSTOM") {
        setEscalateCategoryCustom("");
      }
      setMsg("Escalation recorded (security event + audit).");
      invalidate();
    },
    onError: (e: unknown) => setMsg(e instanceof ApiError ? e.message : "Failed")
  });

  const isSuspended = entity?.status === "SUSPENDED";
  const isActive = entity?.status === "ACTIVE";
  const canSuspend = entity && entity.status !== "SUSPENDED" && entity.status !== "DEACTIVATED";

  if (!customerId) {
    return <p className="text-sm text-[var(--color-text-muted)]">Missing customer id.</p>;
  }

  return (
    <div className="space-y-6">
      <CustomerWorkspaceHeader customerId={customerId} customerName={customerName} tabLabel="Actions" />
      <CustomerWorkspaceNav customerId={customerId} />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {entity ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={entity.status.replace(/_/g, " ")} tone={userStatusTone(entity.status)} />
            <span className="text-sm text-slate-600">{entity.email ?? "No email on file"}</span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Use documented reasons — actions are audited
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-xl border border-[#c3c6d6]/30 bg-white p-6 shadow-sm">
          <h3 className="font-headline text-sm font-bold text-[#181b25]">Shared reason &amp; note</h3>
          <p className="mt-1 text-xs text-slate-500">
            Suspend, reactivate, and restore require a reason. Optional note is stored on the status change.
          </p>
          <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-slate-500">
            Reason (required for status changes)
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-lg border border-[#c3c6d6]/50 px-3 py-2 text-sm"
              placeholder="Reason for auditors"
            />
          </label>
          <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate-500">
            Optional note
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-lg border border-[#c3c6d6]/50 px-3 py-2 text-sm"
            />
          </label>
        </section>

        <div className="flex items-start gap-6 rounded-xl border-l-4 border-[#ba1a1a] bg-white p-6 shadow-sm">
          <div className="rounded-lg bg-[#ffdad6] p-3 text-[#ba1a1a]">
            <MaterialIcon name="lock" className="text-2xl" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-headline text-lg font-semibold text-[#181b25]">Suspend account</h3>
              <button
                type="button"
                disabled={suspendM.isPending || !reason.trim() || !canSuspend}
                onClick={() => {
                  setMsg(null);
                  suspendM.mutate();
                }}
                className="rounded-sm bg-[#ba1a1a] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
              >
                Suspend
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">Blocks checkout and sign-in until restored.</p>
            {!canSuspend ? <p className="mt-2 text-xs italic text-slate-500">Not available for this status.</p> : null}
          </div>
        </div>

        <div
          className={`flex items-start gap-6 rounded-xl border-l-4 border-[#00873b] bg-white p-6 shadow-sm ${
            !isSuspended ? "opacity-60 grayscale" : ""
          }`}
        >
          <div className="rounded-lg bg-[#00873b]/10 p-3 text-[#00873b]">
            <MaterialIcon name="lock_open" className="text-2xl" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-headline text-lg font-semibold text-[#181b25]">Reactivate account</h3>
              <button
                type="button"
                disabled={reactM.isPending || !reason.trim() || !isSuspended}
                onClick={() => {
                  setMsg(null);
                  reactM.mutate();
                }}
                className="rounded-sm bg-[#006b2d] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
              >
                Reactivate
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">Returns a suspended account to active when permitted.</p>
            {!isSuspended ? (
              <p className="mt-2 text-xs italic text-slate-500">Shown when the account is suspended.</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-start gap-6 rounded-xl border-l-4 border-[#1653cc] bg-white p-6 shadow-sm">
          <div className="rounded-lg bg-[#3b6de6]/10 p-3 text-[#1653cc]">
            <MaterialIcon name="undo" className="text-2xl" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-headline text-lg font-semibold text-[#181b25]">Restore to active</h3>
              <button
                type="button"
                disabled={restoreM.isPending || !reason.trim() || isActive}
                onClick={() => {
                  setMsg(null);
                  restoreM.mutate();
                }}
                className="rounded-sm border border-[#c3c6d6] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#181b25] hover:bg-slate-50 disabled:opacity-50"
              >
                Restore
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">Same audited path as reactivate for non-active accounts.</p>
            {isActive ? <p className="mt-2 text-xs italic text-slate-500">Account is already active.</p> : null}
          </div>
        </div>

        <div className="flex items-start gap-6 rounded-xl border-l-4 border-amber-600 bg-white p-6 shadow-sm">
          <div className="rounded-lg bg-amber-100 p-3 text-amber-800">
            <MaterialIcon name="priority_high" className="text-2xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-headline text-lg font-semibold text-[#181b25]">Escalate for security review</h3>
            <p className="mt-2 text-sm text-slate-600">
              Creates an audited security event on this customer. Use for fraud, account takeover, or policy escalation — not a
              substitute for the support ticket queue.
            </p>
            <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-slate-500">
              Category
              <select
                value={escalatePreset}
                onChange={(e) => setEscalatePreset(e.target.value)}
                className="rounded-lg border border-[#c3c6d6]/50 px-3 py-2 text-sm"
              >
                <option value="FRAUD_REVIEW">Fraud review</option>
                <option value="ACCOUNT_TAKEOVER">Account takeover</option>
                <option value="PAYMENT_ABUSE">Payment / refund abuse</option>
                <option value="POLICY_VIOLATION">Policy violation</option>
                <option value="CHARGEBACK">Chargeback / dispute</option>
                <option value="CUSTOM">Custom…</option>
              </select>
            </label>
            {escalatePreset === "CUSTOM" ? (
              <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate-500">
                Custom category (max 120 chars)
                <input
                  value={escalateCategoryCustom}
                  onChange={(e) => setEscalateCategoryCustom(e.target.value.slice(0, 120))}
                  className="rounded-lg border border-[#c3c6d6]/50 px-3 py-2 text-sm"
                  placeholder="Short label for auditors"
                />
              </label>
            ) : null}
            <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate-500">
              Observation (required)
              <textarea
                value={escalateObservation}
                onChange={(e) => setEscalateObservation(e.target.value)}
                rows={3}
                className="rounded-md border border-[#c3c6d6]/50 p-3 text-sm"
                placeholder="What happened, evidence, order IDs, etc."
              />
            </label>
            <button
              type="button"
              disabled={
                escalateM.isPending ||
                !escalateObservation.trim() ||
                (escalatePreset === "CUSTOM" && !escalateCategoryCustom.trim())
              }
              onClick={() => {
                setMsg(null);
                escalateM.mutate();
              }}
              className="mt-4 rounded-sm bg-amber-700 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
            >
              Submit escalation
            </button>
          </div>
        </div>

        <div className="flex items-start gap-6 rounded-xl border-l-4 border-[#1653cc] bg-white p-6 shadow-sm">
          <div className="rounded-lg bg-[#3b6de6]/10 p-3 text-[#1653cc]">
            <MaterialIcon name="confirmation_number" className="text-2xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-headline text-lg font-semibold text-[#181b25]">Support queue</h3>
            <p className="mt-2 text-sm text-slate-600">Create or review tickets from the support workspace.</p>
            <Link
              to="/admin/support/tickets"
              className="mt-4 inline-block rounded-sm bg-[#1653cc] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90"
            >
              Open tickets
            </Link>
          </div>
        </div>

        <div className="flex items-start gap-6 rounded-xl border-l-4 border-[#5b5e68] bg-white p-6 shadow-sm">
          <div className="rounded-lg bg-[#dedfeb]/80 p-3 text-[#5b5e68]">
            <MaterialIcon name="note_add" className="text-2xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-headline text-lg font-semibold text-[#181b25]">Internal note</h3>
            <p className="mt-2 text-sm text-slate-600">Adds a staff-visible note without emailing the customer.</p>
            <textarea
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={3}
              className="mt-3 w-full rounded-md border border-[#c3c6d6]/50 p-3 text-sm"
              placeholder="Internal note text"
            />
            <button
              type="button"
              disabled={internalM.isPending || !internalNote.trim()}
              onClick={() => {
                setMsg(null);
                internalM.mutate();
              }}
              className="mt-4 rounded-sm bg-[#5b5e68] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
            >
              Save note
            </button>
          </div>
        </div>

        {msg ? <p className="text-center text-sm text-slate-700">{msg}</p> : null}
      </div>

      <div className="flex justify-end border-t border-[#c3c6d6]/20 pt-4">
        <button
          type="button"
          className="text-xs font-bold uppercase tracking-widest text-[#1653cc] hover:underline"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-customer-detail", customerId] })}
        >
          Refresh customer
        </button>
      </div>
    </div>
  );
};
