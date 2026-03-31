import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { rateLimit } from "../../common/middleware/rate-limit.middleware";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
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
  archiveAdminCatalogBrand,
  archiveAdminCatalogCategory,
  publishAdminCatalogBrand,
  publishAdminCatalogCategory,
  restoreAdminCatalogBrand,
  restoreAdminCatalogCategory,
  unpublishAdminCatalogBrand,
  unpublishAdminCatalogCategory,
  applyAdminCatalogProductScheduledPricing,
  archiveAdminCatalogProduct,
  bulkArchiveAdminCatalogProductVariants,
  createAdminCatalogBrand,
  createAdminCatalogCategory,
  createAdminCatalogProduct,
  createAdminCatalogProductMediaUploadIntent,
  createAdminCatalogProductMedia,
  createAdminCatalogProductVariant,
  deleteAdminCatalogProductMedia,
  patchAdminCatalogProductMedia,
  getAdminCatalogProduct,
  getAdminCatalogProductInventorySummary,
  getAdminCatalogProductPricing,
  getAdminCatalogProductActivity,
  getAdminCatalogProductAnalytics,
  getPublicCatalogBrand,
  getPublicCatalogCategory,
  getPublicCatalogProduct,
  getAdminCatalogBrand,
  getAdminCatalogCategory,
  listAdminCatalogBrands,
  listAdminCatalogCategories,
  listAdminCatalogProductMedia,
  listAdminCatalogProductVariants,
  listAdminCatalogProducts,
  listPublicCatalogCategories,
  listPublicCatalogProductReviews,
  listPublicCatalogProducts,
  publishAdminCatalogProduct,
  reorderAdminCatalogProductMedia,
  searchPublicCatalog,
  unpublishAdminCatalogProduct,
  updateAdminCatalogBrand,
  updateAdminCatalogCategory,
  updateAdminCatalogProductPricing,
  updateAdminCatalogProduct,
  updateAdminCatalogVariant
} from "./catalog.controller";

const router = Router();

const publicCatalogSearchRateLimit = rateLimit({
  keyPrefix: "rl:catalog:search",
  maxRequests: 30,
  windowSeconds: 60,
  failClosed: true
});

router.get("/catalog/products", validateRequest({ query: publicCatalogListQuerySchema }), listPublicCatalogProducts);
router.get("/catalog/products/:productSlug", validateRequest({ params: productSlugParamsSchema }), getPublicCatalogProduct);
router.get("/catalog/products/:productSlug/reviews", validateRequest({ params: productSlugParamsSchema, query: publicReviewsQuerySchema }), listPublicCatalogProductReviews);
router.get("/catalog/categories", listPublicCatalogCategories);
router.get("/catalog/categories/:categorySlug", validateRequest({ params: categorySlugParamsSchema, query: publicCatalogListQuerySchema }), getPublicCatalogCategory);
router.get("/catalog/brands/:brandSlug", validateRequest({ params: brandSlugParamsSchema, query: publicCatalogListQuerySchema }), getPublicCatalogBrand);
router.get(
  "/catalog/search",
  publicCatalogSearchRateLimit,
  validateRequest({ query: publicSearchQuerySchema }),
  searchPublicCatalog
);

router.get("/admin/catalog/products", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ query: adminCatalogListQuerySchema }), listAdminCatalogProducts);
router.get("/admin/catalog/products/:productId", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ params: productIdParamsSchema }), getAdminCatalogProduct);
router.post("/admin/catalog/products", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ body: createProductBodySchema }), createAdminCatalogProduct);
router.patch("/admin/catalog/products/:productId", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: productIdParamsSchema, body: updateProductBodySchema }), updateAdminCatalogProduct);
router.post("/admin/catalog/products/:productId/publish", requireAdminActor, requirePermissions(["catalog.products.publish"]), validateRequest({ params: productIdParamsSchema, body: productMutationBodySchema }), publishAdminCatalogProduct);
router.post("/admin/catalog/products/:productId/unpublish", requireAdminActor, requirePermissions(["catalog.products.publish"]), validateRequest({ params: productIdParamsSchema, body: productMutationBodySchema }), unpublishAdminCatalogProduct);
router.post("/admin/catalog/products/:productId/archive", requireAdminActor, requirePermissions(["catalog.products.publish"]), validateRequest({ params: productIdParamsSchema, body: productMutationBodySchema }), archiveAdminCatalogProduct);
router.get(
  "/admin/catalog/products/:productId/analytics",
  requireAdminActor,
  requirePermissions(["catalog.products.read"]),
  validateRequest({ params: productIdParamsSchema, query: adminProductAnalyticsQuerySchema }),
  getAdminCatalogProductAnalytics
);
router.get("/admin/catalog/products/:productId/activity", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ params: productIdParamsSchema }), getAdminCatalogProductActivity);
router.get("/admin/catalog/products/:productId/variants", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ params: productIdParamsSchema }), listAdminCatalogProductVariants);
router.post("/admin/catalog/products/:productId/variants", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: productIdParamsSchema, body: createVariantBodySchema }), createAdminCatalogProductVariant);
router.post(
  "/admin/catalog/products/:productId/variants/bulk-archive",
  requireAdminActor,
  requirePermissions(["catalog.products.write"]),
  validateRequest({ params: productIdParamsSchema, body: bulkArchiveVariantsBodySchema }),
  bulkArchiveAdminCatalogProductVariants
);
router.patch("/admin/catalog/variants/:variantId", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: variantIdParamsSchema, body: updateVariantBodySchema }), updateAdminCatalogVariant);
router.post(
  "/admin/catalog/products/:productId/scheduled-pricing/apply",
  requireAdminActor,
  requirePermissions(["catalog.products.change_price"]),
  validateRequest({ params: productIdParamsSchema, body: applyScheduledPricingBodySchema }),
  applyAdminCatalogProductScheduledPricing
);
router.get("/admin/catalog/products/:productId/media", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ params: productIdParamsSchema }), listAdminCatalogProductMedia);
router.post("/admin/catalog/products/:productId/media/upload-intents", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: productIdParamsSchema, body: createMediaUploadIntentBodySchema }), createAdminCatalogProductMediaUploadIntent);
router.post("/admin/catalog/products/:productId/media", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: productIdParamsSchema, body: createMediaBodySchema }), createAdminCatalogProductMedia);
router.patch("/admin/catalog/products/:productId/media/reorder", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: productIdParamsSchema, body: reorderProductMediaBodySchema }), reorderAdminCatalogProductMedia);
router.patch("/admin/catalog/media/:mediaId", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: mediaIdParamsSchema, body: updateProductMediaBodySchema }), patchAdminCatalogProductMedia);
router.delete("/admin/catalog/media/:mediaId", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: mediaIdParamsSchema }), deleteAdminCatalogProductMedia);
router.get("/admin/catalog/products/:productId/pricing", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ params: productIdParamsSchema }), getAdminCatalogProductPricing);
router.patch("/admin/catalog/products/:productId/pricing", requireAdminActor, requirePermissions(["catalog.products.change_price"]), validateRequest({ params: productIdParamsSchema, body: updateProductPricingBodySchema }), updateAdminCatalogProductPricing);
router.get("/admin/catalog/products/:productId/inventory-summary", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ params: productIdParamsSchema }), getAdminCatalogProductInventorySummary);
router.get(
  "/admin/catalog/categories",
  requireAdminActor,
  requirePermissions(["catalog.categories.read"]),
  validateRequest({ query: adminTaxonomyListQuerySchema }),
  listAdminCatalogCategories
);
router.get(
  "/admin/catalog/categories/:categoryId",
  requireAdminActor,
  requirePermissions(["catalog.categories.read"]),
  validateRequest({ params: categoryIdParamsSchema }),
  getAdminCatalogCategory
);
router.post("/admin/catalog/categories", requireAdminActor, requirePermissions(["catalog.categories.write"]), validateRequest({ body: createCategoryBodySchema }), createAdminCatalogCategory);
router.patch("/admin/catalog/categories/:categoryId", requireAdminActor, requirePermissions(["catalog.categories.write"]), validateRequest({ params: categoryIdParamsSchema, body: updateCategoryBodySchema }), updateAdminCatalogCategory);
router.post("/admin/catalog/categories/:categoryId/archive", requireAdminActor, requirePermissions(["catalog.categories.write"]), validateRequest({ params: categoryIdParamsSchema, body: productMutationBodySchema }), archiveAdminCatalogCategory);
router.post(
  "/admin/catalog/categories/:categoryId/publish",
  requireAdminActor,
  requirePermissions(["catalog.categories.write"]),
  validateRequest({ params: categoryIdParamsSchema, body: productMutationBodySchema }),
  publishAdminCatalogCategory
);
router.post(
  "/admin/catalog/categories/:categoryId/unpublish",
  requireAdminActor,
  requirePermissions(["catalog.categories.write"]),
  validateRequest({ params: categoryIdParamsSchema, body: productMutationBodySchema }),
  unpublishAdminCatalogCategory
);
router.post(
  "/admin/catalog/categories/:categoryId/restore",
  requireAdminActor,
  requirePermissions(["catalog.categories.write"]),
  validateRequest({ params: categoryIdParamsSchema, body: productMutationBodySchema }),
  restoreAdminCatalogCategory
);
router.get(
  "/admin/catalog/brands",
  requireAdminActor,
  requirePermissions(["catalog.brands.read"]),
  validateRequest({ query: adminTaxonomyListQuerySchema }),
  listAdminCatalogBrands
);
router.get(
  "/admin/catalog/brands/:brandId",
  requireAdminActor,
  requirePermissions(["catalog.brands.read"]),
  validateRequest({ params: brandIdParamsSchema }),
  getAdminCatalogBrand
);
router.post("/admin/catalog/brands", requireAdminActor, requirePermissions(["catalog.brands.write"]), validateRequest({ body: createBrandBodySchema }), createAdminCatalogBrand);
router.patch("/admin/catalog/brands/:brandId", requireAdminActor, requirePermissions(["catalog.brands.write"]), validateRequest({ params: brandIdParamsSchema, body: updateBrandBodySchema }), updateAdminCatalogBrand);
router.post("/admin/catalog/brands/:brandId/archive", requireAdminActor, requirePermissions(["catalog.brands.write"]), validateRequest({ params: brandIdParamsSchema, body: productMutationBodySchema }), archiveAdminCatalogBrand);
router.post(
  "/admin/catalog/brands/:brandId/publish",
  requireAdminActor,
  requirePermissions(["catalog.brands.write"]),
  validateRequest({ params: brandIdParamsSchema, body: productMutationBodySchema }),
  publishAdminCatalogBrand
);
router.post(
  "/admin/catalog/brands/:brandId/unpublish",
  requireAdminActor,
  requirePermissions(["catalog.brands.write"]),
  validateRequest({ params: brandIdParamsSchema, body: productMutationBodySchema }),
  unpublishAdminCatalogBrand
);
router.post(
  "/admin/catalog/brands/:brandId/restore",
  requireAdminActor,
  requirePermissions(["catalog.brands.write"]),
  validateRequest({ params: brandIdParamsSchema, body: productMutationBodySchema }),
  restoreAdminCatalogBrand
);

export const catalogRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/catalog/products", summary: "List published catalog products.", tags: ["catalog"], auth: "public" },
    { method: "GET", path: "/api/v1/catalog/products/:productSlug", summary: "Get a published product detail page payload.", tags: ["catalog"], auth: "public" },
    { method: "GET", path: "/api/v1/catalog/products/:productSlug/reviews", summary: "List published reviews for a catalog product.", tags: ["catalog"], auth: "public" },
    { method: "GET", path: "/api/v1/catalog/categories", summary: "List catalog categories.", tags: ["catalog"], auth: "public" },
    { method: "GET", path: "/api/v1/catalog/categories/:categorySlug", summary: "Get a category landing payload with products.", tags: ["catalog"], auth: "public" },
    { method: "GET", path: "/api/v1/catalog/brands/:brandSlug", summary: "Get a brand landing payload with products.", tags: ["catalog"], auth: "public" },
    { method: "GET", path: "/api/v1/catalog/search", summary: "Search published catalog products.", tags: ["catalog"], auth: "public" },
    { method: "GET", path: "/api/v1/admin/catalog/products", summary: "List products for the admin catalog grid.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.read"] },
    { method: "GET", path: "/api/v1/admin/catalog/products/:productId", summary: "Get an admin product detail payload.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.read"] },
    { method: "POST", path: "/api/v1/admin/catalog/products", summary: "Create a product.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.write"] },
    { method: "PATCH", path: "/api/v1/admin/catalog/products/:productId", summary: "Update a product.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/products/:productId/publish", summary: "Publish a product.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.publish"] },
    { method: "POST", path: "/api/v1/admin/catalog/products/:productId/unpublish", summary: "Unpublish a product.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.publish"] },
    { method: "POST", path: "/api/v1/admin/catalog/products/:productId/archive", summary: "Archive a product.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.publish"] },
    { method: "GET", path: "/api/v1/admin/catalog/products/:productId/analytics", summary: "Get product analytics for a selected period.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.read"] },
    { method: "GET", path: "/api/v1/admin/catalog/products/:productId/activity", summary: "List timeline activity for a product.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.read"] },
    { method: "GET", path: "/api/v1/admin/catalog/products/:productId/variants", summary: "List product variants.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.read"] },
    { method: "POST", path: "/api/v1/admin/catalog/products/:productId/variants", summary: "Create a product variant.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/products/:productId/variants/bulk-archive", summary: "Archive multiple variants for a product.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.write"] },
    { method: "PATCH", path: "/api/v1/admin/catalog/variants/:variantId", summary: "Update a product variant.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/products/:productId/scheduled-pricing/apply", summary: "Apply scheduled list price to the configured variant.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.change_price"] },
    { method: "GET", path: "/api/v1/admin/catalog/products/:productId/media", summary: "List product media.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.read"] },
    { method: "POST", path: "/api/v1/admin/catalog/products/:productId/media/upload-intents", summary: "Create a signed upload intent for product media.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/products/:productId/media", summary: "Create product media metadata.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.write"] },
    { method: "PATCH", path: "/api/v1/admin/catalog/products/:productId/media/reorder", summary: "Reorder product media assets.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.write"] },
    { method: "PATCH", path: "/api/v1/admin/catalog/media/:mediaId", summary: "Update product media (e.g. variant assignment).", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.write"] },
    { method: "DELETE", path: "/api/v1/admin/catalog/media/:mediaId", summary: "Delete product media metadata.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.write"] },
    { method: "GET", path: "/api/v1/admin/catalog/products/:productId/pricing", summary: "Fetch derived product pricing and per-variant pricing.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.read"] },
    { method: "PATCH", path: "/api/v1/admin/catalog/products/:productId/pricing", summary: "Update per-variant pricing for a product.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.change_price"] },
    { method: "GET", path: "/api/v1/admin/catalog/products/:productId/inventory-summary", summary: "Fetch product-level and variant-level inventory summaries.", tags: ["catalog"], auth: "admin", permissions: ["catalog.products.read"] },
    { method: "GET", path: "/api/v1/admin/catalog/categories", summary: "List admin categories.", tags: ["catalog"], auth: "admin", permissions: ["catalog.categories.read"] },
    {
      method: "GET",
      path: "/api/v1/admin/catalog/categories/:categoryId",
      summary: "Get a single admin category (list row shape).",
      tags: ["catalog"],
      auth: "admin",
      permissions: ["catalog.categories.read"]
    },
    { method: "POST", path: "/api/v1/admin/catalog/categories", summary: "Create a category.", tags: ["catalog"], auth: "admin", permissions: ["catalog.categories.write"] },
    { method: "PATCH", path: "/api/v1/admin/catalog/categories/:categoryId", summary: "Update a category.", tags: ["catalog"], auth: "admin", permissions: ["catalog.categories.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/categories/:categoryId/archive", summary: "Archive a category.", tags: ["catalog"], auth: "admin", permissions: ["catalog.categories.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/categories/:categoryId/publish", summary: "Publish a draft category (make it active).", tags: ["catalog"], auth: "admin", permissions: ["catalog.categories.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/categories/:categoryId/unpublish", summary: "Move an active category back to draft when it has no products.", tags: ["catalog"], auth: "admin", permissions: ["catalog.categories.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/categories/:categoryId/restore", summary: "Restore an archived category to active.", tags: ["catalog"], auth: "admin", permissions: ["catalog.categories.write"] },
    { method: "GET", path: "/api/v1/admin/catalog/brands", summary: "List admin brands.", tags: ["catalog"], auth: "admin", permissions: ["catalog.brands.read"] },
    {
      method: "GET",
      path: "/api/v1/admin/catalog/brands/:brandId",
      summary: "Get a single admin brand (list row shape).",
      tags: ["catalog"],
      auth: "admin",
      permissions: ["catalog.brands.read"]
    },
    { method: "POST", path: "/api/v1/admin/catalog/brands", summary: "Create a brand.", tags: ["catalog"], auth: "admin", permissions: ["catalog.brands.write"] },
    { method: "PATCH", path: "/api/v1/admin/catalog/brands/:brandId", summary: "Update a brand.", tags: ["catalog"], auth: "admin", permissions: ["catalog.brands.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/brands/:brandId/archive", summary: "Archive a brand.", tags: ["catalog"], auth: "admin", permissions: ["catalog.brands.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/brands/:brandId/publish", summary: "Publish a draft brand (make it active).", tags: ["catalog"], auth: "admin", permissions: ["catalog.brands.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/brands/:brandId/unpublish", summary: "Move an active brand back to draft when it has no products.", tags: ["catalog"], auth: "admin", permissions: ["catalog.brands.write"] },
    { method: "POST", path: "/api/v1/admin/catalog/brands/:brandId/restore", summary: "Restore an archived brand to active.", tags: ["catalog"], auth: "admin", permissions: ["catalog.brands.write"] }
  ]
};
