import type { RequestHandler } from "express";

import { forbiddenError } from "../errors/app-error";
import { env, normalizeCorsOrigin } from "../../config/env";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const isWebhookLikePath = (path: string) =>
  path.includes("/webhook") || path.includes("/webhooks/");

/**
 * When a browser sends `Origin`, require it to match the configured CORS allow-list.
 * Does not replace CSRF tokens for cookie sessions; complements Bearer-based APIs by
 * blocking simple cross-site form posts that omit `Authorization`.
 */
export const browserOriginGuardMiddleware: RequestHandler = (request, _response, next) => {
  if (!mutatingMethods.has(request.method)) {
    return next();
  }

  if (isWebhookLikePath(request.path)) {
    return next();
  }

  const origin = request.header("origin");

  if (!origin) {
    return next();
  }

  if (env.corsAllowedOrigins.includes("*")) {
    return next();
  }

  if (env.corsAllowedOrigins.includes(normalizeCorsOrigin(origin))) {
    return next();
  }

  return next(forbiddenError("The request origin is not allowed for this operation."));
};
