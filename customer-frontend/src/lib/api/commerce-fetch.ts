import { clearAuthTokens, getAccessToken, getOrCreateSessionId } from "@/lib/api/commerce-session";
import { customerFrontendEnv } from "@/lib/config/env";
import { useCustomerStore } from "@/lib/store/customer-store";

/**
 * Express API origin (no trailing slash).
 * - **Development:** falls back to `window.location.origin` so Vite’s `/api` proxy works.
 * - **Production:** must set `VITE_BACKEND_BASE_URL` at **build** time. Do not use the static site
 *   host (e.g. `*.netlify.app`) — there is no Express there, so `/api/*` returns 404 HTML.
 */
export const getBackendBaseUrl = (): string => {
  const fromEnv = customerFrontendEnv.backendBaseUrl;
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (customerFrontendEnv.isDev && typeof window !== "undefined") {
    return window.location.origin;
  }
  if (customerFrontendEnv.isProd) {
    if (typeof window !== "undefined") {
      console.error(
        "[customer-frontend] Missing VITE_BACKEND_BASE_URL. Set it in your host’s build env and redeploy " +
          "(Netlify: Site configuration → Environment variables → VITE_BACKEND_BASE_URL = https://your-api-host, no trailing slash)."
      );
    }
    return "";
  }
  return typeof window !== "undefined" ? window.location.origin : "";
};

/** Resolves a path like `/api/...` against the configured API origin. */
export const resolveCommerceUrl = (path: string): URL => {
  if (path.startsWith("http")) {
    return new URL(path);
  }
  const base = getBackendBaseUrl();
  if (!base) {
    throw new CommerceApiError(
      customerFrontendEnv.isProd
        ? "VITE_BACKEND_BASE_URL is not set. Rebuild with your Express API origin (e.g. https://api.example.com). On Netlify: Site settings → Environment variables → add VITE_BACKEND_BASE_URL → redeploy."
        : "Could not resolve API base URL (missing window in this environment).",
      0,
      "MISSING_BACKEND_BASE_URL",
      null,
      null
    );
  }
  return new URL(path, base);
};

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

const parseJsonResponse = async (response: Response): Promise<{
  payload: unknown;
  rawText: string;
  contentType: string | null;
  parseError: boolean;
}> => {
  const rawText = await response.text();
  const contentType = response.headers.get("content-type");

  if (!rawText) {
    return {
      payload: null,
      rawText,
      contentType,
      parseError: false
    };
  }

  try {
    return {
      payload: JSON.parse(rawText) as unknown,
      rawText,
      contentType,
      parseError: false
    };
  } catch {
    return {
      payload: { parseError: true, text: rawText },
      rawText,
      contentType,
      parseError: true
    };
  }
};

const isJsonContentType = (value: string | null) => {
  const normalized = value?.toLowerCase() ?? "";
  return normalized.includes("application/json") || normalized.includes("+json");
};

const truncatePreview = (value: string, limit = 500) =>
  value.length <= limit ? value : `${value.slice(0, limit)}...`;

export type CommerceFetchOptions = RequestInit & {
  json?: unknown;
  /** When true (default), send x-session-id. */
  session?: boolean;
  /** When true, attach Bearer access token if present. */
  auth?: boolean;
  /** When true, reject HTML/text responses even if the status code is otherwise informative. */
  requireJsonContentType?: boolean;
};

export const commerceFetchJson = async <T>(
  path: string,
  options: CommerceFetchOptions = {}
): Promise<CommerceSuccess<T>> => {
  const url = resolveCommerceUrl(path);
  const {
    json,
    session = true,
    auth = true,
    requireJsonContentType = false,
    headers: initHeaders,
    ...rest
  } = options;

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

  if (auth && response.status === 401) {
    useCustomerStore.getState().signOut();
  }

  const parsed = await parseJsonResponse(response);
  const payload = parsed.payload as JsonEnvelope | Record<string, unknown> | null;

  if (requireJsonContentType && parsed.rawText && !isJsonContentType(parsed.contentType)) {
    throw new CommerceApiError(
      "API returned a non-JSON response.",
      response.status,
      "NON_JSON_RESPONSE",
      {
        contentType: parsed.contentType
      },
      truncatePreview(parsed.rawText)
    );
  }

  if (requireJsonContentType && parsed.parseError) {
    throw new CommerceApiError(
      "API returned malformed JSON.",
      response.status,
      "INVALID_JSON_RESPONSE",
      {
        contentType: parsed.contentType
      },
      truncatePreview(parsed.rawText)
    );
  }

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
