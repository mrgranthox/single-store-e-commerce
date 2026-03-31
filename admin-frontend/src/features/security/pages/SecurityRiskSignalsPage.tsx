import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUp, ArrowUpRight, CheckCircle, Download, RefreshCw, TrendingUp } from "lucide-react";

import {
  StitchBreadcrumbs,
  StitchFieldLabel,
  StitchFilterPanel,
  StitchPageBody,
  stitchInputClass,
  stitchSelectClass
} from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  getSecurityDashboard,
  listRiskSignals,
  reviewRiskSignal
} from "@/features/security/api/admin-security.api";
import { SecurityHubNav } from "@/features/security/components/SecurityHubNav";
import {
  downloadUtf8Csv,
  humanizeEnumLabel,
  relativeShort,
  securityTableScrollClass,
  stitchVisibleLinkClass,
  summarizeUserRef,
  timelinePayloadLine
} from "@/features/security/lib/securityUiHelpers";

const REVIEW_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending review" },
  { value: "reviewed", label: "Reviewed" }
] as const;

const MIN_SCORE_OPTS: { value: string; label: string }[] = [
  { value: "", label: "All scores" },
  { value: "90", label: "90+ (critical band)" },
  { value: "70", label: "70+ (high band)" },
  { value: "40", label: "40+ (medium band)" }
];

const scoreBarColor = (score: number) => {
  if (score >= 90) return "bg-[#ba1a1a]";
  if (score >= 70) return "bg-orange-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-[#737685]";
};

const statusChip = (reviewed: boolean, score: number) => {
  if (reviewed) {
    return (
      <span className="rounded border border-[#737685]/30 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-tighter text-[#5b5e68]">
        Reviewed
      </span>
    );
  }
  if (score >= 90) {
    return (
      <span className="rounded border border-[#ba1a1a] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-tighter text-[#ba1a1a]">
        Critical
      </span>
    );
  }
  if (score >= 70) {
    return (
      <span className="rounded border border-orange-500 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-tighter text-orange-600">
        High
      </span>
    );
  }
  return (
    <span className="rounded border border-amber-500 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-tighter text-amber-600">
      Medium
    </span>
  );
};

export const SecurityRiskSignalsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [minScore, setMinScore] = useState("");
  const [reviewFilter, setReviewFilter] = useState<"" | "pending" | "reviewed">("");

  const queryKey = useMemo(
    () => ["admin-risk-signals", page, typeFilter, minScore, reviewFilter] as const,
    [page, typeFilter, minScore, reviewFilter]
  );

  const dashQuery = useQuery({
    queryKey: ["admin-security-dashboard-metrics"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getSecurityDashboard(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const q = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const reviewed =
        reviewFilter === "pending" ? false : reviewFilter === "reviewed" ? true : undefined;
      const min = minScore ? Number(minScore) : undefined;
      return listRiskSignals(accessToken, {
        page,
        page_size: 20,
        ...(typeFilter.trim() ? { type: typeFilter.trim() } : {}),
        ...(min != null && !Number.isNaN(min) ? { minScore: min } : {}),
        ...(reviewed !== undefined ? { reviewed } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const reviewMut = useMutation({
    mutationFn: async (input: { id: string; disposition: "reviewed" | "escalated" }) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return reviewRiskSignal(accessToken, input.id, { disposition: input.disposition });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-risk-signals"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-security-dashboard-metrics"] });
    }
  });

  const items = q.data?.data.items ?? [];
  const meta = q.data?.meta;
  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const ro = dashQuery.data?.data.metrics.riskSignalsOps;
  const unrev = dashQuery.data?.data.metrics.unreviewedRiskSignals ?? 0;
  const kpis = {
    elevated: ro?.unreviewedScoreGte70 ?? 0,
    unreviewed: unrev,
    volume24h: ro?.createdLast24h ?? 0
  };

  return (
    <StitchPageBody className="w-full max-w-[1600px]">
      <SecurityHubNav />
      <StitchBreadcrumbs
        emphasizeLinks
        items={[{ label: "Alerts", to: "/admin/security/alerts" }, { label: "Risk & fraud review" }]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">Risk signals</h1>
          <p className="mt-1 text-sm text-[#434654]">
            Operational anomalies and flagged behavioral patterns requiring analyst attention.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              downloadUtf8Csv(
                `risk-signals-page-${page}.csv`,
                ["id", "type", "score", "reviewedAt", "user", "createdAt"],
                items.map((r) => [
                  r.id,
                  r.type,
                  r.score != null ? String(r.score) : "",
                  r.reviewedAt ?? "",
                  summarizeUserRef(r.user),
                  r.createdAt
                ])
              );
            }}
            className="flex items-center gap-2 rounded border border-[#1653cc]/35 bg-white px-4 py-2 text-xs font-bold text-[#1653cc] underline decoration-[#1653cc]/40 underline-offset-2 shadow-sm hover:bg-[#f2f3ff]"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export dataset
          </button>
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-risk-signals"] })}
            className="flex items-center gap-2 rounded bg-[#1653cc] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6de6]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      <p className="text-[10px] font-medium uppercase tracking-wider text-[#737685]">
        KPI tiles mirror security dashboard aggregates (studio-wide).
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative flex h-32 flex-col justify-between overflow-hidden rounded-sm bg-white p-6 shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#ba1a1a]" />
          <div className="flex items-start justify-between">
            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685]">
              Unreviewed · score 70+
            </span>
          </div>
          <div className="flex items-end justify-between">
            <span className="font-headline text-4xl font-bold text-[#181b25]">{kpis.elevated}</span>
            <span className="flex items-center rounded bg-[#ffdad6]/40 px-2 py-0.5 font-mono text-[0.6875rem] text-[#ba1a1a]">
              <ArrowUp className="mr-1 h-3 w-3" aria-hidden />
              watchlist
            </span>
          </div>
        </div>
        <div className="relative flex h-32 flex-col justify-between overflow-hidden rounded-sm bg-white p-6 shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#1653cc]" />
          <div className="flex items-start justify-between">
            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685]">
              Unreviewed (all)
            </span>
          </div>
          <div className="flex items-end justify-between">
            <span className="font-headline text-4xl font-bold text-[#181b25]">{kpis.unreviewed}</span>
            <span className="rounded border border-[#c3c6d6] px-2 py-0.5 font-mono text-[0.6875rem] text-[#5b5e68]">
              queue
            </span>
          </div>
        </div>
        <div className="relative flex h-32 flex-col justify-between overflow-hidden rounded-sm bg-white p-6 shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#006b2d]" />
          <div className="flex items-start justify-between">
            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685]">New (24h)</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="font-headline text-4xl font-bold text-[#181b25]">{kpis.volume24h}</span>
            <span className="flex items-center text-[0.6875rem] text-[#5b5e68]">
              <TrendingUp className="mr-1 h-3 w-3" aria-hidden />
              signals
            </span>
          </div>
        </div>
      </div>

      <StitchFilterPanel className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <div className="min-w-0 flex-1 lg:min-w-[160px]">
          <StitchFieldLabel>Risk category / type</StitchFieldLabel>
          <input
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by signal type code…"
            className={stitchInputClass}
          />
        </div>
        <div className="min-w-0 lg:min-w-[140px]">
          <StitchFieldLabel>Minimum score</StitchFieldLabel>
          <select
            value={minScore}
            onChange={(e) => {
              setMinScore(e.target.value);
              setPage(1);
            }}
            className={stitchSelectClass}
          >
            {MIN_SCORE_OPTS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 lg:min-w-[180px]">
          <StitchFieldLabel>Review status</StitchFieldLabel>
          <select
            value={reviewFilter}
            onChange={(e) => {
              setReviewFilter(e.target.value as "" | "pending" | "reviewed");
              setPage(1);
            }}
            className={stitchSelectClass}
          >
            {REVIEW_FILTERS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </StitchFilterPanel>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[#60626c]">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
          <div className={securityTableScrollClass}>
            <table className="min-w-[1040px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#c3c6d6]/10 bg-[#f2f3ff]">
                  {[
                    "Signal #",
                    "Category",
                    "Risk score",
                    "Description",
                    "Entity linked",
                    "Detected",
                    "Status",
                    "Actions"
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#737685] ${
                        h === "Actions" ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d6]/10">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#60626c]">
                      No risk signals for these filters.
                    </td>
                  </tr>
                ) : (
                  items.map((r) => {
                    const score = r.score != null ? Math.round(Math.min(100, Math.max(0, r.score))) : 0;
                    const reviewed = Boolean(r.reviewedAt);
                    const desc = timelinePayloadLine(r.metadata);
                    return (
                      <tr key={r.id} className="group transition-colors hover:bg-[#e6e7f6]/60">
                        <td className="px-6 py-4 font-mono text-[0.75rem] font-semibold text-[#181b25]">
                          {r.id.slice(0, 8).toUpperCase()}…
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-xs font-medium text-[#181b25]">
                            <span className={`mr-2 h-2 w-2 rounded-full ${scoreBarColor(score)}`} />
                            {humanizeEnumLabel(r.type.replace(/[._]/g, " "))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="relative h-1.5 w-24 rounded-full bg-[#e0e2f0]">
                            <div
                              className={`absolute left-0 top-0 h-full rounded-full ${scoreBarColor(score)}`}
                              style={{ width: `${score}%` }}
                            />
                            <span className="absolute -top-5 right-0 font-mono text-[0.65rem] font-bold text-[#181b25]">
                              {r.score != null ? score : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-xs truncate px-6 py-4 text-xs text-[#434654]" title={desc}>
                          {desc}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {r.user ? (
                            <Link to={`/admin/customers/${r.user.id}`} className={stitchVisibleLinkClass}>
                              {summarizeUserRef(r.user)}
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            </Link>
                          ) : (
                            <span className="font-medium text-[#737685]">Unlinked</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-[#5b5e68]">{relativeShort(r.createdAt)}</td>
                        <td className="px-6 py-4">{statusChip(reviewed, score)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                            <button
                              type="button"
                              disabled={reviewed || reviewMut.isPending}
                              onClick={() => reviewMut.mutate({ id: r.id, disposition: "reviewed" })}
                              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#006b2d] underline decoration-[#006b2d]/40 underline-offset-2 disabled:opacity-30"
                            >
                              <CheckCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Mark reviewed
                            </button>
                            <button
                              type="button"
                              disabled={reviewMut.isPending}
                              onClick={() => reviewMut.mutate({ id: r.id, disposition: "escalated" })}
                              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#ba1a1a] underline decoration-[#ba1a1a]/40 underline-offset-2 disabled:opacity-30"
                            >
                              <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Escalate
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#60626c]">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded-lg border px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span>
            {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= meta.totalPages}
            className="rounded-lg border px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </StitchPageBody>
  );
};
