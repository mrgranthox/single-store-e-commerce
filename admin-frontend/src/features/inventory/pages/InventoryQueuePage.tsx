import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileSpreadsheet, RefreshCw, Search, Settings2 } from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { StitchFilterPanel } from "@/components/stitch";
import { InventoryProductCell } from "@/features/inventory/components/InventoryProductCell";
import { InventorySubNav } from "@/features/inventory/components/InventorySubNav";
import {
  ApiError,
  listAdminWarehouses,
  listLowStockInventory,
  listOutOfStockInventory,
  type InventoryStockRow
} from "@/features/inventory/api/admin-inventory.api";

type QueueMode = "low" | "out";

type InventoryQueuePageProps = {
  mode: QueueMode;
};

const titles: Record<QueueMode, { title: string; description: string }> = {
  low: {
    title: "Low Stock",
    description: "Operational inventory queue prioritized by stock-out risk."
  },
  out: {
    title: "Out of Stock",
    description: "Operational urgency: inventory depletion detected."
  }
};

const daysSince = (iso: string) => {
  try {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "—";
    return String(Math.max(0, Math.floor((Date.now() - t) / 86_400_000)));
  } catch {
    return "—";
  }
};

const formatRestockHint = (row: InventoryStockRow) => {
  const lm = row.lastMovement?.createdAt;
  if (!lm) return "—";
  const d = daysSince(lm);
  return d === "—" ? "—" : `${d} days ago`;
};

const formatMoney = (cents: number, currency = "GHS") => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
};

const replenishmentCentsForRow = (row: InventoryStockRow) => {
  const need = Math.max(0, row.stock.effectiveReorderLevel - row.stock.available);
  const unit = row.variant.costAmountCents ?? row.variant.priceAmountCents ?? 0;
  return need * unit;
};

export const InventoryQueuePage = ({ mode }: InventoryQueuePageProps) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [poOpen, setPoOpen] = useState(false);

  const warehousesQuery = useQuery({
    queryKey: ["admin-warehouses"],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return listAdminWarehouses(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const queryKey = useMemo(
    () => ["admin-inventory-queue", mode, page, appliedSearch, warehouseId] as const,
    [mode, page, appliedSearch, warehouseId]
  );

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const query = {
        page,
        page_size: 20,
        sortBy: "available" as const,
        sortOrder: "asc" as const,
        ...(appliedSearch.trim() ? { q: appliedSearch.trim() } : {}),
        ...(warehouseId ? { warehouseId } : {})
      };
      return mode === "low"
        ? listLowStockInventory(accessToken, query)
        : listOutOfStockInventory(accessToken, query);
    },
    enabled: Boolean(accessToken)
  });

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;
  const warehouses = warehousesQuery.data?.data.items ?? [];

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(searchDraft);
  };

  const errorMessage =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error instanceof Error
        ? listQuery.error.message
        : null;

  const criticalCount = mode === "low" ? items.filter((r) => r.stock.available < 5).length : 0;
  const replenishmentPageCents =
    mode === "low" ? items.reduce((sum, r) => sum + replenishmentCentsForRow(r), 0) : 0;
  const revenueAtRiskPageCents =
    mode === "out"
      ? items.reduce((sum, r) => sum + (r.variant.priceAmountCents ?? r.variant.costAmountCents ?? 0), 0)
      : 0;

  const exportPoDraft = () => {
    const header = ["priority", "sku", "product_title", "warehouse_code", "suggested_qty", "unit_cost_cents"];
    const lines = [
      header.join(","),
      ...items.map((row, index) => {
        const p = index + 1 + (meta ? (meta.page - 1) * meta.limit : 0);
        const need = Math.max(0, row.stock.effectiveReorderLevel - row.stock.available);
        return [
          p,
          row.variant.sku,
          `"${(row.variant.product.title || "").replace(/"/g, '""')}"`,
          row.warehouse.code,
          need,
          row.variant.costAmountCents ?? ""
        ].join(",");
      })
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-order-draft-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rescanQueues = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-inventory-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-inventory-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-inventory-stocks"] });
  };

  const rows =
    mode === "low"
      ? items.map((row: InventoryStockRow, index: number) => {
          const p = index + 1 + (meta ? (meta.page - 1) * meta.limit : 0);
          const critical = row.stock.available < 5;
          return [
            <span
              key={`pr-${row.id}`}
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                critical ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              P{p}
            </span>,
            <InventoryProductCell
              key={`p-${row.id}`}
              productId={row.variant.product.id}
              title={row.variant.product.title}
              thumbnailUrl={row.variant.product.thumbnailUrl}
            />,
            <span key={`sku-${row.id}`} className="font-mono text-xs text-slate-600">
              {row.variant.sku}
            </span>,
            <span key={`wh-${row.id}`} className="text-sm font-medium">
              {row.warehouse.name}
            </span>,
            <span
              key={`oh-${row.id}`}
              className={`font-semibold ${critical ? "text-red-600" : "text-slate-800"}`}
            >
              {row.stock.onHand}
            </span>,
            <span key={`re-${row.id}`} className="text-sm text-slate-500">
              {row.stock.effectiveReorderLevel} units
            </span>,
            <span key={`lr-${row.id}`} className="text-xs text-slate-400">
              {formatRestockHint(row)}
            </span>,
            <span key={`oa-${row.id}`} className="text-center font-headline text-sm font-bold tabular-nums text-slate-800">
              {row.ordersAffectedCount ?? 0}
            </span>,
            <div key={`ac-${row.id}`} className="text-right">
              <Link
                to="/admin/inventory/adjustments"
                className="text-xs font-bold text-[#1653cc] hover:underline"
              >
                Adjust stock
              </Link>
              <Link
                to={`/admin/catalog/products/${row.variant.product.id}`}
                className="ml-3 inline-flex text-slate-400 hover:text-slate-700"
                aria-label="View product"
              >
                <Eye className="h-4 w-4" />
              </Link>
            </div>
          ];
        })
      : items.map((row: InventoryStockRow) => {
          const days = daysSince(row.updatedAt);
          return [
            <InventoryProductCell
              key={`p-${row.id}`}
              productId={row.variant.product.id}
              title={row.variant.product.title}
              thumbnailUrl={row.variant.product.thumbnailUrl}
            />,
            <span key={`sku-${row.id}`} className="font-mono text-xs font-medium text-[#1653cc]">
              {row.variant.sku}
            </span>,
            <span key={`wh-${row.id}`} className="text-sm text-slate-600">
              {row.warehouse.name} ({row.warehouse.code})
            </span>,
            <span key={`d-${row.id}`} className="text-sm font-semibold text-red-600">
              {days === "—" ? "—" : `${days} days`}
            </span>,
            <span key={`oa-${row.id}`} className="text-sm text-slate-700">
              <span className="font-headline text-lg font-bold tabular-nums">{row.ordersAffectedCount ?? 0}</span>
              <span className="mt-0.5 block text-[10px] text-slate-500">
                Open orders (CONFIRMED/PROCESSING) with this SKU
              </span>
              <Link to="/admin/orders" className="mt-1 inline-block text-xs font-semibold text-[#1653cc] hover:underline">
                View orders →
              </Link>
            </span>,
            <div key={`ac-${row.id}`} className="flex justify-end gap-2">
              <Link
                to="/admin/inventory/adjustments"
                className="rounded p-2 text-[#1653cc] hover:bg-slate-100"
                title="Adjust stock"
              >
                <span className="text-xs font-bold">Adjust</span>
              </Link>
              <Link
                to={`/admin/catalog/products/${row.variant.product.id}`}
                className="rounded p-2 text-slate-500 hover:bg-slate-100"
                title="View product"
              >
                <Eye className="h-4 w-4" />
              </Link>
            </div>
          ];
        });

  const { title, description } = titles[mode];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        titleSize="screen"
        description={description}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admin/inventory/overview" className="text-sm font-semibold text-[#1653cc] hover:underline">
              ← Overview
            </Link>
            <button
              type="button"
              onClick={rescanQueues}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-scan
            </button>
            <Link
              to="/admin/system/settings"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#1653cc]"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Auto-hide rules
            </Link>
            {mode === "low" ? (
              <button
                type="button"
                onClick={() => setPoOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#13161e] px-3 py-1.5 text-xs font-bold text-white hover:opacity-95"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Generate purchase orders
              </button>
            ) : null}
          </div>
        }
      />

      <InventorySubNav />

      {poOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="font-headline text-lg font-bold text-[#181b25]">Generate purchase orders</h3>
            <p className="mt-2 text-sm text-slate-600">
              Export a CSV draft of the current queue page (SKU, warehouse, suggested reorder qty from reorder level
              minus available). Full PO workflow is not wired; procurement can import this into their system.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                onClick={() => setPoOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-bold text-white hover:opacity-95"
                onClick={() => {
                  exportPoDraft();
                  setPoOpen(false);
                }}
              >
                Download CSV draft
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === "low" && items.length > 0 ? (
        <section className="flex flex-col justify-between gap-4 rounded-r-lg border-l-4 border-red-600 bg-red-50/60 p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
              <span className="text-lg font-bold">!</span>
            </div>
            <div>
              <h3 className="font-headline text-lg font-bold text-red-900">
                {meta?.totalItems ?? items.length} SKUs below reorder threshold
              </h3>
              <p className="text-sm font-medium text-red-900/80">
                {criticalCount} critical {criticalCount === 1 ? "item has" : "items have"} fewer than 5 units
                remaining and need immediate procurement.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {mode === "out" && items.length > 0 ? (
        <div className="flex flex-col justify-between gap-3 rounded-r-xl border-l-4 border-red-600 bg-red-50/50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 text-red-900">
            <span className="font-medium">
              {meta?.totalItems ?? items.length} SKUs currently unavailable — confirm storefront visibility in
              catalog.
            </span>
          </div>
        </div>
      ) : null}

      {mode === "low" ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-6">
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-red-600" />
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Critical alerts</p>
            <h4 className="font-headline text-3xl font-bold">{criticalCount}</h4>
            <p className="mt-1 text-[10px] text-slate-500">&lt; 5 units on this page</p>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-6">
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#1653cc]" />
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Queue depth</p>
            <h4 className="font-headline text-3xl font-bold">{meta?.totalItems ?? items.length}</h4>
            <p className="mt-1 text-[10px] text-slate-500">Global low-stock lines</p>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-6">
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-violet-600" />
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Replenishment (est.)</p>
            <h4 className="font-headline text-2xl font-bold">{formatMoney(replenishmentPageCents)}</h4>
            <p className="mt-1 text-[10px] text-slate-500">This page · cost or list price × shortfall</p>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-6">
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-violet-600" />
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Merch in transit</p>
            <h4 className="font-headline text-2xl font-bold text-[#181b25]">
              {meta?.inTransitMerchandiseValueCents !== undefined
                ? formatMoney(meta.inTransitMerchandiseValueCents)
                : "—"}
            </h4>
            <p className="mt-1 text-[10px] text-slate-500">
              {warehouseId ? "Scoped warehouse shipments · " : "All warehouses · "}
              DISPATCHED / IN_TRANSIT · order line totals
            </p>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-6">
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-slate-500" />
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">This page</p>
            <h4 className="font-headline text-3xl font-bold">{items.length}</h4>
          </div>
        </div>
      ) : null}

      {mode === "out" && meta ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex min-h-[8rem] flex-col justify-between rounded-xl border-l-4 border-red-600 bg-white p-5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total OOS SKUs</span>
            <span className="font-headline text-3xl font-bold">{meta.totalItems}</span>
            <span className="text-[10px] text-slate-500">Across all pages</span>
          </div>
          <div className="flex min-h-[8rem] flex-col justify-between rounded-xl border-l-4 border-amber-600 bg-white p-5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Revenue at risk (est.)</span>
            <span className="font-headline text-2xl font-bold text-amber-800">{formatMoney(revenueAtRiskPageCents)}</span>
            <span className="text-[10px] text-slate-500">This page · 1 unit list price proxy</span>
          </div>
          <div className="flex min-h-[8rem] flex-col justify-between rounded-xl border-l-4 border-[#1653cc] bg-white p-5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">On this page</span>
            <span className="font-headline text-3xl font-bold">{items.length}</span>
          </div>
          <div className="flex min-h-[8rem] flex-col justify-between rounded-xl border-l-4 border-slate-400 bg-white p-5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Orders impacted</span>
            <span className="font-headline text-3xl font-bold tabular-nums">
              {meta.openOrdersDistinctForOosVariants ?? "—"}
            </span>
            <span className="text-[10px] text-slate-500">
              Distinct open orders with a line for any OOS variant
              {warehouseId ? " (this warehouse)" : ""}
            </span>
            <Link to="/admin/orders" className="text-xs font-semibold text-[#1653cc] hover:underline">
              Open orders →
            </Link>
          </div>
        </div>
      ) : null}

      <StitchFilterPanel className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                applySearch();
              }
            }}
            placeholder="Search SKU, product, or warehouse…"
            className="w-full rounded-lg border border-[var(--color-border-light)] py-2 pl-10 pr-3 text-sm outline-none focus:border-[#1653cc]"
          />
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
          Warehouse
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setPage(1);
            }}
            className="min-w-[180px] rounded-lg border border-[var(--color-border-light)] px-3 py-2 text-sm"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={applySearch}
          className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
        >
          Apply
        </button>
      </StitchFilterPanel>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {listQuery.isLoading ? (
        <div className="rounded-xl border border-[var(--color-border-light)] bg-white p-8 text-center text-sm text-[var(--color-text-muted)]">
          Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]">
          {mode === "low" ? (
            <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f8f9fb] px-6 py-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500">Inventory priority queue</h4>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e7eb] bg-[#f8f9fb] px-6 py-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Inventory alert queue</h3>
            </div>
          )}
          <DataTableShell
            embedded
            variant="stitchOperational"
            columns={
              mode === "low"
                ? [
                    "Priority",
                    "Product",
                    "SKU",
                    "Warehouse",
                    "On hand",
                    "Reorder lvl",
                    "Last restock",
                    "Open orders",
                    "Actions"
                  ]
                : ["Product", "SKU", "Warehouse", "Days OOS", "Orders affected", "Actions"]
            }
            rows={rows}
            rowKeys={items.map((r) => r.id)}
            emptyState="No rows match the current filters."
          />
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-muted)]">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.totalItems} rows
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[var(--color-border-light)] px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[var(--color-border-light)] px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
