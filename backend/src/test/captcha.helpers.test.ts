import test from "node:test";
import assert from "node:assert/strict";

import { evaluateTurnstileVerification } from "../modules/security/captcha.helpers";

test("evaluateTurnstileVerification accepts a valid response with matching action and hostname", () => {
  const result = evaluateTurnstileVerification({
    response: {
      success: true,
      hostname: "shop.example.com",
      action: "public_support_contact"
    },
    expectedAction: "public_support_contact",
    allowedHostnames: ["shop.example.com"],
    enforceAction: true
  });

  assert.equal(result.valid, true);
  assert.equal(result.reason, null);
});

test("evaluateTurnstileVerification rejects action mismatches when action enforcement is enabled", () => {
  const result = evaluateTurnstileVerification({
    response: {
      success: true,
      hostname: "shop.example.com",
      action: "other_action"
    },
    expectedAction: "public_support_contact",
    allowedHostnames: ["shop.example.com"],
    enforceAction: true
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, "action_mismatch");
});

test("evaluateTurnstileVerification rejects hostnames outside the allow-list", () => {
  const result = evaluateTurnstileVerification({
    response: {
      success: true,
      hostname: "attacker.example.com",
      action: "public_support_contact"
    },
    expectedAction: "public_support_contact",
    allowedHostnames: ["shop.example.com"],
    enforceAction: true
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, "hostname_mismatch");
});

test("evaluateTurnstileVerification surfaces provider failure error codes", () => {
  const result = evaluateTurnstileVerification({
    response: {
      success: false,
      "error-codes": ["timeout-or-duplicate"]
    },
    expectedAction: "public_support_contact",
    allowedHostnames: ["shop.example.com"],
    enforceAction: true
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, "timeout-or-duplicate");
  assert.deepEqual(result.errorCodes, ["timeout-or-duplicate"]);
});
