import test from "node:test";
import assert from "node:assert/strict";

import { canUseDevAuthBypass } from "../modules/auth/auth.middleware";

test("dev auth bypass is always allowed in test mode when enabled", () => {
  assert.equal(
    canUseDevAuthBypass({
      allowBypass: true,
      nodeEnv: "test",
      ipAddress: "203.0.113.20"
    }),
    true
  );
});

test("dev auth bypass is blocked for non-loopback development traffic", () => {
  assert.equal(
    canUseDevAuthBypass({
      allowBypass: true,
      nodeEnv: "development",
      ipAddress: "203.0.113.20"
    }),
    false
  );
});

test("dev auth bypass is allowed for loopback development traffic", () => {
  assert.equal(
    canUseDevAuthBypass({
      allowBypass: true,
      nodeEnv: "development",
      ipAddress: "127.0.0.1"
    }),
    true
  );
});

test("dev auth bypass is blocked outside development and test", () => {
  assert.equal(
    canUseDevAuthBypass({
      allowBypass: true,
      nodeEnv: "production",
      ipAddress: "127.0.0.1"
    }),
    false
  );
});
