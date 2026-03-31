import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Package,
  Search,
  Truck
} from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { MiniSparkline } from "@/components/stitch";
import { InventoryProductCell } from "@/features/inventory/components/InventoryProductCell";
import { InventorySubNav } from "@/features/inventory/components/InventorySubNav";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  getInventoryOverview,
  listAdminWarehouses,
  listInventoryStocks,
  type InventoryStockRow
} from "@/features/inventory/api/admin-inventory.api";

const healthFilterParam = (v: string): "all" | "healthy" | "low_stock" | "out_of_stock" => {
  if (v === "in_stock") return "healthy";
  if (v === "low_stock") return "low_stock";
  if (v === "out_of_stock") return "out_of_stock";
  return "all";
};

const stockStatusBadge = (row: InventoryStockRow) => {
  const low = row.health?.lowStock;
  const out = row.health?.outOfStock;
  if (out) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Out of Stock
      </span>
    );
  }
  if (low) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Low Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
      In Stock
    </span>
  );
};

const rowBorderClass = (row: InventoryStockRow) => {
  if (row.health?.outOfStock) return "border-l-4 border-red-500";
  if (row.health?.lowStock) return "border-l-4 border-amber-500";
  return "";
};

const formatMoney = (cents: number, currency = "GHS") => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
};

const formatDeltaPct = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
};

export const InventoryOverviewPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [minAvailDraft, setMinAvailDraft] = useState("");
  const [maxAvailDraft, setMaxAvailDraft] = useState("");
  const [appliedMinAvail, setAppliedMinAvail] = useState<number | undefined>(undefined);
  const [appliedMaxAvail, setAppliedMaxAvail] = useState<number | undefined>(undefined);

  const overviewQuery = useQuery({
    queryKey: ["admin-inventory-overview"],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return getInventoryOverview(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const warehousesQuery = useQuery({
    queryKey: ["admin-warehouses"],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return listAdminWarehouses(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const healthFilter = healthFilterParam(statusFilter);

  const stocksQuery = useQuery({
    queryKey: [
      "admin-inventory-stocks",
      page,
      appliedSearch,
      warehouseId,
      healthFilter,
      statusFilter,
      appliedMinAvail,
      appliedMaxAvail
    ],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return listInventoryStocks(accessToken, {
        page,
        page_size: 20,
        sortBy: "productTitle",
        sortOrder: "asc",
        ...(appliedSearch.trim() ? { q: appliedSearch.trim() } : {}),
        ...(warehouseId ? { warehouseId } : {}),
        healthFilter,
        ...(appliedMinAvail !== undefined ? { minAvailable: appliedMinAvail } : {}),
        ...(appliedMaxAvail !== undefined ? { maxAvailable: appliedMaxAvail } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const entity = overviewQuery.data?.data.entity;
  const err =
    overviewQuery.error instanceof ApiError
      ? overviewQuery.error.message
      : overviewQuery.error instanceof Error
        ? overviewQuery.error.message
        : null;

  const warehouses = warehousesQuery.data?.data.items ?? [];
  const stockItems = stocksQuery.data?.data.items ?? [];
  const stockMeta = stocksQuery.data?.meta;

  const tracked = entity?.trackedLineCount ?? 0;
  const healthy = entity?.healthyStockCount ?? 0;
  const pctHealthy = tracked > 0 ? ((healthy / tracked) * 100).toFixed(1) : "0";
  const pctLowOfTracked = tracked > 0 && entity ? ((entity.lowStockCount / tracked) * 100).toFixed(1) : "0";
  const pctOutOfTracked = tracked > 0 && entity ? ((entity.outOfStockCount / tracked) * 100).toFixed(1) : "0";
  const d = entity?.kpiDeltaSincePrior ?? null;
  const inTransitCents = entity?.inTransitMerchandiseValueCents ?? 0;

  const applyFilters = () => {
    setPage(1);
    setAppliedSearch(searchDraft);
  };

  const applyAdvancedAvailability = () => {
    const minN = minAvailDraft.trim() === "" ? undefined : Number(minAvailDraft);
    const maxN = maxAvailDraft.trim() === "" ? undefined : Number(maxAvailDraft);
    setAppliedMinAvail(minN !== undefined && Number.isFinite(minN) ? minN : undefined);
    setAppliedMaxAvail(maxN !== undefined && Number.isFinite(maxN) ? maxN : undefined);
    setPage(1);
  };

  const clearAdvancedAvailability = () => {
    setMinAvailDraft("");
    setMaxAvailDraft("");
    setAppliedMinAvail(undefined);
    setAppliedMaxAvail(undefined);
    setPage(1);
  };

  const exportCsv = () => {
    const rows = stockItems;
    const header = [
      "Product",
      "Variant SKU",
      "Warehouse",
      "On hand",
      "Reserved",
      "Available",
      "Reorder level",
      "Status"
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) => {
        const status = r.health?.outOfStock ? "Out of stock" : r.health?.lowStock ? "Low stock" : "In stock";
        return [
          `"${(r.variant.product.title || "").replace(/"/g, '""')}"`,
          r.variant.sku,
          r.warehouse.code,
          r.stock.onHand,
          r.stock.reserved,
          r.stock.available,
          r.stock.effectiveReorderLevel,
          status
        ].join(",");
      })
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tableRows = useMemo(
    () =>
      stockItems.map((row: InventoryStockRow) => [
        <InventoryProductCell
          key={`p-${row.id}`}
          productId={row.variant.product.id}
          title={row.variant.product.title}
          thumbnailUrl={row.variant.product.thumbnailUrl}
          borderClass={rowBorderClass(row)}
        />,
        <span key={`v-${row.id}`} className="text-sm text-slate-600">
          {row.variant.status ? String(row.variant.status).replace(/_/g, " ") : "—"}
        </span>,
        <span key={`sku-${row.id}`} className="font-mono text-xs text-slate-600">
          {row.variant.sku}
        </span>,
        <span key={`wh-${row.id}`} className="text-sm text-slate-600">
          {row.warehouse.name}
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
        <span key={`st-${row.id}`}>{stockStatusBadge(row)}</span>,
        <div key={`ac-${row.id}`} className="text-right">
          <Link
            to="/admin/inventory/adjustments"
            className="text-xs font-semibold text-[#1653cc] hover:underline"
          >
            Adjust
          </Link>
        </div>
      ]),
    [stockItems]
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inventory"
        titleSize="screen"
        description="Real-time stock architecture and logistics overview."
        actions={
          <button
            type="button"
            onClick={exportCsv}
            disabled={stockItems.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1653cc]/20 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            Export CSV
          </button>
        }
      />

      <InventorySubNav />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {err}
          {overviewQuery.error instanceof ApiError && overviewQuery.error.statusCode === 403 ? (
            <span className="mt-1 block text-xs">Requires inventory.read.</span>
          ) : null}
        </div>
      ) : null}

      {overviewQuery.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading overview…</p>
      ) : entity ? (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
            <article className="relative flex min-h-[8.5rem] flex-col justify-between overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-white p-6 shadow-card">
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#1653cc]" />
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total SKUs</p>
                <div className="flex items-center gap-2">
                  <MiniSparkline
                    stroke="#1653cc"
                    variant={
                      (d?.trackedLineCountPct ?? 0) > 0 ? "up" : (d?.trackedLineCountPct ?? 0) < 0 ? "down" : "flat"
                    }
                    className="opacity-90"
                  />
                  <Package className="h-5 w-5 text-[#1653cc]/30" strokeWidth={2} />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-headline text-3xl font-bold text-[#0f1117]">
                    {entity.trackedLineCount.toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-medium text-slate-400">Tracked warehouse × variant lines</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">
                  {d ? (
                    <>
                      {formatDeltaPct(d.trackedLineCountPct) ?? "—"} vs prior 24h
                      <span className="ml-1 font-normal text-slate-400">
                        ({new Date(d.baselineCapturedAt).toLocaleDateString()})
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400">24h trend available after older snapshot exists</span>
                  )}
                </p>
              </div>
            </article>
            <article className="relative flex min-h-[8.5rem] flex-col justify-between overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-white p-6 shadow-card">
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-emerald-600" />
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">In Stock</p>
                <div className="flex items-center gap-2">
                  <MiniSparkline
                    stroke="#059669"
                    variant={
                      (d?.healthyStockCountPct ?? 0) > 0 ? "up" : (d?.healthyStockCountPct ?? 0) < 0 ? "down" : "flat"
                    }
                    className="opacity-90"
                  />
                  <CheckCircle className="h-5 w-5 text-emerald-600/30" strokeWidth={2} />
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-headline text-3xl font-bold text-[#0f1117]">
                    {entity.healthyStockCount.toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">{pctHealthy}% of lines</span>
                </div>
                <p className="mt-1 text-[10px] font-medium text-slate-500">Healthy lines (above reorder, in stock)</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-600">
                  {d ? `${formatDeltaPct(d.healthyStockCountPct) ?? "—"} vs prior 24h` : "—"}
                </p>
              </div>
            </article>
            <article className="relative flex min-h-[8.5rem] flex-col justify-between overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-white p-6 shadow-card">
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-amber-500" />
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Low Stock</p>
                <div className="flex items-center gap-2">
                  <MiniSparkline
                    stroke="#d97706"
                    variant={
                      (d?.lowStockCountPct ?? 0) > 0 ? "down" : (d?.lowStockCountPct ?? 0) < 0 ? "up" : "flat"
                    }
                    className="opacity-90"
                  />
                  <AlertTriangle className="h-5 w-5 text-amber-500/40" strokeWidth={2} />
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-headline text-3xl font-bold text-amber-600">
                    {entity.lowStockCount.toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-amber-800">{pctLowOfTracked}% of SKUs</span>
                </div>
                <p className="mt-1 text-[10px] font-bold text-amber-700">Below reorder · action required</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-600">
                  {d ? `${formatDeltaPct(d.lowStockCountPct) ?? "—"} vs prior 24h` : "—"}
                </p>
              </div>
            </article>
            <article className="relative flex min-h-[8.5rem] flex-col justify-between overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-white p-6 shadow-card">
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-red-500" />
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Out of Stock</p>
                <div className="flex items-center gap-2">
                  <MiniSparkline
                    stroke="#dc2626"
                    variant={
                      (d?.outOfStockCountPct ?? 0) > 0 ? "down" : (d?.outOfStockCountPct ?? 0) < 0 ? "up" : "flat"
                    }
                    className="opacity-90"
                  />
                  <AlertCircle className="h-5 w-5 text-red-500/30" strokeWidth={2} />
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-headline text-3xl font-bold text-red-600">
                    {entity.outOfStockCount.toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-red-700">{pctOutOfTracked}% of SKUs</span>
                </div>
                <p className="mt-1 text-[10px] font-bold text-red-700">Critical · zero available</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-600">
                  {d ? `${formatDeltaPct(d.outOfStockCountPct) ?? "—"} vs prior 24h` : "—"}
                </p>
              </div>
            </article>
            <article className="relative flex min-h-[8.5rem] flex-col justify-between overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-white p-6 shadow-card">
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-violet-600" />
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Merch in transit</p>
                <div className="flex items-center gap-2">
                  <MiniSparkline
                    stroke="#7c3aed"
                    variant={
                      (d?.inTransitMerchandiseValueCentsPct ?? 0) > 0
                        ? "up"
                        : (d?.inTransitMerchandiseValueCentsPct ?? 0) < 0
                          ? "down"
                          : "flat"
                    }
                    className="opacity-90"
                  />
                  <Truck className="h-5 w-5 text-violet-500/40" strokeWidth={2} />
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-headline text-2xl font-bold text-[#0f1117]">{formatMoney(inTransitCents)}</span>
                </div>
                <p className="mt-1 text-[10px] font-medium text-slate-500">
                  Line value on CONFIRMED/PROCESSING orders with DISPATCHED or IN_TRANSIT shipments
                </p>
                <p className="mt-1 text-[10px] font-semibold text-slate-600">
                  {d ? `${formatDeltaPct(d.inTransitMerchandiseValueCentsPct) ?? "—"} vs prior 24h` : "—"}
                </p>
              </div>
            </article>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#e5e7eb] bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]">
            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
                placeholder="Search product name or SKU…"
                className="w-full rounded-lg border-0 bg-[#f2f3ff] py-2 pl-10 pr-4 text-sm outline-none ring-2 ring-transparent focus:ring-[#1653cc]/20"
              />
            </div>
            <select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border-0 bg-[#f2f3ff] px-4 py-2 text-sm font-medium text-[#181b25] outline-none ring-2 ring-transparent focus:ring-[#1653cc]/20"
            >
              <option value="">All warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border-0 bg-[#f2f3ff] px-4 py-2 text-sm font-medium outline-none ring-2 ring-transparent focus:ring-[#1653cc]/20"
            >
              <option value="all">All status</option>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Advanced filters
              {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {advancedOpen ? (
            <div className="rounded-xl border border-[var(--color-border-light)] bg-[#f8f9fb] p-4 shadow-inner">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Available quantity range
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Min available
                  <input
                    type="number"
                    min={0}
                    value={minAvailDraft}
                    onChange={(e) => setMinAvailDraft(e.target.value)}
                    placeholder="e.g. 0"
                    className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Max available
                  <input
                    type="number"
                    min={0}
                    value={maxAvailDraft}
                    onChange={(e) => setMaxAvailDraft(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                  />
                </label>
                <button
                  type="button"
                  onClick={applyAdvancedAvailability}
                  className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  Apply range
                </button>
                {appliedMinAvail !== undefined || appliedMaxAvail !== undefined ? (
                  <button
                    type="button"
                    onClick={clearAdvancedAvailability}
                    className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Clear range
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {stocksQuery.error instanceof ApiError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {stocksQuery.error.message}
            </div>
          ) : null}

          {stocksQuery.isLoading ? (
            <div className="rounded-xl border border-[var(--color-border-light)] bg-white p-8 text-center text-sm text-[var(--color-text-muted)]">
              Loading stock grid…
            </div>
          ) : (
            <DataTableShell
              variant="stitchOperational"
              columns={[
                "Product",
                "Variant",
                "SKU",
                "Warehouse",
                "On hand",
                "Reserved",
                "Available",
                "Reorder level",
                "Status",
                "Actions"
              ]}
              rows={tableRows}
              rowKeys={stockItems.map((r) => r.id)}
              emptyState="No stock rows match the current filters."
            />
          )}

          {stockMeta && stockMeta.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border-light)] bg-[#f8f9fb] px-6 py-4 text-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Page {stockMeta.page} of {stockMeta.totalPages} · {stockMeta.totalItems} SKUs
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= stockMeta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
