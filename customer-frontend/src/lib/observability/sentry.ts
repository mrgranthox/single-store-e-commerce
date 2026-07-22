import * as Sentry from "@sentry/react";

import { customerFrontendEnv } from "@/lib/config/env";

let sentryInitialized = false;

const shouldLoadSentry = () =>
  Boolean(customerFrontendEnv.sentryDsn) &&
  (!customerFrontendEnv.isDev || customerFrontendEnv.sentryEnableInDev);

export const initializeCustomerObservability = () => {
  if (sentryInitialized || !shouldLoadSentry()) {
    return;
  }

  Sentry.init({
    dsn: customerFrontendEnv.sentryDsn,
    environment: customerFrontendEnv.mode,
    release: customerFrontendEnv.appRelease,
    tracesSampleRate: customerFrontendEnv.sentryTracesSampleRate,
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

export const captureCustomerException = (error: unknown, context?: Record<string, unknown>) => {
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
