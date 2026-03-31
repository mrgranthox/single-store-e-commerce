import { apiRequest, ApiError } from "@/lib/api/http";

export type AuditLogItem = {
  id: string;
  actorType: string;
  actorAdmin: unknown;
  actionCode: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  note: string | null;
  metadata: unknown;
  createdAt: string;
};

export type ListAuditLogsQuery = {
  page?: number;
  page_size?: number;
  actionCode?: string;
  entityType?: string;
  entityId?: string;
  actorAdminUserId?: string;
  actorEmailContains?: string;
};

const auditQueryString = (query: ListAuditLogsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.actionCode?.trim()) {
    params.set("actionCode", query.actionCode.trim());
  }
  if (query.entityType?.trim()) {
    params.set("entityType", query.entityType.trim());
  }
  if (query.entityId?.trim()) {
    params.set("entityId", query.entityId.trim());
  }
  if (query.actorAdminUserId?.trim()) {
    params.set("actorAdminUserId", query.actorAdminUserId.trim());
  }
  if (query.actorEmailContains?.trim()) {
    params.set("actorEmailContains", query.actorEmailContains.trim());
  }
  return `?${params.toString()}`;
};

export type AdminAuditLogsResponse = {
  success: true;
  data: { items: AuditLogItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminAuditLogs = async (
  accessToken: string,
  query: ListAuditLogsQuery = {}
): Promise<AdminAuditLogsResponse> =>
  apiRequest<AdminAuditLogsResponse>({
    path: `/api/admin/audit-logs${auditQueryString(query)}`,
    accessToken
  });

export type AdminActionLogItem = {
  id: string;
  adminUser: { id: string; email: string | null } | null;
  screen: string | null;
  actionCode: string;
  reason: string | null;
  note: string | null;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type ListAdminActionLogsQuery = {
  page?: number;
  page_size?: number;
  actionCode?: string;
  entityType?: string;
  entityId?: string;
  adminUserId?: string;
  screen?: string;
};

const adminActionsQueryString = (query: ListAdminActionLogsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.actionCode?.trim()) {
    params.set("actionCode", query.actionCode.trim());
  }
  if (query.entityType?.trim()) {
    params.set("entityType", query.entityType.trim());
  }
  if (query.entityId?.trim()) {
    params.set("entityId", query.entityId.trim());
  }
  if (query.adminUserId?.trim()) {
    params.set("adminUserId", query.adminUserId.trim());
  }
  if (query.screen?.trim()) {
    params.set("screen", query.screen.trim());
  }
  return `?${params.toString()}`;
};

export type AdminActionLogsResponse = {
  success: true;
  data: { items: AdminActionLogItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminActionLogs = async (
  accessToken: string,
  query: ListAdminActionLogsQuery = {}
): Promise<AdminActionLogsResponse> =>
  apiRequest<AdminActionLogsResponse>({
    path: `/api/admin/admin-action-logs${adminActionsQueryString(query)}`,
    accessToken
  });

export { ApiError };
