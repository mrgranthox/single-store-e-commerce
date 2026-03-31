import * as Sentry from "@sentry/node";
import type { Express } from "express";

import { env } from "./env";
import { logger } from "./logger";

type SentryRuntime = "http" | "worker";

const secretKeyPattern = /(authorization|token|secret|signature|password|api[_-]?key|access[_-]?code)/i;

let sentryInitialized = false;
let runtimeErrorHandlersRegistered = false;

const sanitizeValue = (value: unknown, depth = 0): unknown => {
  if (depth > 6) {
    return "[Truncated]";
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        secretKeyPattern.test(key) ? "[REDACTED]" : sanitizeValue(entry, depth + 1)
      ])
    );
  }

  return value;
};

const shouldEnableSentry = () => Boolean(env.SENTRY_ENABLED && env.SENTRY_DSN);

export const initializeSentry = (runtime: SentryRuntime = "http") => {
  if (sentryInitialized) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN || undefined,
    enabled: shouldEnableSentry(),
    environment: env.sentryEnvironment,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    profileSessionSampleRate: env.SENTRY_PROFILE_SAMPLE_RATE,
    attachStacktrace: env.SENTRY_ATTACH_STACKTRACE,
    sendDefaultPii: env.SENTRY_SEND_DEFAULT_PII,
    debug: env.SENTRY_DEBUG,
    initialScope: {
      tags: {
        runtime
      }
    },
    integrations: [
      Sentry.httpIntegration(),
      Sentry.prismaIntegration(),
      ...(runtime === "http" ? [Sentry.expressIntegration()] : []),
      Sentry.requestDataIntegration({
        include: {
          cookies: false,
          data: true,
          headers: true,
          ip: false,
          query_string: true,
          url: true
        }
      }),
      Sentry.linkedErrorsIntegration(),
      Sentry.extraErrorDataIntegration(),
      Sentry.zodErrorsIntegration()
    ],
    beforeSend(event) {
      return sanitizeValue(event) as typeof event;
    },
    beforeBreadcrumb(breadcrumb) {
      return sanitizeValue(breadcrumb) as typeof breadcrumb;
    }
  });

  sentryInitialized = true;
};

export const setupSentryExpressErrorHandler = (application: Express) => {
  if (!shouldEnableSentry()) {
    return;
  }

  Sentry.setupExpressErrorHandler(application, {
    shouldHandleError(error) {
      const status =
        Number(error.status) ||
        Number(error.statusCode) ||
        Number(error.status_code) ||
        Number(error.output?.statusCode);

      return !Number.isFinite(status) || status >= 500;
    }
  });
};

export const captureSentryException = (
  error: unknown,
  context?: {
    requestId?: string | null;
    actorId?: string | null;
    actorKind?: string | null;
    sessionId?: string | null;
    tags?: Record<string, string | number | boolean | null | undefined>;
    extra?: Record<string, unknown>;
  }
) => {
  if (!shouldEnableSentry()) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.requestId) {
      scope.setTag("request_id", context.requestId);
    }

    if (context?.actorKind) {
      scope.setTag("actor_kind", context.actorKind);
    }

    if (context?.sessionId) {
      scope.setTag("session_id", context.sessionId);
    }

    if (context?.actorId) {
      scope.setUser({
        id: context.actorId
      });
    }

    if (context?.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        if (value !== undefined && value !== null) {
          scope.setTag(key, String(value));
        }
      }
    }

    if (context?.extra) {
      scope.setExtras(sanitizeValue(context.extra) as Record<string, unknown>);
    }

    Sentry.captureException(error);
  });
};

export const flushSentry = async (timeoutMs = 2_000) => {
  if (!shouldEnableSentry()) {
    return;
  }

  await Sentry.flush(timeoutMs);
};

export const registerRuntimeErrorHandlers = (runtime: SentryRuntime) => {
  if (runtimeErrorHandlersRegistered) {
    return;
  }

  process.on("unhandledRejection", (reason) => {
    logger.error({ runtime, reason }, "Unhandled promise rejection.");
    captureSentryException(reason, {
      tags: {
        runtime,
        process_event: "unhandled_rejection"
      }
    });
  });

  process.on("uncaughtException", (error) => {
    logger.fatal({ runtime, error }, "Uncaught exception.");
    captureSentryException(error, {
      tags: {
        runtime,
        process_event: "uncaught_exception"
      }
    });

    void flushSentry().finally(() => {
      process.exit(1);
    });
  });

  runtimeErrorHandlersRegistered = true;
};
