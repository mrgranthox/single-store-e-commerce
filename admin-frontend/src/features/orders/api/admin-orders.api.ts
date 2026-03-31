import { apiRequest, ApiError } from "@/lib/api/http";

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  totals: {
    grandTotalCents?: number | null;
    currency?: string | null;
  } | null;
  paymentState: string;
  fulfillment?: {
    status: string;
    shipmentCount: number;
    trackingAvailable: boolean;
    latestTrackingNumber: string | null;
  };
  assignedWarehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
  customer: {
    id: string | null;
    email: string | null;
    guest: boolean;
    name: string | null;
  };
};

export type AdminOrdersListResponse = {
  success: true;
  data: {
    items: AdminOrderListItem[];
  };
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ListAdminOrdersQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: string;
  paymentState?: string;
};

const buildQuery = (query: ListAdminOrdersQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.paymentState?.trim()) {
    params.set("paymentState", query.paymentState.trim());
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const listAdminOrders = async (
  accessToken: string,
  query: ListAdminOrdersQuery = {}
): Promise<AdminOrdersListResponse> =>
  apiRequest<AdminOrdersListResponse>({
    path: `/api/admin/orders${buildQuery(query)}`,
    accessToken
  });

export type AdminOrderDetailEntity = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string | null;
    email: string | null;
    guest: boolean;
    name: string | null;
  };
  payment: {
    id?: string | null;
    paymentState: string;
    amountCents: number | null;
    currency: string | null;
    provider: string | null;
    providerPaymentRef?: string | null;
  };
  fulfillment: {
    status: string;
    shipmentCount: number;
    trackingAvailable: boolean;
    latestTrackingNumber: string | null;
  };
  items: Array<{
    id: string;
    variantId: string;
    productTitle: string;
    unitPriceAmountCents: number;
    unitPriceCurrency: string;
    quantity: number;
    lineTotalCents: number;
  }>;
  shipments?: Array<{
    id: string;
    status: string;
    trackingNumber: string | null;
    carrier: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  assignedWarehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
  totals: {
    grandTotalCents?: number | null;
    currency?: string | null;
  } | null;
};

export type AdminOrderDetailResponse = {
  success: true;
  data: {
    entity: AdminOrderDetailEntity;
  };
};

export const getAdminOrderDetail = async (
  accessToken: string,
  orderId: string
): Promise<AdminOrderDetailResponse> =>
  apiRequest<AdminOrderDetailResponse>({
    path: `/api/admin/orders/${encodeURIComponent(orderId)}`,
    accessToken
  });

export type AdminOrderTimelineItem = {
  id: string;
  kind: string;
  eventType: string;
  label: string;
  occurredAt: string;
  actorType: string;
  payload: unknown;
};

export type AdminOrderTimelineResponse = {
  success: true;
  data: {
    entity: { id: string; orderNumber: string };
    timeline: AdminOrderTimelineItem[];
  };
};

export const getAdminOrderTimeline = async (
  accessToken: string,
  orderId: string
): Promise<AdminOrderTimelineResponse> =>
  apiRequest<AdminOrderTimelineResponse>({
    path: `/api/admin/orders/${encodeURIComponent(orderId)}/timeline`,
    accessToken
  });

export type AdminOrderStatus = "DRAFT" | "PENDING_PAYMENT" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "CLOSED";

export const updateAdminOrderStatus = async (
  accessToken: string,
  orderId: string,
  body: { status: AdminOrderStatus; reason?: string; note?: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/orders/${encodeURIComponent(orderId)}/status`,
    accessToken,
    body
  });

export const assignAdminOrderWarehouse = async (
  accessToken: string,
  orderId: string,
  body: { warehouseId: string; reason?: string; note?: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/orders/${encodeURIComponent(orderId)}/assign-warehouse`,
    accessToken,
    body
  });

export const cancelAdminOrder = async (
  accessToken: string,
  orderId: string,
  body: { reason: string; note?: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/orders/${encodeURIComponent(orderId)}/cancel`,
    accessToken,
    body
  });

export const createAdminOrderShipment = async (
  accessToken: string,
  orderId: string,
  body: { warehouseId: string; carrier?: string; trackingNumber?: string; note?: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/orders/${encodeURIComponent(orderId)}/shipments`,
    accessToken,
    body
  });

export type AdminOrderQueueQuery = {
  page?: number;
  page_size?: number;
  q?: string;
};

const queueQueryString = (query: AdminOrderQueueQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  return `?${params.toString()}`;
};

export const listAdminFulfillmentQueue = async (
  accessToken: string,
  query: AdminOrderQueueQuery = {}
): Promise<AdminOrdersListResponse> =>
  apiRequest<AdminOrdersListResponse>({
    path: `/api/admin/orders/fulfillment-queue${queueQueryString(query)}`,
    accessToken
  });

export const listAdminDispatchQueue = async (
  accessToken: string,
  query: AdminOrderQueueQuery = {}
): Promise<AdminOrdersListResponse> =>
  apiRequest<AdminOrdersListResponse>({
    path: `/api/admin/orders/dispatch-queue${queueQueryString(query)}`,
    accessToken
  });

export type CancellationRequestListItem = {
  id: string;
  status: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedNote: string | null;
  customer: {
    id: string | null;
    email: string | null;
    guest: boolean;
    name: string;
  };
  order: {
    id: string;
    orderNumber: string;
    status: string;
    payment: {
      paymentState: string;
      amountCents: number | null;
      currency: string | null;
    };
    fulfillment: {
      status: string;
      shipmentCount: number;
      trackingAvailable: boolean;
      latestTrackingNumber: string | null;
    };
  };
};

export type CancellationQueueStats = {
  pendingTotal: number;
  fulfillmentLockedPending: number;
  resolvedToday: number;
  successRatePercent: number | null;
  avgResponseMinutes: number | null;
};

export type AdminCancellationRequestsResponse = {
  success: true;
  data: { items: CancellationRequestListItem[] };
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    queueStats: CancellationQueueStats;
  };
};

export type ListAdminCancellationRequestsQuery = {
  page?: number;
  page_size?: number;
  status?: string;
};

const cancellationQueryString = (query: ListAdminCancellationRequestsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  return `?${params.toString()}`;
};

export const listAdminCancellationRequests = async (
  accessToken: string,
  query: ListAdminCancellationRequestsQuery = {}
): Promise<AdminCancellationRequestsResponse> =>
  apiRequest<AdminCancellationRequestsResponse>({
    path: `/api/admin/orders/cancellation-requests${cancellationQueryString(query)}`,
    accessToken
  });

export const approveAdminCancellationRequest = async (
  accessToken: string,
  cancellationId: string,
  body: { note?: string } = {}
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/orders/cancellation-requests/${encodeURIComponent(cancellationId)}/approve`,
    accessToken,
    body
  });

export const rejectAdminCancellationRequest = async (
  accessToken: string,
  cancellationId: string,
  body: { note?: string } = {}
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/orders/cancellation-requests/${encodeURIComponent(cancellationId)}/reject`,
    accessToken,
    body
  });

export type ShipmentTrackingEventApi = {
  id: string;
  eventType: string | null;
  statusLabel: string;
  occurredAt: string;
  location: string | null;
  payload: unknown;
};

export type ShipmentRecipient = {
  fullName: string | null;
  email: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
};

export type ShipmentWarehouse = { id: string; code: string; name: string } | null;

export type ShipmentDetailEntity = {
  id: string;
  order: { id: string; orderNumber: string; status: string };
  warehouse: ShipmentWarehouse;
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
  createdAt: string;
  updatedAt: string;
  recipient: ShipmentRecipient;
  trackingEvents: ShipmentTrackingEventApi[];
};

export type ShipmentDetailResponse = {
  success: true;
  data: { entity: ShipmentDetailEntity };
};

export const getAdminShipmentDetail = async (
  accessToken: string,
  shipmentId: string
): Promise<ShipmentDetailResponse> =>
  apiRequest<ShipmentDetailResponse>({
    path: `/api/admin/shipments/${encodeURIComponent(shipmentId)}`,
    accessToken
  });

export type ShipmentTrackingHeaderEntity = {
  id: string;
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
};

export type ShipmentTrackingResponse = {
  success: true;
  data: { entity: ShipmentTrackingHeaderEntity; items: ShipmentTrackingEventApi[] };
};

export const getAdminShipmentTracking = async (
  accessToken: string,
  shipmentId: string
): Promise<ShipmentTrackingResponse> =>
  apiRequest<ShipmentTrackingResponse>({
    path: `/api/admin/shipments/${encodeURIComponent(shipmentId)}/tracking`,
    accessToken
  });

export const createAdminShipmentTrackingEvent = async (
  accessToken: string,
  shipmentId: string,
  body: {
    statusLabel: string;
    eventType?: string;
    location?: string;
    note?: string;
  }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/shipments/${encodeURIComponent(shipmentId)}/tracking-events`,
    accessToken,
    body
  });

export { ApiError };
