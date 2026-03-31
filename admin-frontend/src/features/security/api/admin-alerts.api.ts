import { apiRequest, ApiError } from "@/lib/api/http";

export type AlertListItem = {
  id: string;
  type: string;
  status: string;
  severity: string;
  assignedTo: unknown;
  resolvedBy: unknown;
  relatedOrderId: string | null;
  relatedPaymentId: string | null;
  relatedSecurityEventId: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type ListAdminAlertsQuery = {
  page?: number;
  page_size?: number;
  status?: string;
  severity?: string;
  type?: string;
};

const alertsQueryString = (query: ListAdminAlertsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.severity?.trim()) {
    params.set("severity", query.severity.trim());
  }
  if (query.type?.trim()) {
    params.set("type", query.type.trim());
  }
  return `?${params.toString()}`;
};

export type AdminAlertsListResponse = {
  success: true;
  data: { items: AlertListItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminAlerts = async (
  accessToken: string,
  query: ListAdminAlertsQuery = {}
): Promise<AdminAlertsListResponse> =>
  apiRequest<AdminAlertsListResponse>({
    path: `/api/admin/alerts${alertsQueryString(query)}`,
    accessToken
  });

export type AdminAlertDetailResponse = {
  success: true;
  data: { entity: AlertListItem };
};

export const getAdminAlertDetail = async (
  accessToken: string,
  alertId: string
): Promise<AdminAlertDetailResponse> =>
  apiRequest<AdminAlertDetailResponse>({
    path: `/api/admin/alerts/${encodeURIComponent(alertId)}`,
    accessToken
  });

export const assignAdminAlert = async (
  accessToken: string,
  alertId: string,
  body: { assignedToAdminUserId: string | null; note?: string }
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/alerts/${encodeURIComponent(alertId)}/assign`,
    accessToken,
    body
  });

export const acknowledgeAdminAlert = async (
  accessToken: string,
  alertId: string,
  body: { note?: string } = {}
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/alerts/${encodeURIComponent(alertId)}/acknowledge`,
    accessToken,
    body
  });

export const resolveAdminAlert = async (
  accessToken: string,
  alertId: string,
  body: { note?: string } = {}
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/alerts/${encodeURIComponent(alertId)}/resolve`,
    accessToken,
    body
  });

export const bulkAcknowledgeAdminAlerts = async (
  accessToken: string,
  body: { alertIds: string[]; note?: string }
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: "/api/admin/alerts/bulk-acknowledge",
    accessToken,
    body
  });

export const bulkAssignAdminAlerts = async (
  accessToken: string,
  body: { alertIds: string[]; assignedToAdminUserId: string | null; note?: string }
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: "/api/admin/alerts/bulk-assign",
    accessToken,
    body
  });

export { ApiError };
