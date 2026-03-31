import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";

import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createPromotionRule,
  updatePromotionRule,
  type PromotionRuleRow
} from "@/features/marketing/api/admin-marketing.api";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

const RULE_TYPE_OPTIONS = [
  "PRODUCT",
  "CATEGORY",
  "BRAND",
  "ORDER_TOTAL",
  "CUSTOMER_SEGMENT",
  "CART"
] as const;

type Mode = "create" | "edit" | "view";

type TargetingRow = { localId: string; key: string; value: string };

const newRowId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `r-${Date.now()}-${Math.random()}`;

const valueToEditString = (v: unknown): string => {
  if (v === null || v === undefined) {
    return "";
  }
  if (typeof v === "string") {
    return v;
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

const targetingToRows = (t: Record<string, unknown> | undefined): TargetingRow[] => {
  if (!t || typeof t !== "object" || Array.isArray(t)) {
    return [{ localId: newRowId(), key: "", value: "" }];
  }
  const entries = Object.entries(t as Record<string, unknown>);
  if (entries.length === 0) {
    return [{ localId: newRowId(), key: "", value: "" }];
  }
  return entries.map(([key, value]) => ({
    localId: newRowId(),
    key,
    value: valueToEditString(value)
  }));
};

const parseCellValue = (raw: string): unknown => {
  const t = raw.trim();
  if (!t) {
    return "";
  }
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return t;
  }
};

const rowsToTargeting = (rows: TargetingRow[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (!k) {
      continue;
    }
    out[k] = parseCellValue(row.value);
  }
  return out;
};

const storeCentsFromAmount = (raw: string): number | undefined => {
  const t = raw.trim();
  if (!t) {
    return undefined;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Minimum order must be a non-negative number.");
  }
  return Math.round(n * 100);
};

export const PromotionRuleFormPanel = ({
  mode,
  promotionId,
  rule,
  onClose,
  onSwitchToEdit,
  onSaved
}: {
  mode: Mode;
  promotionId: string;
  rule: PromotionRuleRow | null;
  onClose: () => void;
  onSwitchToEdit?: () => void;
  onSaved: () => void;
}) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [ruleType, setRuleType] = useState("PRODUCT");
  const [targetingRows, setTargetingRows] = useState<TargetingRow[]>([{ localId: newRowId(), key: "", value: "" }]);
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setLocalError(null);
    if (rule && (mode === "edit" || mode === "view")) {
      setRuleType(rule.ruleType);
      setTargetingRows(targetingToRows(rule.targeting as Record<string, unknown> | undefined));
      setMinOrderAmount(rule.minOrderAmountCents != null ? (rule.minOrderAmountCents / 100).toFixed(2) : "");
    } else {
      setRuleType("PRODUCT");
      setTargetingRows([{ localId: newRowId(), key: "", value: "" }]);
      setMinOrderAmount("");
    }
  }, [rule, mode]);

  const readOnly = mode === "view";

  const updateRow = (localId: string, patch: Partial<Pick<TargetingRow, "key" | "value">>) => {
    setTargetingRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setTargetingRows((prev) => [...prev, { localId: newRowId(), key: "", value: "" }]);
  };

  const removeRow = (localId: string) => {
    setTargetingRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.localId !== localId)));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      setLocalError(null);
      const targeting = rowsToTargeting(targetingRows);
      const rt = ruleType.trim();
      if (rt.length < 1) {
        throw new Error("Rule type is required.");
      }
      let minCents: number | undefined;
      try {
        minCents = storeCentsFromAmount(minOrderAmount);
      } catch (e) {
        throw e instanceof Error ? e : new Error("Invalid minimum order.");
      }
      const body = {
        ruleType: rt,
        targeting,
        ...(minCents != null ? { minOrderAmountCents: minCents } : {})
      };
      if (mode === "create") {
        return createPromotionRule(accessToken, promotionId, body);
      }
      if (!rule) {
        throw new Error("Missing rule.");
      }
      return updatePromotionRule(accessToken, promotionId, rule.id, body);
    },
    onSuccess: onSaved,
    onError: (e) => {
      setLocalError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed.");
    }
  });

  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-black/40">
      <button type="button" className="h-full flex-1 cursor-default" aria-label="Close panel" onClick={onClose} />
      <div className="flex h-full w-full max-w-xl flex-col border-l border-[#c3c6d6]/25 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-8 w-1 rounded-full bg-[#1653cc]" />
            <h2 className="font-headline text-lg font-bold text-[#181b25]">
              {mode === "create" ? "New rule" : mode === "edit" ? "Edit rule" : "Rule detail"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-[#f8f9fb]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {localError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{localError}</div>
          ) : null}
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Rule type</span>
            <input
              list="promotion-rule-type-suggestions"
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2 text-sm font-semibold text-[#181b25] focus:border-[#1653cc] focus:outline-none focus:ring-1 focus:ring-[#1653cc]"
            />
            <datalist id="promotion-rule-type-suggestions">
              {RULE_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">
              Minimum order (optional, store currency)
            </span>
            <input
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              disabled={readOnly}
              placeholder="e.g. 25.00"
              className="mt-1 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2 text-sm"
            />
          </label>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Who or what this rule applies to</span>
            <p className="mt-1 text-xs text-[#737685]">
              Add one row per field the storefront expects (for example product IDs, category IDs, or segment codes). For lists
              or nested data, paste structured text in the value column (JSON is accepted).
            </p>
            <div className="mt-3 space-y-2 rounded-xl border border-[#e5e7eb] bg-[#f8f9fb] p-3">
              <div className="grid grid-cols-[1fr_1.2fr_auto] gap-2 text-[10px] font-bold uppercase tracking-wider text-[#737685]">
                <span>Field name</span>
                <span>Value</span>
                <span className="w-8 text-center" aria-hidden />
              </div>
              {targetingRows.map((row) => (
                <div key={row.localId} className="grid grid-cols-[1fr_1.2fr_auto] gap-2">
                  <input
                    value={row.key}
                    onChange={(e) => updateRow(row.localId, { key: e.target.value })}
                    disabled={readOnly}
                    placeholder="e.g. productIds"
                    className="rounded-lg border border-[#e5e7eb] bg-white px-2 py-2 text-xs text-[#181b25]"
                  />
                  <textarea
                    value={row.value}
                    onChange={(e) => updateRow(row.localId, { value: e.target.value })}
                    disabled={readOnly}
                    rows={2}
                    placeholder="Text, number, ID list, or paste structured data"
                    className="rounded-lg border border-[#e5e7eb] bg-white px-2 py-2 text-xs leading-relaxed text-[#181b25]"
                  />
                  {!readOnly ? (
                    <button
                      type="button"
                      title="Remove row"
                      onClick={() => removeRow(row.localId)}
                      className="flex h-9 w-8 items-center justify-center rounded-lg text-[#737685] hover:bg-red-50 hover:text-[#ba1a1a]"
                    >
                      <MaterialIcon name="close" className="text-lg" />
                    </button>
                  ) : (
                    <span className="w-8" />
                  )}
                </div>
              ))}
              {!readOnly ? (
                <button
                  type="button"
                  onClick={addRow}
                  className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#1653cc] hover:underline"
                >
                  <MaterialIcon name="add" className="text-sm" />
                  Add field
                </button>
              ) : null}
            </div>
          </div>
          <p className="rounded-lg border border-[#1653cc]/15 bg-[#f2f3ff] px-3 py-2 text-xs text-[#434654]">
            Rules are checked on the server when orders and carts are priced. Leave all field rows empty for a rule that only
            uses the minimum order amount above.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
          {readOnly ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#434654]"
              >
                Close
              </button>
              {rule && onSwitchToEdit ? (
                <button
                  type="button"
                  onClick={onSwitchToEdit}
                  className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3b6de6]"
                >
                  Edit
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#434654]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate()}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#1653cc]/20 disabled:opacity-50"
              >
                <MaterialIcon name="save" className="text-base text-white" />
                {saveMut.isPending ? "Saving…" : mode === "create" ? "Create rule" : "Save rule"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
