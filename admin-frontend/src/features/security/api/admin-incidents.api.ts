import { apiRequest, ApiError } from "@/lib/api/http";

export type IncidentListItem = {
  id: string;
  status: string;
  title: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  createdBy: unknown;
  metadata?: unknown;
};

export type ListIncidentsQuery = {
  page?: number;
  page_size?: number;
  status?: string;
  q?: string;
};

const incidentsQs = (query: ListIncidentsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  return `?${params.toString()}`;
};

export type IncidentsListResponse = {
  success: true;
  data: { items: IncidentListItem[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminIncidents = async (
  accessToken: string,
  query: ListIncidentsQuery = {}
): Promise<IncidentsListResponse> =>
  apiRequest<IncidentsListResponse>({
    path: `/api/admin/incidents${incidentsQs(query)}`,
    accessToken
  });

export type IncidentDetailEntity = IncidentListItem & { metadata: unknown };

export type IncidentDetailResponse = {
  success: true;
  data: { entity: IncidentDetailEntity };
};

export const getAdminIncidentDetail = async (
  accessToken: string,
  incidentId: string
): Promise<IncidentDetailResponse> =>
  apiRequest<IncidentDetailResponse>({
    path: `/api/admin/incidents/${encodeURIComponent(incidentId)}`,
    accessToken
  });

export const closeAdminIncident = async (
  accessToken: string,
  incidentId: string,
  body: { note?: string } = {}
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/incidents/${encodeURIComponent(incidentId)}/close`,
    accessToken,
    body
  });

export const createAdminIncident = async (
  accessToken: string,
  body: { title: string; summary?: string; metadata?: Record<string, unknown> }
): Promise<IncidentDetailResponse> =>
  apiRequest<IncidentDetailResponse>({
    method: "POST",
    path: "/api/admin/incidents",
    accessToken,
    body
  });

export const patchAdminIncident = async (
  accessToken: string,
  incidentId: string,
  body: {
    title?: string;
    summary?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<IncidentDetailResponse> =>
  apiRequest<IncidentDetailResponse>({
    method: "PATCH",
    path: `/api/admin/incidents/${encodeURIComponent(incidentId)}`,
    accessToken,
    body
  });

export { ApiError };
