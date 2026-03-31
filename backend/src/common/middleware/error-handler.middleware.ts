import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError, isAppError } from "../errors/app-error";
import { sendError } from "../http/response";
import { logger } from "../../config/logger";
import { captureSentryException } from "../../config/sentry";

const normalizeError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError({
      statusCode: 422,
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: error.flatten()
    });
  }

  if (error instanceof Error) {
    return new AppError({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      details: { name: error.name },
      expose: false,
      cause: error
    });
  }

  return new AppError({
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
    expose: false,
    details: { errorType: typeof error }
  });
};

export const errorHandlerMiddleware: ErrorRequestHandler = (error, request, response, _next) => {
  const normalizedError = normalizeError(error);
  const requestId = request.context?.requestId;
  const serializedError =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      : error;

  logger.error(
    {
      requestId,
      code: normalizedError.code,
      statusCode: normalizedError.statusCode,
      details: normalizedError.details,
      error: serializedError
    },
    normalizedError.message
  );

  if (normalizedError.statusCode >= 500) {
    captureSentryException(error, {
      requestId,
      actorId:
        request.context?.actor.kind === "admin"
          ? request.context.actor.adminUserId
          : request.context?.actor.kind === "customer"
            ? request.context.actor.userId
            : null,
      actorKind: request.context?.actor.kind,
      sessionId: request.context?.sessionId,
      extra: {
        code: normalizedError.code,
        statusCode: normalizedError.statusCode,
        details: normalizedError.details
      }
    });
  }

  return sendError(response, normalizedError, requestId);
};
