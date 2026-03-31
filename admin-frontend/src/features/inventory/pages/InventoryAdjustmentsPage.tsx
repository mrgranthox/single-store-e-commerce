import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Search } from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createInventoryAdjustment,
  listAdminWarehouses,
  listInventoryMovements
} from "@/features/inventory/api/admin-inventory.api";
import {
  getAdminCatalogProductInventorySummary,
  getAdminCatalogProductVariants,
  listAdminCatalogProducts,
  type AdminCatalogProductVariant
} from "@/features/catalog/api/admin-catalog.api";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { InventorySubNav } from "@/features/inventory/components/InventorySubNav";

const REASONS = [
  "Damage / write-off",
  "Restock received",
  "Error correction",
  "Cycle count / audit",
  "Transfer adjustment"
] as const;

type OpMode = "add" | "remove" | "set";

const variantLabel = (v: AdminCatalogProductVariant) => {
  const a = v.attributes;
  if (a && typeof a === "object" && !Array.isArray(a)) {
    const parts = Object.values(a as Record<string, unknown>)
      .filter((x) => x !== null && x !== undefined && String(x).trim() !== "")
      .slice(0, 4)
      .map((x) => String(x));
    if (parts.length) return parts.join(" / ");
  }
  return v.sku;
};

export const InventoryAdjustmentsPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [productQuery, setProductQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [opMode, setOpMode] = useState<OpMode>("add");
  const [qtyInput, setQtyInput] = useState("");
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(productQuery.trim()), 300);
    return () => window.clearTimeout(t);
  }, [productQuery]);

  const productsQuery = useQuery({
    queryKey: ["admin-adjust-products-search", debouncedQ],
    queryFn: async () => {
      if (!accessToken || debouncedQ.length < 2) return null;
      return listAdminCatalogProducts(accessToken, { q: debouncedQ, page_size: 8, page: 1 });
    },
    enabled: Boolean(accessToken && debouncedQ.length >= 2)
  });

  const variantsQuery = useQuery({
    queryKey: ["admin-adjust-variants", selectedProductId],
    queryFn: async () => {
      if (!accessToken || !selectedProductId) return null;
      return getAdminCatalogProductVariants(accessToken, selectedProductId);
    },
    enabled: Boolean(accessToken && selectedProductId)
  });

  const warehousesQuery = useQuery({
    queryKey: ["admin-warehouses"],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return listAdminWarehouses(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const invSummaryQuery = useQuery({
    queryKey: ["admin-adjust-inv-summary", selectedProductId],
    queryFn: async () => {
      if (!accessToken || !selectedProductId) return null;
      return getAdminCatalogProductInventorySummary(accessToken, selectedProductId);
    },
    enabled: Boolean(accessToken && selectedProductId)
  });

  const recentMovementsQuery = useQuery({
    queryKey: ["admin-adjust-movements", selectedProductId],
    queryFn: async () => {
      if (!accessToken || !selectedProductId) return null;
      return listInventoryMovements(accessToken, {
        productId: selectedProductId,
        page: 1,
        page_size: 10,
        sortOrder: "desc"
      });
    },
    enabled: Boolean(accessToken && selectedProductId)
  });

  const warehouses = warehousesQuery.data?.data.items ?? [];
  const variants = variantsQuery.data?.data.items ?? [];
  const productHits = productsQuery.data?.data.items ?? [];

  const currentOnHand = useMemo(() => {
    if (!selectedVariantId || !warehouseId || !invSummaryQuery.data?.data.entity.stockRows) return null;
    const row = invSummaryQuery.data.data.entity.stockRows.find(
      (r) => r.variantId === selectedVariantId && r.warehouse.id === warehouseId
    );
    return row?.onHand ?? null;
  }, [invSummaryQuery.data, selectedVariantId, warehouseId]);

  const qtyNum = Number(qtyInput);
  const deltaOnHand = useMemo(() => {
    if (!Number.isFinite(qtyNum) || qtyNum < 0) return null;
    if (currentOnHand === null) return null;
    if (opMode === "add") return qtyNum;
    if (opMode === "remove") return -qtyNum;
    return qtyNum - currentOnHand;
  }, [qtyNum, opMode, currentOnHand]);

  const projected = currentOnHand !== null && deltaOnHand !== null ? currentOnHand + deltaOnHand : null;

  const m = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      if (!selectedVariantId || !warehouseId || deltaOnHand === null || deltaOnHand === 0 || !reason.trim()) {
        throw new Error("Select product, variant, warehouse, valid quantity, and reason.");
      }
      let confirmationReason: string | undefined;
      if (Math.abs(deltaOnHand) > 100) {
        const typed = window.prompt(
          `This adjustment changes stock by ${deltaOnHand} units. Type CONFIRM to proceed.`
        );
        if (typed !== "CONFIRM") {
          throw new Error("Confirmation cancelled.");
        }
        confirmationReason = "Large adjustment confirmed by operator";
      }
      return createInventoryAdjustment(accessToken, {
        reason: reason.trim(),
        ...(notes.trim() ? { note: notes.trim() } : {}),
        ...(confirmationReason ? { confirmationReason } : {}),
        items: [{ variantId: selectedVariantId, warehouseId, deltaOnHand }]
      });
    },
    onSuccess: () => {
      setMessage("Adjustment applied. Movement history will reflect the change shortly.");
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory-stocks"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory-movements"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-adjust-inv-summary", selectedProductId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-adjust-movements", selectedProductId] });
    },
    onError: (e: unknown) => {
      setMessage(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed.");
    }
  });

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const recent = recentMovementsQuery.data?.data.items ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Adjust Stock"
        titleSize="screen"
        description="Inventory management — manual adjustment console. All changes are validated on the server."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-inventory-movements"])]}
      />

      <InventorySubNav />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-10">
        <div className="space-y-6 lg:col-span-6">
          <section className="rounded-xl bg-white p-8 shadow-card ring-1 ring-slate-200">
            <div className="space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#13161e] text-sm font-bold text-white">
                    1
                  </span>
                  <h2 className="font-headline text-lg font-bold text-[#181b25]">Select product</h2>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Search by SKU, product name…"
                    className="w-full rounded-lg border-0 bg-[#f2f3ff] py-3 pl-12 pr-4 text-sm outline-none ring-2 ring-transparent focus:ring-[#1653cc]/25"
                  />
                  {debouncedQ.length >= 2 && productHits.length > 0 && !selectedProductId ? (
                    <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                      {productHits.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setSelectedVariantId(null);
                            setWarehouseId(null);
                            setProductQuery(p.title);
                          }}
                        >
                          <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                            {p.thumbnailUrl ? (
                              <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">
                                —
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#181b25]">{p.title}</p>
                            <p className="text-xs text-slate-500">{p.primarySku ?? "SKU varies by variant"}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {selectedProductId ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm">
                    <span className="font-semibold text-emerald-900">Selected product</span>
                    <button
                      type="button"
                      className="ml-3 text-xs font-bold text-[#1653cc] hover:underline"
                      onClick={() => {
                        setSelectedProductId(null);
                        setSelectedVariantId(null);
                        setWarehouseId(null);
                        setProductQuery("");
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#13161e] text-sm font-bold text-white">
                    2
                  </span>
                  <h2 className="font-headline text-lg font-bold text-[#181b25]">Variant</h2>
                </div>
                <select
                  disabled={!variants.length}
                  value={selectedVariantId ?? ""}
                  onChange={(e) => setSelectedVariantId(e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm"
                >
                  <option value="">Choose a variant…</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {variantLabel(v)} — {v.sku}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#13161e] text-sm font-bold text-white">
                    3
                  </span>
                  <h2 className="font-headline text-lg font-bold text-[#181b25]">Warehouse</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {warehouses.map((w) => {
                    const row = invSummaryQuery.data?.data.entity.stockRows?.find(
                      (r) => r.variantId === selectedVariantId && r.warehouse.id === w.id
                    );
                    const whStock = row?.onHand ?? "—";
                    const active = warehouseId === w.id;
                    return (
                      <label
                        key={w.id}
                        className={`relative flex cursor-pointer flex-col rounded-xl border-2 p-4 transition-all ${
                          active ? "border-[#1653cc] bg-white shadow-sm" : "border-transparent bg-[#f2f3ff] hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name="wh"
                          checked={active}
                          onChange={() => setWarehouseId(w.id)}
                          disabled={!selectedVariantId}
                        />
                        <div className="mb-2 flex items-start justify-between">
                          <span className="text-sm font-bold text-[#181b25]">{w.name}</span>
                          {active ? <CheckCircle2 className="h-5 w-5 text-[#1653cc]" /> : null}
                        </div>
                        <div className="mt-auto flex items-end justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500">
                            Current on hand
                          </span>
                          <span className="font-mono text-xl font-bold text-[#181b25]">{whStock}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#13161e] text-sm font-bold text-white">
                    4
                  </span>
                  <h2 className="font-headline text-lg font-bold text-[#181b25]">Adjustment</h2>
                </div>
                <div className="grid grid-cols-1 gap-6 rounded-xl bg-[#f2f3ff] p-6 md:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Operation
                    </label>
                    <select
                      value={opMode}
                      onChange={(e) => setOpMode(e.target.value as OpMode)}
                      className="w-full rounded-lg border border-slate-200 py-2 text-sm"
                    >
                      <option value="add">Add (+)</option>
                      <option value="remove">Remove (−)</option>
                      <option value="set">Set absolute (=)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={qtyInput}
                      onChange={(e) => setQtyInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 py-2 font-mono text-sm"
                    />
                  </div>
                  <div className="flex flex-col justify-center rounded-lg border border-dashed border-slate-300 bg-white p-4 md:col-span-2">
                    <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Projected on hand
                    </p>
                    <p className="text-center font-mono text-2xl font-bold text-[#1653cc]">
                      {projected !== null && Number.isFinite(projected) ? projected : "—"}
                    </p>
                    <p className="mt-1 text-center text-xs text-slate-500">
                      Current: {currentOnHand ?? "—"} · Delta: {deltaOnHand ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#13161e] text-sm font-bold text-white">
                    5
                  </span>
                  <h2 className="font-headline text-lg font-bold text-[#181b25]">Justification</h2>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Reason
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-lg border-0 bg-[#f2f3ff] py-3 text-sm outline-none ring-2 ring-transparent focus:ring-[#1653cc]/20"
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Operational notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Optional context for the operations team…"
                    className="w-full rounded-lg border-0 bg-[#f2f3ff] p-4 text-sm outline-none ring-2 ring-transparent focus:ring-[#1653cc]/20"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-4 border-t border-slate-200 pt-6">
                <Link
                  to="/admin/inventory/movements"
                  className="px-6 py-3 text-sm font-semibold text-slate-500 hover:text-[#181b25]"
                >
                  View movement history
                </Link>
                <button
                  type="button"
                  disabled={
                    m.isPending ||
                    !selectedVariantId ||
                    !warehouseId ||
                    deltaOnHand === null ||
                    deltaOnHand === 0 ||
                    projected === null ||
                    projected < 0
                  }
                  onClick={() => setConfirmOpen(true)}
                  className="rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-10 py-3 text-sm font-bold text-white shadow-lg hover:opacity-95 disabled:opacity-40"
                >
                  Apply adjustment
                </button>
              </div>

              {confirmOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                  <div className="max-w-md rounded-xl bg-white p-6 shadow-2xl">
                    <h3 className="font-headline text-lg font-bold">Confirm adjustment</h3>
                    <ul className="mt-4 space-y-2 text-sm text-slate-600">
                      <li>
                        <span className="text-slate-400">Variant:</span> {selectedVariant?.sku}
                      </li>
                      <li>
                        <span className="text-slate-400">Warehouse:</span>{" "}
                        {warehouses.find((w) => w.id === warehouseId)?.name}
                      </li>
                      <li>
                        <span className="text-slate-400">Current → New:</span> {currentOnHand} → {projected}
                      </li>
                      <li>
                        <span className="text-slate-400">Reason:</span> {reason}
                      </li>
                    </ul>
                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                        onClick={() => setConfirmOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-bold text-white hover:opacity-95"
                        onClick={() => {
                          setMessage(null);
                          setConfirmOpen(false);
                          m.mutate();
                        }}
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {message ? (
                <p className="text-sm text-slate-700" role="status">
                  {message}
                </p>
              ) : null}

              {m.isSuccess && m.data ? (
                <TechnicalJsonDisclosure label="Full adjustment record" data={m.data} defaultOpen={false} />
              ) : null}
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <section className="relative overflow-hidden rounded-xl bg-[#13161e] p-6 text-white shadow-2xl">
            <div className="relative z-10">
              <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-slate-400">
                Recent movements
                {selectedVariant ? `: ${selectedVariant.sku}` : ""}
              </h3>
              {!selectedProductId ? (
                <p className="text-sm text-slate-400">Select a product to load recent movements.</p>
              ) : recentMovementsQuery.isLoading ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : recent.length === 0 ? (
                <p className="text-sm text-slate-400">No movements for this product yet.</p>
              ) : (
                <div className="space-y-3">
                  {recent.map((mv) => {
                    const pos = mv.deltaOnHand > 0;
                    return (
                      <div
                        key={mv.id}
                        className={`flex items-center justify-between rounded-lg border-l-2 bg-white/5 p-3 ${
                          pos ? "border-emerald-400" : "border-red-400"
                        }`}
                      >
                        <div>
                          <span className="font-mono text-xs font-bold">
                            {pos ? "+" : ""}
                            {mv.deltaOnHand}
                          </span>
                          <span className="ml-1 text-[10px] uppercase text-slate-500">
                            {mv.movementType.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="text-right text-xs text-slate-300">
                          {formatWhen(mv.createdAt)}
                          <span className="mt-1 block text-[10px] text-slate-500">{mv.warehouse.code}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link
                to="/admin/inventory/movements"
                className="mt-6 inline-block text-xs font-semibold text-[#7eb0ff] hover:underline"
              >
                Open full history →
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}
