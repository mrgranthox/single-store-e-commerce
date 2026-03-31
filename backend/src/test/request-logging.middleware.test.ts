import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeRequestLogContext } from "../common/middleware/request-logging.middleware";

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
