import { clearAuthTokens, getAccessToken, getOrCreateSessionId } from "@/lib/api/commerce-session";

export const getBackendBaseUrl = () =>
  import.meta.env.VITE_BACKEND_BASE_URL?.trim() || (typeof window !== "undefined" ? window.location.origin : "");

export type CommerceSuccess<T> = { data: T; meta?: Record<string, unknown> };

export class CommerceApiError extends Error {
  readonly status: number;

  readonly code: string | null;

  readonly details: unknown;

  readonly payload: unknown;

  constructor(message: string, status: number, code: string | null, details: unknown, payload: unknown) {
    super(message);
    this.name = "CommerceApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.payload = payload;
  }
}

type JsonEnvelope =
  | { success: true; data: unknown; meta?: Record<string, unknown> }
  | { success: false; error: { code?: string; message?: string; details?: unknown } };

const parseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { parseError: true, text };
  }
};

export type CommerceFetchOptions = RequestInit & {
  json?: unknown;
  /** When true (default), send x-session-id. */
  session?: boolean;
  /** When true, attach Bearer access token if present. */
  auth?: boolean;
};

export const commerceFetchJson = async <T>(
  path: string,
  options: CommerceFetchOptions = {}
): Promise<CommerceSuccess<T>> => {
  const base = getBackendBaseUrl();
  const url = path.startsWith("http") ? new URL(path) : new URL(path, base);
  const { json, session = true, auth = true, headers: initHeaders, ...rest } = options;

  const headers = new Headers(initHeaders);
  headers.set("accept", "application/json");
  if (json !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (session) {
    headers.set("x-session-id", getOrCreateSessionId());
  }
  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body
  });

  const payload = (await parseJson(response)) as JsonEnvelope | Record<string, unknown> | null;

  if (!payload || typeof payload !== "object") {
    throw new CommerceApiError("Empty response from API.", response.status, null, null, payload);
  }

  if ("success" in payload && payload.success === false) {
    const err = payload.error as { code?: string; message?: string; details?: unknown } | undefined;
    const message = err?.message ?? "Request failed.";
    const code = err?.code ?? null;
    throw new CommerceApiError(message, response.status, code, err?.details ?? null, payload);
  }

  if (!response.ok) {
    throw new CommerceApiError(`Request failed with status ${response.status}.`, response.status, null, null, payload);
  }

  if (!("success" in payload) || payload.success !== true) {
    throw new CommerceApiError("Unexpected response envelope.", response.status, null, null, payload);
  }

  return {
    data: payload.data as T,
    meta: payload.meta as Record<string, unknown> | undefined
  };
};

export const commerceLogoutClient = () => {
  clearAuthTokens();
};
