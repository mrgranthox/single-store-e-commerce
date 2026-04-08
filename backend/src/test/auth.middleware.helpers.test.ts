import test, { before } from "node:test";
import assert from "node:assert/strict";

const REQUIRED_ENV_DEFAULTS: Record<string, string> = {
  APP_BASE_URL: "http://localhost:3000",
  ADMIN_APP_URL: "http://localhost:3001",
  CUSTOMER_APP_URL: "http://localhost:3002",
  MOBILE_APP_URL: "http://localhost:3003",
  CORS_ALLOWED_ORIGINS: "http://localhost:3000",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  PAYSTACK_API_BASE_URL: "https://api.paystack.co",
  SESSION_SECRET: "test-session-secret-with-32-plus-chars"
};

for (const [key, value] of Object.entries(REQUIRED_ENV_DEFAULTS)) {
  process.env[key] ??= value;
}

type CanUseDevAuthBypass = (input: {
  allowBypass: boolean;
  nodeEnv: string;
  ipAddress?: string | null;
}) => boolean;

let canUseDevAuthBypass: CanUseDevAuthBypass;

before(async () => {
  ({ canUseDevAuthBypass } = await import("../modules/auth/auth.middleware"));
});

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
