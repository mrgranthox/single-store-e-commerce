import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ProductAdminNav } from "@/components/catalog/ProductAdminNav";
import { PageHeader } from "@/components/primitives/PageHeader";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  archiveAdminCatalogProduct,
  getAdminCatalogProduct,
  getAdminCatalogProductActivity,
  type AdminCatalogProductDetailEntity,
  type AdminCatalogProductVariant,
  type AdminProductActivityItem
} from "@/features/catalog/api/admin-catalog.api";
import { formatMoney, formatProductListPrice } from "@/features/catalog/lib/format-money";

const formatCostRange = (
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined
) => {
  if (min == null || max == null || !currency) {
    return "—";
  }
  if (min === max) {
    return formatMoney(min, currency);
  }
  return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
};

const formatReorderRange = (min: number | null | undefined, max: number | null | undefined) => {
  if (min == null || max == null) {
    return "—";
  }
  if (min === max) {
    return `${min.toLocaleString()} units`;
  }
  return `${min.toLocaleString()} – ${max.toLocaleString()} units`;
};
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const statusTone = (status: string): StatusBadgeTone => {
  switch (status) {
    case "PUBLISHED":
      return "active";
    case "DRAFT":
      return "draft";
    case "ARCHIVED":
      return "danger";
    default:
      return "draft";
  }
};

const reviewStatusLabel = (status: string) => {
  switch (status) {
    case "PUBLISHED":
      return "Published";
    case "PENDING":
      return "Pending";
    case "HIDDEN":
      return "Hidden";
    case "REJECTED":
      return "Rejected";
    default:
      return status.replace(/_/g, " ");
  }
};

const variantLabel = (v: AdminCatalogProductVariant) => {
  if (v.attributes && typeof v.attributes === "object" && v.attributes !== null && !Array.isArray(v.attributes)) {
    const entries = Object.entries(v.attributes as Record<string, unknown>).filter(
      ([, val]) => val != null && String(val).length > 0
    );
    if (entries.length) {
      return entries.map(([k, val]) => `${k}: ${String(val)}`).join(" · ");
    }
  }
  return "Default";
};

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const humanizeEvent = (eventType: string) =>
  eventType
    .replace(/^PRODUCT_/i, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const activityActor = (row: AdminProductActivityItem) => {
  if (row.actorAdminUserId) {
    return "Admin";
  }
  if (row.actorType) {
    return row.actorType;
  }
  return "System";
};

const primaryThumb = (entity: AdminCatalogProductDetailEntity) => entity.media[0]?.url ?? null;

export const CatalogProductDetailPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-catalog-product", productId],
    queryFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return getAdminCatalogProduct(accessToken, productId);
    },
    enabled: Boolean(accessToken && productId)
  });

  const activityQuery = useQuery({
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
  const activity = activityQuery.data?.data.items ?? [];

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const archiveProduct = async () => {
    if (!accessToken || !productId || !entity) {
      return;
    }
    setActionError(null);
    if (!window.confirm("Archive this product? It will be hidden from storefront flows.")) {
      return;
    }
    try {
      await archiveAdminCatalogProduct(accessToken, productId, {});
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-product", productId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Could not archive.");
    }
  };

  if (!productId) {
    return <p className="text-sm text-slate-500">Missing product id.</p>;
  }

  const descriptionSnippet =
    entity?.description && entity.description.length > 220
      ? `${entity.description.slice(0, 220)}…`
      : entity?.description ?? "";

  return (
    <div className="space-y-6">
      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}
      <PageHeader
        title={entity?.title ?? "Product"}
        description="Overview of catalog content, variants, reviews, and operational signals."
        breadcrumbItems={
          entity
            ? [
                { label: "Catalog", to: "/admin/catalog/products" },
                { label: entity.title }
              ]
            : undefined
        }
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-catalog-product", productId])]}
      />
      <ProductAdminNav />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : entity ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Summary</h2>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                {primaryThumb(entity) ? (
                  <img
                    src={primaryThumb(entity)!}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                    No image
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900">{entity.title}</h3>
                    <StatusBadge label={entity.status.replace(/_/g, " ")} tone={statusTone(entity.status)} />
                  </div>
                  <p className="font-mono text-sm text-slate-600">
                    SKU: {entity.variants[0]?.sku ?? "—"}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-800">Categories: </span>
                    {entity.categories.length ? entity.categories.map((c) => c.name).join(", ") : "—"}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-800">Brand: </span>
                    {entity.brand?.name ?? "—"}
                  </p>
                  {descriptionSnippet ? (
                    <p className="text-sm leading-relaxed text-slate-700">{descriptionSnippet}</p>
                  ) : (
                    <p className="text-sm text-slate-400">No description yet.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Variants snapshot</h2>
                <Link
                  to={`/admin/catalog/products/${productId}/variants`}
                  className="text-sm font-semibold text-[#4f7ef8] hover:underline"
                >
                  + Add variant
                </Link>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">Variant</th>
                      <th className="py-2 pr-4">SKU</th>
                      <th className="py-2 pr-4">Price</th>
                      <th className="py-2 pr-4">Stock</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entity.variants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-slate-500">
                          No active variants. Add one to sell this product.
                        </td>
                      </tr>
                    ) : (
                      entity.variants.map((v) => (
                        <tr key={v.id}>
                          <td className="py-2 pr-4 text-slate-800">{variantLabel(v)}</td>
                          <td className="py-2 pr-4 font-mono text-xs text-slate-600">{v.sku}</td>
                          <td className="py-2 pr-4">
                            {v.pricing
                              ? formatMoney(v.pricing.amountCents, v.pricing.currency)
                              : "—"}
                          </td>
                          <td className="py-2 pr-4 font-mono text-slate-700">
                            {v.availability.availableQuantity.toLocaleString()}
                          </td>
                          <td className="py-2">
                            <StatusBadge
                              label={v.status.replace(/_/g, " ")}
                              tone={v.status === "ACTIVE" ? "active" : "draft"}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Reviews snapshot</h2>
              <div className="mt-3 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {entity.reviewSummary?.averageRating != null ? `★ ${entity.reviewSummary.averageRating}` : "—"}
                </span>
                <span className="text-sm text-slate-500">
                  {(entity.reviewSummary?.totalReviews ?? 0).toLocaleString()} reviews
                </span>
              </div>
              <ul className="mt-4 divide-y divide-slate-100">
                {(entity.recentReviews ?? []).length === 0 ? (
                  <li className="py-4 text-sm text-slate-500">No reviews yet.</li>
                ) : (
                  (entity.recentReviews ?? []).map((r) => (
                    <li key={r.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {r.authorName}{" "}
                          <span className="text-amber-600">★ {r.rating}</span>
                        </p>
                        {r.bodySnippet ? (
                          <p className="mt-1 text-sm text-slate-600">{r.bodySnippet}</p>
                        ) : null}
                      </div>
                      <StatusBadge label={reviewStatusLabel(r.status)} tone="draft" />
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800">Pricing summary</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Range</dt>
                  <dd className="font-medium text-slate-900">{formatProductListPrice(entity.pricing)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Compare-at</dt>
                  <dd className="text-slate-800">
                    {entity.pricing?.compareAtAmountCents != null
                      ? formatMoney(entity.pricing.compareAtAmountCents, entity.pricing.currency)
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Cost (variants)</dt>
                  <dd className="text-right text-slate-800">
                    {formatCostRange(
                      entity.costMarginSummary?.minCostCents,
                      entity.costMarginSummary?.maxCostCents,
                      entity.costMarginSummary?.currency ?? entity.pricing?.currency
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Margin</dt>
                  <dd className="text-slate-800">
                    {entity.costMarginSummary?.marginPercent != null
                      ? `${entity.costMarginSummary.marginPercent}% (primary priced variant)`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800">Inventory summary</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">On hand</dt>
                  <dd className="font-mono font-medium">{entity.inventorySummary.onHand.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Reserved</dt>
                  <dd className="font-mono font-medium">{entity.inventorySummary.reserved.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Available</dt>
                  <dd className="font-mono font-medium">{entity.inventorySummary.available.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Low-stock signal</dt>
                  <dd>{entity.inventorySummary.lowStock ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Reorder threshold (range)</dt>
                  <dd className="font-mono text-sm">
                    {formatReorderRange(
                      entity.reorderThresholdSummary?.minReorderLevel,
                      entity.reorderThresholdSummary?.maxReorderLevel
                    )}
                  </dd>
                </div>
                <p className="pt-2 text-[11px] text-slate-400">
                  Per-warehouse reorder levels roll up here. Adjust stock targets on the Inventory tab.
                </p>
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800">Quick actions</h3>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  to={`/admin/catalog/products/${productId}/edit`}
                  className="rounded-lg bg-[#4f7ef8] py-2.5 text-center text-sm font-semibold text-white hover:opacity-95"
                >
                  Edit product
                </Link>
                <Link
                  to={`/admin/catalog/products/${productId}/analytics`}
                  className="rounded-lg border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  View analytics
                </Link>
                <Link
                  to={`/admin/catalog/products/${productId}/media`}
                  className="rounded-lg border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Manage media
                </Link>
                <button
                  type="button"
                  onClick={archiveProduct}
                  disabled={entity.status === "ARCHIVED"}
                  className="rounded-lg border-2 border-red-200 py-2.5 text-center text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Archive
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800">Recent activity</h3>
              {activityQuery.isLoading ? (
                <p className="mt-2 text-sm text-slate-500">Loading activity…</p>
              ) : activity.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No timeline events recorded yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {activity.slice(0, 5).map((row) => (
                    <li key={row.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-slate-800">{humanizeEvent(row.eventType)}</p>
                      <p className="text-xs text-slate-500">
                        {activityActor(row)} · {formatWhen(row.occurredAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
