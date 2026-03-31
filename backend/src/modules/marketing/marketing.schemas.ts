import { CouponStatus, PromotionStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

const optionalDateSchema = z.coerce.date().optional();
const jsonRecordSchema = z.record(z.string(), z.unknown());

export const couponIdParamsSchema = z.object({
  couponId: z.string().uuid()
});

export const promotionIdParamsSchema = z.object({
  promotionId: z.string().uuid()
});

export const promotionRuleIdParamsSchema = z.object({
  promotionId: z.string().uuid(),
  ruleId: z.string().uuid()
});

export const campaignIdParamsSchema = z.object({
  campaignId: z.string().uuid()
});

export const adminCouponsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(CouponStatus).optional(),
  q: z.string().trim().min(1).max(160).optional(),
  discount_type: z.string().trim().min(1).max(80).optional(),
  active_from: z.coerce.date().optional(),
  active_to: z.coerce.date().optional(),
  /** 0–100: min share of max redemptions used (capped coupons only unless min is 0). */
  usage_ratio_min: z.coerce.number().min(0).max(100).optional(),
  usage_ratio_max: z.coerce.number().min(0).max(100).optional()
});

export const createCouponBodySchema = z.object({
  code: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase()),
  status: z.nativeEnum(CouponStatus).default(CouponStatus.ACTIVE),
  activeFrom: optionalDateSchema,
  activeTo: optionalDateSchema,
  discountType: z.string().trim().min(1).max(80),
  discountValue: z.coerce.number().int().min(0).optional(),
  minOrderAmountCents: z.coerce.number().int().min(0).optional(),
  maxRedemptions: z.coerce.number().int().min(1).optional(),
  perCustomerLimit: z.coerce.number().int().min(1).optional(),
  bannerId: z.string().uuid().optional()
});

export const updateCouponBodySchema = createCouponBodySchema.partial().omit({
  code: true
}).extend({
  bannerId: z.string().uuid().nullable().optional()
});

export const promotionRuleSchema = z.object({
  ruleType: z.string().trim().min(1).max(80),
  targeting: jsonRecordSchema,
  minOrderAmountCents: z.coerce.number().int().min(0).optional()
});

export const adminPromotionsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(PromotionStatus).optional(),
  q: z.string().trim().min(1).max(160).optional()
});

export const createPromotionBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  status: z.nativeEnum(PromotionStatus).default(PromotionStatus.ACTIVE),
  activeFrom: optionalDateSchema,
  activeTo: optionalDateSchema,
  rules: z.array(promotionRuleSchema).default([]),
  bannerId: z.string().uuid().optional()
});

export const updatePromotionBodySchema = createPromotionBodySchema.partial().extend({
  bannerId: z.string().uuid().nullable().optional()
});

export const adminCampaignsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(PromotionStatus).optional(),
  q: z.string().trim().min(1).max(160).optional()
});

export const adminCouponAnalyticsQuerySchema = z.object({
  period_days: z.coerce.number().int().min(1).max(366).default(30),
  abuse_threshold: z.coerce.number().int().min(2).max(500).default(10)
});

export const adminCampaignPerformanceQuerySchema = z.object({
  period: z.enum(["24h", "7d", "30d", "all"]).default("30d")
});

export const createCampaignBodySchema = z.object({
  slug: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(160),
  status: z.nativeEnum(PromotionStatus).default(PromotionStatus.ACTIVE),
  promotionId: z.string().uuid().optional(),
  costCents: z.coerce.number().int().min(0).nullable().optional()
});

export const updateCampaignBodySchema = createCampaignBodySchema.partial().omit({
  slug: true
});
