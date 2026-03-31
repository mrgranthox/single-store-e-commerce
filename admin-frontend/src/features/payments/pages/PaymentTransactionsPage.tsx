import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { PAYSTACK_GATEWAY_HELP, formatPaymentGatewayLabel } from "@/features/payments/lib/paystackRails";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  getAdminPaymentTransactions,
  type AdminPaymentTransactionRow,
  type PaymentTransactionsResponse
} from "@/features/payments/api/admin-payments.api";
import { StitchPaymentStatusPill } from "@/features/payments/ui/stitchPaymentsUi";

const paymentRefLabel = (id: string) => `PAY-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const formatMoney = (cents: number | null, currency: string | null) => {
  if (cents == null || !currency) return "—";
  const cur = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
};

const formatWhenParts = (iso: string) => {
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
    const time = new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(d);
    return { date, time };
  } catch {
    return { date: iso, time: "" };
  }
};

const finalStatusHeadline = (state: string) => {
  switch (state) {
    case "PAID":
      return "Captured";
    case "FAILED":
      return "Failed";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "Refunded";
    default:
      return state.replace(/_/g, " ");
  }
};

const isWebhookish = (eventType: string) => {
  const u = eventType.toUpperCase();
  return u.includes("WEBHOOK") || u.includes("NOTIFICATION") || u.includes("EVENT");
};

type LedgerEntity = PaymentTransactionsResponse["data"]["entity"];

const buildPaymentLedgerReportText = (
  paymentId: string,
  entity: LedgerEntity | undefined,
  items: AdminPaymentTransactionRow[]
) => {
  const lines: string[] = [
    "PAYMENT LEDGER REPORT",
    `Generated (UTC): ${new Date().toISOString()}`,
    "",
    `Payment ID: ${paymentId}`,
    `Reference label: ${paymentRefLabel(paymentId)}`,
    ""
  ];
  if (entity) {
    lines.push("SUMMARY", `  Status: ${entity.paymentState}`, `  Provider: ${formatPaymentGatewayLabel(entity.provider)}`);
    lines.push(`  Provider ref: ${entity.providerPaymentRef?.trim() || "—"}`, "");
  }
  lines.push(`PROVIDER EVENTS (${items.length}, oldest first)`, "—".repeat(72));
  items.forEach((row, index) => {
    const amt = formatMoney(row.amountCents, row.currency);
    lines.push(`${String(index + 1).padStart(3, " ")}. ${row.createdAt}`);
    lines.push(`     Event type: ${row.providerEventType || "—"}`);
    lines.push(`     Status: ${row.status}   Amount: ${amt}`);
    lines.push(`     Provider ref: ${row.providerRef?.trim() || "—"}`);
    lines.push(`     Event ID: ${row.id}`);
    lines.push("");
  });
  lines.push(
    "END OF REPORT",
    "",
    "Provider event payloads are not included in this report. Use “Export data file” on the same screen when you need full structured data."
  );
  return lines.join("\n");
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const PaymentTransactionsPage = () => {
  const { paymentId = "" } = useParams<{ paymentId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [logFilter, setLogFilter] = useState<"all" | "errors" | "webhooks">("all");

  const q = useQuery({
    queryKey: ["admin-payment-transactions", paymentId],
    queryFn: async () => {
      if (!accessToken || !paymentId) {
        throw new Error("Missing context.");
      }
      return getAdminPaymentTransactions(accessToken, paymentId);
    },
    enabled: Boolean(accessToken && paymentId)
  });

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const data = q.data?.data;
  const entity = data?.entity;
  const items = data?.items ?? [];

  const chronological = useMemo(
    () => [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [items]
  );

  const reversedDisplay = useMemo(
    () => [...chronological].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [chronological]
  );

  const filtered = useMemo(() => {
    if (logFilter === "all") return reversedDisplay;
    return reversedDisplay.filter((row) => {
      const st = row.status.toUpperCase();
      const fail = st === "FAILED" || st === "CANCELLED";
      if (logFilter === "errors") return fail;
      return isWebhookish(row.providerEventType ?? "");
    });
  }, [reversedDisplay, logFilter]);

  const totalVolumeCents = useMemo(
    () => items.reduce((acc, row) => acc + (typeof row.amountCents === "number" ? row.amountCents : 0), 0),
    [items]
  );
  const primaryCurrency = items.find((i) => i.currency)?.currency ?? null;

  const latencyMs = useMemo(() => {
    if (chronological.length < 2) return null;
    const t0 = new Date(chronological[0]!.createdAt).getTime();
    const t1 = new Date(chronological[chronological.length - 1]!.createdAt).getTime();
    return Math.max(0, t1 - t0);
  }, [chronological]);

  const exportLedgerReport = () => {
    if (!entity) {
      return;
    }
    const body = buildPaymentLedgerReportText(paymentId, entity, chronological);
    downloadBlob(new Blob([body], { type: "text/plain;charset=utf-8" }), `payment-${paymentId}-ledger-report.txt`);
  };

  const exportLedgerDataFile = () => {
    if (!entity) {
      return;
    }
    const body = JSON.stringify({ paymentId, entity, items: chronological }, null, 2);
    downloadBlob(new Blob([body], { type: "application/json" }), `payment-${paymentId}-ledger-data.json`);
  };

  const resync = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-payment-transactions", paymentId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-payment-detail", paymentId] });
  };

  if (!paymentId) {
    return <p className="text-sm text-slate-500">Missing payment id.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-2 flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Ledger</span>
            <MaterialIcon name="chevron_right" className="text-xs" />
            <span>Transactions</span>
            <MaterialIcon name="chevron_right" className="text-xs" />
            <span className="text-[#1653cc]">{paymentRefLabel(paymentId)}</span>
          </nav>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-slate-900">
            Payment #{paymentRefLabel(paymentId)} — <span className="font-medium text-slate-400">Transactions</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={exportLedgerReport}
            disabled={!entity}
            className="flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <MaterialIcon name="download" className="mr-2 text-sm" />
            Export report
          </button>
          <button
            type="button"
            onClick={exportLedgerDataFile}
            disabled={!entity}
            title="Structured JSON for integrations, support tools, or archives"
            className="flex items-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <MaterialIcon name="code" className="mr-2 text-sm" />
            Export data file
          </button>
          <button
            type="button"
            onClick={resync}
            className="flex items-center rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#3b6de6]"
          >
            <MaterialIcon name="refresh" className="mr-2 text-sm" />
            Re-sync Ledger
          </button>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {err}
        </div>
      ) : null}

      {q.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading transaction history…
        </div>
      ) : entity ? (
        <>
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border-l-4 border-[#1653cc] bg-white p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Volume</p>
              <h3 className="mt-2 font-mono text-2xl font-bold">{formatMoney(totalVolumeCents, primaryCurrency)}</h3>
              <span className="absolute bottom-4 right-4 flex items-center text-[10px] font-bold text-[#006b2d]">
                <MaterialIcon name="trending_up" className="mr-1 text-xs" />
                Events: {items.length}
              </span>
            </div>
            <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border-l-4 border-[#006b2d] bg-white p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Final Status</p>
              <h3 className="mt-2 font-headline text-2xl font-bold text-[#006b2d]">{finalStatusHeadline(entity.paymentState)}</h3>
              <div className="absolute bottom-4 right-4 flex items-center text-[10px] font-bold text-slate-400">
                <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#006b2d]" />
                Ledger
              </div>
            </div>
            <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border-l-4 border-slate-300 bg-white p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Provider</p>
              <h3 className="mt-2 font-headline text-2xl font-bold">{formatPaymentGatewayLabel(entity.provider)}</h3>
              <span className="absolute bottom-4 right-4 max-w-[55%] truncate text-[10px] font-bold text-slate-400">
                {entity.providerPaymentRef?.trim() ? `Ref: ${entity.providerPaymentRef.slice(0, 18)}…` : PAYSTACK_GATEWAY_HELP.slice(0, 42)}
              </span>
            </div>
            <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border-l-4 border-red-600 bg-white p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Session Span</p>
              <h3 className="mt-2 font-mono text-2xl font-bold">
                {latencyMs != null ? `${latencyMs.toLocaleString()}ms` : "—"}
              </h3>
              <span className="absolute bottom-4 right-4 flex items-center text-[10px] font-bold text-red-600">
                <MaterialIcon name="schedule" className="mr-1 text-xs" />
                First → last event
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            <Link className="font-semibold text-[#1653cc] hover:underline" to={`/admin/payments/${paymentId}`}>
              ← Payment overview
            </Link>
            <span className="mx-2 text-slate-300">|</span>
            Status: <StitchPaymentStatusPill paymentState={entity.paymentState} />
          </p>

          <div className="relative min-h-[400px] overflow-hidden rounded-xl bg-white p-0 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200/80 p-6 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center text-sm font-bold uppercase tracking-widest text-slate-900">
                <MaterialIcon name="history" className="mr-2 text-[#1653cc]" />
                Provider Audit Trail
              </h2>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-6">
                <div className="flex items-center">
                  <span className="mr-3 text-[10px] font-bold uppercase text-slate-500">Filter Logs:</span>
                  <div className="flex space-x-2">
                    {(["all", "errors", "webhooks"] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLogFilter(key)}
                        className={`rounded px-3 py-1 text-[10px] font-bold transition-all ${
                          logFilter === key
                            ? "bg-slate-100 text-slate-600"
                            : "text-slate-400 hover:bg-slate-100"
                        }`}
                      >
                        {key === "all" ? "All" : key === "errors" ? "Errors" : "Webhooks"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative p-8">
              <div className="absolute bottom-8 left-[39px] top-8 w-0.5 bg-slate-100" aria-hidden />

              {filtered.length === 0 ? (
                <p className="pl-12 text-sm text-slate-500">No events match this filter.</p>
              ) : (
                filtered.map((row) => {
                  const st = row.status.toUpperCase();
                  const fail = st === "FAILED" || st === "CANCELLED";
                  const ok = st === "SUCCESS" || st === "SUCCEEDED";
                  const border = fail ? "border-red-600" : ok ? "border-[#006b2d]" : "border-[#1653cc]";
                  const dot = fail ? "bg-red-600" : ok ? "bg-[#006b2d]" : "bg-[#1653cc]";
                  const badgeBorder = fail ? "border-red-600 text-red-600" : ok ? "border-[#006b2d] text-[#006b2d]" : "border-[#1653cc] text-[#1653cc]";
                  const { date, time } = formatWhenParts(row.createdAt);
                  const title =
                    row.providerEventType?.replace(/_/g, " ")?.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) ??
                    "Provider event";
                  return (
                    <div key={row.id} className="relative mb-12 flex items-start last:mb-0">
                      <div
                        className={`z-10 mt-1 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white ${border}`}
                      >
                        <div className={`h-2 w-2 rounded-full ${dot}`} />
                      </div>
                      <div className="ml-10 grid flex-1 grid-cols-12 items-start gap-6">
                        <div className="col-span-12 sm:col-span-2">
                          <p className="font-mono text-xs font-bold text-slate-900">{date}</p>
                          <p className="font-mono text-[10px] text-slate-400">{time}</p>
                        </div>
                        <div className="col-span-12 sm:col-span-10">
                          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <span
                                className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${badgeBorder}`}
                              >
                                {row.providerEventType?.replace(/_/g, " ") ?? "Event"}
                              </span>
                              <h3 className="font-headline text-sm font-semibold text-slate-900">{title}</h3>
                            </div>
                            <span className={`font-mono text-xs font-bold ${fail ? "text-red-600" : "text-[#1653cc]"}`}>
                              {formatMoney(row.amountCents, row.currency)}
                            </span>
                          </div>
                          <p className="mb-4 font-mono text-xs text-slate-500">
                            Ref: {row.providerRef?.trim() || "—"} · Status: {row.status}
                          </p>
                          <TechnicalJsonDisclosure
                            label="Full provider event data"
                            data={row.payload ?? {}}
                            defaultOpen={false}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center">
              <MaterialIcon name="verified_user" className="mr-2 text-xs" />
              Append-only provider events · {PAYSTACK_GATEWAY_HELP.slice(0, 64)}…
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span>Total Events: {items.length}</span>
              <span className="text-slate-300">|</span>
              <span>Filtered: {filtered.length}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">No data returned.</p>
      )}
    </div>
  );
};
