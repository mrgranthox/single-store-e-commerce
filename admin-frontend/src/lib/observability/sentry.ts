import * as Sentry from "@sentry/react";

import { frontendEnv } from "@/lib/config/env";

let sentryInitialized = false;

const shouldLoadSentry = () =>
  Boolean(frontendEnv.sentryDsn) && (!frontendEnv.isDev || frontendEnv.sentryEnableInDev);

export const isFrontendObservabilityEnabled = () => shouldLoadSentry();

export const initializeFrontendObservability = () => {
  if (sentryInitialized || !shouldLoadSentry()) {
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
  if (!shouldLoadSentry()) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("app_context", context);
    }
    Sentry.captureException(error);
  });
};
