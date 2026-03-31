import { apiRequest, ApiError } from "@/lib/api/http";

/** Matches backend `serializeSecurityEvent` (field is `type`, not `eventType`). */
export type SecurityEventListItem = {
  id: string;
  type: string;
  severity: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  metadata: unknown;
  user: { id: string; email: string | null; name: string | null } | null;
  adminUser: unknown;
};

export type ListSecurityEventsQuery = {
  page?: number;
  page_size?: number;
  severity?: string;
  status?: string;
  type?: string;
  userId?: string;
  adminUserId?: string;
};

export type SecurityEventsListResponse = {
  success: true;
  data: { items: SecurityEventListItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

const securityEventsQs = (query: ListSecurityEventsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.severity?.trim()) {
    params.set("severity", query.severity.trim());
  }
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.type?.trim()) {
    params.set("type", query.type.trim());
  }
  if (query.userId?.trim()) {
    params.set("userId", query.userId.trim());
  }
  if (query.adminUserId?.trim()) {
    params.set("adminUserId", query.adminUserId.trim());
  }
  return `?${params.toString()}`;
};

export const listSecurityEvents = async (
  accessToken: string,
  query: ListSecurityEventsQuery = {}
): Promise<SecurityEventsListResponse> =>
  apiRequest<SecurityEventsListResponse>({
    path: `/api/admin/security-events${securityEventsQs(query)}`,
    accessToken
  });

export type SecurityEventDetailResponse = {
  success: true;
  data: { entity: SecurityEventListItem };
};

export const getSecurityEventDetail = async (
  accessToken: string,
  eventId: string
): Promise<SecurityEventDetailResponse> =>
  apiRequest<SecurityEventDetailResponse>({
    path: `/api/admin/security-events/${encodeURIComponent(eventId)}`,
    accessToken
  });

/** Matches backend `serializeRiskSignal` (no `status` field — use `reviewedAt`). */
export type RiskSignalItem = {
  id: string;
  type: string;
  score: number | null;
  createdAt: string;
  reviewedAt: string | null;
  adminReviewedByAdminUserId: string | null;
  metadata: unknown;
  user: { id: string; email: string | null; name: string | null } | null;
};

export type ListRiskSignalsQuery = {
  page?: number;
  page_size?: number;
  type?: string;
  userId?: string;
  minScore?: number;
  reviewed?: boolean;
};

export type RiskSignalsListResponse = {
  success: true;
  data: { items: RiskSignalItem[] };
  meta?: { page: number; limit: number; totalItems: number; totalPages: number };
};

const riskSignalsQs = (query: ListRiskSignalsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.type?.trim()) {
    params.set("type", query.type.trim());
  }
  if (query.userId?.trim()) {
    params.set("userId", query.userId.trim());
  }
  if (query.minScore != null && !Number.isNaN(query.minScore)) {
    params.set("minScore", String(query.minScore));
  }
  if (query.reviewed === true) {
    params.set("reviewed", "true");
  }
  if (query.reviewed === false) {
    params.set("reviewed", "false");
  }
  return `?${params.toString()}`;
};

export const listRiskSignals = async (
  accessToken: string,
  query: ListRiskSignalsQuery = {}
): Promise<RiskSignalsListResponse> =>
  apiRequest<RiskSignalsListResponse>({
    path: `/api/admin/risk-signals${riskSignalsQs(query)}`,
    accessToken
  });

export type TimelineEventItem = {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  actorAdminUserId: string | null;
  actorType: string;
  payload: unknown;
  occurredAt: string;
  createdAt: string;
};

export type UserActivityQuery = {
  page?: number;
  page_size?: number;
  entityType?: string;
  entityId?: string;
  eventType?: string;
  actorAdminUserId?: string;
  occurredAtFrom?: string;
  occurredAtTo?: string;
};

export type UserActivityListResponse = {
  success: true;
  data: { items: TimelineEventItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

const userActivityQs = (query: UserActivityQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 25));
  if (query.entityType?.trim()) {
    params.set("entityType", query.entityType.trim());
  }
  if (query.entityId?.trim()) {
    params.set("entityId", query.entityId.trim());
  }
  if (query.eventType?.trim()) {
    params.set("eventType", query.eventType.trim());
  }
  if (query.actorAdminUserId?.trim()) {
    params.set("actorAdminUserId", query.actorAdminUserId.trim());
  }
  if (query.occurredAtFrom?.trim()) {
    params.set("occurredAtFrom", query.occurredAtFrom.trim());
  }
  if (query.occurredAtTo?.trim()) {
    params.set("occurredAtTo", query.occurredAtTo.trim());
  }
  return `?${params.toString()}`;
};

export const getUserActivityExplorer = async (
  accessToken: string,
  query: UserActivityQuery = {}
): Promise<UserActivityListResponse> =>
  apiRequest<UserActivityListResponse>({
    path: `/api/admin/user-activity${userActivityQs(query)}`,
    accessToken
  });

export type SecurityDashboardData = {
  metrics: {
    openSecurityEvents: number;
    criticalSecurityEventsLast24Hours: number;
    unreviewedRiskSignals: number;
    failedLoginsLast24Hours: number;
    openAlerts: number;
    openIncidents: number;
    suspendedAccounts: number;
    flaggedTransactionsLast24h: number;
    alertsOpenBySeverity?: Record<string, number>;
    incidentsOps?: {
      open: number;
      investigating: number;
      resolvedOrClosedLast7Days: number;
      avgMttrHoursLast7Days: number | null;
    };
    riskSignalsOps?: {
      unreviewedScoreGte70: number;
      createdLast24h: number;
    };
  };
  recentSecurityEvents: unknown[];
  topRiskSignals: unknown[];
  activeAlertsList?: unknown[];
  openIncidentsList?: unknown[];
};

export type SecurityDashboardResponse = {
  success: true;
  data: SecurityDashboardData;
};

export const getSecurityDashboard = async (
  accessToken: string
): Promise<SecurityDashboardResponse> =>
  apiRequest<SecurityDashboardResponse>({
    path: "/api/admin/security/dashboard",
    accessToken
  });

export const reviewRiskSignal = async (
  accessToken: string,
  riskSignalId: string,
  body: { note?: string; disposition?: "reviewed" | "escalated" }
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/risk-signals/${encodeURIComponent(riskSignalId)}/review`,
    accessToken,
    body
  });

export const notifySecurityEvent = async (
  accessToken: string,
  eventId: string,
  body: { note?: string } = {}
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/security-events/${encodeURIComponent(eventId)}/notify`,
    accessToken,
    body
  });

export const requestSecurityEventIpBlock = async (
  accessToken: string,
  eventId: string,
  body: { note?: string } = {}
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/security-events/${encodeURIComponent(eventId)}/request-ip-block`,
    accessToken,
    body
  });

export const postSecurityEventStatus = async (
  accessToken: string,
  eventId: string,
  body: { nextStatus?: string; note?: string } = {}
) =>
  apiRequest<{ success: true; data: unknown }>({
    method: "POST",
    path: `/api/admin/security-events/${encodeURIComponent(eventId)}/status`,
    accessToken,
    body: { nextStatus: body.nextStatus ?? "RESOLVED", note: body.note }
  });

export { ApiError };
