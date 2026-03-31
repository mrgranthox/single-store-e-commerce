import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { ProductAdminNav } from "@/components/catalog/ProductAdminNav";
import { PageHeader } from "@/components/primitives/PageHeader";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  bulkArchiveAdminCatalogProductVariants,
  createAdminCatalogProductVariant,
  getAdminCatalogProduct,
  getAdminCatalogProductVariants,
  updateAdminCatalogVariant,
  type AdminCatalogProductVariant
} from "@/features/catalog/api/admin-catalog.api";
import {
  centsToInputString,
  formatMoney,
  formatVariantOptions,
  parseMoneyInputToCents
} from "@/features/catalog/lib/catalogFormat";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const variantStatuses = ["ACTIVE", "ARCHIVED"] as const;

export const CatalogProductVariantsPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    queryKey: ["admin-catalog-product-variants", productId],
    queryFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return getAdminCatalogProductVariants(accessToken, productId);
    },
    enabled: Boolean(accessToken && productId)
  });

  const items = q.data?.data.items ?? [];
  const productTitle = productQ.data?.data.entity.title ?? "Product";

  const defaultCurrency =
    items.find((v) => v.pricing?.currency)?.pricing?.currency ??
    productQ.data?.data.entity.pricing?.currency ??
    "GHS";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product-variants", productId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product", productId] });
  };

  const updateMut = useMutation({
    mutationFn: async (input: { variantId: string; body: Parameters<typeof updateAdminCatalogVariant>[2] }) => {
      if (!accessToken) {
        throw new Error("Missing session.");
      }
      return updateAdminCatalogVariant(accessToken, input.variantId, input.body);
    },
    onSuccess: () => {
      invalidate();
      setExpandedId(null);
      setFormError(null);
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Update failed.");
    }
  });

  const archiveMut = useMutation({
    mutationFn: async (variantIds: string[]) => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return bulkArchiveAdminCatalogProductVariants(accessToken, productId, variantIds);
    },
    onSuccess: () => {
      invalidate();
      setSelected(new Set());
      setFormError(null);
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Archive failed.");
    }
  });

  const createMut = useMutation({
    mutationFn: async (body: { sku: string; status: string; priceCurrency?: string }) => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return createAdminCatalogProductVariant(accessToken, productId, {
        sku: body.sku,
        status: body.status,
        priceCurrency: body.priceCurrency
      });
    },
    onSuccess: () => {
      invalidate();
      setShowAdd(false);
      setFormError(null);
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Create failed.");
    }
  });

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((v) => v.id)));
    }
  };

  const selectedVariants = useMemo(
    () => items.filter((v) => selected.has(v.id)),
    [items, selected]
  );

  const runBulkPrice = async () => {
    const raw = window.prompt("New list price (major units, e.g. 19.99) for all selected variants?");
    if (raw == null) {
      return;
    }
    const cents = parseMoneyInputToCents(raw);
    if (cents == null) {
      setFormError("Invalid price.");
      return;
    }
    const cur = defaultCurrency;
    setFormError(null);
    try {
      for (const v of selectedVariants) {
        await updateMut.mutateAsync({
          variantId: v.id,
          body: {
            priceAmountCents: cents,
            priceCurrency: v.pricing?.currency ?? cur,
            compareAtPriceAmountCents: v.pricing?.compareAtAmountCents ?? null
          }
        });
      }
      setSelected(new Set());
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Bulk update failed.");
    }
  };

  const runBulkStatus = async () => {
    const next = window.prompt(`New status for selected variants (${variantStatuses.join(", ")}):`);
    if (next == null) {
      return;
    }
    const status = next.trim().toUpperCase();
    if (!variantStatuses.includes(status as (typeof variantStatuses)[number])) {
      setFormError("Invalid status.");
      return;
    }
    setFormError(null);
    try {
      for (const v of selectedVariants) {
        await updateMut.mutateAsync({
          variantId: v.id,
          body: { status }
        });
      }
      setSelected(new Set());
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Bulk update failed.");
    }
  };

  if (!productId) {
    return <p className="text-sm text-[var(--color-text-muted)]">Missing product id.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={productQ.isLoading ? "Loading…" : productTitle}
        description="SKUs, options, pricing signals, and stock posture per variant."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-catalog-product-variants", productId])]}
      />
      <ProductAdminNav />
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}
      {formError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-[#4f7ef8] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3d6fd6]"
            onClick={() => setShowAdd((s) => !s)}
          >
            {showAdd ? "Close" : "+ Add variant"}
          </button>
        </div>
        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-sm font-medium text-slate-700">{selected.size} selected</span>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={runBulkPrice}
            >
              Update price
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={runBulkStatus}
            >
              Update status
            </button>
            <button
              type="button"
              disabled={archiveMut.isPending}
              title="Archives selected SKUs (order history is preserved)."
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50"
              onClick={() => {
                if (
                  !window.confirm(
                    `Archive ${selected.size} variant(s)? They will be hidden from active merchandising but remain on past orders.`
                  )
                ) {
                  return;
                }
                archiveMut.mutate([...selected]);
              }}
            >
              Archive selected
            </button>
          </div>
        ) : null}
      </div>

      {showAdd ? (
        <AddVariantForm
          defaultCurrency={defaultCurrency}
          submitting={createMut.isPending}
          onCancel={() => setShowAdd(false)}
          onSubmit={(sku) => {
            createMut.mutate({ sku, status: "ACTIVE", priceCurrency: defaultCurrency });
          }}
        />
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selected.size === items.length}
                    onChange={selectAll}
                    aria-label="Select all variants"
                  />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Options</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Compare</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[var(--color-text-muted)]">
                    No variants for this product.
                  </td>
                </tr>
              ) : (
                items.map((v) => (
                  <VariantRowBlock
                    key={v.id}
                    variant={v}
                    expanded={expandedId === v.id}
                    selected={selected.has(v.id)}
                    onToggleSelect={() => toggleSelect(v.id)}
                    onToggleExpand={() => setExpandedId((id) => (id === v.id ? null : v.id))}
                    onSave={(body) => updateMut.mutate({ variantId: v.id, body })}
                    submitting={updateMut.isPending}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const AddVariantForm = ({
  defaultCurrency,
  submitting,
  onSubmit,
  onCancel
}: {
  defaultCurrency: string;
  submitting: boolean;
  onSubmit: (sku: string) => void;
  onCancel: () => void;
}) => {
  const [sku, setSku] = useState("");
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-800">New variant</div>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Creates an active variant with SKU. Add pricing from the expanded row after creation. Currency defaults to{" "}
        {defaultCurrency}.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          SKU
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="e.g. SKU-RED-L"
          />
        </label>
        <button
          type="button"
          disabled={submitting || !sku.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => onSubmit(sku.trim())}
        >
          Create variant
        </button>
        <button type="button" className="text-sm text-slate-600 hover:text-slate-900" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

const VariantRowBlock = ({
  variant,
  expanded,
  selected,
  onToggleSelect,
  onToggleExpand,
  onSave,
  submitting
}: {
  variant: AdminCatalogProductVariant;
  expanded: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onSave: (body: Parameters<typeof updateAdminCatalogVariant>[2]) => void;
  submitting: boolean;
}) => {
  const optionsLabel = formatVariantOptions(variant.attributes);
  const displayName =
    optionsLabel === "Default" ? "Default" : optionsLabel.split(" · ")[0] ?? optionsLabel;
  const price = variant.pricing?.amountCents;
  const compare = variant.pricing?.compareAtAmountCents;
  const cur = variant.pricing?.currency;

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/60">
        <td className="px-4 py-3 align-middle">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`Select ${variant.sku}`} />
        </td>
        <td className="px-4 py-3 font-medium text-slate-900">{displayName}</td>
        <td className="px-4 py-3 font-mono text-xs text-slate-800">{variant.sku}</td>
        <td className="max-w-[220px] px-4 py-3 text-slate-600">{optionsLabel}</td>
        <td className="px-4 py-3 tabular-nums text-slate-800">{formatMoney(price ?? null, cur ?? null)}</td>
        <td className="px-4 py-3 tabular-nums text-slate-600">{formatMoney(compare ?? null, cur ?? null)}</td>
        <td className="px-4 py-3">
          <span
            className={
              variant.availability.lowStock
                ? "rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                : variant.availability.inStock
                  ? "rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                  : "rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800"
            }
          >
            {variant.availability.inStock
              ? `${variant.availability.availableQuantity} available`
              : "Out of stock"}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700">
            {variant.status}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            className="text-sm font-semibold text-[#4f7ef8] hover:underline"
            onClick={onToggleExpand}
          >
            {expanded ? "Collapse" : "Edit"}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-slate-200 bg-slate-50/90">
          <td colSpan={9} className="px-4 py-4">
            <VariantInlineForm variant={variant} onSave={onSave} submitting={submitting} onCancel={onToggleExpand} />
          </td>
        </tr>
      ) : null}
    </>
  );
};

const VariantInlineForm = ({
  variant,
  onSave,
  submitting,
  onCancel
}: {
  variant: AdminCatalogProductVariant;
  onSave: (body: Parameters<typeof updateAdminCatalogVariant>[2]) => void;
  submitting: boolean;
  onCancel: () => void;
}) => {
  const [sku, setSku] = useState(variant.sku);
  const [price, setPrice] = useState(centsToInputString(variant.pricing?.amountCents ?? null));
  const [compare, setCompare] = useState(centsToInputString(variant.pricing?.compareAtAmountCents ?? null));
  const [cost, setCost] = useState(centsToInputString(variant.costAmountCents ?? null));
  const [currency, setCurrency] = useState(variant.pricing?.currency ?? "GHS");
  const [status, setStatus] = useState(variant.status);

  const submit = () => {
    const priceCents = parseMoneyInputToCents(price);
    const compareCents = parseMoneyInputToCents(compare);
    const costCents = parseMoneyInputToCents(cost);
    onSave({
      sku,
      priceAmountCents: priceCents,
      compareAtPriceAmountCents: compareCents,
      costAmountCents: costCents,
      priceCurrency: currency,
      status
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          SKU
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Status
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {variantStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          List price
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Compare-at
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums"
            value={compare}
            onChange={(e) => setCompare(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Cost
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Currency
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
          />
        </label>
      </div>
      <div className="flex flex-col justify-end gap-2">
        <p className="text-xs text-[var(--color-text-muted)]">
          Stock levels are managed per warehouse on the Inventory tab; this form updates catalog variant fields only.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={submitting}
            className="rounded-lg bg-[#4f7ef8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={submit}
          >
            Save variant
          </button>
          <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
