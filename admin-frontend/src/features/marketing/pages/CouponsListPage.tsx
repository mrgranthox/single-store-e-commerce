import { useEffect, useMemo, useState } from "react";
import { marketingKeys } from "@/lib/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { Link } from "react-router-dom";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { QueryError } from "@/components/primitives/QueryError";
import { SkeletonTable } from "@/components/primitives/Skeleton";
import { MarketingWorkspaceNav, StitchFilterPanel, StitchKpiMicro, StitchPageBody } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  deleteAdminCoupon,
  disableAdminCoupon,
  getAdminCouponAnalytics,
  listAdminCoupons,
  updateAdminCoupon,
  type CouponListItem
} from "@/features/marketing/api/admin-marketing.api";
import { CouponFormPanel } from "@/features/marketing/pages/CouponFormPanel";
import {
  formatAdminDate,
  formatCentsMoney,
  formatDiscountStitch,
  humanizeLabel,
  statusCount
} from "@/features/marketing/lib/marketingPresentation";
import { downloadCsv } from "@/lib/csvDownload";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useListFilters } from "@/lib/hooks/useListFilters";

const COUPON_LIST_DEFAULTS = {
  q: "",
  status: "",
  discount_type: "",
  active_from: "",
  active_to: "",
  usage_floor: ""
};

const STATUSES = ["", "ACTIVE", "DISABLED", "EXPIRED"] as const;
const DISCOUNT_TYPES = ["", "PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"] as const;

const CouponDisableAction = ({ coupon }: { coupon: CouponListItem }) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const mut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return disableAdminCoupon(accessToken, coupon.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketingKeys.coupons() });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-coupon-analytics-kpi"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-coupon-analytics"] });
    }
  });

  if (coupon.status !== "ACTIVE") {
    return <span className="inline-block w-9" aria-hidden />;
  }

  return (
    <button
      type="button"
      disabled={mut.isPending}
      title="Disable coupon"
      aria-label={`Disable ${coupon.code}`}
      onClick={() => mut.mutate()}
      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-[#ba1a1a] disabled:opacity-50"
    >
      <MaterialIcon name="block" className="text-lg" />
    </button>
  );
};

const CouponRestoreAction = ({ coupon }: { coupon: CouponListItem }) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const mut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return updateAdminCoupon(accessToken, coupon.id, { status: "ACTIVE" });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketingKeys.coupons() });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-coupon-analytics-kpi"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-coupon-analytics"] });
    }
  });

  if (coupon.status !== "DISABLED") {
    return null;
  }

  return (
    <button
      type="button"
      disabled={mut.isPending}
      title="Restore coupon (set active)"
      aria-label={`Restore ${coupon.code}`}
      onClick={() => mut.mutate()}
      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#006b2d]/10 hover:text-[#006b2d] disabled:opacity-50"
    >
      <MaterialIcon name="restart_alt" className="text-lg" />
    </button>
  );
};

const CouponStatusCell = ({ status }: { status: string }) => {
  const u = status.toUpperCase();
  const isActive = u === "ACTIVE";
  const isExpired = u === "EXPIRED";
  const dot = isActive ? "bg-[#006b2d]" : isExpired ? "bg-[#ba1a1a]" : "bg-slate-400";
  const text = isActive ? "text-[#006b2d]" : isExpired ? "text-[#ba1a1a]" : "text-slate-600";
  return (
    <div className={`flex items-center text-xs font-bold uppercase tracking-wider ${text}`}>
      <span className={`mr-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {humanizeLabel(status)}
    </div>
  );
};

export const CouponsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const { filters, page, set, setPage, setMany, reset } = useListFilters({ defaults: COUPON_LIST_DEFAULTS });
  const [couponPanel, setCouponPanel] = useState<"closed" | "create" | "edit">("closed");
  const [editCoupon, setEditCoupon] = useState<CouponListItem | null>(null);
  const [deleteCouponTarget, setDeleteCouponTarget] = useState<CouponListItem | null>(null);
  const [deleteCouponErr, setDeleteCouponErr] = useState<string | null>(null);
  const [qDraft, setQDraft] = useState("");

  const usageFloorNum = Math.min(100, Math.max(0, Number(filters.usage_floor) || 0));

  useEffect(() => {
    setQDraft(filters.q);
  }, [filters.q]);

  const queryKey = useMemo(
    () =>
      [
        marketingKeys.coupons()[0],
        page,
        filters.q,
        filters.status,
        filters.discount_type,
        filters.active_from,
        filters.active_to,
        filters.usage_floor
      ] as const,
    [page, filters.q, filters.status, filters.discount_type, filters.active_from, filters.active_to, filters.usage_floor]
  );

  const listQuery = useAuthedQuery(queryKey, (token) => {
    const dt = filters.discount_type as (typeof DISCOUNT_TYPES)[number];
    return listAdminCoupons(token, {
      page,
      page_size: 20,
      ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(dt ? { discount_type: dt } : {}),
      ...(filters.active_from.trim() ? { active_from: filters.active_from.trim() } : {}),
      ...(filters.active_to.trim() ? { active_to: filters.active_to.trim() } : {}),
      ...(usageFloorNum > 0 ? { usage_ratio_min: usageFloorNum, usage_ratio_max: 100 } : {})
    });
  });

  const analyticsKpi = useAuthedQuery(
  ["admin-marketing-coupon-analytics-kpi"],
  (token) => getAdminCouponAnalytics(token, { period_days: 30 })
);

  const items = listQuery.data?.data.items ?? [];

  const invalidateCouponQueries = () => {
    void queryClient.invalidateQueries({ queryKey: marketingKeys.coupons() });
    void queryClient.invalidateQueries({ queryKey: ["admin-marketing-coupon-analytics-kpi"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-marketing-coupon-analytics"] });
  };

  const deleteCouponMut = useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return deleteAdminCoupon(accessToken, id);
    },
    onSuccess: () => {
      setDeleteCouponTarget(null);
      setDeleteCouponErr(null);
      invalidateCouponQueries();
    },
    onError: (e) => {
      setDeleteCouponErr(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Delete failed."
      );
    }
  });

  const meta = listQuery.data?.meta;
  const sc = analyticsKpi.data?.data.statusCounts ?? [];
  const redemptionTotal = analyticsKpi.data?.data.redemptionCount ?? 0;
  const lifetimeSavingsCents = analyticsKpi.data?.data.lifetimeEstimatedDiscountCents ?? 0;
  const avgUsage = analyticsKpi.data?.data.averageUsageRatePercent;

  const openEditCoupon = (c: CouponListItem) => {
    setEditCoupon(c);
    setCouponPanel("edit");
  };

  const rows = items.map((c) => {
    const limit = c.maxRedemptions;
    const used = c.redemptionCount;
    const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : limit ? 0 : 100;
    return [
      <div key={`code-${c.id}`} className="group flex items-center gap-2">
        <span className="font-mono text-sm font-medium text-[#1653cc]">{c.code}</span>
        <button
          type="button"
          title="Copy code"
          className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-[#1653cc]"
          onClick={() => void navigator.clipboard.writeText(c.code)}
        >
          <MaterialIcon name="content_copy" className="text-sm" />
        </button>
      </div>,
      <span
        key={`ty-${c.id}`}
        className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-600"
      >
        {humanizeLabel(c.discountType).toUpperCase()}
      </span>,
      <span key={`disc-${c.id}`} className="text-sm font-bold text-[#181b25]">
        {formatDiscountStitch(c)}
      </span>,
      <span key={`min-${c.id}`} className="font-mono text-xs text-slate-500">
        {formatCentsMoney(c.minOrderAmountCents)}
      </span>,
      <div key={`use-${c.id}`} className="max-w-[100px]">
        <div className="mb-1 flex justify-between text-xs font-bold">
          <span>{used}</span>
          <span className="text-slate-400">{limit != null ? `/ ${limit}` : "—"}</span>
        </div>
        <div className="h-1 w-full rounded-full bg-slate-100">
          <div className="h-1 rounded-full bg-[#1653cc]" style={{ width: `${pct}%` }} />
        </div>
      </div>,
      <CouponStatusCell key={`st-${c.id}`} status={c.status} />,
      <span key={`ex-${c.id}`} className="text-xs text-slate-500">
        {c.activeTo ? formatAdminDate(c.activeTo) : "—"}
      </span>,
      <div key={`a-${c.id}`} className="flex justify-end gap-1">
        <button
          type="button"
          title="Edit"
          aria-label={`Edit ${c.code}`}
          onClick={() => openEditCoupon(c)}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#1653cc]/5 hover:text-[#1653cc]"
        >
          <MaterialIcon name="edit" className="text-lg" />
        </button>
        <Link
          to="/admin/marketing/coupons/analytics"
          title="View analytics"
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#1653cc]/5 hover:text-[#1653cc]"
        >
          <MaterialIcon name="analytics" className="text-lg" />
        </Link>
        <CouponRestoreAction coupon={c} />
        <CouponDisableAction coupon={c} />
        <button
          type="button"
          title={
            c.redemptionCount > 0
              ? "Cannot delete: redemptions exist"
              : "Delete coupon"
          }
          aria-label={`Delete ${c.code}`}
          disabled={c.redemptionCount > 0}
          onClick={() => {
            setDeleteCouponErr(null);
            setDeleteCouponTarget(c);
          }}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-[#ba1a1a] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <MaterialIcon name="delete" className="text-lg" />
        </button>
      </div>
    ];
  });

  const activeCoupons = statusCount(sc, "ACTIVE");
  const expiredCoupons = statusCount(sc, "EXPIRED");

  const exportCouponsCsv = () => {
    const headers = [
      "Code",
      "Status",
      "Discount type",
      "Discount display",
      "Min order (GHS)",
      "Redemptions",
      "Max redemptions",
      "Active from",
      "Active to",
      "Updated"
    ];
    const rows = items.map((c) => [
      c.code,
      c.status,
      c.discountType,
      formatDiscountStitch(c),
      c.minOrderAmountCents != null ? (c.minOrderAmountCents / 100).toFixed(2) : "",
      c.redemptionCount,
      c.maxRedemptions ?? "",
      c.activeFrom ? formatAdminDate(c.activeFrom) : "",
      c.activeTo ? formatAdminDate(c.activeTo) : "",
      formatAdminDate(c.updatedAt)
    ]);
    downloadCsv(`coupons-export-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <StitchPageBody>
      <MarketingWorkspaceNav />
      <PageHeader
        title="Coupons"
        titleSize="deck"
        description="Create and monitor promotional codes, usage limits, and eligibility."
        autoBreadcrumbs={false}
        breadcrumbItems={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Coupon management" }
        ]}
        actionMenuItems={[
          {
            id: "refresh-coupons",
            label: "Refresh data",
            onSelect: () => {
              void queryClient.invalidateQueries({ queryKey: marketingKeys.coupons() });
              void queryClient.invalidateQueries({ queryKey: ["admin-marketing-coupon-analytics-kpi"] });
            }
          }
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCouponsCsv}
              disabled={items.length === 0}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              <MaterialIcon name="download" className="text-lg" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setEditCoupon(null);
                setCouponPanel("create");
              }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1653cc]/20 transition-all hover:shadow-[#1653cc]/30"
            >
              <MaterialIcon name="add" className="text-lg text-white" />
              Create Coupon
            </button>
          </div>
        }
      />

      <p className="text-xs text-slate-500">
        All-time redemptions recorded: <span className="font-semibold text-[#181b25]">{redemptionTotal.toLocaleString()}</span>
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StitchKpiMicro label="Active coupons" value={activeCoupons} footer="Live" barClass="bg-[#1653cc]" />
        <StitchKpiMicro label="Est. savings" value={formatCentsMoney(lifetimeSavingsCents)} footer="Lifetime modeled" barClass="bg-emerald-700" />
        <StitchKpiMicro label="Expired" value={expiredCoupons} footer="Review" barClass="bg-[#ba1a1a]" />
        <StitchKpiMicro label="Avg usage" value={avgUsage != null ? `${avgUsage.toFixed(1)}%` : "—"} footer="Of limit" barClass="bg-slate-300" />
      </div>

      <StitchFilterPanel className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase text-slate-500">Status</span>
          <select
            value={filters.status}
            onChange={(e) => set("status", e.target.value)}
            className="rounded-lg border-none bg-[#f8f9fb] text-xs font-medium text-[#181b25] focus:ring-1 focus:ring-[#1653cc]"
          >
            {STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? humanizeLabel(s) : "All statuses"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase text-slate-500">Type</span>
          <select
            value={filters.discount_type}
            onChange={(e) => set("discount_type", e.target.value)}
            className="rounded-lg border-none bg-[#f8f9fb] text-xs font-medium text-[#181b25] focus:ring-1 focus:ring-[#1653cc]"
          >
            <option value="">All types</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed amount</option>
            <option value="FREE_SHIPPING">Free shipping</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 lg:col-span-1">
          <span className="text-xs font-bold uppercase text-slate-500">Search code</span>
          <div className="relative">
            <MaterialIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"
            />
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setMany({ q: qDraft.trim() });
                }
              }}
              placeholder="Filter by code…"
              className="w-full rounded-lg border-none bg-[#f8f9fb] py-2 pl-9 text-xs font-medium focus:ring-1 focus:ring-[#1653cc]"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase text-slate-500">Active from</span>
          <input
            type="date"
            value={filters.active_from}
            onChange={(e) => set("active_from", e.target.value)}
            className="rounded-lg border-none bg-[#f8f9fb] px-2 py-2 text-xs font-medium text-[#181b25] focus:ring-1 focus:ring-[#1653cc]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase text-slate-500">Active through</span>
          <input
            type="date"
            value={filters.active_to}
            onChange={(e) => set("active_to", e.target.value)}
            className="rounded-lg border-none bg-[#f8f9fb] px-2 py-2 text-xs font-medium text-[#181b25] focus:ring-1 focus:ring-[#1653cc]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase text-slate-500">
            Min usage of cap ({usageFloorNum}%)
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={usageFloorNum}
            onChange={(e) => set("usage_floor", e.target.value)}
            className="mt-2 h-1 w-full accent-[#1653cc]"
          />
        </label>
        <div className="flex justify-end xl:col-span-1">
          <button
            type="button"
            onClick={() => {
              reset();
              setQDraft("");
            }}
            className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200"
          >
            Clear filters
          </button>
        </div>
      </StitchFilterPanel>

      {listQuery.isError ? (
        <QueryError label="coupons" error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : null}

      {listQuery.isLoading ? (
        <SkeletonTable rows={8} cols={8} label="Loading coupons" />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Code", "Type", "Discount", "Min order", "Usage / limit", "Status", "Expires", "Actions"]}
            rows={rows}
            rowKeys={items.map((c) => c.id)}
            emptyState="No coupons match the current filters."
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
              onClick={() => setPage(Math.max(1, page - 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {couponPanel !== "closed" ? (
        <CouponFormPanel
          key={couponPanel === "edit" && editCoupon ? editCoupon.id : "new"}
          mode={couponPanel === "create" ? "create" : "edit"}
          coupon={couponPanel === "edit" ? editCoupon : null}
          onClose={() => {
            setCouponPanel("closed");
            setEditCoupon(null);
          }}
          onSaved={() => {
            invalidateCouponQueries();
            setCouponPanel("closed");
            setEditCoupon(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteCouponTarget)}
        title="Delete this coupon?"
        body={
          deleteCouponErr
            ? deleteCouponErr
            : "Only coupons with zero recorded redemptions can be deleted. This cannot be undone."
        }
        confirmLabel="Delete"
        danger
        confirmDisabled={deleteCouponMut.isPending}
        onClose={() => {
          setDeleteCouponTarget(null);
          setDeleteCouponErr(null);
        }}
        onConfirm={() => {
          if (!deleteCouponTarget) {
            return;
          }
          setDeleteCouponErr(null);
          deleteCouponMut.mutate(deleteCouponTarget.id);
        }}
      />
    </StitchPageBody>
  );
};
