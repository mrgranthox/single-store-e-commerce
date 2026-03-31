/** Mirrors backend `reports.service` payloads (GET /api/admin/reports/:segment). */

export type ReportDatasetSegment =
  | "sales"
  | "products"
  | "inventory"
  | "customers"
  | "support"
  | "refunds-returns"
  | "marketing";

export type SalesReportData = {
  summary: {
    orderCount: number;
    revenueCents: number;
    completedRefundsCents: number;
    netRevenueCents: number;
    averageOrderValueCents: number;
    averageNetOrderValueCents: number;
    discountCentsFromCheckout?: number;
    subtotalCentsFromCheckout?: number;
    discountImpactPctOfSubtotal?: number | null;
    discountImpactPctOfGross?: number | null;
  };
  series: Array<{
    date: string;
    orderCount: number;
    revenueCents: number;
    refundsCents: number;
    netRevenueCents: number;
  }>;
  revenueByCategory?: Array<{
    categoryName: string;
    revenueCents: number;
    orderCount: number;
    pctOfTotal: number;
    averageOrderValueCents: number;
  }>;
  paymentMethodMix?: Array<{
    provider: string;
    revenueCents: number;
    paymentCount: number;
    pctOfTotal: number;
  }>;
  topProductsByRevenue?: Array<{
    rank: number;
    productId: string;
    slug: string;
    title: string;
    quantitySold: number;
    revenueCents: number;
    pctOfTotal: number;
  }>;
};

export type ProductPerformanceReportData = {
  topProducts: Array<{
    productId: string;
    slug: string;
    title: string;
    quantitySold: number;
    revenueCents: number;
    returnRatePct?: number;
    refundRatePct?: number;
  }>;
  categoryPerformance?: Array<{
    categoryName: string;
    revenueCents: number;
    pctOfTotal: number;
  }>;
  highReturnProducts?: Array<{
    productId: string;
    title: string;
    quantitySold: number;
    returnedQuantity: number;
    returnRatePct: number;
  }>;
  inventoryInStockTrend?: Array<{
    date: string;
    trackedLineCount: number;
    outOfStockCount: number;
    inStockPct: number;
  }>;
  movementBreakdown?: Array<{
    movementType: string;
    eventCount: number;
    unitsDeltaAbs: number;
  }>;
  mostAdjustedSkus?: Array<{
    sku: string;
    productTitle: string;
    warehouseName: string;
    adjustmentCount: number;
  }>;
  stockoutMetrics?: {
    outOfStockLineCount: number;
    estimatedStockoutRevenueRiskCents: number;
    revenueFromCurrentlyOosVariantsCents?: number;
    oosSkuDailyRunRateRevenueCents?: number;
  };
  lowStock: Array<{
    inventoryStockId: string;
    productId: string;
    productTitle: string;
    variantId: string;
    sku: string;
    warehouse: { id: string; name: string } | null;
    onHand: number;
    reserved: number;
    reorderLevel: number | null;
  }>;
  warehouseHealth: Array<{
    warehouseName: string;
    totalSkus: number;
    inStockPct: number;
    lowStockCount: number;
  }>;
  fulfillment: {
    avgHoursToDeliver: number | null;
  };
};

export type CustomerReportData = {
  summary: {
    totalBuyersInRange: number;
    newSignupsInRange: number;
    returningBuyersInRange: number | null;
    totalOrdersInRange: number;
    suspendedAmongBuyers: number;
    avgLtvCentsAmongBuyers: number;
  };
  topCustomers: Array<{
    id: string;
    email: string;
    name: string | null;
    orderCount: number;
    spendCents: number;
    supportTicketCount: number;
    reviewCount: number;
  }>;
  growthSeries?: Array<{ date: string; newSignups: number; ordersPlaced: number }>;
  cohortRepeatPurchase?: Array<{
    cohortMonth: string;
    customersJoined: number;
    orderedAgainWithin30dPct: number;
  }>;
  ltvBuckets?: Array<{ label: string; customerCount: number }>;
  geographicDistribution?: Array<{ country: string; customerCount: number }>;
};

export type SupportReportData = {
  summary: {
    totalTickets: number;
    openTickets: number;
    pendingCustomerTickets: number;
    averageMessageCount: number;
    avgFirstResponseMinutes: number | null;
    resolutionRatePct: number;
    csatScorePercent: number | null;
    csatResponseCount?: number;
    csatProxyResolutionRatePct: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  stitchBacklog: {
    new: number;
    open: number;
    pending: number;
    onHold: number;
    resolved: number;
  };
  complaintCategories: Array<{ category: string; count: number }>;
  slaAtRiskTickets: Array<{
    id: string;
    subject: string;
    priority: string;
    status: string;
    createdAt: string;
    slaDeadlineIso: string;
  }>;
  slaByPriority?: Array<{
    priority: string;
    ticketsInPriority: number;
    firstResponseSamples: number;
    onTimePct: number | null;
    avgFirstResponseMinutes: number | null;
    breachCount: number;
  }>;
};

export type PostPurchaseReportData = {
  returns: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
    quantityRequested: number;
  };
  refunds: {
    total: number;
    completedCents: number;
  };
  reviews: {
    total: number;
    published: number;
    pending: number;
  };
  refundTrend?: Array<{ date: string; refundCents: number }>;
  returnReasons?: Array<{ reason: string; count: number }>;
  topReturnedProducts?: Array<{
    productId: string;
    productTitle: string;
    returnedQty: number;
  }>;
  processing?: {
    avgRefundProcessingHours: number | null;
    avgReturnCompletionHours: number | null;
  };
};

export type MarketingReportData = {
  discounts?: {
    totalCentsFromCheckout: number;
    ordersWithDiscountSnapshotCount: number;
  };
  coupons: {
    total: number;
    active: number;
    disabled: number;
    redemptions: number;
  };
  promotions: {
    total: number;
    active: number;
    ruleCount: number;
  };
  campaigns: {
    total: number;
    active: number;
    bannerCount: number;
  };
  topCouponsByRedemption?: Array<{ rank: number; code: string; redemptions: number }>;
  channelAttribution?: Array<{
    channel: string;
    revenueCents: number;
    orderCount: number;
    pctOfRevenue: number;
  }>;
  campaignRoi?: Array<{
    campaignId: string;
    name: string;
    status: string;
    bannerCount: number;
    attributedRevenueCents: number;
    costCents: number | null;
    roiPct: number | null;
  }>;
};
