import { apiRequest, ApiError } from "@/lib/api/http";

export type SystemSettingRow = {
  id: string;
  storeId: string | null;
  key: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
};

export type AdminSystemSettingsResponse = {
  success: true;
  data: { items: SystemSettingRow[] };
};

export const listAdminSystemSettings = async (
  accessToken: string
): Promise<AdminSystemSettingsResponse> =>
  apiRequest<AdminSystemSettingsResponse>({
    path: "/api/admin/settings",
    accessToken
  });

export const patchAdminSystemSettings = async (
  accessToken: string,
  settings: Array<{ key: string; value: unknown }>,
  stepUpToken?: string
): Promise<AdminSystemSettingsResponse> =>
  apiRequest<AdminSystemSettingsResponse>({
    method: "PATCH",
    path: "/api/admin/settings",
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body: { settings }
  });

export type SettingsScope = "checkout" | "reviews" | "support";

export const listAdminSettingsScoped = async (
  accessToken: string,
  scope: SettingsScope
): Promise<AdminSystemSettingsResponse> =>
  apiRequest<AdminSystemSettingsResponse>({
    path: `/api/admin/settings/${scope}`,
    accessToken
  });

export const patchAdminSettingsScoped = async (
  accessToken: string,
  scope: SettingsScope,
  settings: Array<{ key: string; value: unknown }>,
  stepUpToken?: string
): Promise<AdminSystemSettingsResponse> =>
  apiRequest<AdminSystemSettingsResponse>({
    method: "PATCH",
    path: `/api/admin/settings/${scope}`,
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body: { settings }
  });

export type WebhookEventRow = {
  id: string;
  provider: string;
  eventType: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  receivedAt?: string;
  attemptCount?: number;
  latestAttempt?: {
    id: string;
    attemptNo: number;
    status: string;
    startedAt: string;
    finishedAt: string | null;
  } | null;
};

export type WebhooksListResponse = {
  success: true;
  data: { items: WebhookEventRow[] };
  meta: { page: number; pageSize: number; total: number };
};

export type ListWebhooksQuery = {
  page?: number;
  pageSize?: number;
  status?: string;
  provider?: string;
  eventType?: string;
  receivedAfter?: string;
  receivedBefore?: string;
};

const webhooksQs = (query: ListWebhooksQuery) => {
  const p = new URLSearchParams();
  p.set("page", String(query.page ?? 1));
  p.set("pageSize", String(query.pageSize ?? 20));
  if (query.status?.trim()) {
    p.set("status", query.status.trim());
  }
  if (query.provider?.trim()) {
    p.set("provider", query.provider.trim());
  }
  if (query.eventType?.trim()) {
    p.set("eventType", query.eventType.trim());
  }
  if (query.receivedAfter?.trim()) {
    p.set("receivedAfter", query.receivedAfter.trim());
  }
  if (query.receivedBefore?.trim()) {
    p.set("receivedBefore", query.receivedBefore.trim());
  }
  return `?${p.toString()}`;
};

export const listAdminWebhooks = async (
  accessToken: string,
  query: ListWebhooksQuery = {}
): Promise<WebhooksListResponse> =>
  apiRequest<WebhooksListResponse>({
    path: `/api/admin/webhooks${webhooksQs(query)}`,
    accessToken
  });

export type WebhookEventDetailResponse = {
  success: true;
  data: Record<string, unknown>;
};

export const getAdminWebhookEvent = async (
  accessToken: string,
  webhookEventId: string
): Promise<WebhookEventDetailResponse> =>
  apiRequest<WebhookEventDetailResponse>({
    path: `/api/admin/webhooks/${encodeURIComponent(webhookEventId)}`,
    accessToken
  });

export const retryAdminWebhookEvent = async (
  accessToken: string,
  webhookEventId: string,
  stepUpToken?: string
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/webhooks/${encodeURIComponent(webhookEventId)}/retry`,
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body: {}
  });

export type IntegrationsHealthResponse = {
  success: true;
  data: unknown;
};

export const getIntegrationsHealth = async (
  accessToken: string
): Promise<IntegrationsHealthResponse> =>
  apiRequest<IntegrationsHealthResponse>({
    path: "/api/admin/integrations/health",
    accessToken
  });

export type NotificationRow = {
  id: string;
  type: string;
  channel: string;
  status: string;
  recipientUser: { id: string; email: string; name: string | null } | null;
  recipientEmail: string | null;
  recipientType: string | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
  deliveries: Array<{
    id: string;
    providerMessageId: string | null;
    status: string;
    error: unknown;
    sentAt: string | null;
    createdAt: string;
  }>;
};

export type AdminNotificationsResponse = {
  success: true;
  data: { items: NotificationRow[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export type AdminNotificationDetailResponse = {
  success: true;
  data: { entity: NotificationRow };
};

export type ListAdminNotificationsQuery = {
  page?: number;
  page_size?: number;
  status?: string;
  type?: string;
  channel?: string;
  recipientUserId?: string;
  recipientEmail?: string;
};

const notificationsQueryString = (query: ListAdminNotificationsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.status?.trim()) params.set("status", query.status.trim());
  if (query.type?.trim()) params.set("type", query.type.trim());
  if (query.channel?.trim()) params.set("channel", query.channel.trim());
  if (query.recipientUserId?.trim()) params.set("recipientUserId", query.recipientUserId.trim());
  if (query.recipientEmail?.trim()) params.set("recipientEmail", query.recipientEmail.trim());
  return `?${params.toString()}`;
};

export const listAdminNotifications = async (
  accessToken: string,
  query: ListAdminNotificationsQuery = {}
): Promise<AdminNotificationsResponse> =>
  apiRequest<AdminNotificationsResponse>({
    path: `/api/admin/notifications${notificationsQueryString(query)}`,
    accessToken
  });

export const getAdminNotification = async (
  accessToken: string,
  notificationId: string
): Promise<AdminNotificationDetailResponse> =>
  apiRequest<AdminNotificationDetailResponse>({
    path: `/api/admin/notifications/${encodeURIComponent(notificationId)}`,
    accessToken
  });

export const retryAdminNotification = async (
  accessToken: string,
  notificationId: string,
  stepUpToken?: string
): Promise<AdminNotificationDetailResponse> =>
  apiRequest<AdminNotificationDetailResponse>({
    method: "POST",
    path: `/api/admin/notifications/${encodeURIComponent(notificationId)}/retry`,
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body: {}
  });

export const createAdminNotification = async (
  accessToken: string,
  body: {
    type: string;
    channel?: string;
    recipientUserId?: string;
    recipientEmail?: string;
    recipientType?: string;
    payload?: Record<string, unknown>;
  },
  stepUpToken?: string
): Promise<AdminNotificationDetailResponse> =>
  apiRequest<AdminNotificationDetailResponse>({
    method: "POST",
    path: "/api/admin/notifications",
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body
  });

export type BroadcastSegment = "ALL_ACTIVE_CUSTOMERS" | "MARKETING_OPT_IN" | "ALL_ACTIVE_ADMINS";

export type BroadcastSegmentPreviewResponse = {
  success: true;
  data: { segment: BroadcastSegment; recipientCount: number };
};

export const getBroadcastSegmentPreview = async (
  accessToken: string,
  segment: BroadcastSegment
): Promise<BroadcastSegmentPreviewResponse> =>
  apiRequest<BroadcastSegmentPreviewResponse>({
    path: `/api/admin/notifications/broadcast/segment-preview?segment=${encodeURIComponent(segment)}`,
    accessToken
  });

export type BroadcastEnqueueResponse = {
  success: true;
  data: {
    broadcastBatchId: string;
    segment: BroadcastSegment;
    type: string;
    expectedRecipients: number;
    enqueued: number;
    failed: number;
    lastError: string | null;
  };
};

export const broadcastAdminNotifications = async (
  accessToken: string,
  body: { segment: BroadcastSegment; type?: string; payload: Record<string, unknown> },
  stepUpToken?: string
): Promise<BroadcastEnqueueResponse> =>
  apiRequest<BroadcastEnqueueResponse>({
    method: "POST",
    path: "/api/admin/notifications/broadcast",
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body
  });

export { ApiError };
