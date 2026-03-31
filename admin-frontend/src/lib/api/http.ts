import { resolveBackendBaseUrl } from "@/lib/config/runtime";
import { useAdminAuthStore, type AdminActor } from "@/features/auth/auth.store";

export class ApiError extends Error {
  statusCode: number;
  payload: unknown;

  constructor(message: string, statusCode: number, payload: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

type ApiRequestInput = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  accessToken?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  backendBaseUrl?: string;
  allowRefresh?: boolean;
};

type ApiEnvelope = {
  success: boolean;
  data?: unknown;
  meta?: unknown;
  message?: string;
  error?: {
    message?: string;
    code?: string;
  };
};

const isApiEnvelope = (value: unknown): value is ApiEnvelope =>
  typeof value === "object" && value !== null && "success" in value;

type AdminRefreshPayload = {
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
};

let adminTokenRefreshPromise: Promise<string | null> | null = null;

const payloadToActor = (payload: AdminRefreshPayload): AdminActor => ({
  id: payload.admin.id,
  email: payload.admin.email,
  fullName: null,
  roles: payload.roles.map((role) => role.code),
  permissions: payload.permissions
});

const readResponsePayload = async (response: Response) =>
  (await response.json().catch(() => null)) as ApiEnvelope | null;

const performAdminTokenRefresh = async (backendBaseUrl?: string) => {
  const {
    refreshToken,
    remembered,
    clearSession,
    setSession
  } = useAdminAuthStore.getState();

  if (!refreshToken) {
    clearSession();
    return null;
  }

  if (!adminTokenRefreshPromise) {
    adminTokenRefreshPromise = (async () => {
      const response = await fetch(new URL("/api/admin/auth/refresh", backendBaseUrl ?? resolveBackendBaseUrl()), {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({ refreshToken })
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          clearSession();
          return null;
        }

        throw new ApiError(
          payload?.error?.message ?? payload?.message ?? `Request failed with status ${response.status}`,
          response.status,
          payload
        );
      }

      if (!isApiEnvelope(payload) || payload.success !== true || !payload.data) {
        throw new ApiError("Response did not match the expected success envelope.", response.status, payload);
      }

      const refreshData = payload.data as AdminRefreshPayload;
      setSession({
        accessToken: refreshData.accessToken,
        refreshToken: refreshData.refreshToken,
        actor: payloadToActor(refreshData),
        remember: remembered
      });

      return refreshData.accessToken;
    })().finally(() => {
      adminTokenRefreshPromise = null;
    });
  }

  return adminTokenRefreshPromise;
};

export const apiRequest = async <T>(input: ApiRequestInput): Promise<T> => {
  const response = await fetch(new URL(input.path, input.backendBaseUrl ?? resolveBackendBaseUrl()), {
    method: input.method ?? "GET",
    headers: {
      accept: "application/json",
      ...(input.body ? { "content-type": "application/json" } : {}),
      ...(input.accessToken ? { authorization: `Bearer ${input.accessToken}` } : {}),
      ...input.headers
    },
    body: input.body ? JSON.stringify(input.body) : undefined
  });

  const payload = await readResponsePayload(response);

  const mayRefresh =
    response.status === 401 &&
    input.allowRefresh !== false &&
    Boolean(input.accessToken) &&
    input.path !== "/api/admin/auth/refresh";

  if (mayRefresh) {
    const refreshedAccessToken = await performAdminTokenRefresh(input.backendBaseUrl);
    if (refreshedAccessToken) {
      return apiRequest<T>({
        ...input,
        accessToken: refreshedAccessToken,
        allowRefresh: false
      });
    }
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? payload?.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  if (!isApiEnvelope(payload) || payload.success !== true) {
    throw new ApiError("Response did not match the expected success envelope.", response.status, payload);
  }

  return payload as T;
};
