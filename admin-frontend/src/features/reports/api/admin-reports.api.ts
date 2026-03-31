import { apiRequest, ApiError } from "@/lib/api/http";

export type ReportsOverviewData = {
  range: { from: string | null; to: string | null };
  kpis: {
    orderCount: number;
    grossRevenueCents: number;
    totalCustomers: number;
    openSupportCount: number;
    pendingReviews: number;
    activeReturns: number;
    lowStockCount: number;
    openAlerts: number;
  };
  payments: {
    paidCount: number;
    refundedCount: number;
    partiallyRefundedCount: number;
  };
};

export type ReportsOverviewResponse = {
  success: true;
  data: ReportsOverviewData;
};

export type ReportsOverviewQuery = {
  from?: string;
  to?: string;
};

const overviewQuery = (query: ReportsOverviewQuery) => {
  const params = new URLSearchParams();
  if (query.from?.trim()) {
    params.set("from", query.from.trim());
  }
  if (query.to?.trim()) {
    params.set("to", query.to.trim());
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const getAdminReportsOverview = async (
  accessToken: string,
  query: ReportsOverviewQuery = {}
): Promise<ReportsOverviewResponse> =>
  apiRequest<ReportsOverviewResponse>({
    path: `/api/admin/reports/overview${overviewQuery(query)}`,
    accessToken
  });

export type ReportDatasetResponse = {
  success: true;
  data: unknown;
};

export const getAdminReportsDataset = async (
  accessToken: string,
  segment:
    | "sales"
    | "products"
    | "inventory"
    | "customers"
    | "support"
    | "refunds-returns"
    | "marketing",
  query: ReportsOverviewQuery = {}
): Promise<ReportDatasetResponse> =>
  apiRequest<ReportDatasetResponse>({
    path: `/api/admin/reports/${segment}${overviewQuery(query)}`,
    accessToken
  });

export { ApiError };
