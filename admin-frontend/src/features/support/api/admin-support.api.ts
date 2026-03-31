import { apiRequest, ApiError } from "@/lib/api/http";

export type SupportTicketListItem = {
  id: string;
  subject: string;
  supportType: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  order: { id: string; orderNumber: string } | null;
  productContext: { productId: string; productSlug: string | null; productTitle: string | null } | null;
  assignee: { id: string; email: string | null } | null;
  customer: { id: string | null; email: string | null; name: string | null };
  summary: string | null;
  lastMessageAt: string;
  messageCount: number;
  attachmentCount: number;
  slaDueAt: string;
  firstAdminReplyAt: string | null;
  slaSecondsRemaining: number | null;
  slaBreached: boolean;
  slaMet: boolean;
};

export type SupportTicketsListResponse = {
  success: true;
  data: { items: SupportTicketListItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export type ListSupportTicketsQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: string;
  priority?: string;
  supportType?: string;
  assignment?: "any" | "unassigned" | "me";
};

const ticketsQuery = (query: ListSupportTicketsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.priority?.trim()) {
    params.set("priority", query.priority.trim());
  }
  if (query.supportType?.trim()) {
    params.set("supportType", query.supportType.trim());
  }
  if (query.assignment && query.assignment !== "any") {
    params.set("assignment", query.assignment);
  }
  return `?${params.toString()}`;
};

export const listSupportTickets = async (
  accessToken: string,
  query: ListSupportTicketsQuery = {}
): Promise<SupportTicketsListResponse> =>
  apiRequest<SupportTicketsListResponse>({
    path: `/api/admin/support/tickets${ticketsQuery(query)}`,
    accessToken
  });

export type SupportQueueListResponse = {
  success: true;
  data: { items: SupportTicketListItem[] };
  meta?: { page: number; limit: number; totalItems: number; totalPages: number };
};

export type SupportSlaQueueResponse = {
  success: true;
  data: {
    metrics: { openCount: number; overdueCount: number; atRiskCount: number };
    items: SupportTicketListItem[];
  };
};

export type SupportQueueQuery = {
  page?: number;
  page_size?: number;
  status?: string;
  priority?: string;
  supportType?: string;
  assignment?: "any" | "unassigned" | "me";
  q?: string;
};

const buildQueueParams = (page: number, page_size: number, extra?: SupportQueueQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(page_size));
  if (extra?.status?.trim()) {
    params.set("status", extra.status.trim());
  }
  if (extra?.priority?.trim()) {
    params.set("priority", extra.priority.trim());
  }
  if (extra?.supportType?.trim()) {
    params.set("supportType", extra.supportType.trim());
  }
  if (extra?.assignment && extra.assignment !== "any") {
    params.set("assignment", extra.assignment);
  }
  if (extra?.q?.trim()) {
    params.set("q", extra.q.trim());
  }
  return `?${params.toString()}`;
};

export const listSupportSlaQueue = async (accessToken: string): Promise<SupportSlaQueueResponse> =>
  apiRequest<SupportSlaQueueResponse>({
    path: "/api/admin/support/queues/sla",
    accessToken
  });

export const listSupportPrePurchaseQueue = async (
  accessToken: string,
  page = 1,
  page_size = 20,
  extra?: SupportQueueQuery
): Promise<SupportQueueListResponse> =>
  apiRequest<SupportQueueListResponse>({
    path: `/api/admin/support/queues/pre-purchase${buildQueueParams(page, page_size, extra)}`,
    accessToken
  });

export const listSupportComplaintsQueue = async (
  accessToken: string,
  page = 1,
  page_size = 20,
  extra?: SupportQueueQuery
): Promise<SupportQueueListResponse> =>
  apiRequest<SupportQueueListResponse>({
    path: `/api/admin/support/queues/complaints${buildQueueParams(page, page_size, extra)}`,
    accessToken
  });

export type SupportReportPeriod = "daily" | "weekly" | "monthly";

export type SupportReportStatusRow = { status: string; count: number };
export type SupportReportPriorityRow = { priority: string; count: number };

export type SupportReportsData = {
  period: SupportReportPeriod;
  window: { start: string; end: string };
  openCount: number;
  openSlaBreachedCount: number;
  openSlaSampleCapped: boolean;
  byStatus: SupportReportStatusRow[];
  byPriority: SupportReportPriorityRow[];
  averages: {
    firstResponseMinutes: number | null;
    resolutionMinutes: number | null;
  };
  sla: {
    firstResponseCompliancePercent: number | null;
    byPriority: Array<{ priority: string; compliancePercent: number | null; sampleSize: number }>;
  };
  csat: { score: number | null; note: string };
  agentLeaderboard: Array<{
    adminUserId: string;
    email: string | null;
    resolved: number;
    avgResolutionMinutes: number | null;
  }>;
  prePurchase: {
    activeCount: number;
    guestCount: number;
    avgFirstResponseMinutes: number | null;
    slaAtRiskCount: number;
  };
  complaints: {
    openCount: number;
    slaAtRiskCount: number;
    resolvedInPeriod: number;
    resolutionRatePercent: number | null;
  };
  totals: {
    resolutionRatePercent: number | null;
  };
};

export type SupportReportsResponse = {
  success: true;
  data: SupportReportsData;
  meta?: Record<string, unknown>;
};

export const getSupportReports = async (
  accessToken: string,
  period: SupportReportPeriod = "weekly"
): Promise<SupportReportsResponse> =>
  apiRequest<SupportReportsResponse>({
    path: `/api/admin/support/reports?period=${encodeURIComponent(period)}`,
    accessToken
  });

export type SupportTicketMessage = {
  id: string;
  authorType: string;
  authorUserId: string | null;
  body: string;
  createdAt: string;
};

export type SupportTicketInternalNote = {
  id: string;
  note: string;
  actorAdminUserId: string | null;
  createdAt: string;
};

export type SupportTicketAttachment = {
  id: string;
  url: string;
  originalFilename: string | null;
  mimeType: string | null;
  messageId: string | null;
  createdAt: string;
};

export type SupportTicketDetailEntity = SupportTicketListItem & {
  messages: SupportTicketMessage[];
  internalNotes: SupportTicketInternalNote[];
  attachments: SupportTicketAttachment[];
  csatScore?: number | null;
  csatSubmittedAt?: string | null;
  allowedActions: {
    canReply: boolean;
    canAssign: boolean;
    canUpdateStatus: boolean;
    canAddInternalNote: boolean;
    canRecordCsat?: boolean;
  };
};

export type SupportTicketDetailResponse = {
  success: true;
  data: { entity: SupportTicketDetailEntity };
};

export const getSupportTicketDetail = async (
  accessToken: string,
  ticketId: string
): Promise<SupportTicketDetailResponse> =>
  apiRequest<SupportTicketDetailResponse>({
    path: `/api/admin/support/tickets/${encodeURIComponent(ticketId)}`,
    accessToken
  });

export type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "CLOSED" | "PENDING_CUSTOMER";

export const replySupportTicket = async (
  accessToken: string,
  ticketId: string,
  body: { body: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/support/tickets/${encodeURIComponent(ticketId)}/reply`,
    accessToken,
    body
  });

export const addSupportTicketInternalNote = async (
  accessToken: string,
  ticketId: string,
  body: { note: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/support/tickets/${encodeURIComponent(ticketId)}/internal-note`,
    accessToken,
    body
  });

export const assignSupportTicket = async (
  accessToken: string,
  ticketId: string,
  body: { assignedToAdminUserId: string | null; note?: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/support/tickets/${encodeURIComponent(ticketId)}/assign`,
    accessToken,
    body
  });

export const updateSupportTicketStatus = async (
  accessToken: string,
  ticketId: string,
  body: { status: SupportTicketStatus; note?: string }
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/support/tickets/${encodeURIComponent(ticketId)}/status`,
    accessToken,
    body
  });

export const recordSupportTicketCsat = async (
  accessToken: string,
  ticketId: string,
  body: { csatScore: number; note?: string }
): Promise<SupportTicketDetailResponse> =>
  apiRequest<SupportTicketDetailResponse>({
    method: "POST",
    path: `/api/admin/support/tickets/${encodeURIComponent(ticketId)}/csat`,
    accessToken,
    body
  });

export type BulkMutationResult = {
  updated: number;
  skipped: number;
  failed: number;
};

export const bulkAssignSupportTickets = async (
  accessToken: string,
  body: { ticketIds: string[]; assignedToAdminUserId: string | null }
): Promise<{ success: true; data: BulkMutationResult }> =>
  apiRequest({
    method: "POST",
    path: "/api/admin/support/tickets/bulk-assign",
    accessToken,
    body
  });

export const bulkStatusSupportTickets = async (
  accessToken: string,
  body: { ticketIds: string[]; status: SupportTicketStatus; note?: string }
): Promise<{ success: true; data: BulkMutationResult }> =>
  apiRequest({
    method: "POST",
    path: "/api/admin/support/tickets/bulk-status",
    accessToken,
    body
  });

export { ApiError };
