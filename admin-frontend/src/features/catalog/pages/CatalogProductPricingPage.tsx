import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { ProductAdminNav } from "@/components/catalog/ProductAdminNav";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  applyAdminCatalogProductScheduledPricing,
  getAdminCatalogProduct,
  getAdminCatalogProductActivity,
  getAdminCatalogProductPricing,
  updateAdminCatalogProduct,
  updateAdminCatalogProductPricing
} from "@/features/catalog/api/admin-catalog.api";
import {
  centsToInputString,
  formatMoney,
  parseMoneyInputToCents
} from "@/features/catalog/lib/catalogFormat";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

export const CatalogProductPricingPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [compare, setCompare] = useState("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState("GHS");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmReason, setConfirmReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [merchFeatured, setMerchFeatured] = useState(false);
  const [merchHome, setMerchHome] = useState(false);
  const [merchBoost, setMerchBoost] = useState(0);
  const [schedVariantId, setSchedVariantId] = useState("");
  const [schedAmount, setSchedAmount] = useState("");
  const [schedCurrency, setSchedCurrency] = useState("GHS");
  const [schedEffective, setSchedEffective] = useState("");
  const [schedNote, setSchedNote] = useState("");

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
    queryKey: ["admin-catalog-product-pricing", productId],
    queryFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return getAdminCatalogProductPricing(accessToken, productId);
    },
    enabled: Boolean(accessToken && productId)
  });

  const activityQ = useQuery({
    queryKey: ["admin-catalog-product-activity", productId],
    queryFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return getAdminCatalogProductActivity(accessToken, productId);
    },
    enabled: Boolean(accessToken && productId)
  });

  const entity = q.data?.data.entity;
  const variants = entity?.variants ?? [];
  const product = productQ.data?.data.entity;
  const productTitle = product?.title ?? "Product";

  const activeVariantId = variantId ?? variants[0]?.id ?? null;
  const activeVariant = variants.find((v) => v.id === activeVariantId);

  const syncFormFromVariant = (id: string | null) => {
    const v = variants.find((x) => x.id === id);
    if (!v) {
      return;
    }
    setPrice(centsToInputString(v.pricing?.amountCents ?? null));
    setCompare(centsToInputString(v.pricing?.compareAtAmountCents ?? null));
    setCost(centsToInputString(v.costAmountCents ?? null));
    setCurrency(v.pricing?.currency ?? "GHS");
  };

  useEffect(() => {
    if (variants.length === 0 || variantId != null) {
      return;
    }
    const first = variants[0]!.id;
    setVariantId(first);
    const v = variants.find((x) => x.id === first);
    if (v) {
      setPrice(centsToInputString(v.pricing?.amountCents ?? null));
      setCompare(centsToInputString(v.pricing?.compareAtAmountCents ?? null));
      setCost(centsToInputString(v.costAmountCents ?? null));
      setCurrency(v.pricing?.currency ?? "GHS");
    }
  }, [variants, variantId]);

  const priceCents = parseMoneyInputToCents(price);
  const compareCents = parseMoneyInputToCents(compare);
  const costCents = parseMoneyInputToCents(cost);
  const compareBelowBase =
    priceCents != null && compareCents != null && compareCents > 0 && compareCents < priceCents;

  const marginPercent =
    priceCents != null && costCents != null && priceCents > 0
      ? (((priceCents - costCents) / priceCents) * 100).toFixed(1)
      : null;

  useEffect(() => {
    if (!product) {
      return;
    }
    setMerchFeatured(product.merchandising?.featured ?? false);
    setMerchHome(product.merchandising?.homeHighlight ?? false);
    setMerchBoost(product.merchandising?.searchBoost ?? 0);
    const sp = product.scheduledPricing;
    setSchedVariantId(sp?.variantId ?? "");
    setSchedAmount(centsToInputString(sp?.listPriceAmountCents ?? null));
    setSchedCurrency(sp?.listPriceCurrency ?? "GHS");
    setSchedEffective(
      sp?.effectiveAt ? new Date(sp.effectiveAt).toISOString().slice(0, 16) : ""
    );
    setSchedNote(sp?.note ?? "");
  }, [product]);

  type VariantSnap = {
    variantId: string;
    sku?: string;
    priceAmountCents: number | null;
    compareAtPriceAmountCents?: number | null;
    priceCurrency?: string | null;
  };

  const priceHistoryRows = useMemo(() => {
    const items = activityQ.data?.data.items ?? [];
    const rows: Array<{
      key: string;
      at: string;
      sku: string;
      oldList: string;
      newList: string;
      cur: string;
      actor: string;
    }> = [];

    for (const ev of items.filter((e) => e.eventType === "PRODUCT_PRICING_UPDATED")) {
      const payload = ev.payload as
        | {
            before?: { variants?: VariantSnap[] };
            after?: { variants?: VariantSnap[] };
          }
        | null
        | undefined;
      const afterList = payload?.after?.variants ?? [];
      const beforeList = payload?.before?.variants ?? [];
      const beforeById = new Map(beforeList.map((v) => [v.variantId, v]));

      for (const aft of afterList) {
        const bef = beforeById.get(aft.variantId);
        const cur = aft.priceCurrency ?? bef?.priceCurrency ?? "GHS";
        rows.push({
          key: `${ev.id}-${aft.variantId}`,
          at: new Date(ev.occurredAt).toLocaleString(),
          sku: aft.sku ?? bef?.sku ?? aft.variantId.slice(0, 8),
          oldList: formatMoney(bef?.priceAmountCents ?? null, cur),
          newList: formatMoney(aft.priceAmountCents ?? null, cur),
          cur,
          actor: ev.actorAdminUserId ? "Admin" : "System"
        });
      }
    }

    return rows.slice(0, 24);
  }, [activityQ.data?.data.items]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product-pricing", productId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product", productId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product-activity", productId] });
  };

  const merchMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return updateAdminCatalogProduct(accessToken, productId, {
        merchandisingFeatured: merchFeatured,
        merchandisingHomeHighlight: merchHome,
        merchandisingSearchBoost: merchBoost
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product", productId] });
      setFormError(null);
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed.");
    }
  });

  const scheduleSaveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      const vId = schedVariantId.trim();
      const cents = parseMoneyInputToCents(schedAmount);
      if (!vId) {
        return updateAdminCatalogProduct(accessToken, productId, {
          scheduledListPriceVariantId: null,
          scheduledListPriceAmountCents: null,
          scheduledListPriceCurrency: null,
          scheduledPriceEffectiveAt: null,
          scheduledPriceNote: null
        });
      }
      if (cents == null) {
        throw new Error("Enter a new list price for the scheduled SKU.");
      }
      if (!schedEffective.trim()) {
        throw new Error("Pick an effective date and time for the scheduled price.");
      }
      const cur = schedCurrency.trim().toUpperCase();
      if (!cur || cur.length !== 3) {
        throw new Error("Enter a 3-letter currency code.");
      }
      return updateAdminCatalogProduct(accessToken, productId, {
        scheduledListPriceVariantId: vId,
        scheduledListPriceAmountCents: cents,
        scheduledListPriceCurrency: cur,
        scheduledPriceEffectiveAt: new Date(schedEffective).toISOString(),
        scheduledPriceNote: schedNote.trim() || null
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product", productId] });
      setFormError(null);
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed.");
    }
  });

  const applySchedMut = useMutation({
    mutationFn: async (force: boolean) => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return applyAdminCatalogProductScheduledPricing(accessToken, productId, { force });
    },
    onSuccess: () => {
      invalidate();
      setFormError(null);
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Apply failed.");
    }
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !productId || !activeVariantId) {
        throw new Error("Missing context.");
      }
      const p = parseMoneyInputToCents(price);
      const cmp = parseMoneyInputToCents(compare);
      const cst = parseMoneyInputToCents(cost);
      return updateAdminCatalogProductPricing(accessToken, productId, {
        variants: [
          {
            variantId: activeVariantId,
            priceAmountCents: p,
            compareAtPriceAmountCents: cmp,
            costAmountCents: cst,
            priceCurrency: currency
          }
        ]
      });
    },
    onSuccess: () => {
      invalidate();
      setConfirmOpen(false);
      setConfirmReason("");
      setFormError(null);
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed.");
    }
  });

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const visibilityLabel =
    product?.status === "PUBLISHED" ? "Published" : product?.status === "ARCHIVED" ? "Hidden" : "Private";

  if (!productId) {
    return <p className="text-sm text-[var(--color-text-muted)]">Missing product id.</p>;
  }

  const rangeLabel =
    entity?.pricing != null
      ? `${formatMoney(entity.pricing.minAmountCents, entity.pricing.currency)} – ${formatMoney(entity.pricing.maxAmountCents, entity.pricing.currency)}`
      : "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title={productQ.isLoading ? "Loading…" : productTitle}
        description="List prices, costs, and recorded pricing changes."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-catalog-product-pricing", productId])]}
      />
      <ProductAdminNav />
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}
      {formError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</div>
      ) : null}

      {compareBelowBase ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Compare-at price is below the base price. Customers may see inconsistent merchandising; adjust before
          saving.
        </div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : entity && variants.length === 0 ? (
        <SurfaceCard title="Pricing" description="Add at least one variant before setting prices.">
          <p className="text-sm text-[var(--color-text-muted)]">
            This product has no SKUs yet. Create a variant from the Variants tab, then return here to set list and
            compare-at prices.
          </p>
        </SurfaceCard>
      ) : entity && activeVariant ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-4">
            <SurfaceCard
              title="Current pricing"
              description={`Catalog band across variants: ${rangeLabel}. Edit one SKU below.`}
            >
              <label className="block text-xs font-medium text-slate-600">
                Variant
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={activeVariantId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setVariantId(id);
                    syncFormFromVariant(id);
                  }}
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku} ({v.status})
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Base price
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Compare-at
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
                    value={compare}
                    onChange={(e) => setCompare(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Cost per item
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Currency
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                  />
                </label>
              </div>
              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-medium">Margin (est.):</span>{" "}
                {marginPercent != null ? `${marginPercent}%` : "—"}
                <span className="ml-2 text-xs text-[var(--color-text-muted)]">Based on base price and cost.</span>
              </div>
              <button
                type="button"
                className="mt-4 rounded-lg bg-[#4f7ef8] px-4 py-2 text-sm font-semibold text-white shadow-sm"
                onClick={() => setConfirmOpen(true)}
              >
                Save pricing
              </button>
            </SurfaceCard>

            <SurfaceCard title="Price history" description="Per-SKU list price changes from the audit timeline.">
              {activityQ.isLoading ? (
                <p className="text-sm text-[var(--color-text-muted)]">Loading history…</p>
              ) : priceHistoryRows.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No pricing changes recorded yet. Updates appear here after you save new prices.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">SKU</th>
                        <th className="py-2 pr-3">Old list</th>
                        <th className="py-2 pr-3">New list</th>
                        <th className="py-2">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceHistoryRows.map((row) => (
                        <tr key={row.key} className="border-b border-slate-100">
                          <td className="py-2 pr-3 text-slate-700">{row.at}</td>
                          <td className="py-2 pr-3 font-mono text-xs text-slate-800">{row.sku}</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-600">{row.oldList}</td>
                          <td className="py-2 pr-3 tabular-nums font-medium text-slate-900">{row.newList}</td>
                          <td className="py-2 text-slate-600">{row.actor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SurfaceCard>
          </div>

          <div className="space-y-4">
            <SurfaceCard
              title="Merchandising"
              description="Visibility still follows product status; these toggles persist on the product for future storefront rules."
            >
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <span className="font-medium text-slate-800">Visibility</span>
                  <span className="text-slate-600">{visibilityLabel}</span>
                </div>
                <label className="flex items-center justify-between gap-3">
                  <span>Featured product</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={merchFeatured}
                    onChange={(e) => setMerchFeatured(e.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>Homepage highlight</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={merchHome}
                    onChange={(e) => setMerchHome(e.target.checked)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>Search rank boost (0–100)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="rounded-lg border border-slate-200 px-3 py-2"
                    value={merchBoost}
                    onChange={(e) => setMerchBoost(Number(e.target.value))}
                  />
                </label>
                <button
                  type="button"
                  disabled={merchMut.isPending}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => merchMut.mutate()}
                >
                  {merchMut.isPending ? "Saving…" : "Save merchandising"}
                </button>
              </div>
            </SurfaceCard>

            <SurfaceCard
              title="Schedule list price"
              description="Stores the next list price for one SKU. Apply when the effective time passes, or force-apply for corrections."
            >
              <div className="space-y-3 text-sm">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Variant
                  <select
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={schedVariantId}
                    onChange={(e) => setSchedVariantId(e.target.value)}
                  >
                    <option value="">Select SKU…</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.sku}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  New list price (major units)
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
                    value={schedAmount}
                    onChange={(e) => setSchedAmount(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Currency
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
                    value={schedCurrency}
                    onChange={(e) => setSchedCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Effective from (local)
                  <input
                    type="datetime-local"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={schedEffective}
                    onChange={(e) => setSchedEffective(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Note
                  <textarea
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    rows={2}
                    value={schedNote}
                    onChange={(e) => setSchedNote(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={scheduleSaveMut.isPending}
                    className="rounded-lg bg-[#4f7ef8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    onClick={() => scheduleSaveMut.mutate()}
                  >
                    {scheduleSaveMut.isPending ? "Saving…" : "Save schedule"}
                  </button>
                  <button
                    type="button"
                    disabled={applySchedMut.isPending}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
                    onClick={() => applySchedMut.mutate(false)}
                  >
                    Apply if due
                  </button>
                  <button
                    type="button"
                    disabled={applySchedMut.isPending}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50"
                    onClick={() => {
                      if (window.confirm("Apply scheduled price now even before the effective time?")) {
                        applySchedMut.mutate(true);
                      }
                    }}
                  >
                    Force apply
                  </button>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Applying updates the variant list price and clears this schedule. A worker can automate “if due”
                  checks later. To remove a pending schedule, choose “Select SKU…” and click Save schedule.
                </p>
              </div>
            </SurfaceCard>
          </div>
        </div>
      ) : null}

      {confirmOpen && activeVariant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Confirm price change</h2>
            <p className="mt-2 text-sm text-slate-600">
              Current list price:{" "}
              <strong>{formatMoney(activeVariant.pricing?.amountCents ?? null, currency)}</strong>
              <br />
              New list price: <strong>{formatMoney(priceCents, currency)}</strong>
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600">
              Optional reason (for your records)
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                value={confirmReason}
                onChange={(e) => setConfirmReason(e.target.value)}
                placeholder="e.g. Seasonal markdown"
              />
            </label>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              The API does not persist this reason yet; keep internal notes if required for policy.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmReason("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveMut.isPending}
                className="rounded-lg bg-[#4f7ef8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => saveMut.mutate()}
              >
                {saveMut.isPending ? "Saving…" : "Apply change"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
