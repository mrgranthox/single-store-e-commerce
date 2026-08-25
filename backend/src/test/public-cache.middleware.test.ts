import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePublicCacheKey,
  shouldBypassPublicCache
} from "../common/cache/public-cache-policy";

test("normalizePublicCacheKey sorts query params and normalizes equivalent searches", () => {
  const first = normalizePublicCacheKey({
    baseUrl: "/api",
    path: "/search",
    query: {
      page_size: "48",
      q: "  Demo   Hoodie ",
      page: "1"
    }
  } as never);

  const second = normalizePublicCacheKey({
    baseUrl: "/api",
    path: "/search",
    query: {
      q: "demo hoodie",
      page: "1",
      page_size: "48"
    }
  } as never);

  assert.equal(first, "/api/search?page=1&page_size=48&q=demo+hoodie");
  assert.equal(first, second);
});

test("shouldBypassPublicCache protects auth and mutating or sensitive paths", () => {
  assert.equal(
    shouldBypassPublicCache({
      method: "GET",
      headers: { authorization: "Bearer token" },
      path: "/products"
    } as never, true),
    true
  );
  assert.equal(
    shouldBypassPublicCache({
      method: "GET",
      headers: {},
      path: "/cart"
    } as never, true),
    true
  );
  assert.equal(
    shouldBypassPublicCache({
      method: "POST",
      headers: {},
      path: "/products"
    } as never, true),
    true
  );
  assert.equal(
    shouldBypassPublicCache({
      method: "GET",
      headers: {},
      path: "/products"
    } as never, true),
    false
  );
});
