import { apiRequest, ApiError } from "@/lib/api/http";

export type ReturnListItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  status: string;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  receivedAt: string | null;
  completedAt: string | null;
  customerReason: string | null;
  itemCount: number;
  customer: { id: string | null; email: string | null; guest: boolean; name: string | null };
  refunds: Array<{
    id: string;
    state: string;
    amountCents: number;
    currency: string;
  }>;
};

export type ReturnDetailEntity = ReturnListItem & {
  adminNote: string | null;
  shipments: Array<{
    id: string;
    status: string;
    trackingNumber: string | null;
    carrier: string | null;
    warehouse: unknown;
    createdAt: string;
    updatedAt: string;
  }>;
  items: Array<{
    id: string;
    orderItemId: string;
    variantId: string;
    quantity: number;
    status: string;
    productTitle: string;
    sku: string;
    unitPriceAmountCents: number;
    unitPriceCurrency: string;
    requestedAmountCents: number;
  }>;
};

export type ListAdminReturnsQuery = {
  page?: number;
  page_size?: number;
  status?: string;
  q?: string;
  reason_contains?: string;
};

const returnsQuery = (query: ListAdminReturnsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.reason_contains?.trim()) {
    params.set("reason_contains", query.reason_contains.trim());
  }
  return `?${params.toString()}`;
};

export type AdminReturnsListResponse = {
  success: true;
  data: { items: ReturnListItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminReturns = async (
  accessToken: string,
  query: ListAdminReturnsQuery = {}
): Promise<AdminReturnsListResponse> =>
  apiRequest<AdminReturnsListResponse>({
    path: `/api/admin/returns${returnsQuery(query)}`,
    accessToken
  });

export type AdminReturnDetailResponse = {
  success: true;
  data: { entity: ReturnDetailEntity };
};

export const getAdminReturnDetail = async (
  accessToken: string,
  returnId: string
): Promise<AdminReturnDetailResponse> =>
  apiRequest<AdminReturnDetailResponse>({
    path: `/api/admin/returns/${encodeURIComponent(returnId)}`,
    accessToken
  });

export const approveAdminReturn = async (
  accessToken: string,
  returnId: string,
  body: { note?: string } = {}
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/returns/${encodeURIComponent(returnId)}/approve`,
    accessToken,
    body
  });

export const rejectAdminReturn = async (
  accessToken: string,
  returnId: string,
  body: { note: string }
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/returns/${encodeURIComponent(returnId)}/reject`,
    accessToken,
    body
  });

export const markReturnReceivedAdmin = async (
  accessToken: string,
  returnId: string,
  body: { note?: string; restockItems?: boolean } = {}
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/returns/${encodeURIComponent(returnId)}/mark-received`,
    accessToken,
    body: { restockItems: true, ...body }
  });

export const completeAdminReturn = async (
  accessToken: string,
  returnId: string,
  body: { note?: string } = {}
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/returns/${encodeURIComponent(returnId)}/complete`,
    accessToken,
    body
  });

export { ApiError };
