import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  listAdminWarehouses,
  listInventoryMovements
} from "@/features/inventory/api/admin-inventory.api";
import type { InventoryMovementRow } from "@/features/inventory/api/admin-inventory.api";
import { StitchFilterPanel } from "@/components/stitch";
import { InventorySubNav } from "@/features/inventory/components/InventorySubNav";

const MOVEMENT_TYPES = [
  "",
  "RESERVATION",
  "RESERVATION_RELEASE",
  "DEDUCTION",
  "RESTOCK",
  "MANUAL_ADJUSTMENT_INCREASE",
  "MANUAL_ADJUSTMENT_DECREASE",
  "RETURN_RESTOCK"
] as const;

const movementTypeLabel = (raw: string) => {
  const map: Record<string, string> = {
    RESERVATION: "Sale",
    RESERVATION_RELEASE: "Release",
    DEDUCTION: "Deduction",
    RESTOCK: "Restock",
    MANUAL_ADJUSTMENT_INCREASE: "Adjustment",
    MANUAL_ADJUSTMENT_DECREASE: "Adjustment",
    RETURN_RESTOCK: "Return"
  };
  return map[raw] ?? raw.replace(/_/g, " ");
};

const movementBadgeClass = (label: string) => {
  if (label === "Sale" || label === "Deduction") return "border-blue-200 bg-blue-50 text-blue-800";
  if (label === "Restock" || label === "Return") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (label === "Adjustment") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatWhenMono = (iso: string) => {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
};

const actorLabel = (m: InventoryMovementRow) => {
  if (!m.actorAdminUserId) return "System";
  const id = m.actorAdminUserId;
  return `Admin ${id.slice(0, 8)}…`;
};

const referenceLabel = (m: InventoryMovementRow) => {
  if (m.orderId) return `ORD-${m.orderId.slice(0, 8)}`;
  if (m.returnId) return `RET-${m.returnId.slice(0, 8)}`;
  if (m.paymentId) return `PAY-${m.paymentId.slice(0, 8)}`;
  if (m.reservationId) return `RSV-${m.reservationId.slice(0, 8)}`;
  const r = m.reason?.trim();
  if (r) return r.length > 28 ? `${r.slice(0, 28)}…` : r;
  return `MOV-${m.id.slice(0, 8)}`;
};

export const InventoryMovementsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [skuDraft, setSkuDraft] = useState("");
  const [appliedSku, setAppliedSku] = useState("");
  const [movementType, setMovementType] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [dateFromDraft, setDateFromDraft] = useState("");
  const [dateToDraft, setDateToDraft] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [actorDraft, setActorDraft] = useState("");
  const [appliedActorId, setAppliedActorId] = useState("");
  const urlProductId = searchParams.get("productId")?.trim() ?? "";
  const [appliedProductId, setAppliedProductId] = useState(urlProductId);

  useEffect(() => {
    if (urlProductId) {
      setAppliedProductId(urlProductId);
      setPage(1);
    }
  }, [urlProductId]);

  const warehousesQuery = useQuery({
    queryKey: ["admin-warehouses"],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return listAdminWarehouses(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const queryKey = useMemo(
    () =>
      [
        "admin-inventory-movements",
        page,
        appliedSku,
        movementType,
        appliedProductId,
        warehouseId,
        appliedDateFrom,
        appliedDateTo,
        appliedActorId
      ] as const,
    [page, appliedSku, movementType, appliedProductId, warehouseId, appliedDateFrom, appliedDateTo, appliedActorId]
  );

  const movementsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listInventoryMovements(accessToken, {
        page,
        page_size: 25,
        sortOrder: "desc",
        ...(appliedSku.trim() ? { sku: appliedSku.trim() } : {}),
        ...(movementType ? { movementType } : {}),
        ...(appliedProductId ? { productId: appliedProductId } : {}),
        ...(warehouseId ? { warehouseId } : {}),
        ...(appliedDateFrom.trim() ? { dateFrom: appliedDateFrom.trim() } : {}),
        ...(appliedDateTo.trim() ? { dateTo: appliedDateTo.trim() } : {}),
        ...(appliedActorId.trim() ? { actorAdminUserId: appliedActorId.trim() } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = movementsQuery.data?.data.items ?? [];
  const meta = movementsQuery.data?.meta;
  const warehouses = warehousesQuery.data?.data.items ?? [];

  const applyFilters = () => {
    setPage(1);
    setAppliedSku(skuDraft);
    setAppliedDateFrom(dateFromDraft);
    setAppliedDateTo(dateToDraft);
    setAppliedActorId(actorDraft);
  };

  const clearFilters = () => {
    setSkuDraft("");
    setAppliedSku("");
    setMovementType("");
    setWarehouseId("");
    setAppliedProductId("");
    setDateFromDraft("");
    setDateToDraft("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setActorDraft("");
    setAppliedActorId("");
    const next = new URLSearchParams(searchParams);
    next.delete("productId");
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const filtersActive =
    Boolean(appliedSku.trim()) ||
    Boolean(movementType) ||
    Boolean(warehouseId) ||
    Boolean(appliedProductId) ||
    Boolean(appliedDateFrom.trim()) ||
    Boolean(appliedDateTo.trim()) ||
    Boolean(appliedActorId.trim());

  const exportCsv = () => {
    const header = [
      "Timestamp",
      "Product",
      "SKU",
      "Warehouse",
      "Type",
      "Change",
      "Before",
      "After",
      "Actor",
      "Reference"
    ];
    const lines = [
      header.join(","),
      ...items.map((m) => {
        const before = m.resultingOnHand - m.deltaOnHand;
        const label = movementTypeLabel(m.movementType);
        return [
          formatWhenMono(m.createdAt),
          `"${m.variant.product.title.replace(/"/g, '""')}"`,
          m.variant.sku,
          m.warehouse.code,
          label,
          m.deltaOnHand,
          before,
          m.resultingOnHand,
          actorLabel(m),
          referenceLabel(m)
        ].join(",");
      })
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorMessage =
    movementsQuery.error instanceof ApiError
      ? movementsQuery.error.message
      : movementsQuery.error instanceof Error
        ? movementsQuery.error.message
        : null;

  const rows = items.map((m) => {
    const before = m.resultingOnHand - m.deltaOnHand;
    const label = movementTypeLabel(m.movementType);
    const changeCls =
      m.deltaOnHand > 0 ? "text-emerald-700" : m.deltaOnHand < 0 ? "text-red-600 font-bold" : "text-slate-600";
    return [
      <span key={`t-${m.id}`} className="font-mono text-xs text-slate-500">
        {formatWhenMono(m.createdAt)}
      </span>,
      <div key={`p-${m.id}`}>
        <Link
          to={`/admin/catalog/products/${m.variant.product.id}`}
          className="text-sm font-medium text-[#1653cc] hover:underline"
        >
          {m.variant.product.title}
        </Link>
        <span className="block text-xs text-slate-400">SKU {m.variant.sku}</span>
      </div>,
      <span key={`sku-${m.id}`} className="font-mono text-xs text-slate-600">
        {m.variant.sku}
      </span>,
      <span key={`wh-${m.id}`} className="text-sm">
        {m.warehouse.code}
      </span>,
      <span key={`ty-${m.id}`}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${movementBadgeClass(label)}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
          {label}
        </span>
      </span>,
      <span key={`d-${m.id}`} className={`text-right font-mono text-sm ${changeCls}`}>
        {m.deltaOnHand > 0 ? `+${m.deltaOnHand}` : String(m.deltaOnHand)}
      </span>,
      <span key={`b-${m.id}`} className="text-right font-mono text-sm text-slate-500">
        {before}
      </span>,
      <span key={`a-${m.id}`} className="text-right font-mono text-sm font-semibold">
        {m.resultingOnHand}
      </span>,
      <span key={`act-${m.id}`} className="text-sm text-slate-600">
        {actorLabel(m)}
      </span>,
      <span key={`ref-${m.id}`} className="font-mono text-xs text-[#1653cc]">
        {referenceLabel(m)}
      </span>
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movement History"
        titleSize="screen"
        description="Immutable audit log of stock changes across warehouses."
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admin/inventory/overview" className="text-sm font-semibold text-[#1653cc] hover:underline">
              ← Overview
            </Link>
            <button
              type="button"
              onClick={exportCsv}
              disabled={items.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        }
      />

      <InventorySubNav />

      <StitchFilterPanel className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
        {appliedProductId ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="text-[var(--color-text-muted)]">Product scope</span>
            <Link
              className="font-medium text-[#1653cc] hover:underline"
              to={`/admin/catalog/products/${appliedProductId}`}
            >
              Open product
            </Link>
            <button
              type="button"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              onClick={() => {
                setAppliedProductId("");
                const next = new URLSearchParams(searchParams);
                next.delete("productId");
                setSearchParams(next, { replace: true });
                setPage(1);
              }}
            >
              Clear
            </button>
          </div>
        ) : null}
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={skuDraft}
            onChange={(e) => setSkuDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                applyFilters();
              }
            }}
            placeholder="Search product or SKU…"
            className="w-full rounded-lg border-0 bg-[#f2f3ff] py-2 pl-10 pr-4 text-sm outline-none ring-2 ring-transparent focus:ring-[#1653cc]/20"
          />
        </div>
        <label className="flex w-full flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] lg:w-52">
          Warehouse
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 text-sm"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-full flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] lg:w-56">
          Movement type
          <select
            value={movementType}
            onChange={(e) => {
              setMovementType(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 text-sm"
          >
            {MOVEMENT_TYPES.map((t) => (
              <option key={t || "all"} value={t}>
                {t ? movementTypeLabel(t) : "All types"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-full flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] lg:w-40">
          From date
          <input
            value={dateFromDraft}
            onChange={(e) => setDateFromDraft(e.target.value)}
            placeholder="YYYY-MM-DD"
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="flex w-full flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] lg:w-40">
          To date
          <input
            value={dateToDraft}
            onChange={(e) => setDateToDraft(e.target.value)}
            placeholder="YYYY-MM-DD"
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="flex w-full min-w-[12rem] flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)] lg:w-56">
          Actor user ID
          <input
            value={actorDraft}
            onChange={(e) => setActorDraft(e.target.value)}
            placeholder="User ID"
            className="rounded-lg border border-[var(--color-border-light)] px-3 py-2 font-mono text-xs"
          />
        </label>
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
        >
          Apply
        </button>
        {filtersActive ? (
          <button type="button" onClick={clearFilters} className="text-sm font-semibold text-[#1653cc] hover:underline">
            Clear filters
          </button>
        ) : null}
      </StitchFilterPanel>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {movementsQuery.isLoading ? (
        <div className="rounded-xl border border-[var(--color-border-light)] bg-white p-8 text-center text-sm text-[var(--color-text-muted)]">
          Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]">
          <DataTableShell
            embedded
            variant="stitchOperational"
            columns={[
              "Timestamp",
              "Product & variant",
              "SKU",
              "Warehouse",
              "Type",
              "Change",
              "Before",
              "After",
              "Actor",
              "Reference"
            ]}
            rows={rows}
            rowKeys={items.map((m) => m.id)}
            emptyState="No movements match filters."
          />
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-muted)]">
          <span>
            Page {meta.page} of {meta.totalPages}
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
