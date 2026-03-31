import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  createCampaignAdmin,
  createCouponAdmin,
  createPromotionRuleAdmin,
  createPromotionAdmin,
  deleteCouponAdmin,
  deletePromotionAdmin,
  deletePromotionRuleAdmin,
  disableCouponAdmin,
  getCampaignPerformanceAdmin,
  getCouponAnalyticsAdmin,
  getGlobalRulesPromotionContainerAdmin,
  getPromotionAdmin,
  listPromotionRulesAdmin,
  listCampaignsAdmin,
  listCouponsAdmin,
  listPromotionsAdmin,
  updateCampaignAdmin,
  updateCouponAdmin,
  updatePromotionAdmin,
  updatePromotionRuleAdmin
} from "./marketing.controller";
import {
  adminCampaignPerformanceQuerySchema,
  adminCampaignsQuerySchema,
  adminCouponAnalyticsQuerySchema,
  adminCouponsQuerySchema,
  adminPromotionsQuerySchema,
  campaignIdParamsSchema,
  couponIdParamsSchema,
  createCampaignBodySchema,
  createCouponBodySchema,
  createPromotionBodySchema,
  promotionIdParamsSchema,
  promotionRuleIdParamsSchema,
  promotionRuleSchema,
  updateCampaignBodySchema,
  updateCouponBodySchema,
  updatePromotionBodySchema
} from "./marketing.schemas";

const router = Router();

router.get(
  "/admin/marketing/coupons",
  requireAdminActor,
  requirePermissions(["marketing.coupons.read"]),
  validateRequest({ query: adminCouponsQuerySchema }),
  listCouponsAdmin
);
router.post(
  "/admin/marketing/coupons",
  requireAdminActor,
  requirePermissions(["marketing.coupons.write"]),
  validateRequest({ body: createCouponBodySchema }),
  createCouponAdmin
);
router.patch(
  "/admin/marketing/coupons/:couponId",
  requireAdminActor,
  requirePermissions(["marketing.coupons.write"]),
  validateRequest({ params: couponIdParamsSchema, body: updateCouponBodySchema }),
  updateCouponAdmin
);
router.post(
  "/admin/marketing/coupons/:couponId/disable",
  requireAdminActor,
  requirePermissions(["marketing.coupons.write"]),
  validateRequest({ params: couponIdParamsSchema }),
  disableCouponAdmin
);
router.delete(
  "/admin/marketing/coupons/:couponId",
  requireAdminActor,
  requirePermissions(["marketing.coupons.write"]),
  validateRequest({ params: couponIdParamsSchema }),
  deleteCouponAdmin
);
router.get(
  "/admin/coupons",
  requireAdminActor,
  requirePermissions(["marketing.coupons.read"]),
  validateRequest({ query: adminCouponsQuerySchema }),
  listCouponsAdmin
);
router.post(
  "/admin/coupons",
  requireAdminActor,
  requirePermissions(["marketing.coupons.write"]),
  validateRequest({ body: createCouponBodySchema }),
  createCouponAdmin
);
router.patch(
  "/admin/coupons/:couponId",
  requireAdminActor,
  requirePermissions(["marketing.coupons.write"]),
  validateRequest({ params: couponIdParamsSchema, body: updateCouponBodySchema }),
  updateCouponAdmin
);
router.post(
  "/admin/coupons/:couponId/disable",
  requireAdminActor,
  requirePermissions(["marketing.coupons.write"]),
  validateRequest({ params: couponIdParamsSchema }),
  disableCouponAdmin
);
router.delete(
  "/admin/coupons/:couponId",
  requireAdminActor,
  requirePermissions(["marketing.coupons.write"]),
  validateRequest({ params: couponIdParamsSchema }),
  deleteCouponAdmin
);
router.get(
  "/admin/coupons/analytics",
  requireAdminActor,
  requirePermissions(["marketing.coupons.read"]),
  validateRequest({ query: adminCouponAnalyticsQuerySchema }),
  getCouponAnalyticsAdmin
);

router.get(
  "/admin/marketing/promotions",
  requireAdminActor,
  requirePermissions(["marketing.promotions.read"]),
  validateRequest({ query: adminPromotionsQuerySchema }),
  listPromotionsAdmin
);
router.get(
  "/admin/marketing/promotions/global/rules-container",
  requireAdminActor,
  requirePermissions(["marketing.promotions.read"]),
  getGlobalRulesPromotionContainerAdmin
);
router.post(
  "/admin/marketing/promotions",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ body: createPromotionBodySchema }),
  createPromotionAdmin
);
router.patch(
  "/admin/marketing/promotions/:promotionId",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ params: promotionIdParamsSchema, body: updatePromotionBodySchema }),
  updatePromotionAdmin
);
router.delete(
  "/admin/marketing/promotions/:promotionId",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ params: promotionIdParamsSchema }),
  deletePromotionAdmin
);
router.delete(
  "/admin/marketing/promotions/:promotionId/rules/:ruleId",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ params: promotionRuleIdParamsSchema }),
  deletePromotionRuleAdmin
);
router.get(
  "/admin/promotions",
  requireAdminActor,
  requirePermissions(["marketing.promotions.read"]),
  validateRequest({ query: adminPromotionsQuerySchema }),
  listPromotionsAdmin
);
router.post(
  "/admin/promotions",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ body: createPromotionBodySchema }),
  createPromotionAdmin
);
router.get(
  "/admin/promotions/global/rules-container",
  requireAdminActor,
  requirePermissions(["marketing.promotions.read"]),
  getGlobalRulesPromotionContainerAdmin
);
router.get(
  "/admin/promotions/:promotionId",
  requireAdminActor,
  requirePermissions(["marketing.promotions.read"]),
  validateRequest({ params: promotionIdParamsSchema }),
  getPromotionAdmin
);
router.patch(
  "/admin/promotions/:promotionId",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ params: promotionIdParamsSchema, body: updatePromotionBodySchema }),
  updatePromotionAdmin
);
router.delete(
  "/admin/promotions/:promotionId",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ params: promotionIdParamsSchema }),
  deletePromotionAdmin
);
router.get(
  "/admin/promotions/:promotionId/rules",
  requireAdminActor,
  requirePermissions(["marketing.promotions.read"]),
  validateRequest({ params: promotionIdParamsSchema }),
  listPromotionRulesAdmin
);
router.post(
  "/admin/promotions/:promotionId/rules",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ params: promotionIdParamsSchema, body: promotionRuleSchema }),
  createPromotionRuleAdmin
);
router.patch(
  "/admin/promotions/:promotionId/rules/:ruleId",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ params: promotionRuleIdParamsSchema, body: promotionRuleSchema.partial() }),
  updatePromotionRuleAdmin
);
router.delete(
  "/admin/promotions/:promotionId/rules/:ruleId",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ params: promotionRuleIdParamsSchema }),
  deletePromotionRuleAdmin
);

router.get(
  "/admin/marketing/campaigns",
  requireAdminActor,
  requirePermissions(["marketing.promotions.read"]),
  validateRequest({ query: adminCampaignsQuerySchema }),
  listCampaignsAdmin
);
router.post(
  "/admin/marketing/campaigns",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ body: createCampaignBodySchema }),
  createCampaignAdmin
);
router.patch(
  "/admin/marketing/campaigns/:campaignId",
  requireAdminActor,
  requirePermissions(["marketing.promotions.write"]),
  validateRequest({ params: campaignIdParamsSchema, body: updateCampaignBodySchema }),
  updateCampaignAdmin
);
router.get(
  "/admin/campaigns/performance",
  requireAdminActor,
  requirePermissions(["marketing.promotions.read"]),
  validateRequest({ query: adminCampaignPerformanceQuerySchema }),
  getCampaignPerformanceAdmin
);

export const marketingRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/admin/marketing/coupons", summary: "List coupons.", tags: ["marketing"], auth: "admin", permissions: ["marketing.coupons.read"] },
    { method: "POST", path: "/api/v1/admin/marketing/coupons", summary: "Create a coupon.", tags: ["marketing"], auth: "admin", permissions: ["marketing.coupons.write"] },
    { method: "PATCH", path: "/api/v1/admin/marketing/coupons/:couponId", summary: "Update a coupon.", tags: ["marketing"], auth: "admin", permissions: ["marketing.coupons.write"] },
    { method: "POST", path: "/api/v1/admin/marketing/coupons/:couponId/disable", summary: "Disable a coupon.", tags: ["marketing"], auth: "admin", permissions: ["marketing.coupons.write"] },
    { method: "DELETE", path: "/api/v1/admin/marketing/coupons/:couponId", summary: "Delete a coupon with no redemptions.", tags: ["marketing"], auth: "admin", permissions: ["marketing.coupons.write"] },
    { method: "GET", path: "/api/v1/admin/marketing/promotions", summary: "List promotions.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.read"] },
    { method: "POST", path: "/api/v1/admin/marketing/promotions", summary: "Create a promotion.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "PATCH", path: "/api/v1/admin/marketing/promotions/:promotionId", summary: "Update a promotion.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "DELETE", path: "/api/v1/admin/marketing/promotions/:promotionId", summary: "Delete a promotion.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "GET", path: "/api/v1/admin/marketing/promotions/global/rules-container", summary: "Get or create the global rules promotion id.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.read"] },
    { method: "DELETE", path: "/api/v1/admin/marketing/promotions/:promotionId/rules/:ruleId", summary: "Delete a promotion rule.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "GET", path: "/api/v1/admin/marketing/campaigns", summary: "List campaigns.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.read"] },
    { method: "POST", path: "/api/v1/admin/marketing/campaigns", summary: "Create a campaign.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "PATCH", path: "/api/v1/admin/marketing/campaigns/:campaignId", summary: "Update a campaign.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "GET", path: "/api/v1/admin/coupons", summary: "List coupons through the plain admin contract.", tags: ["marketing"], auth: "admin", permissions: ["marketing.coupons.read"] },
    { method: "POST", path: "/api/v1/admin/coupons", summary: "Create a coupon through the plain admin contract.", tags: ["marketing"], auth: "admin", permissions: ["marketing.coupons.write"] },
    { method: "PATCH", path: "/api/v1/admin/coupons/:couponId", summary: "Update a coupon through the plain admin contract.", tags: ["marketing"], auth: "admin", permissions: ["marketing.coupons.write"] },
    { method: "POST", path: "/api/v1/admin/coupons/:couponId/disable", summary: "Disable a coupon.", tags: ["marketing"], auth: "admin", permissions: ["marketing.coupons.write"] },
    { method: "DELETE", path: "/api/v1/admin/coupons/:couponId", summary: "Delete a coupon with no redemptions.", tags: ["marketing"], auth: "admin", permissions: ["marketing.coupons.write"] },
    { method: "GET", path: "/api/v1/admin/coupons/analytics", summary: "Fetch coupon analytics.", tags: ["marketing"], auth: "admin", permissions: ["marketing.coupons.read"] },
    { method: "GET", path: "/api/v1/admin/promotions", summary: "List promotions through the plain admin contract.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.read"] },
    { method: "POST", path: "/api/v1/admin/promotions", summary: "Create a promotion through the plain admin contract.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "GET", path: "/api/v1/admin/promotions/:promotionId", summary: "Fetch promotion detail.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.read"] },
    { method: "PATCH", path: "/api/v1/admin/promotions/:promotionId", summary: "Update a promotion through the plain admin contract.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "GET", path: "/api/v1/admin/promotions/:promotionId/rules", summary: "List promotion rules.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.read"] },
    { method: "POST", path: "/api/v1/admin/promotions/:promotionId/rules", summary: "Create a promotion rule.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "PATCH", path: "/api/v1/admin/promotions/:promotionId/rules/:ruleId", summary: "Update a promotion rule.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "DELETE", path: "/api/v1/admin/promotions/:promotionId/rules/:ruleId", summary: "Delete a promotion rule.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "GET", path: "/api/v1/admin/promotions/global/rules-container", summary: "Get or create the global rules promotion id.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.read"] },
    { method: "DELETE", path: "/api/v1/admin/promotions/:promotionId", summary: "Delete a promotion.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.write"] },
    { method: "GET", path: "/api/v1/admin/campaigns/performance", summary: "Fetch campaign performance data.", tags: ["marketing"], auth: "admin", permissions: ["marketing.promotions.read"] }
  ]
};
