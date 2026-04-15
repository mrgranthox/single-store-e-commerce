import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { Download, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";

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
  listLoginEvents,
  type LoginEventItem
} from "@/features/security/api/admin-security.api";
import { SecurityHubNav } from "@/features/security/components/SecurityHubNav";
import { formatDateTime } from "@/lib/format";
import {
  downloadUtf8Csv,
  relativeShort,
  securityTableScrollClass
} from "@/features/security/lib/securityUiHelpers";

const outcomeChip = (success: boolean) =>
  success ? (
    <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-emerald-800">
      <ShieldCheck className="h-3 w-3" aria-hidden />
      Success
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-red-800">
      <ShieldAlert className="h-3 w-3" aria-hidden />
      Failed
    </span>
  );


const summarizeLocation = (item: LoginEventItem) => {
  const parts = [item.ipRegion, item.ipCountry].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
};

export const SecurityLoginEventsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [emailDraft, setEmailDraft] = useState("");
  const [email, setEmail] = useState("");
  const [outcome, setOutcome] = useState<"" | "success" | "failure">("");

  const queryKey = useMemo(
    () => ["admin-security-login-events", page, email, outcome] as const,
    [page, email, outcome]
  );

  const query = useAuthedQuery(
    queryKey,
    (token) =>
      listLoginEvents(token, {
        page,
        page_size: 20,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(outcome === "success" ? { success: true } : {}),
        ...(outcome === "failure" ? { success: false } : {}) }),
  );

  const items = query.data?.data.items ?? [];
  const meta = query.data?.meta;
  const err =
    query.error instanceof ApiError ? query.error.message : query.error instanceof Error ? query.error.message : null;

  const applyFilters = () => {
    setPage(1);
    setEmail(emailDraft);
  };

  const clearFilters = () => {
    setEmailDraft("");
    setEmail("");
    setOutcome("");
    setPage(1);
  };

  const kpis = useMemo(() => {
    const successCount = items.filter((item) => item.success).length;
    const failureCount = items.length - successCount;
    const uniqueEmails = new Set(items.map((item) => item.email.toLowerCase())).size;
    return {
      successCount,
      failureCount,
      uniqueEmails
    };
  }, [items]);

  return (
    <StitchPageBody className="w-full max-w-[1600px]">
      <SecurityHubNav />
      <StitchBreadcrumbs
        emphasizeLinks
        items={[{ label: "Security events", to: "/admin/security/events" }, { label: "Login events" }]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">Login events</h1>
          <p className="mt-1 text-sm text-[#434654]">
            Auth success and failure records for operator review, user lookup, and incident follow-up.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              downloadUtf8Csv(
                `login-events-page-${page}.csv`,
                ["id", "email", "success", "failureReason", "location", "createdAt"],
                items.map((item) => [
                  item.id,
                  item.email,
                  item.success ? "true" : "false",
                  item.failureReason ?? "",
                  summarizeLocation(item),
                  item.createdAt
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
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-security-login-events"] })}
            className="flex items-center gap-2 rounded bg-[#1653cc] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6de6]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="relative flex h-28 flex-col justify-between overflow-hidden rounded-sm bg-white p-6 shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#006b2d]" />
          <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685]">Success on page</span>
          <span className="font-headline text-4xl font-bold text-[#181b25]">{kpis.successCount}</span>
        </div>
        <div className="relative flex h-28 flex-col justify-between overflow-hidden rounded-sm bg-white p-6 shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#ba1a1a]" />
          <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685]">Failures on page</span>
          <span className="font-headline text-4xl font-bold text-[#181b25]">{kpis.failureCount}</span>
        </div>
        <div className="relative flex h-28 flex-col justify-between overflow-hidden rounded-sm bg-white p-6 shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#1653cc]" />
          <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#737685]">Unique emails</span>
          <span className="font-headline text-4xl font-bold text-[#181b25]">{kpis.uniqueEmails}</span>
        </div>
      </div>

      <StitchFilterPanel className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <div className="min-w-0 flex-1 lg:min-w-[240px]">
          <StitchFieldLabel>Email</StitchFieldLabel>
          <input
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && applyFilters()}
            placeholder="Filter by email…"
            className={stitchInputClass}
          />
        </div>
        <div className="min-w-0 flex-1 lg:min-w-[180px]">
          <StitchFieldLabel>Outcome</StitchFieldLabel>
          <select
            value={outcome}
            onChange={(event) => {
              setOutcome(event.target.value as "" | "success" | "failure");
              setPage(1);
            }}
            className={stitchSelectClass}
          >
            <option value="">All outcomes</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded bg-[#1653cc] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3b6de6]"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded border border-[#c3c6d6] bg-white px-4 py-2 text-xs font-semibold text-[#434654] hover:bg-[#f2f3ff]"
          >
            Clear
          </button>
        </div>
      </StitchFilterPanel>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      <div className={`${securityTableScrollClass} overflow-hidden rounded-sm bg-white shadow-sm`}>
        <table className="min-w-full border-collapse text-left">
          <thead className="border-b border-[#e0e2f0] bg-[#f2f3ff]">
            <tr>
              {(["Email", "Outcome", "Failure reason", "Location", "Actor", "Created"] as const).map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#737685]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef1f8]">
            {query.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#737685]">
                  Loading login events…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#737685]">
                  No login events matched the current filters.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="align-top transition-colors hover:bg-[#f8f9fb]">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[#181b25]">{item.email}</span>
                      <span className="font-mono text-[11px] text-[#737685]">{item.id.slice(0, 10)}…</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{outcomeChip(item.success)}</td>
                  <td className="px-4 py-3 text-xs text-[#434654]">{item.failureReason ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-[#434654]">{summarizeLocation(item)}</td>
                  <td className="px-4 py-3 text-xs text-[#434654]">
                    {item.adminUser?.email ?? item.user?.email ?? "Anonymous / public"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-[#434654]">{formatDateTime(item.createdAt)}</span>
                      <span className="text-[11px] text-[#737685]">{relativeShort(item.createdAt)}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#5b5e68]">
          <span>
            Showing {items.length ? (meta.page - 1) * meta.limit + 1 : 0} to{" "}
            {(meta.page - 1) * meta.limit + items.length} of {meta.totalItems} login events
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded border border-[#c3c6d6] px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="rounded bg-[#1653cc] px-3 py-1.5 font-bold text-white">{meta.page}</span>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded border border-[#c3c6d6] px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </StitchPageBody>
  );
};
