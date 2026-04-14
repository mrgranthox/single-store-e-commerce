import type { RequestHandler } from "express";

import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { sanitizeRequestLogContext as sanitizeRequestLogContextWithSalt } from "./request-logging.utils";

export const sanitizeRequestLogContext = (input: {
  actorId?: string | null;
  ipAddress?: string | null;
}) => sanitizeRequestLogContextWithSalt(input, env.SESSION_SECRET);

export const requestLoggingMiddleware: RequestHandler = (request, response, next) => {
  response.on("finish", () => {
    const durationMs = Date.now() - request.context.startedAt;
    const level =
      response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info";

    logger[level](
      {
        requestId: request.context.requestId,
        traceId: request.context.traceId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs,
        actorId: null,
        actorKind: request.context.actor.kind,
        ipAddress: null,
        ...sanitizeRequestLogContext({
          actorId: request.context.actor.actorId,
          ipAddress: request.context.ipAddress
        })
      },
      "HTTP request completed."
    );
  });

  next();
};
