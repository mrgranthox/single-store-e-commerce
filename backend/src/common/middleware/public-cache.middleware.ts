import crypto from "node:crypto";

import type { NextFunction, Request, RequestHandler, Response } from "express";

import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { redis } from "../../config/redis";
import {
  normalizePublicCacheKey,
  shouldBypassPublicCache
} from "../cache/public-cache-policy";
import { appendServerTiming } from "./performance.middleware";

type CacheNamespace = "catalog" | "content" | "homepage" | "support";

type PublicCacheEntry = {
  statusCode: number;
  contentType?: string;
  body: string;
  createdAtMs: number;
};

type PublicCacheOptions = {
  namespace: CacheNamespace;
  ttlSeconds: number;
};

const CACHE_PREFIX = "public-cache:v1";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const L1_MAX_ENTRIES = 500;

const l1Cache = new Map<string, PublicCacheEntry>();

const buildCacheKey = (namespace: CacheNamespace, normalizedKey: string) => {
  const digest = crypto.createHash("sha256").update(normalizedKey).digest("hex");
  return `${CACHE_PREFIX}:${namespace}:${digest}`;
};

const getL1Entry = (cacheKey: string, ttlSeconds: number) => {
  const entry = l1Cache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.createdAtMs > (ttlSeconds + env.PUBLIC_CACHE_STALE_SECONDS) * 1000) {
    l1Cache.delete(cacheKey);
    return null;
  }

  l1Cache.delete(cacheKey);
  l1Cache.set(cacheKey, entry);
  return entry;
};

const setL1Entry = (cacheKey: string, entry: PublicCacheEntry) => {
  l1Cache.set(cacheKey, entry);
  if (l1Cache.size <= L1_MAX_ENTRIES) {
    return;
  }

  const oldestKey = l1Cache.keys().next().value;
  if (oldestKey) {
    l1Cache.delete(oldestKey);
  }
};

const deleteL1Namespace = (namespace: CacheNamespace) => {
  const prefix = `${CACHE_PREFIX}:${namespace}:`;
  for (const key of l1Cache.keys()) {
    if (key.startsWith(prefix)) {
      l1Cache.delete(key);
    }
  }
};

const setPublicCacheHeaders = (response: Response, ttlSeconds: number) => {
  const staleSeconds = env.PUBLIC_CACHE_STALE_SECONDS;
  response.removeHeader("Pragma");
  response.removeHeader("Expires");
  response.removeHeader("Surrogate-Control");
  response.setHeader(
    "Cache-Control",
    `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=${staleSeconds}`
  );
  response.setHeader("Vary", "Origin, Accept-Encoding");
};

export const publicCache = ({ namespace, ttlSeconds }: PublicCacheOptions): RequestHandler =>
  async (request, response, next) => {
    if (shouldBypassPublicCache(request, env.PUBLIC_CACHE_ENABLED)) {
      response.setHeader("X-Cache", "BYPASS");
      next();
      return;
    }

    const normalizedKey = normalizePublicCacheKey(request);
    const cacheKey = buildCacheKey(namespace, normalizedKey);
    const startedAt = performance.now();
    const l1Entry = getL1Entry(cacheKey, ttlSeconds);

    if (l1Entry) {
      const isStale = Date.now() - l1Entry.createdAtMs > ttlSeconds * 1000;
      appendServerTiming(response, "cache", performance.now() - startedAt);
      response.status(l1Entry.statusCode);
      setPublicCacheHeaders(response, ttlSeconds);
      response.setHeader("Content-Type", l1Entry.contentType ?? JSON_CONTENT_TYPE);
      response.setHeader("X-Cache", isStale ? "STALE" : "HIT");
      response.send(l1Entry.body);
      return;
    }

    try {
      const cached = await redis.get(cacheKey);
      appendServerTiming(response, "cache", performance.now() - startedAt);

      if (cached) {
        const entry = JSON.parse(cached) as PublicCacheEntry;
        setL1Entry(cacheKey, entry);
        const isStale = Date.now() - entry.createdAtMs > ttlSeconds * 1000;
        response.status(entry.statusCode);
        setPublicCacheHeaders(response, ttlSeconds);
        response.setHeader("Content-Type", entry.contentType ?? JSON_CONTENT_TYPE);
        response.setHeader("X-Cache", isStale ? "STALE" : "HIT");
        response.send(entry.body);
        return;
      }

      response.setHeader("X-Cache", "MISS");
    } catch (error) {
      appendServerTiming(response, "cache", performance.now() - startedAt);
      response.setHeader("X-Cache", "BYPASS");
      logger.warn({ error, namespace }, "public cache read failed");
      next();
      return;
    }

    const originalSend = response.send.bind(response);
    response.send = ((body?: unknown) => {
      if (response.statusCode === 200 && !response.headersSent && body !== undefined) {
        setPublicCacheHeaders(response, ttlSeconds);
        const stringBody = Buffer.isBuffer(body) ? body.toString("utf8") : String(body);
        const entry: PublicCacheEntry = {
          statusCode: response.statusCode,
          contentType: String(response.getHeader("Content-Type") ?? JSON_CONTENT_TYPE),
          body: stringBody,
          createdAtMs: Date.now()
        };

        setL1Entry(cacheKey, entry);
        void redis
          .set(cacheKey, JSON.stringify(entry), "EX", ttlSeconds + env.PUBLIC_CACHE_STALE_SECONDS)
          .catch((error) => logger.warn({ error, namespace }, "public cache write failed"));
      }

      return originalSend(body);
    }) as Response["send"];

    next();
  };

export const invalidatePublicCacheNamespaces = async (namespaces: CacheNamespace[]) => {
  if (!env.PUBLIC_CACHE_ENABLED || namespaces.length === 0) {
    return;
  }

  for (const namespace of [...new Set(namespaces)]) {
    deleteL1Namespace(namespace);
    const pattern = `${CACHE_PREFIX}:${namespace}:*`;
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 250);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  }
};

const namespacesForMutation = (request: Request): CacheNamespace[] => {
  const url = request.originalUrl.toLowerCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    return [];
  }
  if (url.includes("/admin/catalog") || url.includes("/admin/inventory")) {
    return ["catalog", "homepage"];
  }
  if (url.includes("/admin/content")) {
    return ["content", "homepage"];
  }
  if (url.includes("/admin/marketing")) {
    return ["catalog", "homepage"];
  }

  return [];
};

export const publicCacheInvalidationMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  const namespaces = namespacesForMutation(request);
  if (namespaces.length === 0) {
    next();
    return;
  }

  response.on("finish", () => {
    if (response.statusCode >= 200 && response.statusCode < 400) {
      void invalidatePublicCacheNamespaces(namespaces).catch((error) =>
        logger.warn({ error, namespaces }, "public cache invalidation failed")
      );
    }
  });

  next();
};
