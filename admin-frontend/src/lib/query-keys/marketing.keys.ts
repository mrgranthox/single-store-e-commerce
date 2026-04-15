export const marketingKeys = {
  all: () => ["admin-marketing"] as const,

  // Promotions
  promotions: () => [...marketingKeys.all(), "promotions"] as const,
  promotionList: (params: Record<string, unknown>) =>
    [...marketingKeys.promotions(), "list", params] as const,
  promotion: (id: string) => [...marketingKeys.promotions(), id] as const,

  // Promotion rules
  promotionRules: (promotionId: string) =>
    [...marketingKeys.promotion(promotionId), "rules"] as const,
  promotionRulesHub: () =>
    [...marketingKeys.promotions(), "rules-hub"] as const,

  // Coupons
  coupons: () => [...marketingKeys.all(), "coupons"] as const,
  couponList: (params: Record<string, unknown>) =>
    [...marketingKeys.coupons(), "list", params] as const,
  coupon: (id: string) => [...marketingKeys.coupons(), id] as const,
  couponAnalytics: (id: string) =>
    [...marketingKeys.coupon(id), "analytics"] as const,

  // Campaign performance
  campaigns: () => [...marketingKeys.all(), "campaigns"] as const,
  campaignPerformance: (params: Record<string, unknown>) =>
    [...marketingKeys.campaigns(), "performance", params] as const,
};
