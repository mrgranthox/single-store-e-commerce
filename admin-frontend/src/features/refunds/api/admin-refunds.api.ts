import { apiRequest, ApiError } from "@/lib/api/http";

export type RefundListItem = {
  id: string;
  state: string;
  amountCents: number;
  approvedAmountCents: number | null;
  currency: string;
  providerRefundRef: string | null;
  providerPayload?: unknown;
  internalNote?: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payment: {
    id: string;
    paymentState: string;
    provider: string | null;
    providerPaymentRef: string | null;
  };
  order: {
    id: string;
    orderNumber: string;
    status: string;
    customer: { id: string | null; email: string | null; guest: boolean; name: string | null };
  };
  return: {
    id: string;
    status: string;
    customerReason: string | null;
  } | null;
  items: Array<{ id: string; orderItemId: string; amountCents: number }>;
};

export type ListAdminRefundsQuery = {
  page?: number;
  page_size?: number;
  state?: string;
  q?: string;
};

const refundsQuery = (query: ListAdminRefundsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.state?.trim()) {
    params.set("state", query.state.trim());
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  return `?${params.toString()}`;
};

export type AdminRefundsListResponse = {
  success: true;
  data: { items: RefundListItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminRefunds = async (
  accessToken: string,
  query: ListAdminRefundsQuery = {}
): Promise<AdminRefundsListResponse> =>
  apiRequest<AdminRefundsListResponse>({
    path: `/api/admin/refunds${refundsQuery(query)}`,
    accessToken
  });

export type AdminRefundDetailResponse = {
  success: true;
  data: { entity: RefundListItem };
};

export const getAdminRefundDetail = async (
  accessToken: string,
  refundId: string
): Promise<AdminRefundDetailResponse> =>
  apiRequest<AdminRefundDetailResponse>({
    path: `/api/admin/refunds/${encodeURIComponent(refundId)}`,
    accessToken
  });

export const approveAdminRefund = async (
  accessToken: string,
  refundId: string,
  body: { note?: string } = {}
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/refunds/${encodeURIComponent(refundId)}/approve`,
    accessToken,
    body
  });

export const rejectAdminRefund = async (
  accessToken: string,
  refundId: string,
  body: { note: string }
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/refunds/${encodeURIComponent(refundId)}/reject`,
    accessToken,
    body
  });

export const completeAdminRefund = async (
  accessToken: string,
  refundId: string,
  body: { note?: string; providerRefundRef?: string } = {}
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/refunds/${encodeURIComponent(refundId)}/mark-completed`,
    accessToken,
    body
  });

export { ApiError };
