import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { PageHeader } from "@/components/primitives/PageHeader";
import { MarketingWorkspaceNav, StitchPageBody } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  deletePromotionRule,
  getGlobalRulesPromotionContainer,
  listPromotionRules,
  type PromotionRuleRow
} from "@/features/marketing/api/admin-marketing.api";
import {
  formatAdminDateTime,
  formatCentsMoney,
  formatRuleTargetingRows,
  humanizeLabel,
  promotionRuleIcon
} from "@/features/marketing/lib/marketingPresentation";
import { downloadCsv } from "@/lib/csvDownload";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { PromotionRuleFormPanel } from "@/features/marketing/pages/PromotionRuleFormPanel";

const GLOBAL_RULES_NAME = "__GLOBAL_RULES__";

const accentForIndex = (i: number) => {
  const mod = i % 3;
  if (mod === 0) {
    return { bar: "bg-[#1653cc]", iconWrap: "bg-[#f2f3ff] text-[#1653cc]" };
  }
  if (mod === 1) {
    return { bar: "bg-[#00873b]", iconWrap: "bg-[#f7fff3] text-[#00873b]" };
  }
  return { bar: "bg-[#c4c6d1]", iconWrap: "bg-[#ecedfb] text-[#434654]" };
};

const RuleCard = ({
  rule,
  index,
  onView,
  onEdit,
  onDelete
}: {
  rule: PromotionRuleRow;
  index: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const accent = accentForIndex(index);
  const icon = promotionRuleIcon(rule.ruleType);
  const rows = formatRuleTargetingRows(rule.targeting);
  const minOrder =
    rule.minOrderAmountCents != null ? (
      <p className="mt-2 text-sm leading-relaxed text-[#434654]">
        Minimum order value:{" "}
        <span className="font-mono font-bold text-[#1653cc]">{formatCentsMoney(rule.minOrderAmountCents)}</span>
      </p>
    ) : null;

  return (
    <div className="group relative flex gap-5 overflow-hidden rounded-xl border border-[#c3c6d6]/25 bg-white p-5">
      <div className={`absolute bottom-0 left-0 top-0 w-1 ${accent.bar}`} />
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${accent.iconWrap}`}>
        <MaterialIcon name={icon} className="text-2xl" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#737685]">
            {humanizeLabel(rule.ruleType)}
          </span>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              title="View"
              onClick={onView}
              className="rounded-md p-1.5 text-[#737685] transition-colors hover:bg-[#f8f9fb] hover:text-[#1653cc]"
            >
              <MaterialIcon name="visibility" className="text-lg" />
            </button>
            <button
              type="button"
              title="Edit"
              onClick={onEdit}
              className="rounded-md p-1.5 text-[#737685] transition-colors hover:bg-[#f8f9fb] hover:text-[#1653cc]"
            >
              <MaterialIcon name="edit" className="text-lg" />
            </button>
            <button
              type="button"
              title="Delete"
              onClick={onDelete}
              className="rounded-md p-1.5 text-[#737685] transition-colors hover:bg-[#f8f9fb] hover:text-[#ba1a1a]"
            >
              <MaterialIcon name="delete" className="text-lg" />
            </button>
          </div>
        </div>
        <h3 className="text-base font-semibold text-[#181b25]">{humanizeLabel(rule.ruleType)} rule</h3>
        {rows.length > 0 ? (
          <dl className="mt-3 space-y-1.5">
            {rows.map((row) => (
              <div key={`${rule.id}-${row.label}`} className="flex flex-wrap gap-x-2 text-sm text-[#434654]">
                <dt className="font-medium text-[#181b25]">{row.label}</dt>
                <dd className="min-w-0 break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[#434654]">No targeting fields are set for this rule.</p>
        )}
        {minOrder}
        <p className="mt-3 text-xs text-[#737685]">Created {formatAdminDateTime(rule.createdAt)}</p>
      </div>
    </div>
  );
};

export const PromotionRulesPage = () => {
  const { promotionId: promotionIdParam } = useParams<{ promotionId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [rulePanel, setRulePanel] = useState<"closed" | "create" | "edit" | "view">("closed");
  const [panelRule, setPanelRule] = useState<PromotionRuleRow | null>(null);
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<PromotionRuleRow | null>(null);
  const [deleteRuleErr, setDeleteRuleErr] = useState<string | null>(null);

  const isGlobalRoute = promotionIdParam === "global";

  const containerQ = useQuery({
    queryKey: ["admin-global-rules-container"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getGlobalRulesPromotionContainer(accessToken);
    },
    enabled: Boolean(accessToken && isGlobalRoute)
  });

  const resolvedPromotionId = isGlobalRoute ? containerQ.data?.data.entity.id : promotionIdParam;

  const q = useQuery({
    queryKey: ["admin-promotion-rules", resolvedPromotionId],
    queryFn: async () => {
      if (!accessToken || !resolvedPromotionId) {
        throw new Error("Missing context.");
      }
      return listPromotionRules(accessToken, resolvedPromotionId);
    },
    enabled: Boolean(accessToken && resolvedPromotionId)
  });

  const items = q.data?.data.items ?? [];
  const entity = q.data?.data.entity;
  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;
  const containerErr =
    containerQ.error instanceof ApiError
      ? containerQ.error.message
      : containerQ.error instanceof Error
        ? containerQ.error.message
        : null;

  const invalidateRules = () => {
    if (resolvedPromotionId) {
      void queryClient.invalidateQueries({ queryKey: ["admin-promotion-rules", resolvedPromotionId] });
    }
    void queryClient.invalidateQueries({ queryKey: ["admin-promotions-contract"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-promotion-rules-hub"] });
  };

  const deleteRuleMut = useMutation({
    mutationFn: async ({ pid, rid }: { pid: string; rid: string }) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return deletePromotionRule(accessToken, pid, rid);
    },
    onSuccess: () => {
      invalidateRules();
      setDeleteRuleTarget(null);
      setDeleteRuleErr(null);
    },
    onError: (e) => {
      setDeleteRuleErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Delete failed.");
    }
  });

  if (!promotionIdParam) {
    return <p className="text-sm text-slate-500">Missing promotion id.</p>;
  }

  const displayPromotionName =
    isGlobalRoute || entity?.name === GLOBAL_RULES_NAME ? "Global store rules" : (entity?.name ?? "Promotion");

  const titleSuffix = `${displayPromotionName} — rules`;

  const exportRulesCsv = () => {
    const headers = ["Rule ID", "Type", "Min order (GHS)", "Created", "Targeting summary"];
    const rows = items.map((rule) => {
      const tgt = formatRuleTargetingRows(rule.targeting)
        .map((r) => `${r.label}: ${r.value}`)
        .join(" | ");
      return [
        rule.id,
        rule.ruleType,
        rule.minOrderAmountCents != null ? (rule.minOrderAmountCents / 100).toFixed(2) : "",
        formatAdminDateTime(rule.createdAt),
        tgt
      ];
    });
    downloadCsv(
      `promotion-rules-${displayPromotionName.replace(/\s+/g, "-").slice(0, 40)}.csv`,
      headers,
      rows
    );
  };

  const openCreateRule = () => {
    setPanelRule(null);
    setRulePanel("create");
  };
  const openViewRule = (r: PromotionRuleRow) => {
    setPanelRule(r);
    setRulePanel("view");
  };
  const openEditRule = (r: PromotionRuleRow) => {
    setPanelRule(r);
    setRulePanel("edit");
  };

  const loadingGlobal = isGlobalRoute && (containerQ.isLoading || !resolvedPromotionId);
  const showError = containerErr ?? (isGlobalRoute && containerQ.isError ? "Could not load global rules container." : null);

  return (
    <StitchPageBody>
      <MarketingWorkspaceNav />
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-[#f8f9fb] px-0 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Link to="/admin/marketing/promotions" className="flex items-center gap-1 text-[#1653cc]">
            <MaterialIcon name="arrow_back" />
            <span className="font-normal text-[#737685]">Promotions / </span>
            <span className="text-[#181b25]">{titleSuffix}</span>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!isGlobalRoute ? (
            <Link
              to="/admin/marketing/promotions/global/rules"
              className="flex items-center gap-2 rounded-lg border border-[#1653cc]/30 bg-white px-4 py-1.5 text-sm font-semibold text-[#1653cc] shadow-sm hover:bg-[#f2f3ff]"
            >
              <MaterialIcon name="public" className="text-sm" />
              Global rules
            </Link>
          ) : null}
          <button
            type="button"
            onClick={exportRulesCsv}
            disabled={items.length === 0}
            className="flex items-center gap-2 rounded-lg bg-[#1653cc] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#3b6de6] disabled:opacity-40"
          >
            <MaterialIcon name="ios_share" className="text-sm text-white" />
            Export CSV
          </button>
        </div>
      </div>

      <PageHeader
        title="Rule configuration"
        titleSize="deck"
        description={
          isGlobalRoute
            ? "Storewide targeting rules apply in addition to per-promotion rules. Changes are validated and audited on the server."
            : "Review and edit the logic that qualifies customers and orders for this promotion."
        }
        autoBreadcrumbs={false}
        actionMenuItems={
          resolvedPromotionId
            ? [refreshDataMenuItem(queryClient, ["admin-promotion-rules", resolvedPromotionId])]
            : []
        }
        actions={
          <button
            type="button"
            disabled={!resolvedPromotionId || loadingGlobal}
            onClick={openCreateRule}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#1653cc]/25 disabled:opacity-40"
          >
            <MaterialIcon name="add" className="text-lg text-white" />
            Add rule
          </button>
        }
      />

      {isGlobalRoute ? (
        <div className="rounded-xl border-l-4 border-[#00873b] bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#181b25]">Global (storewide) rules</p>
          <p className="mt-1 text-sm text-[#434654]">
            These rules live on a system promotion container and are excluded from the main promotions list. Use them
            for defaults that should apply across the catalog unless a promotion overrides behavior downstream.
          </p>
        </div>
      ) : null}

      {showError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{showError}</div>
      ) : null}

      {err && !loadingGlobal ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {loadingGlobal ? (
        <p className="text-sm text-slate-500">Resolving global rules container…</p>
      ) : q.isLoading ? (
        <p className="text-sm text-slate-500">Loading rules…</p>
      ) : (
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 space-y-4 lg:col-span-7">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No rules yet. Add a rule to define targeting for this promotion.
              </div>
            ) : (
              items.map((rule, index) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  index={index}
                  onView={() => openViewRule(rule)}
                  onEdit={() => openEditRule(rule)}
                  onDelete={() => {
                    setDeleteRuleErr(null);
                    setDeleteRuleTarget(rule);
                  }}
                />
              ))
            )}

            <div className="rounded-xl border border-[#1653cc]/20 bg-[#f2f3ff] p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1653cc] text-white">
                  <MaterialIcon name="add_circle" className="text-lg text-white" />
                </div>
                <h4 className="font-headline font-bold text-[#181b25]">Add another rule</h4>
              </div>
              <p className="text-sm text-[#434654]">
                Rules combine as the storefront and checkout evaluate them. Add targeting fields in the rule editor so only the
                right carts and customers qualify.
              </p>
              <button
                type="button"
                disabled={!resolvedPromotionId}
                onClick={openCreateRule}
                className="mt-4 flex items-center gap-2 rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3b6de6] disabled:opacity-40"
              >
                <MaterialIcon name="add" className="text-base text-white" />
                New rule
              </button>
            </div>
          </div>

          <div className="col-span-12 space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <h4 className="text-sm font-bold text-[#181b25]">Promotion summary</h4>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-[#737685]">Name</dt>
                  <dd className="mt-0.5 font-medium text-[#181b25]">{displayPromotionName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-[#737685]">Status</dt>
                  <dd className="mt-0.5 font-medium text-[#181b25]">
                    {entity?.status ? humanizeLabel(entity.status) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-[#737685]">Rule count</dt>
                  <dd className="mt-0.5 font-medium text-[#181b25]">{items.length}</dd>
                </div>
                {resolvedPromotionId ? (
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-[#737685]">Promotion id</dt>
                    <dd className="mt-0.5 break-all font-mono text-xs text-[#434654]">{resolvedPromotionId}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </div>
      )}

      {resolvedPromotionId && rulePanel !== "closed" ? (
        <PromotionRuleFormPanel
          key={`${rulePanel}-${panelRule?.id ?? "new"}`}
          mode={rulePanel === "create" ? "create" : rulePanel === "view" ? "view" : "edit"}
          promotionId={resolvedPromotionId}
          rule={rulePanel === "create" ? null : panelRule}
          onClose={() => {
            setRulePanel("closed");
            setPanelRule(null);
          }}
          onSwitchToEdit={() => setRulePanel("edit")}
          onSaved={() => {
            invalidateRules();
            setRulePanel("closed");
            setPanelRule(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteRuleTarget && resolvedPromotionId)}
        title="Delete this rule?"
        body={
          deleteRuleTarget
            ? `Remove the ${humanizeLabel(deleteRuleTarget.ruleType)} rule. This cannot be undone.${
                deleteRuleErr ? ` ${deleteRuleErr}` : ""
              }`
            : undefined
        }
        danger
        confirmLabel={deleteRuleMut.isPending ? "Deleting…" : "Delete rule"}
        confirmDisabled={deleteRuleMut.isPending}
        onClose={() => {
          setDeleteRuleTarget(null);
          setDeleteRuleErr(null);
        }}
        onConfirm={() => {
          if (deleteRuleTarget && resolvedPromotionId) {
            deleteRuleMut.mutate({ pid: resolvedPromotionId, rid: deleteRuleTarget.id });
          }
        }}
      />
    </StitchPageBody>
  );
};
