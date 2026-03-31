import type { Response } from "express";

import { env } from "../../config/env";
import { AppError } from "../errors/app-error";

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export const sendSuccess = <T>(
  response: Response,
  options: {
    statusCode?: number;
    data: T;
    meta?: Record<string, unknown>;
  }
) => {
  const envelope: SuccessEnvelope<T> = {
    success: true,
    data: options.data
  };

  if (options.meta) {
    envelope.meta = options.meta;
  }

  return response.status(options.statusCode ?? 200).json(envelope);
};

export const sendError = (
  response: Response,
  error: AppError,
  requestId?: string
) => {
  const envelope: ErrorEnvelope = {
    success: false,
    error: {
      code: error.code,
      message: error.message
    }
  };

  const redactClientDetails =
    env.NODE_ENV === "production" && (!error.expose || error.statusCode >= 500);

  if (error.details !== undefined && !redactClientDetails) {
    envelope.error.details = error.details;
  }

  if (requestId) {
    envelope.error.requestId = requestId;
  }

  return response.status(error.statusCode).json(envelope);
};
