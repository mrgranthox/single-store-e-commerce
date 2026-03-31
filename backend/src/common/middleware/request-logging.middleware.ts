import { createHash } from "node:crypto";

import type { RequestHandler } from "express";

import { env } from "../../config/env";
import { logger } from "../../config/logger";

const hashLogIdentifier = (value?: string | null) => {
  if (!value) {
    return null;
  }

  return createHash("sha256")
    .update(`${env.SESSION_SECRET}:${value}`)
    .digest("hex")
    .slice(0, 12);
};

export const sanitizeRequestLogContext = (input: {
  actorId?: string | null;
  ipAddress?: string | null;
}) => ({
  actorFingerprint: hashLogIdentifier(input.actorId),
  ipFingerprint: hashLogIdentifier(input.ipAddress)
});

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
