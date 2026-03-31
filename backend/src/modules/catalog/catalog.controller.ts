import { z } from "zod";

import { forbiddenError } from "../../common/errors/app-error";
import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import { actorHasPermissions } from "../roles-permissions/rbac.service";
import {
  adminCatalogListQuerySchema,
  adminProductAnalyticsQuerySchema,
  adminTaxonomyListQuerySchema,
  applyScheduledPricingBodySchema,
  bulkArchiveVariantsBodySchema,
  brandIdParamsSchema,
  brandSlugParamsSchema,
  categoryIdParamsSchema,
  categorySlugParamsSchema,
  createBrandBodySchema,
  createCategoryBodySchema,
  createMediaBodySchema,
  createMediaUploadIntentBodySchema,
  createProductBodySchema,
  createVariantBodySchema,
  mediaIdParamsSchema,
  productIdParamsSchema,
  productMutationBodySchema,
  productSlugParamsSchema,
  publicCatalogListQuerySchema,
  publicReviewsQuerySchema,
  publicSearchQuerySchema,
  reorderProductMediaBodySchema,
  updateBrandBodySchema,
  updateCategoryBodySchema,
  updateProductMediaBodySchema,
  updateProductPricingBodySchema,
  updateProductBodySchema,
  updateVariantBodySchema,
  variantIdParamsSchema
} from "./catalog.schemas";
import {
  applyAdminProductScheduledPricing,
  archiveAdminBrand,
  archiveAdminCategory,
  publishAdminBrand,
  publishAdminCategory,
  restoreAdminBrand,
  restoreAdminCategory,
  unpublishAdminBrand,
  unpublishAdminCategory,
  bulkArchiveAdminProductVariants,
  createAdminBrand,
  createAdminCategory,
  createAdminProduct,
  createAdminProductMedia,
  createAdminProductMediaUploadIntent,
  createAdminProductVariant,
  deleteAdminProductMedia,
  updateAdminProductMedia,
  getAdminProductInventorySummary,
  getAdminProductPricing,
  getAdminProductActivity,
  getAdminProductAnalytics,
  getAdminProductDetail,
  getAdminBrandById,
  getAdminCategoryById,
  getBrandCatalogView,
  getCategoryCatalogView,
  getPublicProductDetail,
  listAdminBrands,
  listAdminCategories,
  listAdminProductMedia,
  listAdminProducts,
  listAdminProductVariants,
  listCatalogCategories,
  listPublicProductReviews,
  listPublicProducts,
  mutateAdminProductStatus,
  reorderAdminProductMedia,
  updateAdminBrand,
  updateAdminCategory,
  updateAdminProductPricing,
  updateAdminProduct,
  updateAdminProductVariant
} from "./catalog.service";

const ensureVariantPricingPermission = (
  actor: Parameters<typeof actorHasPermissions>[0],
  body: z.infer<typeof createVariantBodySchema> | z.infer<typeof updateVariantBodySchema>
) => {
  const mutatesPricing =
    body.priceAmountCents !== undefined ||
    body.compareAtPriceAmountCents !== undefined ||
    body.priceCurrency !== undefined;

  if (!mutatesPricing) {
    return;
  }

  if (!actorHasPermissions(actor, ["catalog.products.change_price"])) {
    throw forbiddenError("The current admin does not have permission to change pricing.");
  }
};

export const listPublicCatalogProducts = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof publicCatalogListQuerySchema>>(request);
  const data = await listPublicProducts(query);

  return sendSuccess(response, { data });
});

export const getPublicCatalogProduct = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productSlugParamsSchema>>(request);
  const data = await getPublicProductDetail(params.productSlug);

  return sendSuccess(response, { data });
});

export const listPublicCatalogCategories = asyncHandler(async (_request, response) => {
  const data = await listCatalogCategories();

  return sendSuccess(response, {
    data: {
      items: data
    }
  });
});

export const getPublicCatalogCategory = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof categorySlugParamsSchema>>(request);
  const query = readValidatedQuery<z.infer<typeof publicCatalogListQuerySchema>>(request);
  const data = await getCategoryCatalogView(params.categorySlug, query);

  return sendSuccess(response, { data });
});

export const getPublicCatalogBrand = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof brandSlugParamsSchema>>(request);
  const query = readValidatedQuery<z.infer<typeof publicCatalogListQuerySchema>>(request);
  const data = await getBrandCatalogView(params.brandSlug, query);

  return sendSuccess(response, { data });
});

export const searchPublicCatalog = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof publicSearchQuerySchema>>(request);
  const data = await listPublicProducts(query);

  return sendSuccess(response, {
    data: {
      query: query.q,
      ...data
    }
  });
});

export const listPublicCatalogProductReviews = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productSlugParamsSchema>>(request);
  const query = readValidatedQuery<z.infer<typeof publicReviewsQuerySchema>>(request);
  const data = await listPublicProductReviews(params.productSlug, query);

  return sendSuccess(response, { data });
});

export const listAdminCatalogProducts = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminCatalogListQuerySchema>>(request);
  const data = await listAdminProducts(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getAdminCatalogProduct = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const entity = await getAdminProductDetail(params.productId);

  return sendSuccess(response, {
    data: {
      entity
    }
  });
});

export const createAdminCatalogProduct = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createProductBodySchema>>(request);
  const entity = await createAdminProduct({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data: {
      entity
    }
  });
});

export const updateAdminCatalogProduct = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateProductBodySchema>>(request);
  const entity = await updateAdminProduct({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    productId: params.productId,
    ...body
  });

  return sendSuccess(response, {
    data: {
      entity
    }
  });
});

export const publishAdminCatalogProduct = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof productMutationBodySchema>>(request);
  const entity = await mutateAdminProductStatus({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    productId: params.productId,
    action: "publish",
    ...body
  });

  return sendSuccess(response, { data: { entity } });
});

export const unpublishAdminCatalogProduct = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof productMutationBodySchema>>(request);
  const entity = await mutateAdminProductStatus({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    productId: params.productId,
    action: "unpublish",
    ...body
  });

  return sendSuccess(response, { data: { entity } });
});

export const archiveAdminCatalogProduct = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof productMutationBodySchema>>(request);
  const entity = await mutateAdminProductStatus({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    productId: params.productId,
    action: "archive",
    ...body
  });

  return sendSuccess(response, { data: { entity } });
});

export const getAdminCatalogProductAnalytics = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const query = readValidatedQuery<z.infer<typeof adminProductAnalyticsQuerySchema>>(request);
  const entity = await getAdminProductAnalytics(params.productId, query.period);

  return sendSuccess(response, { data: { entity } });
});

export const getAdminCatalogProductActivity = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const items = await getAdminProductActivity(params.productId);

  return sendSuccess(response, { data: { items } });
});

export const listAdminCatalogProductVariants = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const items = await listAdminProductVariants(params.productId);

  return sendSuccess(response, { data: { items } });
});

export const bulkArchiveAdminCatalogProductVariants = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof bulkArchiveVariantsBodySchema>>(request);
  const entity = await bulkArchiveAdminProductVariants({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    productId: params.productId,
    variantIds: body.variantIds
  });

  return sendSuccess(response, { data: { entity } });
});

export const applyAdminCatalogProductScheduledPricing = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof applyScheduledPricingBodySchema>>(request);
  const entity = await applyAdminProductScheduledPricing({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    productId: params.productId,
    force: body.force
  });

  return sendSuccess(response, {
    data: {
      entity
    }
  });
});

export const createAdminCatalogProductVariant = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof createVariantBodySchema>>(request);
  ensureVariantPricingPermission(request.context.actor, body);
  const entity = await createAdminProductVariant({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    productId: params.productId,
    ...body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data: {
      entity
    }
  });
});

export const updateAdminCatalogVariant = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof variantIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateVariantBodySchema>>(request);
  ensureVariantPricingPermission(request.context.actor, body);
  const entity = await updateAdminProductVariant({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    variantId: params.variantId,
    ...body
  });

  return sendSuccess(response, { data: { entity } });
});

export const listAdminCatalogProductMedia = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const items = await listAdminProductMedia(params.productId);

  return sendSuccess(response, { data: { items } });
});

export const createAdminCatalogProductMediaUploadIntent = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof createMediaUploadIntentBodySchema>>(request);
  const data = await createAdminProductMediaUploadIntent({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    productId: params.productId,
    ...body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const createAdminCatalogProductMedia = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof createMediaBodySchema>>(request);
  const entity = await createAdminProductMedia({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    productId: params.productId,
    ...body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data: {
      entity
    }
  });
});

export const deleteAdminCatalogProductMedia = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof mediaIdParamsSchema>>(request);
  const data = await deleteAdminProductMedia({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    mediaId: params.mediaId
  });

  return sendSuccess(response, { data });
});

export const patchAdminCatalogProductMedia = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof mediaIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateProductMediaBodySchema>>(request);
  const entity = await updateAdminProductMedia({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    mediaId: params.mediaId,
    variantId: body.variantId
  });

  return sendSuccess(response, {
    data: {
      entity
    }
  });
});

export const reorderAdminCatalogProductMedia = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof reorderProductMediaBodySchema>>(request);
  const items = await reorderAdminProductMedia({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    productId: params.productId,
    items: body.items
  });

  return sendSuccess(response, {
    data: {
      items
    }
  });
});

export const getAdminCatalogProductPricing = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const entity = await getAdminProductPricing(params.productId);

  return sendSuccess(response, {
    data: {
      entity
    }
  });
});

export const updateAdminCatalogProductPricing = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateProductPricingBodySchema>>(request);
  const entity = await updateAdminProductPricing({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    productId: params.productId,
    variants: body.variants
  });

  return sendSuccess(response, {
    data: {
      entity
    }
  });
});

export const getAdminCatalogProductInventorySummary = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productIdParamsSchema>>(request);
  const entity = await getAdminProductInventorySummary(params.productId);

  return sendSuccess(response, {
    data: {
      entity
    }
  });
});

export const listAdminCatalogCategories = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminTaxonomyListQuerySchema>>(request);
  const items = await listAdminCategories(query.status ? { status: query.status } : undefined);

  return sendSuccess(response, { data: { items } });
});

export const getAdminCatalogCategory = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof categoryIdParamsSchema>>(request);
  const entity = await getAdminCategoryById(params.categoryId);

  return sendSuccess(response, { data: { entity } });
});

export const createAdminCatalogCategory = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createCategoryBodySchema>>(request);
  const entity = await createAdminCategory({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data: {
      entity
    }
  });
});

export const updateAdminCatalogCategory = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof categoryIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateCategoryBodySchema>>(request);
  const entity = await updateAdminCategory({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    categoryId: params.categoryId,
    ...body
  });

  return sendSuccess(response, { data: { entity } });
});

export const archiveAdminCatalogCategory = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof categoryIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof productMutationBodySchema>>(request);
  const entity = await archiveAdminCategory({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    categoryId: params.categoryId,
    ...body
  });

  return sendSuccess(response, { data: { entity } });
});

export const publishAdminCatalogCategory = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof categoryIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof productMutationBodySchema>>(request);
  const entity = await publishAdminCategory({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    categoryId: params.categoryId,
    ...body
  });
  return sendSuccess(response, { data: { entity } });
});

export const unpublishAdminCatalogCategory = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof categoryIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof productMutationBodySchema>>(request);
  const entity = await unpublishAdminCategory({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    categoryId: params.categoryId,
    ...body
  });
  return sendSuccess(response, { data: { entity } });
});

export const restoreAdminCatalogCategory = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof categoryIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof productMutationBodySchema>>(request);
  const entity = await restoreAdminCategory({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    categoryId: params.categoryId,
    ...body
  });
  return sendSuccess(response, { data: { entity } });
});

export const listAdminCatalogBrands = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminTaxonomyListQuerySchema>>(request);
  const items = await listAdminBrands(query.status ? { status: query.status } : undefined);

  return sendSuccess(response, { data: { items } });
});

export const getAdminCatalogBrand = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof brandIdParamsSchema>>(request);
  const entity = await getAdminBrandById(params.brandId);

  return sendSuccess(response, { data: { entity } });
});

export const createAdminCatalogBrand = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createBrandBodySchema>>(request);
  const entity = await createAdminBrand({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data: {
      entity
    }
  });
});

export const updateAdminCatalogBrand = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof brandIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateBrandBodySchema>>(request);
  const entity = await updateAdminBrand({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    brandId: params.brandId,
    ...body
  });

  return sendSuccess(response, { data: { entity } });
});

export const archiveAdminCatalogBrand = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof brandIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof productMutationBodySchema>>(request);
  const entity = await archiveAdminBrand({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    brandId: params.brandId,
    ...body
  });

  return sendSuccess(response, { data: { entity } });
});

export const publishAdminCatalogBrand = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof brandIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof productMutationBodySchema>>(request);
  const entity = await publishAdminBrand({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    brandId: params.brandId,
    ...body
  });
  return sendSuccess(response, { data: { entity } });
});

export const unpublishAdminCatalogBrand = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof brandIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof productMutationBodySchema>>(request);
  const entity = await unpublishAdminBrand({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    brandId: params.brandId,
    ...body
  });
  return sendSuccess(response, { data: { entity } });
});

export const restoreAdminCatalogBrand = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof brandIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof productMutationBodySchema>>(request);
  const entity = await restoreAdminBrand({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    brandId: params.brandId,
    ...body
  });
  return sendSuccess(response, { data: { entity } });
});
