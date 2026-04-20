import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { ProductAdminNav } from "@/components/catalog/ProductAdminNav";
import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
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

type AttributeRow = { key: string; value: string };

const toAttributeRows = (value: unknown): AttributeRow[] => {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return [{ key: "", value: "" }];
  }
  const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
    key: k,
    value: typeof v === "string" ? v : String(v ?? "")
  }));
  return entries.length > 0 ? entries : [{ key: "", value: "" }];
};

const fromAttributeRows = (
  rows: AttributeRow[]
): { ok: true; value: Record<string, unknown> | undefined } | { ok: false; error: string } => {
  const normalized = rows.map((row) => ({
    key: row.key.trim(),
    value: row.value.trim()
  }));

  const filled = normalized.filter((row) => row.key !== "" || row.value !== "");
  if (filled.length === 0) {
    return { ok: true, value: undefined };
  }

  const out: Record<string, unknown> = {};
  for (const row of filled) {
    if (!row.key) {
      return { ok: false, error: "Attribute name is required when value is provided." };
    }
    if (Object.prototype.hasOwnProperty.call(out, row.key)) {
      return { ok: false, error: `Duplicate attribute name "${row.key}".` };
    }
    out[row.key] = row.value;
  }

  return { ok: true, value: out };
};

export const CatalogProductVariantsPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkPriceInput, setBulkPriceInput] = useState("");
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusInput, setBulkStatusInput] = useState<string>(variantStatuses[0]);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  const productQ = useAuthedQuery(
    ["admin-catalog-product", productId],
    (token) => getAdminCatalogProduct(token, productId!),
    { enabled: Boolean(productId) },
  );

  const q = useAuthedQuery(
    ["admin-catalog-product-variants", productId],
    (token) => getAdminCatalogProductVariants(token, productId!),
    { enabled: Boolean(productId) },
  );

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
    mutationFn: async (body: { sku: string; attributes?: Record<string, unknown>; status: string; priceCurrency?: string }) => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return createAdminCatalogProductVariant(accessToken, productId, {
        sku: body.sku,
        attributes: body.attributes,
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

  const applyBulkPrice = async () => {
    const cents = parseMoneyInputToCents(bulkPriceInput);
    if (cents == null) {
      setFormError("Invalid price. Enter a value like 19.99.");
      return;
    }
    const cur = defaultCurrency;
    setFormError(null);
    setBulkPriceOpen(false);
    setBulkPriceInput("");
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

  const applyBulkStatus = async () => {
    setFormError(null);
    setBulkStatusOpen(false);
    try {
      for (const v of selectedVariants) {
        await updateMut.mutateAsync({
          variantId: v.id,
          body: { status: bulkStatusInput }
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
              onClick={() => { setBulkPriceInput(""); setBulkPriceOpen(true); }}
            >
              Update price
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => { setBulkStatusInput(variantStatuses[0]); setBulkStatusOpen(true); }}
            >
              Update status
            </button>
            <button
              type="button"
              disabled={archiveMut.isPending}
              title="Archives selected SKUs (order history is preserved)."
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50"
              onClick={() => setArchiveConfirmOpen(true)}
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
          onSubmit={(payload) => {
            createMut.mutate({
              sku: payload.sku,
              attributes: payload.attributes,
              status: "ACTIVE",
              priceCurrency: defaultCurrency
            });
          }}
        />
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
      {/* Bulk price dialog */}
      {bulkPriceOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-sm rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-2xl">
            <h2 className="font-headline text-lg font-bold text-[#181b25]">
              Update price for {selected.size} variant(s)
            </h2>
            <p className="mt-1 text-sm text-[#60626c]">Enter the new list price in major units (e.g. 19.99).</p>
            <input
              type="text"
              inputMode="decimal"
              value={bulkPriceInput}
              onChange={(e) => setBulkPriceInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void applyBulkPrice(); }}
              placeholder="e.g. 19.99"
              autoFocus
              className="mt-4 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2.5 font-mono text-sm text-[#181b25] focus:border-[#1653cc] focus:outline-none focus:ring-2 focus:ring-[#1653cc]/20"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setBulkPriceOpen(false)}
                className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#434654] hover:bg-[#f8f9fb]">
                Cancel
              </button>
              <button type="button" onClick={() => void applyBulkPrice()} disabled={!bulkPriceInput.trim()}
                className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1653cc]/90 disabled:opacity-50">
                Apply price
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bulk status dialog */}
      {bulkStatusOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-sm rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-2xl">
            <h2 className="font-headline text-lg font-bold text-[#181b25]">
              Update status for {selected.size} variant(s)
            </h2>
            <select
              value={bulkStatusInput}
              onChange={(e) => setBulkStatusInput(e.target.value)}
              autoFocus
              className="mt-4 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2.5 text-sm text-[#181b25] focus:border-[#1653cc] focus:outline-none focus:ring-2 focus:ring-[#1653cc]/20"
            >
              {variantStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setBulkStatusOpen(false)}
                className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#434654] hover:bg-[#f8f9fb]">
                Cancel
              </button>
              <button type="button" onClick={() => void applyBulkStatus()}
                className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1653cc]/90">
                Apply status
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={archiveConfirmOpen}
        title={`Archive ${selected.size} variant(s)?`}
        body="The selected SKUs will be hidden from active merchandising but remain on past orders."
        confirmLabel="Archive selected"
        danger
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={() => {
          setArchiveConfirmOpen(false);
          archiveMut.mutate([...selected]);
        }}
      />
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
  onSubmit: (payload: { sku: string; attributes?: Record<string, unknown> }) => void;
  onCancel: () => void;
}) => {
  const [sku, setSku] = useState("");
  const [rows, setRows] = useState<AttributeRow[]>([{ key: "", value: "" }]);
  const [localError, setLocalError] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-800">New variant</div>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Creates an active variant with SKU. Add pricing from the expanded row after creation. Currency defaults to{" "}
        {defaultCurrency}.
      </p>
      {localError ? <p className="mt-2 text-xs font-medium text-red-700">{localError}</p> : null}
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
        <AttributeEditor rows={rows} onChange={setRows} />
        <button
          type="button"
          disabled={submitting || !sku.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => {
            const parsed = fromAttributeRows(rows);
            if (!parsed.ok) {
              setLocalError(parsed.error);
              return;
            }
            setLocalError(null);
            onSubmit({ sku: sku.trim(), attributes: parsed.value });
          }}
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
  const [rows, setRows] = useState<AttributeRow[]>(toAttributeRows(variant.attributes));
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const attributesParsed = fromAttributeRows(rows);
    if (!attributesParsed.ok) {
      setLocalError(attributesParsed.error);
      return;
    }
    const priceCents = parseMoneyInputToCents(price);
    const compareCents = parseMoneyInputToCents(compare);
    const costCents = parseMoneyInputToCents(cost);
    setLocalError(null);
    onSave({
      sku,
      attributes: attributesParsed.value,
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
        <div className="sm:col-span-2">
          <AttributeEditor rows={rows} onChange={setRows} />
        </div>
      </div>
      <div className="flex flex-col justify-end gap-2">
        {localError ? <p className="text-xs font-medium text-red-700">{localError}</p> : null}
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

const AttributeEditor = ({
  rows,
  onChange
}: {
  rows: AttributeRow[];
  onChange: (rows: AttributeRow[]) => void;
}) => {
  const setRow = (index: number, patch: Partial<AttributeRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [{ key: "", value: "" }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">Variant attributes (optional)</p>
        <button
          type="button"
          className="text-xs font-semibold text-[#4f7ef8] hover:underline"
          onClick={() => onChange([...rows, { key: "", value: "" }])}
        >
          + Add attribute
        </button>
      </div>
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        {rows.map((row, index) => (
          <div key={`attr-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={row.key}
              onChange={(e) => setRow(index, { key: e.target.value })}
              placeholder="Attribute (e.g. size)"
            />
            <input
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={row.value}
              onChange={(e) => setRow(index, { value: e.target.value })}
              placeholder="Value (e.g. L)"
            />
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              onClick={() => removeRow(index)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
