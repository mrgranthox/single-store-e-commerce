import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { MarketingWorkspaceNav, StitchPageBody } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  deleteAdminPromotion,
  listContractPromotions,
  updateAdminPromotion,
  type PromotionListItem
} from "@/features/marketing/api/admin-marketing.api";
import { PromotionFormPanel } from "@/features/marketing/pages/PromotionFormPanel";
import { formatAdminDate, formatCentsMoney, humanizeLabel } from "@/features/marketing/lib/marketingPresentation";
import { downloadCsv } from "@/lib/csvDownload";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

const STATUSES = ["", "ACTIVE", "DISABLED", "ARCHIVED"] as const;

const promotionToneIcon = (name: string, index: number) => {
  const n = name.toLowerCase();
  if (n.includes("welcome") || n.includes("first")) {
    return { icon: "shopping_cart" as const, wrap: "bg-[#006b2d]/10 text-[#006b2d]" };
  }
  if (n.includes("black") || n.includes("flash")) {
    return { icon: "schedule" as const, wrap: "bg-[#3b6de6]/10 text-[#3b6de6]" };
  }
  const cycle = [
    { icon: "local_offer" as const, wrap: "bg-[#1653cc]/10 text-[#1653cc]" },
    { icon: "shopping_cart" as const, wrap: "bg-[#006b2d]/10 text-[#006b2d]" },
    { icon: "schedule" as const, wrap: "bg-[#3b6de6]/10 text-[#3b6de6]" }
  ];
  return cycle[index % cycle.length];
};

const promotionRuleSummary = (p: PromotionListItem) => {
  const rules = p.rules ?? [];
  if (rules.length === 0) {
    return { type: "—", discount: "—" };
  }
  const types = [...new Set(rules.map((r) => r.ruleType))];
  const typeLabel = types.length === 1 ? humanizeLabel(types[0] ?? "").toUpperCase() : "MIXED";
  const mins = rules.map((r) => r.minOrderAmountCents).filter((x): x is number => x != null && x > 0);
  const discount =
    mins.length > 0
      ? `From ${formatCentsMoney(Math.min(...mins))} order`
      : `${rules.length} rule${rules.length === 1 ? "" : "s"}`;
  return { type: typeLabel, discount };
};

const StatusDot = ({ status }: { status: string }) => {
  const u = status.toUpperCase();
  const active = u === "ACTIVE" || u === "PUBLISHED";
  const disabled = u === "DISABLED";
  const dot = active ? "bg-[#006b2d]" : disabled ? "bg-[#ba1a1a]" : "bg-[#1653cc]";
  const text = active ? "text-[#006b2d]" : disabled ? "text-[#ba1a1a]" : "text-[#1653cc]";
  return (
    <div className={`flex items-center gap-2 ${text}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="text-[11px] font-semibold uppercase tracking-wider">{humanizeLabel(status)}</span>
    </div>
  );
};

export const PromotionsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"grid" | "list">("list");
  const [promoPanel, setPromoPanel] = useState<"closed" | "create" | "edit" | "view">("closed");
  const [panelPromotion, setPanelPromotion] = useState<PromotionListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromotionListItem | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const invalidatePromotions = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-promotions-contract"] });
  };

  const patchPromotionMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return updateAdminPromotion(accessToken, id, { status });
    },
    onSuccess: invalidatePromotions
  });

  const deletePromotionMut = useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return deleteAdminPromotion(accessToken, id);
    },
    onSuccess: () => {
      invalidatePromotions();
      setDeleteTarget(null);
      setDeleteErr(null);
    },
    onError: (e) => {
      setDeleteErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Delete failed.");
    }
  });

  const openCreate = () => {
    setPanelPromotion(null);
    setPromoPanel("create");
  };
  const openView = (p: PromotionListItem) => {
    setPanelPromotion(p);
    setPromoPanel("view");
  };
  const openEdit = (p: PromotionListItem) => {
    setPanelPromotion(p);
    setPromoPanel("edit");
  };

  const patchBusy = patchPromotionMut.isPending;
  const busyId = patchPromotionMut.variables?.id;

  const renderPromotionQuickActions = (p: PromotionListItem, reactKey?: string) => {
    const st = p.status.toUpperCase();
    const isActive = st === "ACTIVE" || st === "PUBLISHED";
    const isArchived = st === "ARCHIVED";
    const rowBusy = patchBusy && busyId === p.id;
    return (
      <div key={reactKey} className="flex flex-wrap justify-end gap-0.5">
        <Link
          to={`/admin/marketing/promotions/${p.id}/rules`}
          title="Rules"
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-[#1653cc]"
        >
          <MaterialIcon name="account_tree" className="text-sm" />
        </Link>
        <button
          type="button"
          title="View"
          onClick={() => openView(p)}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-[#1653cc]"
        >
          <MaterialIcon name="visibility" className="text-sm" />
        </button>
        <button
          type="button"
          title="Edit"
          onClick={() => openEdit(p)}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-[#1653cc]"
        >
          <MaterialIcon name="edit" className="text-sm" />
        </button>
        {!isActive ? (
          <button
            type="button"
            title="Publish (set active)"
            disabled={rowBusy}
            onClick={() => patchPromotionMut.mutate({ id: p.id, status: "ACTIVE" })}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-[#006b2d] disabled:opacity-40"
          >
            <MaterialIcon name="publish" className="text-sm" />
          </button>
        ) : (
          <button
            type="button"
            title="Unpublish (disable)"
            disabled={rowBusy}
            onClick={() => patchPromotionMut.mutate({ id: p.id, status: "DISABLED" })}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-[#ba1a1a] disabled:opacity-40"
          >
            <MaterialIcon name="do_not_disturb_on" className="text-sm" />
          </button>
        )}
        {!isArchived ? (
          <button
            type="button"
            title="Archive"
            disabled={rowBusy}
            onClick={() => patchPromotionMut.mutate({ id: p.id, status: "ARCHIVED" })}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-[#1653cc] disabled:opacity-40"
          >
            <MaterialIcon name="archive" className="text-sm" />
          </button>
        ) : (
          <button
            type="button"
            title="Restore (active)"
            disabled={rowBusy}
            onClick={() => patchPromotionMut.mutate({ id: p.id, status: "ACTIVE" })}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-[#006b2d] disabled:opacity-40"
          >
            <MaterialIcon name="restore_from_trash" className="text-sm" />
          </button>
        )}
        <button
          type="button"
          title="Delete"
          onClick={() => {
            setDeleteErr(null);
            setDeleteTarget(p);
          }}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-[#ba1a1a]"
        >
          <MaterialIcon name="delete" className="text-sm" />
        </button>
      </div>
    );
  };

  const q = useQuery({
    queryKey: ["admin-promotions-contract", page, statusFilter],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listContractPromotions(accessToken, {
        page,
        page_size: 20,
        ...(statusFilter ? { status: statusFilter } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = q.data?.data.items ?? [];
  const meta = q.data?.meta;
  const pulse = meta?.pulse;
  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const activeOnPage = useMemo(
    () => items.filter((p) => p.status === "ACTIVE" || p.status === "PUBLISHED").length,
    [items]
  );
  const archivedOnPage = useMemo(() => items.filter((p) => p.status === "ARCHIVED").length, [items]);

  const exportPromotionsCsv = () => {
    const headers = [
      "Name",
      "Status",
      "Rule types",
      "Rule summary",
      "Start",
      "End",
      "Campaigns linked",
      "Updated"
    ];
    const rows = items.map((p) => {
      const { type, discount } = promotionRuleSummary(p);
      return [
        p.name,
        p.status,
        type,
        discount,
        p.activeFrom ? formatAdminDate(p.activeFrom) : "",
        p.activeTo ? formatAdminDate(p.activeTo) : "",
        p.campaigns?.length ?? 0,
        formatAdminDate(p.updatedAt)
      ];
    });
    downloadCsv(`promotions-export-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const rows = items.map((p, index) => {
    const tone = promotionToneIcon(p.name, index);
    const { type, discount } = promotionRuleSummary(p);

    return [
      <div key={`n-${p.id}`} className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded ${tone.wrap}`}>
          <MaterialIcon name={tone.icon} className="text-sm" />
        </div>
        <div>
          <button
            type="button"
            onClick={() => openView(p)}
            className="text-left text-sm font-semibold text-[#181b25] hover:text-[#1653cc]"
          >
            {p.name}
          </button>
          <p className="font-mono text-[11px] tracking-tighter text-slate-500">PRM-{p.id.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>,
      <span
        key={`ty-${p.id}`}
        className="inline-flex rounded border border-slate-200/80 bg-[#ecedfb] px-2 py-0.5 text-[10px] font-bold text-[#434654]"
      >
        {type}
      </span>,
      <span key={`disc-${p.id}`} className="text-sm font-semibold text-[#181b25]">
        {discount}
      </span>,
      <span key={`st-${p.id}`} className="font-mono text-xs text-[#434654]">
        {p.activeFrom ? formatAdminDate(p.activeFrom) : "—"}
      </span>,
      <span key={`en-${p.id}`} className="font-mono text-xs text-[#434654]">
        {p.activeTo ? formatAdminDate(p.activeTo) : "—"}
      </span>,
      <StatusDot key={`stat-${p.id}`} status={p.status} />,
      renderPromotionQuickActions(p, `a-${p.id}`)
    ];
  });

  return (
    <StitchPageBody className="mx-auto w-full max-w-[1600px]">
      <MarketingWorkspaceNav />
      <PageHeader
        title="Promotions"
        titleSize="deck"
        description="Manage discount logic, seasonal campaigns, and storefront messaging."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-promotions-contract"])]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-shadow hover:bg-[#3b6de6] hover:shadow-md"
            >
              <MaterialIcon name="add" className="text-lg text-white" />
              Create promotion
            </button>
            <Link
              to="/admin/marketing/promotions/global/rules"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#1653cc] shadow-sm hover:bg-slate-50"
            >
              <MaterialIcon name="public" className="text-lg" />
              Global rules
            </Link>
            <button
              type="button"
              onClick={exportPromotionsCsv}
              disabled={items.length === 0}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
            >
              <MaterialIcon name="download" className="text-lg" />
              Export CSV
            </button>
            <div className="flex rounded-lg bg-[#e0e2f0] p-1">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${view === "grid" ? "bg-white text-[#181b25] shadow-sm" : "text-slate-500"}`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${view === "list" ? "bg-white text-[#181b25] shadow-sm" : "text-slate-500"}`}
              >
                List
              </button>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="relative col-span-12 overflow-hidden rounded-xl border-l-4 border-[#1653cc] bg-white p-5 shadow-sm lg:col-span-3">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[#434654]">Active campaigns (live)</p>
          <div className="flex items-end justify-between">
            <span className="font-headline text-3xl font-bold text-[#181b25]">
              {pulse?.activeCampaignsCount ?? "—"}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-[#006b2d]/15 px-2 py-0.5 font-mono text-[10px] font-medium text-[#006b2d]">
              Store
              <MaterialIcon name="trending_up" className="text-xs" />
            </span>
          </div>
        </div>
        <div className="relative col-span-12 overflow-hidden rounded-xl border-l-4 border-[#00873b] bg-white p-5 shadow-sm lg:col-span-3">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[#434654]">Order coupon rate (30d)</p>
          <div className="flex items-end justify-between">
            <span className="font-headline text-3xl font-bold text-[#181b25]">
              {pulse != null ? `${pulse.orderCouponRedemptionRatePercent30d}%` : "—"}
            </span>
            <span className="max-w-[8rem] text-right text-[10px] font-medium leading-tight text-[#434654]">
              {pulse != null
                ? `${pulse.ordersWithCoupon30d.toLocaleString()} / ${pulse.ordersTotal30d.toLocaleString()} orders`
                : "—"}
            </span>
          </div>
        </div>
        <div className="col-span-12 flex flex-wrap items-center gap-4 rounded-xl bg-[#1a1d27] p-4 lg:col-span-6">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="min-w-[120px] rounded-lg border-none bg-white/5 px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-[#3b6de6]"
            >
              {STATUSES.map((s) => (
                <option key={s || "all"} value={s} className="text-[#181b25]">
                  {s ? humanizeLabel(s) : "All status"}
                </option>
              ))}
            </select>
            <select
              disabled
              className="min-w-[120px] cursor-not-allowed rounded-lg border-none bg-white/5 px-3 py-2 text-xs text-white/50 outline-none"
              title="Type filter is not available for this list yet"
            >
              <option>All types</option>
            </select>
          </div>
          <button
            type="button"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#1653cc] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#3b6de6]"
          >
            <MaterialIcon name="filter_alt" className="text-sm" />
            Advanced filters
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-slate-200 bg-[#f8f9fb]/80 px-4 py-2 text-center text-xs text-slate-500 lg:hidden">
        Archived on this page: {archivedOnPage}
      </div>

      {meta ? (
        <p className="text-xs text-slate-500">
          Promotions in this result: <span className="font-semibold text-[#181b25]">{meta.totalItems}</span>
          {activeOnPage > 0 ? (
            <span className="ml-2">
              · Active on page: <span className="font-semibold text-[#181b25]">{activeOnPage}</span>
            </span>
          ) : null}
        </p>
      ) : null}

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading promotions…</p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p, index) => {
            const tone = promotionToneIcon(p.name, index);
            return (
              <div
                key={p.id}
                className="relative overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#1653cc]" />
                <div className="flex gap-4 p-5 pl-6">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${tone.wrap}`}>
                    <MaterialIcon name={tone.icon} className="text-2xl" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => openView(p)}
                      className="text-left font-semibold text-[#181b25] hover:text-[#1653cc]"
                    >
                      {p.name}
                    </button>
                    <p className="font-mono text-[11px] text-slate-500">PRM-{p.id.slice(0, 8).toUpperCase()}</p>
                    <div className="mt-3">
                      <StatusDot status={p.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.activeFrom || p.activeTo ? (
                        <>
                          {p.activeFrom ? formatAdminDate(p.activeFrom) : "—"} →{" "}
                          {p.activeTo ? formatAdminDate(p.activeTo) : "—"}
                        </>
                      ) : (
                        "Schedule open-ended"
                      )}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Updated {formatAdminDate(p.updatedAt)}</p>
                    <Link
                      to={`/admin/marketing/promotions/${p.id}/rules`}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#1653cc] hover:underline"
                    >
                      <MaterialIcon name="account_tree" className="text-sm" />
                      Open rules
                    </Link>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-0.5 border-t border-slate-100 bg-[#f8f9fb]/80 px-3 py-2">
                  {renderPromotionQuickActions(p)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Name", "Type", "Discount", "Start", "End", "Status", "Actions"]}
            rows={rows}
            rowKeys={items.map((p) => p.id)}
            emptyState="No promotions."
          />
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 disabled:opacity-40"
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
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      {promoPanel !== "closed" ? (
        <PromotionFormPanel
          key={`${promoPanel}-${panelPromotion?.id ?? "new"}`}
          mode={promoPanel === "create" ? "create" : promoPanel === "view" ? "view" : "edit"}
          promotion={promoPanel === "create" ? null : panelPromotion}
          onClose={() => {
            setPromoPanel("closed");
            setPanelPromotion(null);
          }}
          onSwitchToEdit={() => setPromoPanel("edit")}
          onSaved={() => {
            invalidatePromotions();
            setPromoPanel("closed");
            setPanelPromotion(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete promotion?"
        body={
          deleteTarget
            ? `This removes “${deleteTarget.name}” and unlinks campaigns. This cannot be undone from the admin UI.${
                deleteErr ? ` ${deleteErr}` : ""
              }`
            : undefined
        }
        danger
        confirmLabel={deletePromotionMut.isPending ? "Deleting…" : "Delete"}
        confirmDisabled={deletePromotionMut.isPending}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteErr(null);
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deletePromotionMut.mutate(deleteTarget.id);
          }
        }}
      />
    </StitchPageBody>
  );
};
