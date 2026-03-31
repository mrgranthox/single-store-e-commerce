export type TurnstileVerificationResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  metadata?: Record<string, unknown>;
  "error-codes"?: string[];
};

export type TurnstileVerificationEvaluation = {
  valid: boolean;
  reason: string | null;
  action: string | null;
  hostname: string | null;
  errorCodes: string[];
};

export const evaluateTurnstileVerification = (input: {
  response: TurnstileVerificationResponse;
  expectedAction?: string;
  allowedHostnames?: string[];
  enforceAction?: boolean;
}) => {
  const errorCodes = Array.isArray(input.response["error-codes"])
    ? input.response["error-codes"].filter((value): value is string => typeof value === "string")
    : [];
  const hostname =
    typeof input.response.hostname === "string" && input.response.hostname.trim()
      ? input.response.hostname.trim().toLowerCase()
      : null;
  const action =
    typeof input.response.action === "string" && input.response.action.trim()
      ? input.response.action.trim()
      : null;
  const allowedHostnames = (input.allowedHostnames ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!input.response.success) {
    return {
      valid: false,
      reason: errorCodes[0] ?? "turnstile_failed",
      action,
      hostname,
      errorCodes
    } satisfies TurnstileVerificationEvaluation;
  }

  if (input.expectedAction && input.enforceAction !== false && action !== input.expectedAction) {
    return {
      valid: false,
      reason: "action_mismatch",
      action,
      hostname,
      errorCodes
    } satisfies TurnstileVerificationEvaluation;
  }

  if (allowedHostnames.length > 0 && (!hostname || !allowedHostnames.includes(hostname))) {
    return {
      valid: false,
      reason: "hostname_mismatch",
      action,
      hostname,
      errorCodes
    } satisfies TurnstileVerificationEvaluation;
  }

  return {
    valid: true,
    reason: null,
    action,
    hostname,
    errorCodes
  } satisfies TurnstileVerificationEvaluation;
};
