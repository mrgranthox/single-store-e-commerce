#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const queueConfig = fs.readFileSync(path.join(repoRoot, "backend/src/config/queue.ts"), "utf8");
const monitoringService = fs.readFileSync(
  path.join(repoRoot, "backend/src/modules/jobs-workers/monitoring.service.ts"),
  "utf8"
);

const failures = [];

if (!queueConfig.includes("queueOperationalContracts")) {
  failures.push("queueOperationalContracts export is missing.");
}

if (!monitoringService.includes('Only failed job runs can be replayed.')) {
  failures.push("Job replay failed-state guard is missing.");
}

if (!monitoringService.includes('Only failed or dead-lettered webhook events can be replayed.')) {
  failures.push("Webhook replay failed/dead-letter guard is missing.");
}

if (!monitoringService.includes('actionCode: "system.jobs.retry"')) {
  failures.push("Job replay audit logging is missing.");
}

if (!monitoringService.includes('actionCode: "system.webhooks.retry"')) {
  failures.push("Webhook replay audit logging is missing.");
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`[queue-contracts] ${failure}`));
  process.exit(1);
}

console.log("Queue contracts OK.");
