import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { clerkRequestMiddleware } from "../config/clerk";
import { env, normalizeCorsOrigin } from "../config/env";
import { setupSentryExpressErrorHandler } from "../config/sentry";
import { registerRoutes } from "./routes";
import { browserOriginGuardMiddleware } from "../common/middleware/browser-origin.middleware";
import { errorHandlerMiddleware } from "../common/middleware/error-handler.middleware";
import { notFoundMiddleware } from "../common/middleware/not-found.middleware";
import { optionalAuth } from "../modules/auth/auth.middleware";
import { requestContextMiddleware } from "../common/middleware/request-context.middleware";
import { requestLoggingMiddleware } from "../common/middleware/request-logging.middleware";

const isOriginAllowed = (origin?: string) => {
  if (!origin) {
    return true;
  }

  if (env.corsAllowedOrigins.includes("*")) {
    return true;
  }

  return env.corsAllowedOrigins.includes(normalizeCorsOrigin(origin));
};

export const createApp = () => {
  const application = express();

  application.disable("x-powered-by");
  application.set("trust proxy", 1);

  application.use(helmet());
  application.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("The request origin is not allowed by CORS."));
      }
    })
  );
  application.use(compression());
  application.use(
    express.json({
      limit: "1mb",
      verify(request, _response, buffer) {
        (request as express.Request).rawBody = buffer;
      }
    })
  );
  application.use(express.urlencoded({ extended: true, limit: "1mb" }));
  application.use(requestContextMiddleware);
  application.use(browserOriginGuardMiddleware);
  application.use(clerkRequestMiddleware);
  application.use(optionalAuth);
  application.use(requestLoggingMiddleware);

  registerRoutes(application);

  application.use(notFoundMiddleware);
  setupSentryExpressErrorHandler(application);
  application.use(errorHandlerMiddleware);

  return application;
};
