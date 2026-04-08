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

type SanitizeRequestLogContext = (input: {
  actorId?: string | null;
  ipAddress?: string | null;
}) => {
  actorFingerprint: string | null;
  ipFingerprint: string | null;
};

let sanitizeRequestLogContext: SanitizeRequestLogContext;

before(async () => {
  ({ sanitizeRequestLogContext } = await import("../common/middleware/request-logging.middleware"));
});

test("sanitizeRequestLogContext removes raw actor and ip values", () => {
  const sanitized = sanitizeRequestLogContext({
    actorId: "admin-user-123",
    ipAddress: "203.0.113.20"
  });

  assert.equal(typeof sanitized.actorFingerprint, "string");
  assert.equal(typeof sanitized.ipFingerprint, "string");
  assert.notEqual(sanitized.actorFingerprint, "admin-user-123");
  assert.notEqual(sanitized.ipFingerprint, "203.0.113.20");
});
