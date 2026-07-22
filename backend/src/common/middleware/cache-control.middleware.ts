import type { RequestHandler } from "express";

const NO_STORE_VALUE = "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0";

export const setNoStoreHeaders = (response: {
  setHeader: (name: string, value: string) => unknown;
}) => {
  response.setHeader("Cache-Control", NO_STORE_VALUE);
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
};

/**
 * API responses include auth, inventory, payment, and admin data by default.
 * Routes that are safe for CDN/browser reuse can override these headers locally.
 */
export const defaultNoStoreCacheControlMiddleware: RequestHandler = (_request, response, next) => {
  if (!response.hasHeader("Cache-Control")) {
    setNoStoreHeaders(response);
  }

  next();
};
