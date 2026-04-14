import { apiRequest, ApiError } from "@/lib/api/http";

export type AdminRoleRef = {
  id: string;
  code: string;
  name: string;
};

export type AdminUserRow = {
  id: string;
  clerkAdminUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  roles: AdminRoleRef[];
  security?: {
    totalSessions: number;
    activeSessions: number;
  };
};

export type AdminUserSessionRow = {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  ipCountry: string | null;
  ipRegion: string | null;
  issuedAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

export type AdminInvitationRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  status: string;
  expiresAt: string;
  lastSentAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  note: string | null;
  invitedBy: { id: string; email: string; fullName: string | null } | null;
  revokedBy: { id: string; email: string; fullName: string | null } | null;
  roles: AdminRoleRef[];
  createdAt: string;
  updatedAt: string;
};

export type ListAdminUsersQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: string;
};

const queryString = (query: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && `${value}`.trim() !== "") {
      params.set(key, String(value));
    }
  });
  return `?${params.toString()}`;
};

export type AdminUsersListResponse = {
  success: true;
  data: { items: AdminUserRow[]; availableRoles: AdminRoleRef[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminUsers = async (
  accessToken: string,
  query: ListAdminUsersQuery = {}
): Promise<AdminUsersListResponse> =>
  apiRequest<AdminUsersListResponse>({
    path: `/api/admin/admin-users${queryString({
      page: query.page ?? 1,
      page_size: query.page_size ?? 20,
      q: query.q,
      status: query.status
    })}`,
    accessToken
  });

export type AdminUserDetailResponse = {
  success: true;
  data: { entity: AdminUserRow };
};

export const getAdminUser = async (
  accessToken: string,
  adminUserId: string
): Promise<AdminUserDetailResponse> =>
  apiRequest<AdminUserDetailResponse>({
    path: `/api/admin/admin-users/${encodeURIComponent(adminUserId)}`,
    accessToken
  });

export const createAdminUser = async (
  accessToken: string,
  body: {
    clerkAdminUserId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    roleCodes: string[];
  },
  stepUpToken?: string
): Promise<AdminUserDetailResponse> =>
  apiRequest<AdminUserDetailResponse>({
    method: "POST",
    path: "/api/admin/admin-users",
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body
  });

export const updateAdminUser = async (
  accessToken: string,
  adminUserId: string,
  body: { firstName?: string | null; lastName?: string | null }
): Promise<AdminUserDetailResponse> =>
  apiRequest<AdminUserDetailResponse>({
    method: "PATCH",
    path: `/api/admin/admin-users/${encodeURIComponent(adminUserId)}`,
    accessToken,
    body
  });

export const updateAdminUserRoles = async (
  accessToken: string,
  adminUserId: string,
  body: { roleCodes: string[] },
  stepUpToken?: string
): Promise<AdminUserDetailResponse> =>
  apiRequest<AdminUserDetailResponse>({
    method: "PATCH",
    path: `/api/admin/admin-users/${encodeURIComponent(adminUserId)}/roles`,
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body
  });

export const suspendAdminUser = async (
  accessToken: string,
  adminUserId: string,
  body: { reason?: string; note?: string } = {},
  stepUpToken?: string
): Promise<AdminUserDetailResponse> =>
  apiRequest<AdminUserDetailResponse>({
    method: "POST",
    path: `/api/admin/admin-users/${encodeURIComponent(adminUserId)}/suspend`,
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body
  });

export const reactivateAdminUser = async (
  accessToken: string,
  adminUserId: string,
  body: { reason?: string; note?: string } = {},
  stepUpToken?: string
): Promise<AdminUserDetailResponse> =>
  apiRequest<AdminUserDetailResponse>({
    method: "POST",
    path: `/api/admin/admin-users/${encodeURIComponent(adminUserId)}/reactivate`,
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body
  });

export type AdminUserSessionsResponse = {
  success: true;
  data: { items: AdminUserSessionRow[] };
  meta: { total: number; active: number };
};

export const listAdminUserSessions = async (
  accessToken: string,
  adminUserId: string
): Promise<AdminUserSessionsResponse> =>
  apiRequest<AdminUserSessionsResponse>({
    path: `/api/admin/admin-users/${encodeURIComponent(adminUserId)}/sessions`,
    accessToken
  });

export const revokeAdminUserSession = async (
  accessToken: string,
  adminUserId: string,
  sessionId: string,
  body: { reason?: string; note?: string } = {},
  stepUpToken?: string
): Promise<{ success: true; data: { ok: true } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/admin-users/${encodeURIComponent(adminUserId)}/sessions/${encodeURIComponent(sessionId)}/revoke`,
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body
  });

export type ListAdminInvitationsQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: string;
};

export type AdminInvitationsResponse = {
  success: true;
  data: { items: AdminInvitationRow[]; availableRoles: AdminRoleRef[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listAdminInvitations = async (
  accessToken: string,
  query: ListAdminInvitationsQuery = {}
): Promise<AdminInvitationsResponse> =>
  apiRequest<AdminInvitationsResponse>({
    path: `/api/admin/admin-users/invitations${queryString({
      page: query.page ?? 1,
      page_size: query.page_size ?? 20,
      q: query.q,
      status: query.status
    })}`,
    accessToken
  });

export const createAdminInvitation = async (
  accessToken: string,
  body: {
    email: string;
    firstName?: string;
    lastName?: string;
    roleCodes: string[];
    note?: string;
  },
  stepUpToken?: string
): Promise<{ success: true; data: { entity: AdminInvitationRow } }> =>
  apiRequest({
    method: "POST",
    path: "/api/admin/admin-users/invitations",
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body
  });

export const resendAdminInvitation = async (
  accessToken: string,
  invitationId: string,
  stepUpToken?: string
): Promise<{ success: true; data: { entity: AdminInvitationRow } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/admin-users/invitations/${encodeURIComponent(invitationId)}/resend`,
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body: {}
  });

export const revokeAdminInvitation = async (
  accessToken: string,
  invitationId: string,
  body: { note?: string } = {},
  stepUpToken?: string
): Promise<{ success: true; data: { entity: AdminInvitationRow } }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/admin-users/invitations/${encodeURIComponent(invitationId)}/revoke`,
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined,
    body
  });

export { ApiError };
