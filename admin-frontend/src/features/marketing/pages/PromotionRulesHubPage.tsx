import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { MarketingWorkspaceNav, StitchPageBody } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, listContractPromotions, type PromotionListItem } from "@/features/marketing/api/admin-marketing.api";
import { formatAdminDate, humanizeLabel } from "@/features/marketing/lib/marketingPresentation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export const PromotionRulesHubPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ["admin-promotion-rules-hub", page],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listContractPromotions(accessToken, { page, page_size: 50 });
    },
    enabled: Boolean(accessToken)
  });

  const items = q.data?.data.items ?? [];
  const meta = q.data?.meta;
  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const rows = items.map((p: PromotionListItem) => [
    <span key={`n-${p.id}`} className="font-semibold text-[#181b25]">
      {p.name}
    </span>,
    <span key={`s-${p.id}`} className="text-xs font-bold uppercase tracking-wider text-slate-600">
      {humanizeLabel(p.status)}
    </span>,
    <span key={`r-${p.id}`} className="tabular-nums text-sm text-slate-700">
      {p.rules?.length ?? 0}
    </span>,
    <span key={`u-${p.id}`} className="text-xs text-slate-500">
      {formatAdminDate(p.updatedAt)}
    </span>,
    <div key={`a-${p.id}`} className="flex justify-end">
      <Link
        to={`/admin/marketing/promotions/${p.id}/rules`}
        className="inline-flex items-center gap-1 rounded-lg bg-[#1653cc] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3b6de6]"
      >
        <MaterialIcon name="account_tree" className="text-sm text-white" />
        Rules
      </Link>
    </div>
  ]);

  return (
    <StitchPageBody>
      <MarketingWorkspaceNav />
      <PageHeader
        title="Promotion rules"
        titleSize="deck"
        description="Choose a promotion to view or edit its targeting rules."
        actions={
          <Link
            to="/admin/marketing/promotions/global/rules"
            className="flex items-center gap-2 rounded-lg border border-[#1653cc]/30 bg-white px-4 py-2 text-sm font-semibold text-[#1653cc] shadow-sm hover:bg-[#f2f3ff]"
          >
            <MaterialIcon name="public" className="text-lg" />
            Global store rules
          </Link>
        }
      />
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}
      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading promotions…</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Promotion", "Status", "Rules", "Updated", ""]}
            rows={rows}
            rowKeys={items.map((p) => p.id)}
            emptyState="No promotions found."
          />
        </div>
      )}
      {meta && meta.totalPages > 1 ? (
        <div className="flex flex-wrap justify-between gap-3 text-sm text-slate-500">
          <span>
            Page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </StitchPageBody>
  );
};
