import assert from "node:assert/strict";
import { test } from "node:test";

import { isAppError } from "../common/errors/app-error";
import {
  assertCustomerReviewContentPublishable,
  isCustomerReviewContentPublishable
} from "../modules/reviews/review-content-screen";

test("assertCustomerReviewContentPublishable allows empty body", () => {
  assertCustomerReviewContentPublishable(undefined, []);
  assertCustomerReviewContentPublishable("   ", []);
});

test("assertCustomerReviewContentPublishable allows normal feedback", () => {
  assertCustomerReviewContentPublishable("Great shoes, comfortable for daily wear.", []);
});

test("assertCustomerReviewContentPublishable rejects western union mention", () => {
  assert.throws(
    () => assertCustomerReviewContentPublishable("Pay me via Western Union for a refund.", []),
    (error: unknown) => isAppError(error) && error.code === "INVALID_INPUT"
  );
});

test("assertCustomerReviewContentPublishable rejects configured blocklist term", () => {
  assert.throws(
    () => assertCustomerReviewContentPublishable("This is utterly badword material.", ["badword"]),
    (error: unknown) => isAppError(error) && error.code === "INVALID_INPUT"
  );
});

test("assertCustomerReviewContentPublishable rejects excessive URLs", () => {
  const body = "See https://a.test/1 https://b.test/2 https://c.test/3";
  assert.throws(
    () => assertCustomerReviewContentPublishable(body, []),
    (error: unknown) => isAppError(error) && error.code === "INVALID_INPUT"
  );
});

test("isCustomerReviewContentPublishable matches assert for allow and deny", () => {
  assert.equal(isCustomerReviewContentPublishable(undefined, []), true);
  assert.equal(isCustomerReviewContentPublishable("Great product.", []), true);
  assert.equal(isCustomerReviewContentPublishable("Pay via Western Union.", []), false);
  assert.equal(isCustomerReviewContentPublishable("utterly badword thing.", ["badword"]), false);
});
