import { apiRequest } from "@/lib/api/http";
import type { AdminActor } from "@/features/auth/auth.store";

/** Matches backend `loginAdmin` return shape (see admin-auth.service). */
export type AdminLoginPayload = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  admin: {
    id: string;
    email: string;
    status: string;
  };
  roles: Array<{ id: string; code: string; name: string }>;
  permissions: string[];
  session: {
    sessionId: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
  };
};

type LoginResponse = {
  success: true;
  data: AdminLoginPayload;
};

export const adminLoginPayloadToActor = (payload: AdminLoginPayload): AdminActor => ({
  id: payload.admin.id,
  email: payload.admin.email,
  fullName: null,
  roles: payload.roles.map((role) => role.code),
  permissions: payload.permissions
});

type AdminMeResponse = {
  success: true;
  data: {
    admin: {
      id: string;
      email: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    };
    roles: Array<{ id: string; code: string; name: string }>;
    permissions: string[];
    session: {
      sessionId: string;
      sessionType: string;
      deviceLabel: string | null;
      createdAt: string;
      lastActiveAt: string;
      revokedAt: string | null;
    } | null;
  };
};

type AdminSessionsResponse = {
  success: true;
  data: {
    items: Array<{
      id: string;
      current: boolean;
      userAgent: string | null;
      ipAddress: string | null;
      lastSeenAt: string | null;
      issuedAt: string;
      expiresAt: string;
    }>;
  };
};

type AdminStepUpResponse = {
  success: true;
  data: {
    token: string;
    expiresInMinutes: number;
  };
};

export const loginAdmin = async (body: { email: string; password: string }) =>
  apiRequest<LoginResponse>({
    path: "/api/admin/auth/login",
    method: "POST",
    body
  });

export const forgotAdminPassword = async (body: { email: string }) =>
  apiRequest<{ success: true; message?: string }>({
    path: "/api/admin/auth/forgot-password",
    method: "POST",
    body
  });

export const resetAdminPassword = async (body: { token: string; newPassword: string }) =>
  apiRequest<{ success: true; message?: string }>({
    path: "/api/admin/auth/reset-password",
    method: "POST",
    body
  });

export const fetchCurrentAdmin = async (accessToken: string) =>
  apiRequest<AdminMeResponse>({
    path: "/api/admin/auth/me",
    accessToken
  });

export const fetchAdminSessions = async (accessToken: string) =>
  apiRequest<AdminSessionsResponse>({
    path: "/api/admin/auth/sessions",
    accessToken
  });

export const logoutAdmin = async (accessToken: string) =>
  apiRequest<{ success: true }>({
    path: "/api/admin/auth/logout",
    method: "POST",
    accessToken
  });

export const createAdminStepUp = async (
  accessToken: string,
  body: { email: string; password: string }
) =>
  apiRequest<AdminStepUpResponse>({
    path: "/api/admin/auth/step-up",
    method: "POST",
    accessToken,
    body
  });

export const revokeAdminSession = async (
  accessToken: string,
  sessionId: string,
  stepUpToken?: string
) =>
  apiRequest<{ success: true }>({
    path: `/api/admin/auth/sessions/${encodeURIComponent(sessionId)}/revoke`,
    method: "POST",
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined
  });

export const revokeAllAdminSessions = async (accessToken: string, stepUpToken?: string) =>
  apiRequest<{ success: true }>({
    path: "/api/admin/auth/sessions/revoke-all",
    method: "POST",
    accessToken,
    headers: stepUpToken ? { "x-admin-step-up-token": stepUpToken } : undefined
  });
