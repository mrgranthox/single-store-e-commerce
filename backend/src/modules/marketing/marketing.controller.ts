import { z } from "zod";

import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
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
import {
  createAdminCampaign,
  createAdminCoupon,
  createAdminPromotion,
  createAdminPromotionRule,
  deleteAdminCoupon,
  deleteAdminPromotion,
  deleteAdminPromotionRule,
  getAdminCampaignPerformance,
  getAdminCouponAnalytics,
  getAdminPromotionDetail,
  getOrCreateGlobalRulesPromotion,
  getPromotionPulseMetrics,
  listAdminPromotionRules,
  listAdminCampaigns,
  listAdminCoupons,
  listAdminPromotions,
  updateAdminCampaign,
  updateAdminCoupon,
  updateAdminPromotion,
  updateAdminPromotionRule
} from "./marketing.service";

export const listCouponsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminCouponsQuerySchema>>(request);
  const data = await listAdminCoupons(query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});

export const createCouponAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createCouponBodySchema>>(request);
  const data = await createAdminCoupon({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });
  return sendSuccess(response, { statusCode: 201, data });
});

export const updateCouponAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof couponIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateCouponBodySchema>>(request);
  const data = await updateAdminCoupon({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    couponId: params.couponId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const disableCouponAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof couponIdParamsSchema>>(request);
  const data = await updateAdminCoupon({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    couponId: params.couponId,
    status: "DISABLED"
  });
  return sendSuccess(response, { data });
});

export const deleteCouponAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof couponIdParamsSchema>>(request);
  const data = await deleteAdminCoupon({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    couponId: params.couponId
  });
  return sendSuccess(response, { data });
});

export const getCouponAnalyticsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminCouponAnalyticsQuerySchema>>(request);
  const data = await getAdminCouponAnalytics(query);
  return sendSuccess(response, { data });
});

export const listPromotionsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminPromotionsQuerySchema>>(request);
  const [data, pulse] = await Promise.all([listAdminPromotions(query), getPromotionPulseMetrics()]);
  return sendSuccess(response, { data: { items: data.items }, meta: { ...data.pagination, pulse } });
});

export const createPromotionAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createPromotionBodySchema>>(request);
  const data = await createAdminPromotion({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });
  return sendSuccess(response, { statusCode: 201, data });
});

export const updatePromotionAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof promotionIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updatePromotionBodySchema>>(request);
  const data = await updateAdminPromotion({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    promotionId: params.promotionId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const getPromotionAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof promotionIdParamsSchema>>(request);
  const data = await getAdminPromotionDetail(params.promotionId);
  return sendSuccess(response, { data });
});

export const listPromotionRulesAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof promotionIdParamsSchema>>(request);
  const data = await listAdminPromotionRules(params.promotionId);
  return sendSuccess(response, { data });
});

export const createPromotionRuleAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof promotionIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof promotionRuleSchema>>(request);
  const data = await createAdminPromotionRule({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    promotionId: params.promotionId,
    ...body
  });
  return sendSuccess(response, { statusCode: 201, data });
});

export const updatePromotionRuleAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof promotionRuleIdParamsSchema>>(request);
  const body = readValidatedBody<Partial<z.infer<typeof promotionRuleSchema>>>(request);
  const data = await updateAdminPromotionRule({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    promotionId: params.promotionId,
    ruleId: params.ruleId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const deletePromotionRuleAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof promotionRuleIdParamsSchema>>(request);
  const data = await deleteAdminPromotionRule({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    promotionId: params.promotionId,
    ruleId: params.ruleId
  });
  return sendSuccess(response, { data });
});

export const deletePromotionAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof promotionIdParamsSchema>>(request);
  const data = await deleteAdminPromotion({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    promotionId: params.promotionId
  });
  return sendSuccess(response, { data });
});

export const getGlobalRulesPromotionContainerAdmin = asyncHandler(async (request, response) => {
  const data = await getOrCreateGlobalRulesPromotion({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId)
  });
  return sendSuccess(response, { data });
});

export const listCampaignsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminCampaignsQuerySchema>>(request);
  const data = await listAdminCampaigns(query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});

export const createCampaignAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createCampaignBodySchema>>(request);
  const data = await createAdminCampaign({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });
  return sendSuccess(response, { statusCode: 201, data });
});

export const updateCampaignAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof campaignIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateCampaignBodySchema>>(request);
  const data = await updateAdminCampaign({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    campaignId: params.campaignId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const getCampaignPerformanceAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminCampaignPerformanceQuerySchema>>(request);
  const data = await getAdminCampaignPerformance(query);
  return sendSuccess(response, { data });
});
