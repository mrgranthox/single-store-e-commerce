import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Store, X } from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createAdminWarehouse,
  getInventoryOverview,
  listAdminWarehouses,
  type WarehouseListItem
} from "@/features/inventory/api/admin-inventory.api";
import { InventorySubNav } from "@/features/inventory/components/InventorySubNav";

const statusBadge = (status?: string) => {
  const s = (status ?? "ACTIVE").toUpperCase();
  if (s === "MAINTENANCE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Maintenance
      </span>
    );
  }
  if (s === "OFFLINE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        Offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  );
};

export const WarehousesListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [filterQ, setFilterQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newLine1, setNewLine1] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newOpStatus, setNewOpStatus] = useState<"ACTIVE" | "MAINTENANCE" | "OFFLINE">("ACTIVE");
  const [formError, setFormError] = useState<string | null>(null);

  const warehousesQuery = useQuery({
    queryKey: ["admin-warehouses"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminWarehouses(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const overviewQuery = useQuery({
    queryKey: ["admin-inventory-overview"],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return getInventoryOverview(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const items = warehousesQuery.data?.data.items ?? [];
  const overview = overviewQuery.data?.data.entity;

  const filteredItems = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        (w.locationLabel ?? "").toLowerCase().includes(q)
    );
  }, [items, filterQ]);

  const createWh = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      const code = newCode.trim().toUpperCase().replace(/\s+/g, "_");
      const name = newName.trim();
      if (!code || !name) {
        throw new Error("Code and name are required.");
      }
      const metadata: Record<string, unknown> = {};
      if (newLine1.trim() || newCity.trim() || newCountry.trim()) {
        metadata.address = {
          ...(newLine1.trim() ? { line1: newLine1.trim() } : {}),
          ...(newCity.trim() ? { city: newCity.trim() } : {}),
          ...(newCountry.trim() ? { country: newCountry.trim() } : {})
        };
      }
      if (newContactEmail.trim()) {
        metadata.contact = { email: newContactEmail.trim() };
      }
      return createAdminWarehouse(accessToken, {
        code,
        name,
        operationalStatus: newOpStatus,
        ...(Object.keys(metadata).length ? { metadata } : {})
      });
    },
    onSuccess: () => {
      setFormError(null);
      setAddOpen(false);
      setNewCode("");
      setNewName("");
      setNewLine1("");
      setNewCity("");
      setNewCountry("");
      setNewContactEmail("");
      setNewOpStatus("ACTIVE");
      void queryClient.invalidateQueries({ queryKey: ["admin-warehouses"] });
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to create warehouse.");
    }
  });

  const errorMessage =
    warehousesQuery.error instanceof ApiError
      ? warehousesQuery.error.message
      : warehousesQuery.error instanceof Error
        ? warehousesQuery.error.message
        : null;

  const totalSkus = items.reduce((a, w) => a + w.inventoryItemCount, 0);
  const stockIntegrityPct =
    overview && overview.trackedLineCount > 0
      ? ((overview.healthyStockCount / overview.trackedLineCount) * 100).toFixed(1)
      : "—";

  const rows = filteredItems.map((w: WarehouseListItem) => {
    const lines = w.inventoryItemCount;
    const approxPct =
      w.totals.onHand > 0
        ? Math.min(100, Math.round((w.totals.available / w.totals.onHand) * 100))
        : lines > 0
          ? 0
          : 0;

    return [
      <div key={`n-${w.id}`} className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-[#1653cc]/10 text-[#1653cc]">
          <Store className="h-4 w-4" />
        </div>
        <div>
          <Link to={`/admin/inventory/warehouses/${w.id}`} className="font-semibold text-[#1653cc] hover:underline">
            {w.name}
          </Link>
          <p className="text-xs text-slate-500">{w.code}</p>
        </div>
      </div>,
      <span key={`loc-${w.id}`} className="text-sm text-slate-600">
        {w.locationLabel?.trim() ? w.locationLabel : "—"}
      </span>,
      <span key={`i-${w.id}`} className="text-sm font-medium">
        {w.inventoryItemCount}
      </span>,
      <span key={`pct-${w.id}`} className="text-sm font-mono">
        {lines > 0 ? `${approxPct}%` : "—"}
      </span>,
      <span key={`low-${w.id}`} className="text-sm font-medium text-amber-800">
        {w.lowStockCount ?? 0}
      </span>,
      <span key={`st-${w.id}`}>{statusBadge(w.operationalStatus)}</span>,
      <div key={`ac-${w.id}`} className="text-right">
        <Link
          to={`/admin/inventory/warehouses/${w.id}`}
          className="text-xs font-bold text-[#1653cc] hover:underline"
        >
          View
        </Link>
      </div>
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        titleSize="screen"
        description="Fulfillment nodes with rolled-up stock and shipment activity."
        actions={
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setAddOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            <Plus className="h-4 w-4" />
            Add warehouse
          </button>
        }
        meta={
          <Link to="/admin/inventory/overview" className="text-sm font-semibold text-[#1653cc] hover:underline">
            ← Overview
          </Link>
        }
      />

      <InventorySubNav />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border-l-4 border-[#1653cc] bg-white p-5 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total nodes</p>
          <p className="mt-1 font-headline text-2xl font-bold">{items.length}</p>
          <span className="mt-2 inline-block rounded bg-[#1653cc]/10 px-2 py-0.5 text-[10px] font-mono text-[#1653cc]">
            Active
          </span>
        </div>
        <div className="rounded-xl border-l-4 border-emerald-600 bg-white p-5 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Stock integrity</p>
          <p className="mt-1 font-headline text-2xl font-bold">{stockIntegrityPct}%</p>
          <span className="text-[10px] text-emerald-700">Global healthy lines</span>
        </div>
        <div className="rounded-xl border-l-4 border-red-600 bg-white p-5 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Critical alerts</p>
          <p className="mt-1 font-headline text-2xl font-bold text-red-700">
            {(overview?.lowStockCount ?? 0) + (overview?.outOfStockCount ?? 0)}
          </p>
          <span className="text-[10px] font-bold text-red-600">Low + out of stock</span>
        </div>
        <div className="rounded-xl border-l-4 border-slate-500 bg-white p-5 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total SKUs</p>
          <p className="mt-1 font-headline text-2xl font-bold">{totalSkus.toLocaleString()}</p>
          <span className="text-[10px] text-slate-500">Across warehouses</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-card ring-1 ring-slate-200">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            placeholder="Filter by name, code, or location…"
            className="w-full rounded-lg border-0 bg-[#f2f3ff] py-2 pl-10 pr-4 text-sm outline-none ring-2 ring-transparent focus:ring-[#1653cc]/20"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const header = ["code", "name", "location", "skus", "low_stock", "out_of_stock", "on_hand", "available", "status"];
            const lines = [
              header.join(","),
              ...items.map((w) =>
                [
                  w.code,
                  `"${w.name.replace(/"/g, '""')}"`,
                  `"${(w.locationLabel ?? "").replace(/"/g, '""')}"`,
                  w.inventoryItemCount,
                  w.lowStockCount ?? 0,
                  w.outOfStockCount ?? 0,
                  w.totals.onHand,
                  w.totals.available,
                  w.operationalStatus ?? "ACTIVE"
                ].join(",")
              )
            ];
            const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `warehouses-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={items.length === 0}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="font-headline text-lg font-bold">Add warehouse</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setAddOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              {formError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>
              ) : null}
              <label className="block text-xs font-semibold text-slate-600">
                Code *
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase"
                  placeholder="MAIN_WH"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Display name *
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Main fulfillment center"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Operational status
                <select
                  value={newOpStatus}
                  onChange={(e) => setNewOpStatus(e.target.value as typeof newOpStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="OFFLINE">Offline</option>
                </select>
              </label>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Location (stored in metadata)</p>
              <label className="block text-xs font-semibold text-slate-600">
                Address line 1
                <input
                  value={newLine1}
                  onChange={(e) => setNewLine1(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                City
                <input
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Country
                <input
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Contact email
                <input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                disabled={createWh.isPending}
                onClick={() => {
                  setFormError(null);
                  createWh.mutate();
                }}
                className="w-full rounded-lg bg-[#1653cc] py-3 text-sm font-bold text-white hover:opacity-95 disabled:opacity-50"
              >
                {createWh.isPending ? "Creating…" : "Create warehouse"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {warehousesQuery.isLoading ? (
        <div className="rounded-xl border border-[var(--color-border-light)] bg-white p-8 text-center text-sm text-[var(--color-text-muted)]">
          Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]">
          <DataTableShell
            embedded
            variant="stitchOperational"
            columns={[
              "Warehouse name",
              "Location",
              "Total SKUs",
              "In stock %",
              "Low stock",
              "Status",
              "Actions"
            ]}
            rows={rows}
            rowKeys={filteredItems.map((w) => w.id)}
            emptyState="No warehouses configured."
          />
        </div>
      )}
    </div>
  );
};
