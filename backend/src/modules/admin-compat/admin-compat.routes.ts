import { ReviewStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import type { RouteModule } from "../../app/route.types";
import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  validateRequest
} from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  archiveAdminCatalogBrand,
  archiveAdminCatalogCategory,
  publishAdminCatalogBrand,
  publishAdminCatalogCategory,
  restoreAdminCatalogBrand,
  restoreAdminCatalogCategory,
  unpublishAdminCatalogBrand,
  unpublishAdminCatalogCategory,
  createAdminCatalogBrand,
  createAdminCatalogCategory,
  createAdminCatalogProduct,
  createAdminCatalogProductMedia,
  createAdminCatalogProductVariant,
  deleteAdminCatalogProductMedia,
  getAdminCatalogProduct,
  getAdminCatalogProductAnalytics,
  getAdminCatalogProductInventorySummary,
  getAdminCatalogProductPricing,
  listAdminCatalogBrands,
  listAdminCatalogCategories,
  listAdminCatalogProductMedia,
  listAdminCatalogProductVariants,
  listAdminCatalogProducts,
  publishAdminCatalogProduct,
  reorderAdminCatalogProductMedia,
  unpublishAdminCatalogProduct,
  updateAdminCatalogBrand,
  updateAdminCatalogCategory,
  updateAdminCatalogProduct,
  updateAdminCatalogProductPricing,
  updateAdminCatalogVariant,
  archiveAdminCatalogProduct
} from "../catalog/catalog.controller";
import {
  adminCatalogListQuerySchema,
  adminTaxonomyListQuerySchema,
  adminProductAnalyticsQuerySchema,
  brandIdParamsSchema,
  categoryIdParamsSchema,
  createBrandBodySchema,
  createCategoryBodySchema,
  createMediaBodySchema,
  createProductBodySchema,
  createVariantBodySchema,
  mediaIdParamsSchema,
  productIdParamsSchema,
  productMutationBodySchema,
  reorderProductMediaBodySchema,
  updateBrandBodySchema,
  updateCategoryBodySchema,
  updateProductBodySchema,
  updateProductPricingBodySchema,
  updateVariantBodySchema,
  variantIdParamsSchema
} from "../catalog/catalog.schemas";
import {
  archivePageAdmin,
  createBannerAdmin,
  createPageAdmin,
  deleteBannerAdmin,
  deletePagePermanentAdmin,
  getPageAdmin,
  listBannersAdmin,
  listPagesAdmin,
  publishBannerAdmin,
  publishPageAdmin,
  restorePageAdmin,
  unpublishBannerAdmin,
  unpublishPageAdmin,
  updateBannerAdmin,
  updatePageAdmin
} from "../content/content.controller";
import {
  bannerIdParamsSchema,
  contentMutationBodySchema,
  createBannerBodySchema,
  createPageBodySchema,
  pageIdParamsSchema,
  updateBannerBodySchema,
  updatePageBodySchema
} from "../content/content.schemas";
import {
  createShipmentAdmin,
  createShipmentTrackingEventAdmin,
  getShipmentAdmin,
  getShipmentTrackingAdmin
} from "../shipping/shipping.controller";
import {
  createShipmentBodySchema,
  createTrackingEventBodySchema,
  orderIdParamsSchema as shippingOrderIdParamsSchema,
  shipmentIdParamsSchema
} from "../shipping/shipping.schemas";
import {
  createAdminWarehouse,
  getAdminWarehouse,
  listAdminWarehouses,
  updateAdminWarehouse
} from "../inventory/inventory.controller";
import {
  createWarehouseBodySchema,
  updateWarehouseBodySchema,
  warehouseIdParamsSchema
} from "../inventory/inventory.schemas";
import {
  createInternalNoteAdmin,
  createTicketMessageAdmin,
  getSupportComplaintsQueueAdmin,
  getSupportPrePurchaseQueueAdmin,
  getSupportReportsAdmin,
  listTicketsAdmin,
  recordTicketCsatAdmin
} from "../support/support.controller";
import {
  adminTicketsQuerySchema,
  createInternalNoteBodySchema,
  createTicketMessageBodySchema,
  recordSupportTicketCsatBodySchema,
  ticketIdParamsSchema
} from "../support/support.schemas";
import {
  getReviewAdmin,
  listReviewsAdmin
} from "../reviews/reviews.controller";
import {
  adminReviewsQuerySchema,
  reviewIdParamsSchema
} from "../reviews/reviews.schemas";
import { getDashboardAdmin, getSupportAdmin } from "../reports/reports.controller";
import { reportsDateRangeQuerySchema } from "../reports/reports.schemas";
import { listTimelineAdmin } from "../audit/audit.controller";
import { timelineQuerySchema } from "../audit/audit.schemas";
import {
  listSystemSettingsByPrefix,
  updateSystemSettingsByPrefix
} from "../system-settings/system-settings.service";
import { updateSettingsBodySchema } from "../system-settings/system-settings.schemas";
import { getReadinessSnapshot } from "../health-observability/health.service";
import { moderateAdminReview } from "../reviews/reviews.service";

const router = Router();

const reviewActionBodySchema = z.object({
  moderationNote: z.string().trim().max(1_000).optional()
});

const moderateReviewWithStatus =
  (status: ReviewStatus) =>
  asyncHandler(async (request, response) => {
    const params = readValidatedParams<z.infer<typeof reviewIdParamsSchema>>(request);
    const body = readValidatedBody<z.infer<typeof reviewActionBodySchema>>(request);
    const data = await moderateAdminReview({
      actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
      reviewId: params.reviewId,
      status,
      moderationNote: body.moderationNote
    });

    return sendSuccess(response, { data });
  });

const getScopedSettings =
  (prefix: string) =>
  asyncHandler(async (_request, response) => {
    const data = await listSystemSettingsByPrefix(prefix);
    return sendSuccess(response, { data });
  });

const updateScopedSettings =
  (prefix: string) =>
  asyncHandler(async (request, response) => {
    const body = readValidatedBody<z.infer<typeof updateSettingsBodySchema>>(request);
    const data = await updateSystemSettingsByPrefix({
      actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
      prefix,
      settings: body.settings
    });
    return sendSuccess(response, { data });
  });

const getDashboardSystemHealth = asyncHandler(async (_request, response) => {
  const data = await getReadinessSnapshot();
  return sendSuccess(response, { data });
});

router.get("/admin/products", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ query: adminCatalogListQuerySchema }), listAdminCatalogProducts);
router.post("/admin/products", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ body: createProductBodySchema }), createAdminCatalogProduct);
router.get("/admin/products/:productId", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ params: productIdParamsSchema }), getAdminCatalogProduct);
router.patch("/admin/products/:productId", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: productIdParamsSchema, body: updateProductBodySchema }), updateAdminCatalogProduct);
router.post("/admin/products/:productId/publish", requireAdminActor, requirePermissions(["catalog.products.publish"]), validateRequest({ params: productIdParamsSchema, body: productMutationBodySchema }), publishAdminCatalogProduct);
router.post("/admin/products/:productId/unpublish", requireAdminActor, requirePermissions(["catalog.products.publish"]), validateRequest({ params: productIdParamsSchema, body: productMutationBodySchema }), unpublishAdminCatalogProduct);
router.post("/admin/products/:productId/archive", requireAdminActor, requirePermissions(["catalog.products.publish"]), validateRequest({ params: productIdParamsSchema, body: productMutationBodySchema }), archiveAdminCatalogProduct);
router.get(
  "/admin/products/:productId/analytics",
  requireAdminActor,
  requirePermissions(["catalog.products.read"]),
  validateRequest({ params: productIdParamsSchema, query: adminProductAnalyticsQuerySchema }),
  getAdminCatalogProductAnalytics
);
router.get("/admin/products/:productId/variants", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ params: productIdParamsSchema }), listAdminCatalogProductVariants);
router.post("/admin/products/:productId/variants", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: productIdParamsSchema, body: createVariantBodySchema }), createAdminCatalogProductVariant);
router.patch("/admin/products/:productId/variants/:variantId", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: variantIdParamsSchema, body: updateVariantBodySchema }), updateAdminCatalogVariant);
router.get("/admin/products/:productId/media", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ params: productIdParamsSchema }), listAdminCatalogProductMedia);
router.post("/admin/products/:productId/media", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: productIdParamsSchema, body: createMediaBodySchema }), createAdminCatalogProductMedia);
router.patch("/admin/products/:productId/media/reorder", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: productIdParamsSchema, body: reorderProductMediaBodySchema }), reorderAdminCatalogProductMedia);
router.delete("/admin/products/:productId/media/:mediaId", requireAdminActor, requirePermissions(["catalog.products.write"]), validateRequest({ params: mediaIdParamsSchema }), deleteAdminCatalogProductMedia);
router.get("/admin/products/:productId/pricing", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ params: productIdParamsSchema }), getAdminCatalogProductPricing);
router.patch("/admin/products/:productId/pricing", requireAdminActor, requirePermissions(["catalog.products.change_price"]), validateRequest({ params: productIdParamsSchema, body: updateProductPricingBodySchema }), updateAdminCatalogProductPricing);
router.get("/admin/products/:productId/inventory-summary", requireAdminActor, requirePermissions(["catalog.products.read"]), validateRequest({ params: productIdParamsSchema }), getAdminCatalogProductInventorySummary);

router.get(
  "/admin/categories",
  requireAdminActor,
  requirePermissions(["catalog.categories.read"]),
  validateRequest({ query: adminTaxonomyListQuerySchema }),
  listAdminCatalogCategories
);
router.post("/admin/categories", requireAdminActor, requirePermissions(["catalog.categories.write"]), validateRequest({ body: createCategoryBodySchema }), createAdminCatalogCategory);
router.patch("/admin/categories/:categoryId", requireAdminActor, requirePermissions(["catalog.categories.write"]), validateRequest({ params: categoryIdParamsSchema, body: updateCategoryBodySchema }), updateAdminCatalogCategory);
router.post("/admin/categories/:categoryId/archive", requireAdminActor, requirePermissions(["catalog.categories.write"]), validateRequest({ params: categoryIdParamsSchema, body: productMutationBodySchema }), archiveAdminCatalogCategory);
router.post(
  "/admin/categories/:categoryId/publish",
  requireAdminActor,
  requirePermissions(["catalog.categories.write"]),
  validateRequest({ params: categoryIdParamsSchema, body: productMutationBodySchema }),
  publishAdminCatalogCategory
);
router.post(
  "/admin/categories/:categoryId/unpublish",
  requireAdminActor,
  requirePermissions(["catalog.categories.write"]),
  validateRequest({ params: categoryIdParamsSchema, body: productMutationBodySchema }),
  unpublishAdminCatalogCategory
);
router.post(
  "/admin/categories/:categoryId/restore",
  requireAdminActor,
  requirePermissions(["catalog.categories.write"]),
  validateRequest({ params: categoryIdParamsSchema, body: productMutationBodySchema }),
  restoreAdminCatalogCategory
);

router.get(
  "/admin/brands",
  requireAdminActor,
  requirePermissions(["catalog.brands.read"]),
  validateRequest({ query: adminTaxonomyListQuerySchema }),
  listAdminCatalogBrands
);
router.post("/admin/brands", requireAdminActor, requirePermissions(["catalog.brands.write"]), validateRequest({ body: createBrandBodySchema }), createAdminCatalogBrand);
router.patch("/admin/brands/:brandId", requireAdminActor, requirePermissions(["catalog.brands.write"]), validateRequest({ params: brandIdParamsSchema, body: updateBrandBodySchema }), updateAdminCatalogBrand);
router.post("/admin/brands/:brandId/archive", requireAdminActor, requirePermissions(["catalog.brands.write"]), validateRequest({ params: brandIdParamsSchema, body: productMutationBodySchema }), archiveAdminCatalogBrand);
router.post(
  "/admin/brands/:brandId/publish",
  requireAdminActor,
  requirePermissions(["catalog.brands.write"]),
  validateRequest({ params: brandIdParamsSchema, body: productMutationBodySchema }),
  publishAdminCatalogBrand
);
router.post(
  "/admin/brands/:brandId/unpublish",
  requireAdminActor,
  requirePermissions(["catalog.brands.write"]),
  validateRequest({ params: brandIdParamsSchema, body: productMutationBodySchema }),
  unpublishAdminCatalogBrand
);
router.post(
  "/admin/brands/:brandId/restore",
  requireAdminActor,
  requirePermissions(["catalog.brands.write"]),
  validateRequest({ params: brandIdParamsSchema, body: productMutationBodySchema }),
  restoreAdminCatalogBrand
);

router.get("/admin/reviews", requireAdminActor, requirePermissions(["reviews.moderate"]), validateRequest({ query: adminReviewsQuerySchema }), listReviewsAdmin);
router.get("/admin/reviews/:reviewId", requireAdminActor, requirePermissions(["reviews.moderate"]), validateRequest({ params: reviewIdParamsSchema }), getReviewAdmin);
router.post("/admin/reviews/:reviewId/publish", requireAdminActor, requirePermissions(["reviews.moderate"]), validateRequest({ params: reviewIdParamsSchema, body: reviewActionBodySchema }), moderateReviewWithStatus(ReviewStatus.PUBLISHED));
router.post("/admin/reviews/:reviewId/hide", requireAdminActor, requirePermissions(["reviews.moderate"]), validateRequest({ params: reviewIdParamsSchema, body: reviewActionBodySchema }), moderateReviewWithStatus(ReviewStatus.HIDDEN));
router.post("/admin/reviews/:reviewId/reject", requireAdminActor, requirePermissions(["reviews.moderate"]), validateRequest({ params: reviewIdParamsSchema, body: reviewActionBodySchema }), moderateReviewWithStatus(ReviewStatus.REJECTED));

router.get("/admin/banners", requireAdminActor, requirePermissions(["content.pages.read"]), listBannersAdmin);
router.post("/admin/banners", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ body: createBannerBodySchema }), createBannerAdmin);
router.patch("/admin/banners/:bannerId", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ params: bannerIdParamsSchema, body: updateBannerBodySchema }), updateBannerAdmin);
router.post("/admin/banners/:bannerId/publish", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ params: bannerIdParamsSchema, body: contentMutationBodySchema }), publishBannerAdmin);
router.post("/admin/banners/:bannerId/unpublish", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ params: bannerIdParamsSchema, body: contentMutationBodySchema }), unpublishBannerAdmin);
router.delete("/admin/banners/:bannerId", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ params: bannerIdParamsSchema }), deleteBannerAdmin);

router.get("/admin/cms/pages", requireAdminActor, requirePermissions(["content.pages.read"]), listPagesAdmin);
router.post("/admin/cms/pages", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ body: createPageBodySchema }), createPageAdmin);
router.get("/admin/cms/pages/:pageId", requireAdminActor, requirePermissions(["content.pages.read"]), validateRequest({ params: pageIdParamsSchema }), getPageAdmin);
router.patch("/admin/cms/pages/:pageId", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ params: pageIdParamsSchema, body: updatePageBodySchema }), updatePageAdmin);
router.post("/admin/cms/pages/:pageId/publish", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ params: pageIdParamsSchema, body: contentMutationBodySchema }), publishPageAdmin);
router.post("/admin/cms/pages/:pageId/unpublish", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ params: pageIdParamsSchema, body: contentMutationBodySchema }), unpublishPageAdmin);
router.post("/admin/cms/pages/:pageId/archive", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ params: pageIdParamsSchema, body: contentMutationBodySchema }), archivePageAdmin);
router.post("/admin/cms/pages/:pageId/restore", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ params: pageIdParamsSchema, body: contentMutationBodySchema }), restorePageAdmin);
router.delete("/admin/cms/pages/:pageId", requireAdminActor, requirePermissions(["content.pages.write"]), validateRequest({ params: pageIdParamsSchema }), deletePagePermanentAdmin);

router.get("/admin/warehouses", requireAdminActor, requirePermissions(["inventory.read"]), listAdminWarehouses);
router.post("/admin/warehouses", requireAdminActor, requirePermissions(["inventory.manage_warehouses"]), validateRequest({ body: createWarehouseBodySchema }), createAdminWarehouse);
router.get("/admin/warehouses/:warehouseId", requireAdminActor, requirePermissions(["inventory.read"]), validateRequest({ params: warehouseIdParamsSchema }), getAdminWarehouse);
router.patch("/admin/warehouses/:warehouseId", requireAdminActor, requirePermissions(["inventory.manage_warehouses"]), validateRequest({ params: warehouseIdParamsSchema, body: updateWarehouseBodySchema }), updateAdminWarehouse);
router.get("/admin/warehouses/:warehouseId/inventory", requireAdminActor, requirePermissions(["inventory.read"]), validateRequest({ params: warehouseIdParamsSchema }), getAdminWarehouse);

router.post("/admin/orders/:orderId/create-shipment", requireAdminActor, requirePermissions(["orders.override_fulfillment"]), validateRequest({ params: shippingOrderIdParamsSchema, body: createShipmentBodySchema }), createShipmentAdmin);
router.get("/admin/shipments/:shipmentId", requireAdminActor, requirePermissions(["orders.read"]), validateRequest({ params: shipmentIdParamsSchema }), getShipmentAdmin);
router.get("/admin/shipments/:shipmentId/tracking", requireAdminActor, requirePermissions(["orders.read"]), validateRequest({ params: shipmentIdParamsSchema }), getShipmentTrackingAdmin);
router.post("/admin/shipments/:shipmentId/tracking", requireAdminActor, requirePermissions(["orders.override_fulfillment"]), validateRequest({ params: shipmentIdParamsSchema, body: createTrackingEventBodySchema }), createShipmentTrackingEventAdmin);

router.post("/admin/support/tickets/:ticketId/reply", requireAdminActor, requirePermissions(["support.reply"]), validateRequest({ params: ticketIdParamsSchema, body: createTicketMessageBodySchema }), createTicketMessageAdmin);
router.post("/admin/support/tickets/:ticketId/csat", requireAdminActor, requirePermissions(["support.reply"]), validateRequest({ params: ticketIdParamsSchema, body: recordSupportTicketCsatBodySchema }), recordTicketCsatAdmin);
router.post("/admin/support/tickets/:ticketId/internal-note", requireAdminActor, requirePermissions(["support.reply"]), validateRequest({ params: ticketIdParamsSchema, body: createInternalNoteBodySchema }), createInternalNoteAdmin);
router.get("/admin/support/queue", requireAdminActor, requirePermissions(["support.read"]), validateRequest({ query: adminTicketsQuerySchema }), listTicketsAdmin);
router.get("/admin/support/pre-purchase", requireAdminActor, requirePermissions(["support.read"]), validateRequest({ query: adminTicketsQuerySchema }), getSupportPrePurchaseQueueAdmin);
router.get("/admin/support/complaints", requireAdminActor, requirePermissions(["support.read"]), validateRequest({ query: adminTicketsQuerySchema }), getSupportComplaintsQueueAdmin);
router.get("/admin/support/analytics", requireAdminActor, requirePermissions(["support.read"]), getSupportReportsAdmin);

router.get(
  "/admin/dashboard/overview",
  requireAdminActor,
  requirePermissions(["reports.read"]),
  validateRequest({ query: reportsDateRangeQuerySchema }),
  getDashboardAdmin
);
router.get("/admin/dashboard/support", requireAdminActor, requirePermissions(["reports.read"]), validateRequest({ query: reportsDateRangeQuerySchema }), getSupportAdmin);
router.get("/admin/dashboard/system-health", requireAdminActor, requirePermissions(["reports.read"]), getDashboardSystemHealth);
router.get("/admin/dashboard/recent-activity", requireAdminActor, requirePermissions(["security.audit.read"]), validateRequest({ query: timelineQuerySchema }), listTimelineAdmin);

router.get("/admin/settings/reviews", requireAdminActor, requirePermissions(["settings.read"]), getScopedSettings("reviews."));
router.patch("/admin/settings/reviews", requireAdminActor, requirePermissions(["settings.write"]), validateRequest({ body: updateSettingsBodySchema }), updateScopedSettings("reviews."));
router.get("/admin/settings/support", requireAdminActor, requirePermissions(["settings.read"]), getScopedSettings("support."));
router.patch("/admin/settings/support", requireAdminActor, requirePermissions(["settings.write"]), validateRequest({ body: updateSettingsBodySchema }), updateScopedSettings("support."));

export const adminCompatRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/admin/products", summary: "Compatibility alias for the admin product list contract.", tags: ["admin-compat", "catalog"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/categories", summary: "Compatibility alias for the admin category list contract.", tags: ["admin-compat", "catalog"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/brands", summary: "Compatibility alias for the admin brand list contract.", tags: ["admin-compat", "catalog"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/reviews", summary: "Compatibility alias for the admin review moderation contract.", tags: ["admin-compat", "reviews"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/banners", summary: "Compatibility alias for the admin banner contract.", tags: ["admin-compat", "content"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/cms/pages", summary: "Compatibility alias for the admin CMS contract.", tags: ["admin-compat", "content"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/warehouses", summary: "Compatibility alias for the admin warehouse contract.", tags: ["admin-compat", "inventory"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/support/queue", summary: "Compatibility alias for the admin support queue contract.", tags: ["admin-compat", "support"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/dashboard/overview", summary: "Compatibility alias for executive dashboard overview KPIs.", tags: ["admin-compat", "dashboard"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/dashboard/support", summary: "Compatibility alias for the admin support dashboard contract.", tags: ["admin-compat", "dashboard"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/dashboard/system-health", summary: "Compatibility alias for the admin system-health dashboard contract.", tags: ["admin-compat", "dashboard"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/dashboard/recent-activity", summary: "Compatibility alias for the admin recent-activity dashboard contract.", tags: ["admin-compat", "dashboard"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/settings/reviews", summary: "Compatibility alias for admin review settings.", tags: ["admin-compat", "settings"], auth: "admin" },
    { method: "GET", path: "/api/v1/admin/settings/support", summary: "Compatibility alias for admin support settings.", tags: ["admin-compat", "settings"], auth: "admin" }
  ]
};
