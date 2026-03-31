#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const loggerConfig = fs.readFileSync(path.join(repoRoot, "backend/src/config/logger.ts"), "utf8");
const requestLogging = fs.readFileSync(
  path.join(repoRoot, "backend/src/common/middleware/request-logging.middleware.ts"),
  "utf8"
);
const accountRoutes = fs.readFileSync(
  path.join(repoRoot, "backend/src/modules/account/account.routes.ts"),
  "utf8"
);

const failures = [];

for (const requiredPath of ["payload.email", "payload.phoneNumber", "payload.addressSnapshot"]) {
  if (!loggerConfig.includes(requiredPath)) {
    failures.push(`Logger redaction is missing ${requiredPath}.`);
  }
}

if (!requestLogging.includes("sanitizeRequestLogContext")) {
  failures.push("Request log sanitization helper is missing.");
}

if (!accountRoutes.includes("/account/privacy/export")) {
  failures.push("Privacy export route is missing.");
}

if (!accountRoutes.includes("/account/privacy/anonymize")) {
  failures.push("Privacy anonymize route is missing.");
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`[privacy-controls] ${failure}`));
  process.exit(1);
}

console.log("Privacy controls OK.");
