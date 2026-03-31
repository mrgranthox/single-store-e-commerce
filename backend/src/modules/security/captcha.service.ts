import { randomUUID } from "node:crypto";

import {
  captchaValidationError,
  serviceUnavailableError
} from "../../common/errors/app-error";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { evaluateTurnstileVerification, type TurnstileVerificationResponse } from "./captcha.helpers";

const deriveAllowedTurnstileHostnames = () => {
  if (env.turnstileExpectedHostnames.length > 0) {
    return env.turnstileExpectedHostnames;
  }

  const derived = new Set<string>();

  for (const url of [env.APP_BASE_URL, env.CUSTOMER_APP_URL, env.MOBILE_APP_URL, env.ADMIN_APP_URL]) {
    try {
      derived.add(new URL(url).hostname.toLowerCase());
    } catch {
      // Ignore malformed URLs because env validation already covers them.
    }
  }

  return [...derived];
};

const resolveRemoteIp = (value: string | null | undefined) => {
  if (!value) {
    return undefined;
  }

  const firstEntry = value.split(",")[0]?.trim();
  return firstEntry || undefined;
};

export const isPublicSupportCaptchaEnforced = () =>
  env.PUBLIC_SUPPORT_CAPTCHA_ENABLED && env.ABUSE_CHALLENGE_PROVIDER === "turnstile";

export const getPublicSupportCaptchaConfiguration = () => ({
  enabled: env.PUBLIC_SUPPORT_CAPTCHA_ENABLED,
  provider: env.PUBLIC_SUPPORT_CAPTCHA_ENABLED ? env.ABUSE_CHALLENGE_PROVIDER : "none",
  tokenField: "captchaToken",
  siteKey:
    env.PUBLIC_SUPPORT_CAPTCHA_ENABLED && env.ABUSE_CHALLENGE_PROVIDER === "turnstile"
      ? env.TURNSTILE_SITE_KEY ?? null
      : null,
  supportedActions: [
    "public_support_contact",
    "public_support_contact_upload",
    "public_product_inquiry",
    "public_product_inquiry_upload"
  ]
});

export const verifyPublicSupportCaptcha = async (input: {
  token?: string | null;
  expectedAction: string;
  remoteIp?: string | null;
  requestId?: string | null;
}) => {
  if (!isPublicSupportCaptchaEnforced()) {
    return {
      enforced: false,
      provider: env.ABUSE_CHALLENGE_PROVIDER
    } as const;
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    throw serviceUnavailableError("Public abuse protection is enabled but the Turnstile secret key is missing.");
  }

  const token = input.token?.trim();

  if (!token) {
    throw captchaValidationError("Human verification is required.", {
      reasonCode: "CAPTCHA_REQUIRED"
    });
  }

  let response: Response;

  try {
    response = await fetch(env.TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(resolveRemoteIp(input.remoteIp) ? { remoteip: resolveRemoteIp(input.remoteIp)! } : {}),
        idempotency_key: randomUUID()
      }),
      signal: AbortSignal.timeout(env.TURNSTILE_TIMEOUT_MS)
    });
  } catch (error) {
    logger.error(
      {
        error,
        expectedAction: input.expectedAction,
        requestId: input.requestId
      },
      "Turnstile verification request failed."
    );
    throw serviceUnavailableError("Human verification is temporarily unavailable. Please try again.");
  }

  let payload: TurnstileVerificationResponse;

  try {
    payload = (await response.json()) as TurnstileVerificationResponse;
  } catch (error) {
    logger.error(
      {
        error,
        expectedAction: input.expectedAction,
        requestId: input.requestId,
        status: response.status
      },
      "Turnstile verification response could not be parsed."
    );
    throw serviceUnavailableError("Human verification is temporarily unavailable. Please try again.");
  }

  const evaluation = evaluateTurnstileVerification({
    response: payload,
    expectedAction: input.expectedAction,
    allowedHostnames: deriveAllowedTurnstileHostnames(),
    enforceAction: env.TURNSTILE_ENFORCE_ACTION
  });

  if (!evaluation.valid) {
    throw captchaValidationError("Human verification failed. Please refresh the challenge and try again.", {
      provider: "turnstile",
      reasonCode: evaluation.reason,
      errorCodes: evaluation.errorCodes,
      hostname: evaluation.hostname,
      action: evaluation.action
    });
  }

  return {
    enforced: true,
    provider: "turnstile",
    hostname: evaluation.hostname,
    action: evaluation.action
  } as const;
};
