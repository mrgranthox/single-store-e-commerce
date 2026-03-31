import { apiRequest, ApiError } from "@/lib/api/http";

export type AdminPaymentListItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  provider: string;
  providerPaymentRef: string | null;
  paymentState: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string | null;
    email: string | null;
    guest: boolean;
    name: string | null;
  };
  latestTransactionStatus: string | null;
};

export type AdminPaymentsListResponse = {
  success: true;
  data: { items: AdminPaymentListItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export type ListAdminPaymentsQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  provider?: string;
  paymentState?: string;
};

const buildPaymentsQuery = (query: ListAdminPaymentsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.provider?.trim()) {
    params.set("provider", query.provider.trim());
  }
  if (query.paymentState?.trim()) {
    params.set("paymentState", query.paymentState.trim());
  }
  return `?${params.toString()}`;
};

export const listAdminPayments = async (
  accessToken: string,
  query: ListAdminPaymentsQuery = {}
): Promise<AdminPaymentsListResponse> =>
  apiRequest<AdminPaymentsListResponse>({
    path: `/api/admin/payments${buildPaymentsQuery(query)}`,
    accessToken
  });

export type AdminPaymentDetailEntity = {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  provider: string;
  providerPaymentRef: string | null;
  paymentState: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  customer: AdminPaymentListItem["customer"];
  transactions: Array<{
    id: string;
    providerEventType: string;
    providerRef: string | null;
    amountCents: number | null;
    currency: string | null;
    status: string;
    payload: unknown;
    createdAt: string;
  }>;
};

export type AdminPaymentDetailResponse = {
  success: true;
  data: { entity: AdminPaymentDetailEntity };
};

export const getAdminPaymentDetail = async (
  accessToken: string,
  paymentId: string
): Promise<AdminPaymentDetailResponse> =>
  apiRequest<AdminPaymentDetailResponse>({
    path: `/api/admin/payments/${encodeURIComponent(paymentId)}`,
    accessToken
  });

/** Failed investigations list returns the same row shape as the main payments ledger. */
export type FailedPaymentInvestigationItem = AdminPaymentListItem;

export type FailedInvestigationsResponse = {
  success: true;
  data: { items: FailedPaymentInvestigationItem[] };
  meta?: { page: number; limit: number; totalItems: number; totalPages: number };
};

export type ListFailedInvestigationsQuery = {
  page?: number;
  page_size?: number;
  provider?: string;
};

const buildFailedInvestigationsQuery = (query: ListFailedInvestigationsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.provider?.trim()) {
    params.set("provider", query.provider.trim());
  }
  return `?${params.toString()}`;
};

export const listFailedPaymentInvestigations = async (
  accessToken: string,
  query: ListFailedInvestigationsQuery = {}
): Promise<FailedInvestigationsResponse> =>
  apiRequest<FailedInvestigationsResponse>({
    path: `/api/admin/payments/failed-investigations${buildFailedInvestigationsQuery(query)}`,
    accessToken
  });

export type AdminPaymentTransactionRow = {
  id: string;
  status: string;
  providerEventType: string;
  providerRef: string | null;
  amountCents: number | null;
  currency: string | null;
  createdAt: string;
  payload: unknown;
};

export type PaymentTransactionsResponse = {
  success: true;
  data: {
    entity: {
      id: string;
      provider: string;
      paymentState: string;
      providerPaymentRef: string | null;
    };
    items: AdminPaymentTransactionRow[];
  };
};

export const getAdminPaymentTransactions = async (
  accessToken: string,
  paymentId: string
): Promise<PaymentTransactionsResponse> =>
  apiRequest<PaymentTransactionsResponse>({
    path: `/api/admin/payments/${encodeURIComponent(paymentId)}/transactions`,
    accessToken
  });

export { ApiError };
