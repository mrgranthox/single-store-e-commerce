import * as Sentry from "@sentry/react";

import { frontendEnv } from "@/lib/config/env";

let sentryInitialized = false;

export const isFrontendObservabilityEnabled = () => Boolean(frontendEnv.sentryDsn);

export const initializeFrontendObservability = () => {
  if (sentryInitialized || !frontendEnv.sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: frontendEnv.sentryDsn,
    environment: frontendEnv.mode,
    release: frontendEnv.appRelease,
    tracesSampleRate: frontendEnv.sentryTracesSampleRate,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.authorization;
      }
      return event;
    }
  });

  sentryInitialized = true;
};

export const captureFrontendException = (error: unknown, context?: Record<string, unknown>) => {
  if (!frontendEnv.sentryDsn) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("app_context", context);
    }
    Sentry.captureException(error);
  });
};
