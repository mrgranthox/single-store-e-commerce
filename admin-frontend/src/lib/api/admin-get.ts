import { resolveBackendBaseUrl } from "@/lib/config/runtime";

import { ApiError } from "@/lib/api/http";

export type AdminSuccessEnvelope<T = unknown> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export const adminJsonGet = async <T = unknown>(
  path: string,
  accessToken: string | null
): Promise<AdminSuccessEnvelope<T>> => {
  const response = await fetch(new URL(path, resolveBackendBaseUrl()), {
    method: "GET",
    headers: {
      accept: "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
    }
  });

  const payload = (await response.json().catch(() => null)) as
    | AdminSuccessEnvelope<T>
    | {
        success?: false;
        error?: { message?: string; code?: string };
        message?: string;
      }
    | null;

  if (!response.ok) {
    throw new ApiError(
      (payload as { error?: { message?: string } })?.error?.message ??
        (payload as { message?: string })?.message ??
        `Request failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  if (!payload || typeof payload !== "object" || (payload as AdminSuccessEnvelope).success !== true) {
    throw new ApiError("Unexpected response shape from admin API.", response.status, payload);
  }

  return payload as AdminSuccessEnvelope<T>;
};
