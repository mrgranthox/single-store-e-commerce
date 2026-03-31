import { apiRequest, ApiError } from "@/lib/api/http";

export type LinkedBannerRef = {
  id: string;
  title: string | null;
  mediaUrl: string | null;
  placement: string;
  status: string;
};

export type CouponListItem = {
  id: string;
  code: string;
  status: string;
  activeFrom: string | null;
  activeTo: string | null;
  discountType: string;
  discountValue: number | null;
  minOrderAmountCents: number | null;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
  redemptionCount: number;
  bannerId?: string | null;
  linkedBanner?: LinkedBannerRef | null;
  createdAt: string;
  updatedAt: string;
};

export type ListAdminCouponsQuery = {
  page?: number;
  page_size?: number;
  status?: string;
  q?: string;
  discount_type?: string;
  /** YYYY-MM-DD */
  active_from?: string;
  /** YYYY-MM-DD */
  active_to?: string;
  usage_ratio_min?: number;
  usage_ratio_max?: number;
};

const couponsQuery = (query: ListAdminCouponsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.discount_type?.trim()) {
    params.set("discount_type", query.discount_type.trim());
  }
  if (query.active_from?.trim()) {
    params.set("active_from", query.active_from.trim());
  }
  if (query.active_to?.trim()) {
    params.set("active_to", query.active_to.trim());
  }
  if (query.usage_ratio_min != null) {
    params.set("usage_ratio_min", String(query.usage_ratio_min));
  }
  if (query.usage_ratio_max != null) {
    params.set("usage_ratio_max", String(query.usage_ratio_max));
  }
  return `?${params.toString()}`;
};

export type AdminCouponsListResponse = {
  success: true;
  data: { items: CouponListItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminCoupons = async (
  accessToken: string,
  query: ListAdminCouponsQuery = {}
): Promise<AdminCouponsListResponse> =>
  apiRequest<AdminCouponsListResponse>({
    path: `/api/admin/marketing/coupons${couponsQuery(query)}`,
    accessToken
  });

export type CouponAnalyticsDaily = { date: string; count: number };

export type CouponAnalyticsTopRow = {
  couponId: string;
  code: string;
  discountType: string;
  redemptionCount: number;
  estimatedDiscountCents: number;
};

export type CouponAnalyticsAbuseRow = {
  userId: string;
  redemptionCount: number;
  lastRedeemedAt: string;
};

export type CouponAnalyticsData = {
  statusCounts: { status: string; count: number }[];
  redemptionCount: number;
  lifetimeEstimatedDiscountCents: number;
  averageUsageRatePercent: number | null;
  window: { days: number; from: string; to: string };
  redemptionsInPeriod: number;
  dailyRedemptions: CouponAnalyticsDaily[];
  estimatedDiscountGivenCentsInPeriod: number;
  estimatedRevenueAttributedCentsInPeriod: number;
  averageOrderValueCouponCentsInPeriod: number | null;
  topCouponsInPeriod: CouponAnalyticsTopRow[];
  abuseSignals: CouponAnalyticsAbuseRow[];
};

export type CouponAnalyticsQuery = {
  period_days?: number;
  abuse_threshold?: number;
};

export type CouponAnalyticsResponse = {
  success: true;
  data: CouponAnalyticsData;
};

const couponAnalyticsQuery = (query: CouponAnalyticsQuery = {}) => {
  const p = new URLSearchParams();
  if (query.period_days != null) {
    p.set("period_days", String(query.period_days));
  }
  if (query.abuse_threshold != null) {
    p.set("abuse_threshold", String(query.abuse_threshold));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const getAdminCouponAnalytics = async (
  accessToken: string,
  query: CouponAnalyticsQuery = {}
): Promise<CouponAnalyticsResponse> =>
  apiRequest<CouponAnalyticsResponse>({
    path: `/api/admin/coupons/analytics${couponAnalyticsQuery(query)}`,
    accessToken
  });

export const disableAdminCoupon = async (
  accessToken: string,
  couponId: string
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/marketing/coupons/${encodeURIComponent(couponId)}/disable`,
    accessToken,
    body: {}
  });

export type CreateAdminCouponBody = {
  code: string;
  status?: string;
  activeFrom?: string;
  activeTo?: string;
  discountType: string;
  discountValue?: number;
  minOrderAmountCents?: number;
  maxRedemptions?: number;
  perCustomerLimit?: number;
  bannerId?: string;
};

export type UpdateAdminCouponBody = Omit<Partial<Omit<CreateAdminCouponBody, "code">>, "bannerId"> & {
  bannerId?: string | null;
};

export type AdminCouponMutationResponse = {
  success: true;
  data: { entity: CouponListItem };
};

export const createAdminCoupon = async (
  accessToken: string,
  body: CreateAdminCouponBody
): Promise<AdminCouponMutationResponse> =>
  apiRequest<AdminCouponMutationResponse>({
    method: "POST",
    path: "/api/admin/marketing/coupons",
    accessToken,
    body
  });

export const updateAdminCoupon = async (
  accessToken: string,
  couponId: string,
  body: UpdateAdminCouponBody
): Promise<AdminCouponMutationResponse> =>
  apiRequest<AdminCouponMutationResponse>({
    method: "PATCH",
    path: `/api/admin/marketing/coupons/${encodeURIComponent(couponId)}`,
    accessToken,
    body
  });

export const deleteAdminCoupon = async (
  accessToken: string,
  couponId: string
): Promise<{ success: true; data: { ok: true } }> =>
  apiRequest({
    method: "DELETE",
    path: `/api/admin/marketing/coupons/${encodeURIComponent(couponId)}`,
    accessToken
  });

export type PromotionCampaignRef = {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
};

export type PromotionRuleRef = {
  id: string;
  ruleType: string;
  targeting: unknown;
  minOrderAmountCents: number | null;
  createdAt: string;
};

export type PromotionListItem = {
  id: string;
  name: string;
  status: string;
  activeFrom: string | null;
  activeTo: string | null;
  bannerId?: string | null;
  linkedBanner?: LinkedBannerRef | null;
  createdAt: string;
  updatedAt: string;
  rules: PromotionRuleRef[];
  campaigns: PromotionCampaignRef[];
};

export type PromotionPulseMeta = {
  activeCampaignsCount: number;
  ordersWithCoupon30d: number;
  ordersTotal30d: number;
  orderCouponRedemptionRatePercent30d: number;
};

export type AdminPromotionsListResponse = {
  success: true;
  data: { items: PromotionListItem[] };
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    pulse?: PromotionPulseMeta;
  };
};

export type ListContractPromotionsQuery = {
  page?: number;
  page_size?: number;
  status?: string;
  q?: string;
};

const promotionsQuery = (query: ListContractPromotionsQuery) => {
  const p = new URLSearchParams();
  p.set("page", String(query.page ?? 1));
  p.set("page_size", String(query.page_size ?? 20));
  if (query.status?.trim()) {
    p.set("status", query.status.trim());
  }
  if (query.q?.trim()) {
    p.set("q", query.q.trim());
  }
  return `?${p.toString()}`;
};

export const listContractPromotions = async (
  accessToken: string,
  query: ListContractPromotionsQuery = {}
): Promise<AdminPromotionsListResponse> =>
  apiRequest<AdminPromotionsListResponse>({
    path: `/api/admin/promotions${promotionsQuery(query)}`,
    accessToken
  });

export type PromotionRuleRow = {
  id: string;
  ruleType: string;
  targeting: unknown;
  minOrderAmountCents: number | null;
  createdAt: string;
};

export type PromotionRulesListResponse = {
  success: true;
  data: {
    items: PromotionRuleRow[];
    entity: { id: string; name: string; status: string };
  };
};

export const listPromotionRules = async (
  accessToken: string,
  promotionId: string
): Promise<PromotionRulesListResponse> =>
  apiRequest<PromotionRulesListResponse>({
    path: `/api/admin/promotions/${encodeURIComponent(promotionId)}/rules`,
    accessToken
  });

export type CampaignPerformanceItem = {
  id: string;
  slug: string;
  name: string;
  status: string;
  promotion: { id: string; name: string; status: string } | null;
  bannerCount: number;
  promotionStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignChannelMix = { placement: string; bannerCount: number };

export type CampaignPerformanceSummary = {
  campaignsInView: number;
  activeCampaignsInView: number;
  campaignsWithPromotionInView: number;
  bannerPlacementsInView: number;
  activationRatePercent: number;
};

export type CampaignPerformanceData = {
  period: string;
  windowFrom: string | null;
  summary: CampaignPerformanceSummary;
  channelMix: CampaignChannelMix[];
  items: CampaignPerformanceItem[];
};

export type CampaignPerformanceQuery = {
  period?: "24h" | "7d" | "30d" | "all";
};

export type CampaignPerformanceResponse = {
  success: true;
  data: CampaignPerformanceData;
};

const campaignPerformanceQuery = (query: CampaignPerformanceQuery = {}) => {
  const p = new URLSearchParams();
  if (query.period) {
    p.set("period", query.period);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const getCampaignPerformance = async (
  accessToken: string,
  query: CampaignPerformanceQuery = {}
): Promise<CampaignPerformanceResponse> =>
  apiRequest<CampaignPerformanceResponse>({
    path: `/api/admin/campaigns/performance${campaignPerformanceQuery(query)}`,
    accessToken
  });

export type CreateAdminPromotionBody = {
  name: string;
  status?: string;
  activeFrom?: string;
  activeTo?: string;
  bannerId?: string;
  rules?: Array<{
    ruleType: string;
    targeting: Record<string, unknown>;
    minOrderAmountCents?: number;
  }>;
};

export type UpdateAdminPromotionBody = Omit<Partial<CreateAdminPromotionBody>, "bannerId"> & {
  bannerId?: string | null;
};

export type AdminPromotionMutationResponse = {
  success: true;
  data: { entity: PromotionListItem | null };
};

export const createAdminPromotion = async (
  accessToken: string,
  body: CreateAdminPromotionBody
): Promise<AdminPromotionMutationResponse> =>
  apiRequest<AdminPromotionMutationResponse>({
    method: "POST",
    path: "/api/admin/promotions",
    accessToken,
    body: {
      ...body,
      rules: body.rules ?? []
    }
  });

export const updateAdminPromotion = async (
  accessToken: string,
  promotionId: string,
  body: UpdateAdminPromotionBody
): Promise<AdminPromotionMutationResponse> =>
  apiRequest<AdminPromotionMutationResponse>({
    method: "PATCH",
    path: `/api/admin/promotions/${encodeURIComponent(promotionId)}`,
    accessToken,
    body
  });

export const deleteAdminPromotion = async (
  accessToken: string,
  promotionId: string
): Promise<{ success: true; data: { ok: true } }> =>
  apiRequest({
    method: "DELETE",
    path: `/api/admin/promotions/${encodeURIComponent(promotionId)}`,
    accessToken
  });

export type GlobalRulesContainerResponse = {
  success: true;
  data: { entity: { id: string; name: string; status: string } };
};

export const getGlobalRulesPromotionContainer = async (
  accessToken: string
): Promise<GlobalRulesContainerResponse> =>
  apiRequest<GlobalRulesContainerResponse>({
    path: "/api/admin/promotions/global/rules-container",
    accessToken
  });

export type PromotionRuleMutationBody = {
  ruleType: string;
  targeting: Record<string, unknown>;
  minOrderAmountCents?: number;
};

export const createPromotionRule = async (
  accessToken: string,
  promotionId: string,
  body: PromotionRuleMutationBody
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/promotions/${encodeURIComponent(promotionId)}/rules`,
    accessToken,
    body
  });

export const updatePromotionRule = async (
  accessToken: string,
  promotionId: string,
  ruleId: string,
  body: Partial<PromotionRuleMutationBody>
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "PATCH",
    path: `/api/admin/promotions/${encodeURIComponent(promotionId)}/rules/${encodeURIComponent(ruleId)}`,
    accessToken,
    body
  });

export const deletePromotionRule = async (
  accessToken: string,
  promotionId: string,
  ruleId: string
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "DELETE",
    path: `/api/admin/promotions/${encodeURIComponent(promotionId)}/rules/${encodeURIComponent(ruleId)}`,
    accessToken
  });

export { ApiError };
