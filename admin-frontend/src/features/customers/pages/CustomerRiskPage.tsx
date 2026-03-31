import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { CustomerWorkspaceNav } from "@/components/stitch/CustomerWorkspaceNav";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getAdminCustomerDetail, getAdminCustomerRisk } from "@/features/customers/api/admin-customers.api";
import { displayCustomerName, formatMinorCurrency } from "@/features/customers/lib/customerDisplay";
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

const severityTone = (s: string): StatusBadgeTone => {
  const u = s.toUpperCase();
  if (u === "CRITICAL" || u === "HIGH") {
    return "danger";
  }
  if (u === "MEDIUM") {
    return "pending";
  }
  if (u === "LOW") {
    return "active";
  }
  return "info";
};

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const CustomerRiskPage = () => {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);

  const detailQ = useQuery({
    queryKey: ["admin-customer-detail", customerId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminCustomerDetail(accessToken, customerId);
    },
    enabled: Boolean(accessToken) && Boolean(customerId)
  });

  const q = useQuery({
    queryKey: ["admin-customer-risk", customerId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminCustomerRisk(accessToken, customerId);
    },
    enabled: Boolean(accessToken) && Boolean(customerId)
  });

  const entity = detailQ.data?.data.entity;
  const d = q.data?.data;
  const customerName = entity ? displayCustomerName(entity) : (d?.entity.email ?? "Customer");
  const err = q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const riskSignals = d?.riskSignals ?? [];
  const securityEvents = d?.securityEvents ?? [];
  const loginPatterns = d?.loginPatterns ?? [];
  const refundSummary = d?.refundSummary;

  const maxScore = useMemo(
    () => (riskSignals.length ? Math.max(...riskSignals.map((r) => r.score)) : null),
    [riskSignals]
  );

  const openSecurityCount = useMemo(
    () => securityEvents.filter((e) => (e.status || "").toUpperCase() === "OPEN").length,
    [securityEvents]
  );

  return (
    <div className="space-y-6">
      {!customerId ? <p className="text-sm text-red-700">Missing customer id.</p> : null}
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

      {customerId ? (
        <>
          <CustomerWorkspaceHeader customerId={customerId} customerName={customerName} tabLabel="Risk" />
          <CustomerWorkspaceNav customerId={customerId} />

          {q.isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : d ? (
            <>
              <div className="flex flex-wrap items-center justify-end gap-4">
                <div className="flex items-center gap-3 rounded-sm bg-white px-4 py-2 shadow-sm">
                  <span className="text-xs font-bold uppercase text-slate-500">Account</span>
                  <StatusBadge label={d.entity.status.replace(/_/g, " ")} tone={userStatusTone(d.entity.status)} />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-xs font-bold uppercase text-slate-500">Email</span>
                  <span>{d.entity.email ?? "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="relative overflow-hidden rounded-sm border-l-4 border-[#ba1a1a] bg-white p-5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Highest risk score</p>
                  <p className="font-headline text-4xl font-extrabold text-[#181b25]">
                    {maxScore != null ? Math.round(maxScore) : "—"}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-400">From recorded fraud / risk signals</p>
                </div>
                <div className="rounded-sm border-l-4 border-[#1653cc] bg-white p-5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Risk signals</p>
                  <p className="font-headline text-4xl font-extrabold">{riskSignals.length}</p>
                  <p className="mt-2 text-[10px] text-slate-400">All-time rows for this customer</p>
                </div>
                <div className="rounded-sm border-l-4 border-[#5b5e68] bg-white p-5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Open security events</p>
                  <p className="font-headline text-4xl font-extrabold">{openSecurityCount}</p>
                  <p className="mt-2 text-[10px] text-slate-400">Status &quot;OPEN&quot; in the feed below</p>
                </div>
                <div className="flex flex-col justify-between rounded-sm bg-[#13161e] p-5 text-white">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Operational posture</p>
                    <p className="mt-1 font-headline text-xl font-bold">
                      {openSecurityCount > 0 || (maxScore != null && maxScore >= 70)
                        ? "Elevated monitoring"
                        : "Standard monitoring"}
                    </p>
                  </div>
                  <p className="mt-4 text-[10px] text-slate-400">Derived from open events and peak score</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="overflow-hidden rounded-sm bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[#181b25]">Recent login attempts</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      From authentication logs (success and failure). Not a geographic map — location fields are IP-derived when
                      available.
                    </p>
                  </div>
                  {loginPatterns.length === 0 ? (
                    <p className="p-6 text-sm text-slate-500">No login events recorded for this customer.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">When</th>
                            <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Result</th>
                            <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Location (IP)</th>
                            <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Detail</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {loginPatterns.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50">
                              <td className="px-5 py-3 text-xs text-slate-600">{formatWhen(row.createdAt)}</td>
                              <td className="px-5 py-3">
                                <StatusBadge
                                  label={row.success ? "Success" : "Failed"}
                                  tone={row.success ? "active" : "danger"}
                                />
                              </td>
                              <td className="px-5 py-3 text-xs text-slate-600">
                                {[row.ipCountry, row.ipRegion].filter(Boolean).join(" · ") || "—"}
                              </td>
                              <td className="max-w-[280px] px-5 py-3 text-xs text-slate-600">
                                <span className="line-clamp-2" title={row.failureReason || row.userAgent || ""}>
                                  {row.failureReason || (row.userAgent ? row.userAgent.slice(0, 120) : "—")}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-sm bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[#181b25]">Completed refunds (orders)</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Aggregated from completed refunds tied to this customer&apos;s orders. No synthetic risk scores — use with risk
                      signals and security events above.
                    </p>
                  </div>
                  <div className="space-y-4 p-5">
                    {refundSummary ? (
                      <>
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-slate-500">Count</dt>
                            <dd className="mt-1 font-mono text-lg font-semibold">{refundSummary.completedCount}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-slate-500">Total (sum of cents)</dt>
                            <dd className="mt-1 font-mono text-lg font-semibold">
                              {formatMinorCurrency(
                                refundSummary.totalAmountCents,
                                refundSummary.lastCurrency ?? "USD"
                              )}
                            </dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-[10px] font-bold uppercase text-slate-500">Most recent</dt>
                            <dd className="mt-1 text-xs text-slate-700">
                              {refundSummary.lastCompletedAt
                                ? `${formatWhen(refundSummary.lastCompletedAt)}${
                                    refundSummary.lastAmountCents != null && refundSummary.lastCurrency
                                      ? ` · ${formatMinorCurrency(refundSummary.lastAmountCents, refundSummary.lastCurrency)}`
                                      : ""
                                  }`
                                : "—"}
                            </dd>
                          </div>
                        </dl>
                        <p className="text-[10px] leading-relaxed text-slate-400">
                          If refunds used multiple currencies, combined totals are approximate — confirm amounts in payments.
                        </p>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-sm bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[#181b25]">Risk signals</h3>
                  <p className="mt-1 text-xs text-slate-500">Scoring and review status from security screening.</p>
                </div>
                {riskSignals.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No risk signals for this customer.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Type</th>
                          <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Score</th>
                          <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Recorded</th>
                          <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Reviewed</th>
                          <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Context</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {riskSignals.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3 text-sm font-medium">{row.type.replace(/_/g, " ")}</td>
                            <td className="px-5 py-3 font-mono text-sm">{row.score}</td>
                            <td className="px-5 py-3 text-xs text-slate-600">{formatWhen(row.createdAt)}</td>
                            <td className="px-5 py-3 text-xs text-slate-600">
                              {row.reviewedAt ? formatWhen(row.reviewedAt) : "—"}
                            </td>
                            <td className="px-5 py-3">
                              {row.metadata != null && typeof row.metadata === "object" && Object.keys(row.metadata).length > 0 ? (
                                <TechnicalJsonDisclosure label="Details" data={row.metadata} defaultOpen={false} />
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-sm bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[#181b25]">Security events</h3>
                  <p className="mt-1 text-xs text-slate-500">Login, suspension, and other security-relevant events.</p>
                </div>
                {securityEvents.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No security events for this customer.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Event</th>
                          <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Severity</th>
                          <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Status</th>
                          <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">When</th>
                          <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Resolved</th>
                          <th className="px-5 py-2 text-[10px] font-bold uppercase text-slate-500">Context</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {securityEvents.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3 text-sm font-medium">{row.type.replace(/_/g, " ")}</td>
                            <td className="px-5 py-3">
                              <StatusBadge label={row.severity} tone={severityTone(row.severity)} />
                            </td>
                            <td className="px-5 py-3 text-xs font-semibold uppercase text-slate-600">{row.status}</td>
                            <td className="px-5 py-3 text-xs text-slate-600">{formatWhen(row.createdAt)}</td>
                            <td className="px-5 py-3 text-xs text-slate-600">
                              {row.resolvedAt ? formatWhen(row.resolvedAt) : "—"}
                            </td>
                            <td className="px-5 py-3">
                              {row.metadata != null && typeof row.metadata === "object" && Object.keys(row.metadata).length > 0 ? (
                                <TechnicalJsonDisclosure label="Details" data={row.metadata} defaultOpen={false} />
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
