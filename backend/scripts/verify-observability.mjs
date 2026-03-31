#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const requestContext = fs.readFileSync(
  path.join(repoRoot, "backend/src/common/middleware/request-context.middleware.ts"),
  "utf8"
);
const requestLogging = fs.readFileSync(
  path.join(repoRoot, "backend/src/common/middleware/request-logging.middleware.ts"),
  "utf8"
);

const failures = [];

for (const requiredSnippet of ['x-trace-id', 'traceId: requestId']) {
  if (!requestContext.includes(requiredSnippet)) {
    failures.push(`Request context is missing ${requiredSnippet}.`);
  }
}

if (!requestLogging.includes("traceId")) {
  failures.push("Request logging does not emit traceId.");
}

for (const requiredFile of [
  "deploy/scripts/synthetic-checks.sh",
  ".github/workflows/synthetic-checks.yml",
  "docs/enterprise_operating_policies_2026-03-31.md"
]) {
  if (!fs.existsSync(path.join(repoRoot, requiredFile))) {
    failures.push(`Required observability file is missing: ${requiredFile}`);
  }
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`[observability] ${failure}`));
  process.exit(1);
}

console.log("Observability controls OK.");
