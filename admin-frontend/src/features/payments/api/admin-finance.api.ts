import { apiRequest, ApiError } from "@/lib/api/http";

export type FinancialExceptionRow = {
  id: string;
  exceptionType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  orderId: string | null;
  paymentId: string | null;
  refundId: string | null;
  mismatchSummary: unknown;
  resolvedAt: string | null;
  resolutionNote: string | null;
};

export type ListFinanceExceptionsQuery = {
  page?: number;
  page_size?: number;
};

const qs = (query: ListFinanceExceptionsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  return `?${params.toString()}`;
};

export type FinanceExceptionsListResponse = {
  success: true;
  data: { items: FinancialExceptionRow[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminFinanceExceptions = async (
  accessToken: string,
  query: ListFinanceExceptionsQuery = {}
): Promise<FinanceExceptionsListResponse> =>
  apiRequest<FinanceExceptionsListResponse>({
    path: `/api/admin/finance/exceptions${qs(query)}`,
    accessToken
  });

export const resolveAdminFinanceException = async (
  accessToken: string,
  exceptionId: string,
  body: { note: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/finance/exceptions/${encodeURIComponent(exceptionId)}/resolve`,
    accessToken,
    body
  });

export { ApiError };
