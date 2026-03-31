import type { RequestHandler } from "express";

import { rateLimitError } from "../errors/app-error";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { redis } from "../../config/redis";

type RateLimitOptions = {
  keyPrefix: string;
  maxRequests: number;
  windowSeconds: number;
  /** When true, deny the request if Redis is unavailable (recommended for auth and payment routes). */
  failClosed?: boolean;
  keyResolver?: (request: Parameters<RequestHandler>[0]) => string | null;
};

const defaultKeyResolver = (request: Parameters<RequestHandler>[0]) =>
  request.ip || request.header("x-forwarded-for") || "unknown";

/** Prefer authenticated actor id so limits are not trivially bypassed via proxy rotation. */
export const rateLimitKeyFromActorOrIp = (request: Parameters<RequestHandler>[0]) => {
  const actor = request.context?.actor;

  if (actor?.kind === "customer" && actor.userId) {
    return `user:${actor.userId}`;
  }

  if (actor?.kind === "admin" && actor.adminUserId) {
    return `admin:${actor.adminUserId}`;
  }

  return defaultKeyResolver(request);
};

export const rateLimit = (options: RateLimitOptions): RequestHandler => async (request, _response, next) => {
  const identity = (options.keyResolver ?? defaultKeyResolver)(request);

  if (!identity) {
    return next();
  }

  const key = `${options.keyPrefix}:${identity}`;

  try {
    const hits = await redis.incr(key);

    if (hits === 1) {
      await redis.expire(key, options.windowSeconds);
    }

    if (hits > options.maxRequests) {
      const ttlSeconds = await redis.ttl(key);
      return next(
        rateLimitError("Too many requests. Please try again later.", {
          retryAfterSeconds: ttlSeconds > 0 ? ttlSeconds : options.windowSeconds
        })
      );
    }
  } catch (error) {
    const failClosed = options.failClosed ?? env.NODE_ENV === "production";

    logger.error(
      {
        keyPrefix: options.keyPrefix,
        error,
        failClosed
      },
      "Rate limit enforcement failed."
    );

    if (failClosed) {
      return next(
        rateLimitError("Service temporarily unavailable. Please try again later.", {
          reason: "RATE_LIMIT_BACKEND_UNAVAILABLE"
        })
      );
    }
  }

  return next();
};
