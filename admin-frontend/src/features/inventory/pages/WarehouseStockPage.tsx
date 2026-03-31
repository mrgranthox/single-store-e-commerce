import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Download, Search, SlidersHorizontal } from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  getAdminWarehouseDetail,
  listInventoryStocks,
  type InventoryStockRow
} from "@/features/inventory/api/admin-inventory.api";
import { InventoryProductCell } from "@/features/inventory/components/InventoryProductCell";
import { InventorySubNav } from "@/features/inventory/components/InventorySubNav";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const statusBadge = (row: InventoryStockRow) => {
  if (row.health?.outOfStock) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-red-700">
        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-red-500" />
        Critical
      </span>
    );
  }
  if (row.health?.lowStock) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-amber-800">
        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
        Low stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-emerald-800">
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
      In stock
    </span>
  );
};

const rowClass = (row: InventoryStockRow) => {
  if (row.health?.outOfStock) return "border-l-4 border-red-500";
  if (row.health?.lowStock) return "border-l-4 border-amber-500";
  return "";
};

const formatMovement = (row: InventoryStockRow) => {
  const lm = row.lastMovement?.createdAt;
  if (!lm) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(lm));
  } catch {
    return lm;
  }
};

export const WarehouseStockPage = () => {
  const { warehouseId } = useParams<{ warehouseId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "healthy" | "low_stock" | "out_of_stock">("all");

  const detailQuery = useQuery({
    queryKey: ["admin-warehouse-detail", warehouseId],
    queryFn: async () => {
      if (!accessToken || !warehouseId) throw new Error("Missing context.");
      return getAdminWarehouseDetail(accessToken, warehouseId);
    },
    enabled: Boolean(accessToken && warehouseId)
  });

  const q = useQuery({
    queryKey: ["admin-warehouse-inventory", warehouseId, page, appliedSearch, statusFilter],
    queryFn: async () => {
      if (!accessToken || !warehouseId) {
        throw new Error("Missing context.");
      }
      return listInventoryStocks(accessToken, {
        page,
        page_size: 25,
        warehouseId,
        healthFilter: statusFilter,
        sortBy: "productTitle",
        sortOrder: "asc",
        ...(appliedSearch.trim() ? { q: appliedSearch.trim() } : {})
      });
    },
    enabled: Boolean(accessToken && warehouseId)
  });

  const items = q.data?.data.items ?? [];
  const meta = q.data?.meta;
  const err = q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const wh = detailQuery.data?.data.entity;
  const summary = wh?.summary;

  const rows = items.map((row) => [
    <InventoryProductCell
      key={`p-${row.id}`}
      productId={row.variant.product.id}
      title={row.variant.product.title}
      thumbnailUrl={row.variant.product.thumbnailUrl}
      borderClass={rowClass(row)}
    />,
    <span key={`v-${row.id}`} className="text-xs text-slate-600">
      {row.variant.status ? String(row.variant.status).replace(/_/g, " ") : "—"}
    </span>,
    <span key={`sku-${row.id}`} className="font-mono text-xs">
      {row.variant.sku}
    </span>,
    <span key={`oh-${row.id}`} className="text-right font-mono text-sm">
      {row.stock.onHand}
    </span>,
    <span key={`rs-${row.id}`} className="text-right font-mono text-sm text-slate-500">
      {row.stock.reserved}
    </span>,
    <span key={`av-${row.id}`} className="text-right font-mono text-sm font-semibold">
      {row.stock.available}
    </span>,
    <span key={`rl-${row.id}`} className="text-right font-mono text-sm text-slate-500">
      {row.stock.effectiveReorderLevel}
    </span>,
    <span key={`lm-${row.id}`} className="text-[11px] text-slate-500">
      {formatMovement(row)}
    </span>,
    <span key={`st-${row.id}`}>{statusBadge(row)}</span>,
    <div key={`ac-${row.id}`} className="flex justify-end gap-2">
      <Link
        to="/admin/inventory/adjustments"
        className="rounded p-1.5 text-[#1653cc] hover:bg-[#1653cc]/10"
        title="Adjust"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </Link>
      <Link
        to={`/admin/catalog/products/${row.variant.product.id}`}
        className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
        title="View product"
      >
        <span className="text-xs font-bold">View</span>
      </Link>
    </div>
  ]);

  const exportCsv = () => {
    const header = [
      "Product",
      "Variant",
      "SKU",
      "On hand",
      "Reserved",
      "Available",
      "Reorder",
      "Last movement"
    ];
    const lines = [
      header.join(","),
      ...items.map((r) =>
        [
          `"${r.variant.product.title.replace(/"/g, '""')}"`,
          r.variant.sku,
          r.variant.sku,
          r.stock.onHand,
          r.stock.reserved,
          r.stock.available,
          r.stock.effectiveReorderLevel,
          formatMovement(r)
        ].join(",")
      )
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `warehouse-${warehouseId?.slice(0, 8)}-inventory.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!warehouseId) {
    return <p className="text-sm text-[var(--color-text-muted)]">Missing warehouse id.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={wh ? `${wh.name} → Inventory` : "Warehouse inventory"}
        titleSize="screen"
        description="Stock lines scoped to this facility."
        breadcrumbItems={
          wh
            ? [
                { label: "Inventory", to: "/admin/inventory/overview" },
                { label: wh.name, to: `/admin/inventory/warehouses/${warehouseId}` },
                { label: "Inventory" }
              ]
            : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={items.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <Link
              to="/admin/inventory/adjustments"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-6 py-2 text-sm font-semibold text-white shadow-lg"
            >
              Manual entry
            </Link>
          </div>
        }
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-warehouse-inventory", warehouseId])]}
      />

      <InventorySubNav warehouseId={warehouseId} />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-card ring-1 ring-slate-200 lg:col-span-8">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setAppliedSearch(searchDraft);
                }
              }}
              placeholder="Filter by product, SKU, or variant…"
              className="w-full rounded-lg border-0 bg-[#f2f3ff] py-2 pl-10 pr-4 text-sm outline-none ring-2 ring-transparent focus:ring-[#1653cc]/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as typeof statusFilter);
                setPage(1);
              }}
              className="rounded-lg border-0 bg-[#f2f3ff] py-2 pl-3 pr-8 text-sm focus:ring-2 focus:ring-[#1653cc]/20"
            >
              <option value="all">All</option>
              <option value="healthy">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setAppliedSearch(searchDraft);
            }}
            className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </div>
        <div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-4">
          <div className="rounded-xl border-l-4 border-[#1653cc] bg-white p-4 shadow-card lg:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Facility totals</span>
            <span className="mt-1 block font-headline text-xl font-bold text-[#181b25]">
              {summary ? `${summary.inventoryItemCount.toLocaleString()} SKUs · ${summary.totals.onHand.toLocaleString()} on hand` : "—"}
            </span>
            <span className="text-xs text-slate-500">Totals for this facility</span>
          </div>
          <div className="rounded-xl border-l-4 border-red-600 bg-white p-4 shadow-card">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Out of stock</span>
            <span className="mt-1 block font-headline text-2xl font-bold text-red-600">
              {summary?.outOfStockCount ?? "—"}
            </span>
            <span className="text-xs text-slate-500">Whole warehouse</span>
          </div>
          <div className="rounded-xl border-l-4 border-amber-500 bg-white p-4 shadow-card">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Low stock</span>
            <span className="mt-1 block font-headline text-2xl font-bold text-amber-600">
              {summary?.lowStockCount ?? "—"}
            </span>
            <span className="text-xs text-slate-500">Whole warehouse</span>
          </div>
        </div>
      </div>

      <p className="text-sm">
        <Link className="font-semibold text-[#1653cc] hover:underline" to={`/admin/inventory/warehouses/${warehouseId}`}>
          ← Warehouse detail
        </Link>
      </p>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]">
            <DataTableShell
              embedded
              variant="stitchOperational"
              columns={[
                "Product",
                "Variant",
                "SKU",
                "On hand",
                "Reserved",
                "Available",
                "Reorder",
                "Last movement",
                "Status",
                "Actions"
              ]}
              rows={rows}
              rowKeys={items.map((r) => r.id)}
              emptyState="No rows for this warehouse."
            />
          </div>
          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm">
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
        </>
      )}
    </div>
  );
};
