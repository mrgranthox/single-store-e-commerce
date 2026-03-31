import { apiRequest, ApiError } from "@/lib/api/http";

export type AdminCustomerListItem = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  counts: {
    orders: number;
    openSupportTickets: number;
    reviews: number;
    returns: number;
    refunds: number;
  };
};

export type AdminCustomersMatchingSummary = {
  totalMatching: number;
  byStatus: Record<string, number>;
};

export type AdminCustomersListResponse = {
  success: true;
  data: { items: AdminCustomerListItem[] };
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    matchingSummary: AdminCustomersMatchingSummary;
  };
};

export type ListAdminCustomersQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: string;
  joined_after?: string;
  joined_before?: string;
  min_orders?: number;
  max_orders?: number;
  min_ltv_cents?: number;
  max_ltv_cents?: number;
};

const customersQuery = (query: ListAdminCustomersQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.joined_after?.trim()) {
    params.set("joined_after", query.joined_after.trim());
  }
  if (query.joined_before?.trim()) {
    params.set("joined_before", query.joined_before.trim());
  }
  if (query.min_orders != null) {
    params.set("min_orders", String(query.min_orders));
  }
  if (query.max_orders != null) {
    params.set("max_orders", String(query.max_orders));
  }
  if (query.min_ltv_cents != null) {
    params.set("min_ltv_cents", String(query.min_ltv_cents));
  }
  if (query.max_ltv_cents != null) {
    params.set("max_ltv_cents", String(query.max_ltv_cents));
  }
  return `?${params.toString()}`;
};

export const listAdminCustomers = async (
  accessToken: string,
  query: ListAdminCustomersQuery = {}
): Promise<AdminCustomersListResponse> =>
  apiRequest<AdminCustomersListResponse>({
    path: `/api/admin/customers${customersQuery(query)}`,
    accessToken
  });

export type CustomerNote = {
  id: string;
  note: string;
  createdAt: string;
  actorAdmin: { id: string; email: string | null } | null;
};

export type AdminCustomerAddress = {
  id: string;
  label: string | null;
  fullName: string;
  phoneNumber: string | null;
  country: string;
  region: string;
  city: string;
  postalCode: string | null;
  addressLine1: string;
  addressLine2: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

export type AdminCustomerLastOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
} | null;

export type AdminCustomerDetailEntity = AdminCustomerListItem & {
  clerkUserId: string | null;
  notes: CustomerNote[];
  addresses: AdminCustomerAddress[];
  lastOrder: AdminCustomerLastOrder;
  lifetimeValueCents: number;
  averageOrderValueCents: number | null;
  lastRefundAt: string | null;
};

export type AdminCustomerDetailResponse = {
  success: true;
  data: { entity: AdminCustomerDetailEntity };
};

export const getAdminCustomerDetail = async (
  accessToken: string,
  customerId: string
): Promise<AdminCustomerDetailResponse> =>
  apiRequest<AdminCustomerDetailResponse>({
    path: `/api/admin/customers/${encodeURIComponent(customerId)}`,
    accessToken
  });

export type AdminCustomerOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  lineSummary: string;
  totalAmountCents: number;
  currency: string;
  paymentSummary: string;
  fulfillmentSummary: string;
};

export type AdminCustomerOrdersResponse = {
  success: true;
  data: { items: AdminCustomerOrderRow[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminCustomerOrders = async (
  accessToken: string,
  customerId: string,
  query: ListAdminCustomersQuery = {}
): Promise<AdminCustomerOrdersResponse> =>
  apiRequest<AdminCustomerOrdersResponse>({
    path: `/api/admin/customers/${encodeURIComponent(customerId)}/orders${customersQuery(query)}`,
    accessToken
  });

export type CustomerActivityItem = {
  id: string;
  kind: string;
  occurredAt: string;
  payload: unknown;
};

export type AdminCustomerActivityResponse = {
  success: true;
  data: {
    entity: { id: string; email: string | null };
    items: CustomerActivityItem[];
  };
};

export const getAdminCustomerActivity = async (
  accessToken: string,
  customerId: string
): Promise<AdminCustomerActivityResponse> =>
  apiRequest<AdminCustomerActivityResponse>({
    path: `/api/admin/customers/${encodeURIComponent(customerId)}/activity`,
    accessToken
  });

export type AdminCustomerSupportTicketRow = {
  id: string;
  subject: string | null;
  status: string;
  priority: string;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
  order: { id: string; orderNumber: string } | null;
};

export type AdminCustomerSupportResponse = {
  success: true;
  data: { items: AdminCustomerSupportTicketRow[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminCustomerSupport = async (
  accessToken: string,
  customerId: string,
  query: ListAdminCustomersQuery = {}
): Promise<AdminCustomerSupportResponse> =>
  apiRequest<AdminCustomerSupportResponse>({
    path: `/api/admin/customers/${encodeURIComponent(customerId)}/support${customersQuery(query)}`,
    accessToken
  });

export type AdminCustomerReviewRow = {
  id: string;
  rating: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  product: { id: string; slug: string; title: string };
  variant: { id: string; sku: string } | null;
};

export type AdminCustomerReviewsResponse = {
  success: true;
  data: { items: AdminCustomerReviewRow[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminCustomerReviews = async (
  accessToken: string,
  customerId: string,
  query: ListAdminCustomersQuery = {}
): Promise<AdminCustomerReviewsResponse> =>
  apiRequest<AdminCustomerReviewsResponse>({
    path: `/api/admin/customers/${encodeURIComponent(customerId)}/reviews${customersQuery(query)}`,
    accessToken
  });

export type AdminCustomerRiskSignalRow = {
  id: string;
  storeId: string | null;
  type: string;
  score: number;
  createdAt: string;
  userId: string | null;
  adminReviewedByAdminUserId: string | null;
  reviewedAt: string | null;
  metadata: unknown;
};

export type AdminCustomerSecurityEventRow = {
  id: string;
  storeId: string | null;
  userId: string | null;
  adminUserId: string | null;
  severity: string;
  type: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  metadata: unknown;
};

export type AdminCustomerLoginPatternRow = {
  id: string;
  success: boolean;
  failureReason: string | null;
  ipCountry: string | null;
  ipRegion: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AdminCustomerRefundSummary = {
  completedCount: number;
  totalAmountCents: number;
  lastCompletedAt: string | null;
  lastAmountCents: number | null;
  lastCurrency: string | null;
};

export type AdminCustomerRiskResponse = {
  success: true;
  data: {
    entity: { id: string; email: string | null; status: string };
    riskSignals: AdminCustomerRiskSignalRow[];
    securityEvents: AdminCustomerSecurityEventRow[];
    loginPatterns: AdminCustomerLoginPatternRow[];
    refundSummary: AdminCustomerRefundSummary;
  };
};

export const getAdminCustomerRisk = async (
  accessToken: string,
  customerId: string
): Promise<AdminCustomerRiskResponse> =>
  apiRequest<AdminCustomerRiskResponse>({
    path: `/api/admin/customers/${encodeURIComponent(customerId)}/risk`,
    accessToken
  });

export const suspendAdminCustomer = async (
  accessToken: string,
  customerId: string,
  body: { reason: string; note?: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/customers/${encodeURIComponent(customerId)}/suspend`,
    accessToken,
    body
  });

export const reactivateAdminCustomer = async (
  accessToken: string,
  customerId: string,
  body: { reason: string; note?: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/customers/${encodeURIComponent(customerId)}/reactivate`,
    accessToken,
    body
  });

export const restoreAdminCustomer = async (
  accessToken: string,
  customerId: string,
  body: { reason: string; note?: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/customers/${encodeURIComponent(customerId)}/restore`,
    accessToken,
    body
  });

export type AdminCustomerInternalActionBody =
  | { kind: "NOTE"; note: string }
  | { kind: "ESCALATE"; category: string; observation: string };

export const postAdminCustomerInternalAction = async (
  accessToken: string,
  customerId: string,
  body: AdminCustomerInternalActionBody
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/customers/${encodeURIComponent(customerId)}/internal-actions`,
    accessToken,
    body
  });

/** Internal CRM note (dedicated route; same persistence as internal-actions NOTE). */
export const createAdminCustomerNote = async (
  accessToken: string,
  customerId: string,
  body: { note: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/customers/${encodeURIComponent(customerId)}/notes`,
    accessToken,
    body
  });

export { ApiError };
