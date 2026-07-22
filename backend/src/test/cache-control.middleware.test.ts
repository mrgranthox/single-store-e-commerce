import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultNoStoreCacheControlMiddleware,
  setNoStoreHeaders
} from "../common/middleware/cache-control.middleware";

const createResponse = () => {
  const headers = new Map<string, string>();

  return {
    headers,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    hasHeader(name: string) {
      return headers.has(name.toLowerCase());
    }
  };
};

test("setNoStoreHeaders emits browser and CDN no-store headers", () => {
  const response = createResponse();

  setNoStoreHeaders(response);

  assert.equal(
    response.headers.get("cache-control"),
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0"
  );
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("expires"), "0");
  assert.equal(response.headers.get("surrogate-control"), "no-store");
});

test("defaultNoStoreCacheControlMiddleware preserves explicit route cache headers", () => {
  const response = createResponse();
  response.setHeader("Cache-Control", "public, max-age=60");
  let nextCalled = false;

  defaultNoStoreCacheControlMiddleware(
    {} as Parameters<typeof defaultNoStoreCacheControlMiddleware>[0],
    response as unknown as Parameters<typeof defaultNoStoreCacheControlMiddleware>[1],
    () => {
      nextCalled = true;
    }
  );

  assert.equal(response.headers.get("cache-control"), "public, max-age=60");
  assert.equal(nextCalled, true);
});
