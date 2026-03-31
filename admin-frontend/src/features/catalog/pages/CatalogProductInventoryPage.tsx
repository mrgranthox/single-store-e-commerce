import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ProductAdminNav } from "@/components/catalog/ProductAdminNav";
import { KpiCard } from "@/components/primitives/KpiCard";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getAdminCatalogProduct, getAdminCatalogProductInventorySummary } from "@/features/catalog/api/admin-catalog.api";
import { humanizeMovementType } from "@/features/catalog/lib/catalogFormat";
import {
  ApiError as InventoryApiError,
  createInventoryAdjustment,
  listAdminWarehouses,
  listInventoryMovements,
  type InventoryMovementRow
} from "@/features/inventory/api/admin-inventory.api";

const statusBadge = (row: { outOfStock: boolean; lowStock: boolean }) => {
  if (row.outOfStock) {
    return (
      <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">Out of stock</span>
    );
  }
  if (row.lowStock) {
    return (
      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Low stock</span>
    );
  }
  return (
    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">Healthy</span>
  );
};

const formatMovementActor = (row: InventoryMovementRow) =>
  row.actorAdminUserId ? "Admin" : "System";

type AdjustmentLine = {
  id: string;
  variantId: string;
  warehouseId: string;
  delta: string;
};

const newAdjustmentLine = (variantId: string, warehouseId: string): AdjustmentLine => ({
  id: crypto.randomUUID(),
  variantId,
  warehouseId,
  delta: ""
});

export const CatalogProductInventoryPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<AdjustmentLine[]>([]);
  const [stockReason, setStockReason] = useState("");
  const [stockMsg, setStockMsg] = useState<string | null>(null);

  const productQ = useQuery({
    queryKey: ["admin-catalog-product", productId],
    queryFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return getAdminCatalogProduct(accessToken, productId);
    },
    enabled: Boolean(accessToken && productId)
  });

  const q = useQuery({
    queryKey: ["admin-catalog-product-inventory-summary", productId],
    queryFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return getAdminCatalogProductInventorySummary(accessToken, productId);
    },
    enabled: Boolean(accessToken && productId)
  });

  const movQ = useQuery({
    queryKey: ["admin-catalog-product-inventory-movements", productId],
    queryFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return listInventoryMovements(accessToken, {
        productId,
        page: 1,
        page_size: 15,
        sortOrder: "desc"
      });
    },
    enabled: Boolean(accessToken && productId)
  });

  const entity = q.data?.data.entity;
  const productTitle = productQ.data?.data.entity.title ?? "Product";
  const movements = movQ.data?.data.items ?? [];

  const needsWarehousesForForm = Boolean(accessToken && entity && entity.variants.length > 0);

  const warehousesQ = useQuery({
    queryKey: ["admin-warehouses-product-inventory"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Missing context.");
      }
      return listAdminWarehouses(accessToken);
    },
    enabled: needsWarehousesForForm
  });

  const warehouseItems = warehousesQ.data?.data.items ?? [];

  useEffect(() => {
    if (!productId || !entity) {
      return;
    }
    if (entity.productId !== productId) {
      setLines([]);
      return;
    }
    if (entity.variants.length === 0) {
      setLines([]);
      return;
    }
    const v0 = entity.variants[0]!.id;
    const defaultWh = warehouseItems[0]?.id ?? entity.stockRows[0]?.warehouse.id ?? "";

    setLines((prev) => {
      if (prev.length === 0) {
        return [newAdjustmentLine(v0, defaultWh)];
      }
      return prev.map((line) => {
        const vOk = entity.variants.some((v) => v.id === line.variantId);
        const wOk =
          warehouseItems.some((w) => w.id === line.warehouseId) ||
          entity.stockRows.some((r) => r.warehouse.id === line.warehouseId);
        return {
          ...line,
          variantId: vOk ? line.variantId : v0,
          warehouseId: wOk ? line.warehouseId : defaultWh || line.warehouseId
        };
      });
    });
  }, [productId, entity, warehouseItems]);

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const lowBanner =
    entity?.inventorySummary.lowStock ||
    (entity?.stockRows.some((r) => r.lowStock) ?? false) ||
    (entity?.variants.some((v) => v.inventorySummary.lowStock) ?? false);

  const stockOptions = useMemo(() => entity?.stockRows ?? [], [entity?.stockRows]);

  const warehouseChoices = useMemo(() => {
    if (warehouseItems.length > 0) {
      return warehouseItems.map((w) => ({ id: w.id, label: `${w.name} (${w.code})` }));
    }
    const map = new Map<string, string>();
    for (const r of stockOptions) {
      map.set(r.warehouse.id, `${r.warehouse.name} (${r.warehouse.code})`);
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [warehouseItems, stockOptions]);

  const onHandHint = (variantId: string, warehouseId: string) => {
    const row = stockOptions.find((r) => r.variantId === variantId && r.warehouse.id === warehouseId);
    return row?.onHand;
  };

  const stockMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      if (!stockReason.trim()) {
        throw new Error("Add a reason for this adjustment.");
      }
      const items: Array<{ variantId: string; warehouseId: string; deltaOnHand: number }> = [];
      const seen = new Set<string>();
      for (const line of lines) {
        const variantId = line.variantId.trim();
        const warehouseId = line.warehouseId.trim();
        const d = Number.parseInt(line.delta.trim(), 10);
        if (!variantId || !warehouseId) {
          continue;
        }
        if (!Number.isFinite(d) || d === 0) {
          continue;
        }
        const key = `${variantId}:${warehouseId}`;
        if (seen.has(key)) {
          throw new Error("Each variant × warehouse pair can only appear once. Remove duplicate lines.");
        }
        seen.add(key);
        items.push({ variantId, warehouseId, deltaOnHand: d });
      }
      if (items.length === 0) {
        throw new Error("Add at least one line with variant, warehouse, and a non-zero whole-number delta.");
      }
      return createInventoryAdjustment(accessToken, {
        reason: stockReason.trim(),
        items
      });
    },
    onSuccess: () => {
      setStockMsg("Stock adjustment recorded.");
      setLines((prev) => prev.map((l) => ({ ...l, delta: "" })));
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product-inventory-summary", productId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product-inventory-movements", productId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory-movements"] });
    },
    onError: (e: unknown) => {
      setStockMsg(
        e instanceof InventoryApiError ? e.message : e instanceof Error ? e.message : "Adjustment failed."
      );
    }
  });

  const patchLine = (
    lineId: string,
    patch: Partial<Pick<AdjustmentLine, "variantId" | "warehouseId" | "delta">>
  ) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    if (!entity || entity.variants.length === 0) {
      return;
    }
    const v0 = entity.variants[0]!.id;
    const wh0 = warehouseChoices[0]?.id ?? "";
    setLines((prev) => [...prev, newAdjustmentLine(v0, wh0)]);
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== lineId)));
  };

  if (!productId) {
    return <p className="text-sm text-[var(--color-text-muted)]">Missing product id.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={productQ.isLoading ? "Loading…" : productTitle}
        description="Stock by variant and warehouse, with recent movements for this product."
        actionMenuItems={[
          {
            id: "refresh-data",
            label: "Refresh data",
            onSelect: () => {
              void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product-inventory-summary", productId] });
              void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product-inventory-movements", productId] });
            }
          }
        ]}
      />
      <ProductAdminNav />
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {lowBanner ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          One or more variants are at or below reorder level. Review the table below and replenish or adjust safety
          stock.
        </div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : entity ? (
        <>
          <SurfaceCard
            title="Stock up / adjust"
            description="One or more variant × warehouse lines per submit. Blank or zero deltas are skipped. First positive receipt creates a new stock row. Requires inventory.adjust."
          >
            {entity.variants.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                Add at least one variant to this product before recording stock.
              </p>
            ) : warehousesQ.isLoading && warehouseChoices.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Loading warehouses…</p>
            ) : warehousesQ.isError && warehouseChoices.length === 0 ? (
              <p className="text-sm text-red-700">
                Could not load warehouses. If this product has no stock rows yet, create a warehouse or try again.
                You can also use{" "}
                <Link className="font-semibold text-[#4f7ef8] hover:underline" to="/admin/inventory/adjustments">
                  global adjustments
                </Link>
                .
              </p>
            ) : warehouseChoices.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                No warehouses available. Create a warehouse first, then receive stock here or via{" "}
                <Link className="font-semibold text-[#4f7ef8] hover:underline" to="/admin/inventory/adjustments">
                  global adjustments
                </Link>
                .
              </p>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStockMsg(null);
                  stockMut.mutate();
                }}
              >
                {stockOptions.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    No stock rows yet — add lines below; the first positive adjustment per variant × warehouse creates
                    that row.
                  </p>
                ) : null}
                <div className="space-y-3">
                  {lines.map((line) => {
                    const oh = onHandHint(line.variantId, line.warehouseId);
                    return (
                      <div
                        key={line.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:flex-wrap sm:items-end"
                      >
                        <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
                          Variant
                          <select
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            value={line.variantId}
                            onChange={(e) => patchLine(line.id, { variantId: e.target.value })}
                          >
                            {entity.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.sku}
                                {v.optionLabel && v.optionLabel !== "Default" ? ` · ${v.optionLabel}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
                          Warehouse
                          <select
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            value={line.warehouseId}
                            onChange={(e) => patchLine(line.id, { warehouseId: e.target.value })}
                          >
                            {warehouseChoices.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex w-full min-w-[120px] flex-col gap-1 sm:w-[140px] text-xs font-medium text-slate-600">
                          Delta (units)
                          <input
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums"
                            value={line.delta}
                            onChange={(e) => patchLine(line.id, { delta: e.target.value })}
                            inputMode="numeric"
                            placeholder="e.g. 10"
                          />
                          {oh != null ? (
                            <span className="text-[11px] font-normal text-[var(--color-text-muted)]">
                              Current on hand: {oh}
                            </span>
                          ) : null}
                        </label>
                        <button
                          type="button"
                          disabled={lines.length <= 1}
                          className="h-10 shrink-0 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => removeLine(line.id)}
                        >
                          Remove line
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
                    onClick={addLine}
                  >
                    Add line
                  </button>
                </div>
                <label className="flex max-w-xl flex-col gap-1 text-xs font-medium text-slate-600">
                  Reason (applies to all lines in this submit)
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={stockReason}
                    onChange={(e) => setStockReason(e.target.value)}
                    placeholder="PO receipt / cycle count / transfer"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={stockMut.isPending}
                  className="rounded-lg bg-[#4f7ef8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {stockMut.isPending ? "Submitting…" : "Apply adjustments"}
                </button>
                {stockMsg ? (
                  <p className={`text-sm ${stockMsg.toLowerCase().includes("fail") ? "text-red-700" : "text-slate-700"}`}>
                    {stockMsg}
                  </p>
                ) : null}
              </form>
            )}
          </SurfaceCard>

          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard
              label="Total stock"
              value={String(entity.inventorySummary.onHand)}
              detail="On hand across warehouses"
              tone="neutral"
            />
            <KpiCard
              label="Reserved"
              value={String(entity.inventorySummary.reserved)}
              detail="Committed to orders"
              tone="warning"
            />
            <KpiCard
              label="Available"
              value={String(entity.inventorySummary.available)}
              detail="On hand minus reservations"
              tone="success"
            />
          </div>

          <SurfaceCard title="By variant & warehouse" description="Sellable posture for each SKU and location.">
            {entity.stockRows.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                No warehouse rows yet. Stock lines appear after inventory is initialized for this product&apos;s
                variants.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Variant</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Warehouse</th>
                      <th className="px-4 py-3 text-right">On hand</th>
                      <th className="px-4 py-3 text-right">Reserved</th>
                      <th className="px-4 py-3 text-right">Available</th>
                      <th className="px-4 py-3 text-right">Reorder</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entity.stockRows.map((row) => (
                      <tr key={`${row.variantId}-${row.warehouse.id}`} className="border-b border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">{row.variantLabel}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-800">{row.variantSku}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="font-medium">{row.warehouse.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{row.warehouse.code}</div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.onHand}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.reserved}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{row.available}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.reorderLevel}</td>
                        <td className="px-4 py-3">{statusBadge(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard title="Movement history" description="Latest inventory movements for variants of this product.">
            {movQ.isLoading ? (
              <p className="text-sm text-[var(--color-text-muted)]">Loading movements…</p>
            ) : movements.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No movements recorded for this product yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Qty Δ</th>
                      <th className="py-2 pr-3">Actor</th>
                      <th className="py-2 pr-3">Warehouse</th>
                      <th className="py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-800">{humanizeMovementType(m.movementType)}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-800">
                          {m.deltaOnHand > 0 ? `+${m.deltaOnHand}` : String(m.deltaOnHand)}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{formatMovementActor(m)}</td>
                        <td className="py-2 pr-3 text-slate-700">{m.warehouse.name}</td>
                        <td className="py-2 text-slate-600">{new Date(m.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <Link
                to={`/admin/inventory/movements?productId=${encodeURIComponent(productId)}`}
                className="text-sm font-semibold text-[#4f7ef8] hover:underline"
              >
                View all movements →
              </Link>
            </div>
          </SurfaceCard>
        </>
      ) : null}
    </div>
  );
};
