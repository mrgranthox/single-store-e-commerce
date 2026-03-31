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
  webhookEventId: string
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/webhooks/${encodeURIComponent(webhookEventId)}/retry`,
    accessToken,
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

export { ApiError };
