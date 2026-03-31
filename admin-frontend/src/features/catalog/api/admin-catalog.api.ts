import { apiRequest, ApiError } from "@/lib/api/http";

export type AdminProductListItem = {
  id: string;
  slug: string;
  title: string;
  status: string;
  updatedAt: string;
  thumbnailUrl: string | null;
  primarySku: string | null;
  categoryLabels: string[];
  brand: { id: string; name: string } | null;
  pricing: {
    currency: string;
    amountCents: number | null;
    compareAtAmountCents: number | null;
    minAmountCents: number;
    maxAmountCents: number;
  } | null;
  visibility: string;
  inventorySummary: {
    onHand: number;
    reserved: number;
    available: number;
    lowStock: boolean;
  };
};

export type AdminProductsListResponse = {
  success: true;
  data: {
    items: AdminProductListItem[];
  };
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ListAdminProductsQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: string;
  categoryId?: string;
  brandId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "updatedAt" | "createdAt" | "title" | "status";
  sortOrder?: "asc" | "desc";
};

const buildQuery = (query: ListAdminProductsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 25));
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.categoryId?.trim()) {
    params.set("categoryId", query.categoryId.trim());
  }
  if (query.brandId?.trim()) {
    params.set("brandId", query.brandId.trim());
  }
  if (query.dateFrom?.trim()) {
    params.set("dateFrom", query.dateFrom.trim());
  }
  if (query.dateTo?.trim()) {
    params.set("dateTo", query.dateTo.trim());
  }
  if (query.sortBy) {
    params.set("sortBy", query.sortBy);
  }
  if (query.sortOrder) {
    params.set("sortOrder", query.sortOrder);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const listAdminCatalogProducts = async (
  accessToken: string,
  query: ListAdminProductsQuery = {}
): Promise<AdminProductsListResponse> =>
  apiRequest<AdminProductsListResponse>({
    path: `/api/admin/catalog/products${buildQuery(query)}`,
    accessToken
  });

export type AdminCategoryRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  productCount: number;
  updatedAt: string;
};

export type AdminCategoriesListResponse = {
  success: true;
  data: { items: AdminCategoryRow[] };
};

export type TaxonomyListQuery = {
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
};

const taxonomyListQuery = (query?: TaxonomyListQuery) => {
  if (!query?.status) {
    return "";
  }
  return `?${new URLSearchParams({ status: query.status }).toString()}`;
};

export const listAdminCatalogCategories = async (
  accessToken: string,
  query?: TaxonomyListQuery
): Promise<AdminCategoriesListResponse> =>
  apiRequest<AdminCategoriesListResponse>({
    path: `/api/admin/catalog/categories${taxonomyListQuery(query)}`,
    accessToken
  });

export type AdminCategoryDetailResponse = {
  success: true;
  data: { entity: AdminCategoryRow };
};

export const getAdminCatalogCategory = async (
  accessToken: string,
  categoryId: string
): Promise<AdminCategoryDetailResponse> =>
  apiRequest<AdminCategoryDetailResponse>({
    path: `/api/admin/catalog/categories/${encodeURIComponent(categoryId)}`,
    accessToken
  });

export const createAdminCatalogCategory = async (
  accessToken: string,
  body: { slug: string; name: string; status?: "DRAFT" | "ACTIVE" }
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: "/api/admin/catalog/categories",
    accessToken,
    body
  });

export const updateAdminCatalogCategory = async (
  accessToken: string,
  categoryId: string,
  body: { slug?: string; name?: string }
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "PATCH",
    path: `/api/admin/catalog/categories/${encodeURIComponent(categoryId)}`,
    accessToken,
    body
  });

export const archiveAdminCatalogCategory = async (
  accessToken: string,
  categoryId: string,
  body: { reason?: string; note?: string } = {}
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/categories/${encodeURIComponent(categoryId)}/archive`,
    accessToken,
    body
  });

export const publishAdminCatalogCategory = async (
  accessToken: string,
  categoryId: string,
  body: { reason?: string; note?: string } = {}
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/categories/${encodeURIComponent(categoryId)}/publish`,
    accessToken,
    body
  });

export const unpublishAdminCatalogCategory = async (
  accessToken: string,
  categoryId: string,
  body: { reason?: string; note?: string } = {}
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/categories/${encodeURIComponent(categoryId)}/unpublish`,
    accessToken,
    body
  });

export const restoreAdminCatalogCategory = async (
  accessToken: string,
  categoryId: string,
  body: { reason?: string; note?: string } = {}
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/categories/${encodeURIComponent(categoryId)}/restore`,
    accessToken,
    body
  });

export type AdminBrandBannerRef = {
  id: string;
  title: string | null;
  mediaUrl: string | null;
  placement: string;
  status: string;
  linkUrl?: string | null;
};

export type AdminBrandRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  productCount: number;
  updatedAt: string;
  bannerId?: string | null;
  logoUrl?: string | null;
  galleryImageUrls?: string[];
  linkedBanner?: AdminBrandBannerRef | null;
};

export type AdminBrandsListResponse = {
  success: true;
  data: { items: AdminBrandRow[] };
};

export const listAdminCatalogBrands = async (
  accessToken: string,
  query?: TaxonomyListQuery
): Promise<AdminBrandsListResponse> =>
  apiRequest<AdminBrandsListResponse>({
    path: `/api/admin/catalog/brands${taxonomyListQuery(query)}`,
    accessToken
  });

export type AdminBrandDetailResponse = {
  success: true;
  data: { entity: AdminBrandRow };
};

export const getAdminCatalogBrand = async (
  accessToken: string,
  brandId: string
): Promise<AdminBrandDetailResponse> =>
  apiRequest<AdminBrandDetailResponse>({
    path: `/api/admin/catalog/brands/${encodeURIComponent(brandId)}`,
    accessToken
  });

export const createAdminCatalogBrand = async (
  accessToken: string,
  body: {
    slug: string;
    name: string;
    status?: "DRAFT" | "ACTIVE";
    bannerId?: string;
    logoUrl?: string;
    galleryImageUrls?: string[];
  }
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: "/api/admin/catalog/brands",
    accessToken,
    body
  });

export const updateAdminCatalogBrand = async (
  accessToken: string,
  brandId: string,
  body: {
    slug?: string;
    name?: string;
    bannerId?: string | null;
    logoUrl?: string | null;
    galleryImageUrls?: string[] | null;
  }
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "PATCH",
    path: `/api/admin/catalog/brands/${encodeURIComponent(brandId)}`,
    accessToken,
    body
  });

export const archiveAdminCatalogBrand = async (
  accessToken: string,
  brandId: string,
  body: { reason?: string; note?: string } = {}
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/brands/${encodeURIComponent(brandId)}/archive`,
    accessToken,
    body
  });

export const publishAdminCatalogBrand = async (
  accessToken: string,
  brandId: string,
  body: { reason?: string; note?: string } = {}
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/brands/${encodeURIComponent(brandId)}/publish`,
    accessToken,
    body
  });

export const unpublishAdminCatalogBrand = async (
  accessToken: string,
  brandId: string,
  body: { reason?: string; note?: string } = {}
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/brands/${encodeURIComponent(brandId)}/unpublish`,
    accessToken,
    body
  });

export const restoreAdminCatalogBrand = async (
  accessToken: string,
  brandId: string,
  body: { reason?: string; note?: string } = {}
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/brands/${encodeURIComponent(brandId)}/restore`,
    accessToken,
    body
  });

/** Matches GET /api/admin/catalog/reviews item shape (reviews.service serializeReview). */
export type AdminReviewListItem = {
  id: string;
  rating: number;
  body: string | null;
  status: string;
  moderationNote: string | null;
  createdAt: string;
  updatedAt: string;
  product: { id: string; slug: string; title: string } | null;
  variant: { id: string; sku: string } | null;
  author: { id: string; email: string; name: string | null };
};

export type AdminCatalogReviewsListResponse = {
  success: true;
  data: { items: AdminReviewListItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export type ListCatalogReviewsQuery = {
  page?: number;
  page_size?: number;
  status?: string;
  q?: string;
};

const reviewsQuery = (query: ListCatalogReviewsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  return `?${params.toString()}`;
};

export const listAdminCatalogReviews = async (
  accessToken: string,
  query: ListCatalogReviewsQuery = {}
): Promise<AdminCatalogReviewsListResponse> =>
  apiRequest<AdminCatalogReviewsListResponse>({
    path: `/api/admin/catalog/reviews${reviewsQuery(query)}`,
    accessToken
  });

export type ReviewModerationStatus = "PUBLISHED" | "HIDDEN" | "REJECTED" | "PENDING";

export const moderateAdminCatalogReview = async (
  accessToken: string,
  reviewId: string,
  body: { status: ReviewModerationStatus; moderationNote?: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/reviews/${encodeURIComponent(reviewId)}/moderate`,
    accessToken,
    body
  });

export type AdminCatalogProductMedia = {
  id: string;
  url: string;
  kind: string;
  sortOrder: number;
  variantId: string | null;
  originalFilename?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
};

export type AdminCatalogProductVariant = {
  id: string;
  sku: string;
  status: string;
  attributes: unknown;
  costAmountCents?: number | null;
  pricing: {
    amountCents: number;
    currency: string;
    compareAtAmountCents: number | null;
  } | null;
  availability: {
    inStock: boolean;
    availableQuantity: number;
    lowStock: boolean;
  };
};

export type AdminCatalogProductDetailEntity = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  richDescription: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  scheduledPublishAt: string | null;
  merchandising: {
    featured: boolean;
    homeHighlight: boolean;
    searchBoost: number;
  };
  scheduledPricing: {
    variantId: string | null;
    listPriceAmountCents: number | null;
    listPriceCurrency: string | null;
    effectiveAt: string | null;
    note: string | null;
  };
  status: string;
  brand: { id: string; slug: string; name: string; status: string } | null;
  categories: Array<{ id: string; slug: string; name: string; status: string }>;
  media: AdminCatalogProductMedia[];
  variants: AdminCatalogProductVariant[];
  inventorySummary: {
    onHand: number;
    reserved: number;
    available: number;
    lowStock: boolean;
  };
  reorderThresholdSummary?: {
    minReorderLevel: number | null;
    maxReorderLevel: number | null;
  };
  pricing: {
    currency: string;
    amountCents: number | null;
    compareAtAmountCents: number | null;
    minAmountCents: number;
    maxAmountCents: number;
  } | null;
  costMarginSummary?: {
    minCostCents: number | null;
    maxCostCents: number | null;
    marginPercent: number | null;
    marginBasis: string;
    currency: string | null;
  };
  createdAt: string;
  updatedAt: string;
  reviewSummary: {
    averageRating: number | null;
    totalReviews: number;
  };
  recentReviews: Array<{
    id: string;
    rating: number;
    bodySnippet: string;
    status: string;
    createdAt: string;
    authorName: string;
  }>;
};

export type AdminCatalogProductDetailResponse = {
  success: true;
  data: { entity: AdminCatalogProductDetailEntity };
};

export const getAdminCatalogProduct = async (
  accessToken: string,
  productId: string
): Promise<AdminCatalogProductDetailResponse> =>
  apiRequest<AdminCatalogProductDetailResponse>({
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}`,
    accessToken
  });

export type UpdateAdminCatalogProductBody = {
  title?: string;
  description?: string | null;
  richDescription?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  scheduledPublishAt?: string | null;
  brandId?: string | null;
  categoryIds?: string[];
  merchandisingFeatured?: boolean;
  merchandisingHomeHighlight?: boolean;
  merchandisingSearchBoost?: number;
  scheduledListPriceVariantId?: string | null;
  scheduledListPriceAmountCents?: number | null;
  scheduledListPriceCurrency?: string | null;
  scheduledPriceEffectiveAt?: string | null;
  scheduledPriceNote?: string | null;
};

export const updateAdminCatalogProduct = async (
  accessToken: string,
  productId: string,
  body: UpdateAdminCatalogProductBody
): Promise<AdminCatalogProductDetailResponse> =>
  apiRequest<AdminCatalogProductDetailResponse>({
    method: "PATCH",
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}`,
    accessToken,
    body
  });

export type ProductStatusMutationBody = {
  reason?: string;
  note?: string;
};

export type ProductStatusMutationResponse = {
  success: true;
  data: { entity: { id: string; status: string } };
};

export const publishAdminCatalogProduct = async (
  accessToken: string,
  productId: string,
  body: ProductStatusMutationBody = {}
): Promise<ProductStatusMutationResponse> =>
  apiRequest<ProductStatusMutationResponse>({
    method: "POST",
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/publish`,
    accessToken,
    body
  });

export const unpublishAdminCatalogProduct = async (
  accessToken: string,
  productId: string,
  body: ProductStatusMutationBody = {}
): Promise<ProductStatusMutationResponse> =>
  apiRequest<ProductStatusMutationResponse>({
    method: "POST",
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/unpublish`,
    accessToken,
    body
  });

export const archiveAdminCatalogProduct = async (
  accessToken: string,
  productId: string,
  body: ProductStatusMutationBody = {}
): Promise<ProductStatusMutationResponse> =>
  apiRequest<ProductStatusMutationResponse>({
    method: "POST",
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/archive`,
    accessToken,
    body
  });

export type AdminProductActivityItem = {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  occurredAt: string;
  actorAdminUserId: string | null;
  actorUserId: string | null;
  actorType: string | null;
  payload: unknown;
};

export const getAdminCatalogProductActivity = async (
  accessToken: string,
  productId: string
): Promise<{ success: true; data: { items: AdminProductActivityItem[] } }> =>
  apiRequest({
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/activity`,
    accessToken
  });

export type AdminProductAnalyticsEntity = {
  implemented: boolean;
  period: "7d" | "30d" | "90d";
  periodLabel: string;
  primaryCurrency: string;
  metrics: {
    revenueCents: number;
    unitsSold: number;
    returnRatePercent: number | null;
    refundRatePercent: number | null;
    views: number | null;
    orders: number;
    conversionRate: number | null;
  };
  salesTrend: Array<{ date: string; revenueCents: number; unitsSold: number }>;
  stockoutEvents: Array<{
    startedAt: string;
    endedAt: string | null;
    durationLabel: string | null;
  }>;
  reviewDistribution: {
    star1: number;
    star2: number;
    star3: number;
    star4: number;
    star5: number;
  } | null;
  revenueShare: { productPercent: number; restPercent: number } | null;
};

export type AdminProductPricingEntity = {
  productId: string;
  pricing: AdminCatalogProductDetailEntity["pricing"];
  variants: Array<{
    id: string;
    sku: string;
    status: string;
    costAmountCents: number | null;
    pricing: AdminCatalogProductVariant["pricing"];
  }>;
};

export type AdminProductInventorySummaryEntity = {
  productId: string;
  inventorySummary: {
    onHand: number;
    reserved: number;
    available: number;
    lowStock: boolean;
  };
  stockRows: Array<{
    variantId: string;
    variantLabel: string;
    variantSku: string;
    variantStatus: string;
    warehouse: { id: string; code: string; name: string };
    onHand: number;
    reserved: number;
    available: number;
    reorderLevel: number;
    lowStock: boolean;
    outOfStock: boolean;
  }>;
  variants: Array<{
    id: string;
    sku: string;
    status: string;
    optionLabel: string;
    inventorySummary: {
      onHand: number;
      reserved: number;
      available: number;
      lowStock: boolean;
    };
  }>;
};

const analyticsQuery = (period: "7d" | "30d" | "90d") => `?period=${encodeURIComponent(period)}`;

export const getAdminCatalogProductAnalytics = async (
  accessToken: string,
  productId: string,
  period: "7d" | "30d" | "90d" = "30d"
): Promise<{ success: true; data: { entity: AdminProductAnalyticsEntity } }> =>
  apiRequest({
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/analytics${analyticsQuery(period)}`,
    accessToken
  });

export const getAdminCatalogProductVariants = async (
  accessToken: string,
  productId: string
): Promise<{ success: true; data: { items: AdminCatalogProductVariant[] } }> =>
  apiRequest({
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/variants`,
    accessToken
  });

export const getAdminCatalogProductMedia = async (
  accessToken: string,
  productId: string
): Promise<{ success: true; data: { items: AdminCatalogProductMedia[] } }> =>
  apiRequest({
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/media`,
    accessToken
  });

export const getAdminCatalogProductPricing = async (
  accessToken: string,
  productId: string
): Promise<{ success: true; data: { entity: AdminProductPricingEntity } }> =>
  apiRequest({
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/pricing`,
    accessToken
  });

export const getAdminCatalogProductInventorySummary = async (
  accessToken: string,
  productId: string
): Promise<{ success: true; data: { entity: AdminProductInventorySummaryEntity } }> =>
  apiRequest({
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/inventory-summary`,
    accessToken
  });

export type CreateAdminProductVariantBody = {
  sku: string;
  attributes?: Record<string, unknown>;
  priceAmountCents?: number | null;
  compareAtPriceAmountCents?: number | null;
  costAmountCents?: number | null;
  priceCurrency?: string | null;
  status?: string;
};

export const createAdminCatalogProductVariant = async (
  accessToken: string,
  productId: string,
  body: CreateAdminProductVariantBody
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/variants`,
    accessToken,
    body
  });

export const bulkArchiveAdminCatalogProductVariants = async (
  accessToken: string,
  productId: string,
  variantIds: string[]
): Promise<{ success: true; data: { entity: { archived: number } } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/variants/bulk-archive`,
    accessToken,
    body: { variantIds }
  });

export const applyAdminCatalogProductScheduledPricing = async (
  accessToken: string,
  productId: string,
  body: { force?: boolean } = {}
): Promise<{ success: true; data: { entity: AdminProductPricingEntity } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/scheduled-pricing/apply`,
    accessToken,
    body
  });

export type UpdateAdminCatalogVariantBody = {
  sku?: string;
  attributes?: Record<string, unknown>;
  priceAmountCents?: number | null;
  compareAtPriceAmountCents?: number | null;
  costAmountCents?: number | null;
  priceCurrency?: string | null;
  status?: string;
};

export const updateAdminCatalogVariant = async (
  accessToken: string,
  variantId: string,
  body: UpdateAdminCatalogVariantBody
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "PATCH",
    path: `/api/admin/catalog/variants/${encodeURIComponent(variantId)}`,
    accessToken,
    body
  });

export type CreateCatalogMediaUploadIntentBody = {
  fileName: string;
  contentType: string;
  fileSizeBytes?: number;
  variantId?: string | null;
  resourceType?: "image" | "video" | "raw";
};

export type CatalogMediaUploadIntentEntity = {
  provider: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  signedFormFields: Record<string, string>;
  uploadUrl: string;
  resourceType: string;
  deliveryType: string;
  publicId: string;
  folder: string;
  allowedFormats: string[];
  maxFileSizeBytes: number;
  signed: boolean;
};

export const createCatalogMediaUploadIntent = async (
  accessToken: string,
  productId: string,
  body: CreateCatalogMediaUploadIntentBody
): Promise<{ success: true; data: { entity: CatalogMediaUploadIntentEntity } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/media/upload-intents`,
    accessToken,
    body
  });

export type CreateAdminCatalogProductMediaBody = {
  url: string;
  kind: string;
  variantId?: string | null;
  sortOrder?: number;
  storageProvider?: string;
  publicId?: string;
  resourceType?: "image" | "video" | "raw";
  deliveryType?: "upload" | "private";
  mimeType?: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  originalFilename?: string;
};

export const createAdminCatalogProductMediaRecord = async (
  accessToken: string,
  productId: string,
  body: CreateAdminCatalogProductMediaBody
): Promise<{ success: true; data: { entity: { id: string } } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/media`,
    accessToken,
    body
  });

export const reorderAdminCatalogProductMedia = async (
  accessToken: string,
  productId: string,
  items: Array<{ mediaId: string; sortOrder: number }>
): Promise<{ success: true; data: { items: AdminCatalogProductMedia[] } }> =>
  apiRequest({
    method: "PATCH",
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/media/reorder`,
    accessToken,
    body: { items }
  });

export const deleteAdminCatalogProductMedia = async (
  accessToken: string,
  mediaId: string
): Promise<{ success: true; data: { deleted: boolean } }> =>
  apiRequest({
    method: "DELETE",
    path: `/api/admin/catalog/media/${encodeURIComponent(mediaId)}`,
    accessToken
  });

export const patchAdminCatalogProductMedia = async (
  accessToken: string,
  mediaId: string,
  body: { variantId: string | null }
): Promise<{ success: true; data: { entity: { id: string; productId: string; variantId: string | null } } }> =>
  apiRequest({
    method: "PATCH",
    path: `/api/admin/catalog/media/${encodeURIComponent(mediaId)}`,
    accessToken,
    body
  });

export type UpdateAdminCatalogProductPricingBody = {
  variants: Array<{
    variantId: string;
    priceAmountCents?: number | null;
    compareAtPriceAmountCents?: number | null;
    costAmountCents?: number | null;
    priceCurrency?: string | null;
  }>;
};

export const updateAdminCatalogProductPricing = async (
  accessToken: string,
  productId: string,
  body: UpdateAdminCatalogProductPricingBody
): Promise<{ success: true; data: { entity: AdminProductPricingEntity } }> =>
  apiRequest({
    method: "PATCH",
    path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/pricing`,
    accessToken,
    body
  });

export type CreateAdminProductBody = {
  slug: string;
  title: string;
  description?: string;
  richDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  /** ISO-8601 datetime */
  scheduledPublishAt?: string;
  brandId?: string | null;
  categoryIds?: string[];
  initialVariantSku?: string;
};

export type CreateAdminProductResponse = {
  success: true;
  data: {
    entity: { id: string };
  };
};

export const createAdminCatalogProduct = async (
  accessToken: string,
  body: CreateAdminProductBody
): Promise<CreateAdminProductResponse> =>
  apiRequest<CreateAdminProductResponse>({
    path: "/api/admin/catalog/products",
    method: "POST",
    accessToken,
    body
  });

export { ApiError };
