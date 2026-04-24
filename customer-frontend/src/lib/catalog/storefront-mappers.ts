import type { Product } from "@/lib/types/product";

/** Map storefront public product card (from `GET /api/products`) to UI product shape used across customer-frontend. */
export type UiStorefrontProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  category: string;
  brand?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  /** First purchasable variant for add-to-cart from PLP cards. */
  defaultVariantId?: string | null;
};

const centsToGhs = (cents: number) => Math.round((cents / 100) * 100) / 100;

type ApiMedia = { url?: string | null } | null | undefined;

type ApiReviewSummaryLike = {
  averageRating?: number | null;
  reviewCount?: number | null;
  totalReviews?: number | null;
} | null;

const mapReviewSummaryFields = (summary: ApiReviewSummaryLike | undefined) => {
  const avg = summary?.averageRating;
  const rawCount = summary?.reviewCount ?? summary?.totalReviews;
  return {
    rating: typeof avg === "number" && Number.isFinite(avg) ? avg : undefined,
    reviewCount:
      typeof rawCount === "number" && Number.isFinite(rawCount) ? Math.max(0, Math.trunc(rawCount)) : undefined
  };
};

type ApiPricing = {
  amountCents?: number | null;
  compareAtAmountCents?: number | null;
  minAmountCents?: number;
  maxAmountCents?: number;
  currency?: string | null;
} | null;

type ApiProductCard = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  brand?: { name?: string | null } | null;
  categories?: Array<{ name?: string | null }>;
  primaryMedia?: ApiMedia;
  pricing?: ApiPricing;
  defaultVariantId?: string | null;
  reviewSummary?: ApiReviewSummaryLike;
  availability?: { lowStock?: boolean };
};

export const mapStorefrontProductCard = (raw: unknown): UiStorefrontProduct | null => {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as ApiProductCard;
  if (typeof p.id !== "string" || typeof p.slug !== "string" || typeof p.title !== "string") return null;
  const pricing = p.pricing;
  const amountCents =
    typeof pricing?.amountCents === "number"
      ? pricing.amountCents
      : typeof pricing?.minAmountCents === "number"
        ? pricing.minAmountCents
        : null;
  if (amountCents == null) return null;
  const compare =
    typeof pricing?.compareAtAmountCents === "number" ? pricing.compareAtAmountCents : undefined;
  const category = p.categories?.[0]?.name?.trim() || "Catalog";
  const imageUrl = p.primaryMedia?.url?.trim() || "";
  const { rating: cardRating, reviewCount: cardReviewCount } = mapReviewSummaryFields(p.reviewSummary ?? undefined);
  return {
    id: p.id,
    slug: p.slug,
    name: p.title,
    price: centsToGhs(amountCents),
    originalPrice: compare != null && compare > amountCents ? centsToGhs(compare) : undefined,
    imageUrl,
    category,
    brand: p.brand?.name ?? undefined,
    description: p.description ?? undefined,
    rating: cardRating,
    reviewCount: cardReviewCount,
    badge: p.availability?.lowStock ? "Low stock" : undefined,
    defaultVariantId: typeof p.defaultVariantId === "string" ? p.defaultVariantId : null
  };
};

export const mapStorefrontProductCards = (items: unknown[]): UiStorefrontProduct[] =>
  items.map(mapStorefrontProductCard).filter((x): x is UiStorefrontProduct => Boolean(x));

/** Sum line quantities from cart evaluation `items` if present. */
const parseVariantAttributes = (attributes: unknown): Record<string, string> => {
  if (!attributes) return {};
  if (Array.isArray(attributes)) {
    const out: Record<string, string> = {};
    for (const row of attributes) {
      if (!row || typeof row !== "object") continue;
      const r = row as { name?: string; label?: string; value?: unknown };
      const k = String(r.name ?? r.label ?? "")
        .trim()
        .toLowerCase();
      const v = String(r.value ?? "").trim();
      if (k) out[k] = v;
    }
    return out;
  }
  if (typeof attributes === "object" && !Array.isArray(attributes)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(attributes as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k.toLowerCase()] = v.trim();
    }
    return out;
  }
  return {};
};

const variantLabelFromAttrs = (attrs: Record<string, string>, sku: string) => {
  const size = attrs.size ?? attrs["talla"];
  const color = attrs.color ?? attrs.colour;
  const parts = [color, size].filter(Boolean);
  if (parts.length > 0) return parts.join(" / ");
  return sku || "One size";
};

type ApiVariantDetail = {
  id: string;
  sku: string;
  attributes: unknown;
  status?: string;
  pricing?: { amountCents?: number | null; compareAtAmountCents?: number | null; currency?: string | null } | null;
  availability?: { inStock?: boolean; availableQuantity?: number };
  media?: Array<{ url?: string | null }>;
};

/** Map `GET /api/products/:slug` detail payload to `Product` for PDP + cards. */
export const mapPublicProductDetailToProduct = (raw: unknown): Product | null => {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const id = d.id;
  const slug = d.slug;
  const title = d.title;
  if (typeof id !== "string" || typeof slug !== "string" || typeof title !== "string") return null;

  const categories = d.categories as Array<{ name?: string | null }> | undefined;
  const category = categories?.[0]?.name?.trim() || "Catalog";

  const brandRec = d.brand as { name?: string | null } | null | undefined;
  const brand = brandRec?.name?.trim() || undefined;

  const media = (d.media as Array<{ url?: string | null }>) ?? [];
  const imageUrl = media.find((m) => m.url?.trim())?.url?.trim() ?? "";
  const images = media.map((m) => m.url).filter((u): u is string => Boolean(u?.trim()));

  const pricing = d.pricing as ApiPricing;
  const amountCents =
    typeof pricing?.amountCents === "number"
      ? pricing.amountCents
      : typeof pricing?.minAmountCents === "number"
        ? pricing.minAmountCents
        : null;
  if (amountCents == null) return null;
  const compare =
    typeof pricing?.compareAtAmountCents === "number" ? pricing.compareAtAmountCents : undefined;
  const price = centsToGhs(amountCents);
  const originalPrice = compare != null && compare > amountCents ? centsToGhs(compare) : undefined;

  const reviewSummary = d.reviewSummary as ApiReviewSummaryLike | undefined;
  const { rating: detailRating, reviewCount: detailReviewCount } = mapReviewSummaryFields(reviewSummary ?? undefined);

  const availability = d.availability as { lowStock?: boolean; message?: string } | undefined;
  const badge = availability?.lowStock ? "Low stock" : undefined;

  const variantsRaw = (d.variants as unknown[]) ?? [];
  const pdpVariants: NonNullable<Product["pdpVariants"]> = [];
  for (const row of variantsRaw) {
    if (!row || typeof row !== "object") continue;
    const v = row as ApiVariantDetail;
    if (typeof v.id !== "string" || typeof v.sku !== "string") continue;
    const attrs = parseVariantAttributes(v.attributes);
    const availableQuantity =
      typeof v.availability?.availableQuantity === "number"
        ? Math.max(0, Math.trunc(v.availability.availableQuantity))
        : 0;
    const inStock = v.availability?.inStock !== false && availableQuantity > 0;
    const variantAmountCents =
      typeof v.pricing?.amountCents === "number"
        ? v.pricing.amountCents
        : typeof pricing?.amountCents === "number"
          ? pricing.amountCents
          : null;
    pdpVariants.push({
      id: v.id,
      label: variantLabelFromAttrs(attrs, v.sku),
      inStock,
      stock: availableQuantity,
      price: typeof variantAmountCents === "number" ? centsToGhs(variantAmountCents) : undefined
    });
  }

  const defaultVariantId = pdpVariants.find((x) => x.inStock)?.id ?? pdpVariants[0]?.id ?? null;

  const uniqueLabels = Array.from(new Map(pdpVariants.map((pv) => [pv.label, pv])).values());
  const sizes = uniqueLabels.length > 1 ? uniqueLabels.map((x) => x.label) : undefined;
  const outOfStockSizes = uniqueLabels.filter((x) => !x.inStock).map((x) => x.label);

  return {
    id,
    slug,
    name: title,
    category,
    price,
    originalPrice,
    imageUrl,
    images: images.length > 0 ? images : undefined,
    badge,
    rating: detailRating,
    reviewCount: detailReviewCount,
    description: typeof d.description === "string" ? d.description : undefined,
    brand,
    sizes,
    outOfStockSizes: outOfStockSizes.length > 0 ? outOfStockSizes : undefined,
    defaultVariantId: defaultVariantId ?? null,
    pdpVariants: pdpVariants.length > 0 ? pdpVariants : undefined
  };
};

export const mapWishlistApiItemToProduct = (raw: unknown): Product | null => {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as {
    product?: {
      id?: string;
      slug?: string;
      title?: string;
      brand?: { name?: string | null } | null;
      pricing?: ApiPricing;
      primaryMedia?: ApiMedia;
    };
    variant?: { id?: string; sku?: string; attributes?: unknown } | null;
  };
  const p = row.product;
  if (!p || typeof p.id !== "string" || typeof p.slug !== "string" || typeof p.title !== "string") return null;
  const pricing = p.pricing;
  const amountCents =
    typeof pricing?.amountCents === "number"
      ? pricing.amountCents
      : typeof pricing?.minAmountCents === "number"
        ? pricing.minAmountCents
        : null;
  if (amountCents == null) return null;
  const compare =
    typeof pricing?.compareAtAmountCents === "number" ? pricing.compareAtAmountCents : undefined;
  const imageUrl = p.primaryMedia?.url?.trim() ?? "";
  const attrs = parseVariantAttributes(row.variant?.attributes);
  const defaultVariantId = typeof row.variant?.id === "string" ? row.variant.id : null;

  return {
    id: p.id,
    slug: p.slug,
    name: p.title,
    category: p.brand?.name?.trim() || "Wishlist",
    price: centsToGhs(amountCents),
    originalPrice: compare != null && compare > amountCents ? centsToGhs(compare) : undefined,
    imageUrl,
    brand: p.brand?.name ?? undefined,
    defaultVariantId,
    description: attrs.size || attrs.color ? `${Object.values(attrs).join(" · ")}` : undefined
  };
};

export const slugifyBrand = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "brand";

export const cartItemCountFromEvaluation = (evaluation: unknown): number => {
  if (!evaluation || typeof evaluation !== "object") return 0;
  const rec = evaluation as Record<string, unknown>;
  const items = rec.items;
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, row) => {
    if (!row || typeof row !== "object") return sum;
    const q = (row as { quantity?: unknown }).quantity;
    return sum + (typeof q === "number" && Number.isFinite(q) ? q : 0);
  }, 0);
};
