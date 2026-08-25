import type { Request } from "express";

const normalizeCacheParam = (key: string, value: string) => {
  const trimmed = value.trim();
  const normalizedKey = key.toLowerCase();

  if (["q", "query", "search"].includes(normalizedKey)) {
    return trimmed.toLowerCase().replace(/\s+/g, " ");
  }
  if (["sort", "sortby", "sortorder", "category", "brand", "slug"].includes(normalizedKey)) {
    return trimmed.toLowerCase();
  }

  return trimmed;
};

export const normalizePublicCacheKey = (request: Pick<Request, "path" | "baseUrl" | "query">) => {
  const params = new URLSearchParams();
  const entries = Object.entries(request.query).flatMap(([key, value]) => {
    if (Array.isArray(value)) {
      return value.map((entry) => [key, String(entry)] as const);
    }
    if (value === undefined) {
      return [];
    }
    return [[key, String(value)] as const];
  });

  entries
    .map(([key, value]) => [key.toLowerCase(), normalizeCacheParam(key, value)] as const)
    .filter(([, value]) => value !== "")
    .sort(([aKey, aValue], [bKey, bValue]) => {
      const keyCompare = aKey.localeCompare(bKey);
      return keyCompare !== 0 ? keyCompare : aValue.localeCompare(bValue);
    })
    .forEach(([key, value]) => params.append(key, value));

  const pathname = `${request.baseUrl}${request.path}`.replace(/\/+/g, "/");
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
};

export const shouldBypassPublicCache = (
  request: Pick<Request, "method" | "headers" | "path">,
  cacheEnabled: boolean
) =>
  !cacheEnabled ||
  !["GET", "HEAD"].includes(request.method) ||
  Boolean(request.headers.authorization) ||
  request.path.includes("/admin/") ||
  request.path.includes("/cart") ||
  request.path.includes("/checkout") ||
  request.path.includes("/orders") ||
  request.path.includes("/payments") ||
  request.path.includes("/auth");
