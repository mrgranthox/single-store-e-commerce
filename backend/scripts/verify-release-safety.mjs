#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const deployWorkflow = fs.readFileSync(
  path.join(repoRoot, ".github/workflows/backend-deploy.yml"),
  "utf8"
);

const failures = [];

for (const requiredSnippet of [
  "rollout_strategy",
  "auto_rollback",
  "verify-migration-safety.sh",
  "deploy-release.sh",
  "rollback-release.sh"
]) {
  if (!deployWorkflow.includes(requiredSnippet)) {
    failures.push(`Deploy workflow is missing ${requiredSnippet}.`);
  }
}

for (const requiredFile of [
  "deploy/scripts/verify-migration-safety.sh",
  "deploy/scripts/deploy-release.sh",
  "deploy/scripts/rollback-release.sh"
]) {
  if (!fs.existsSync(path.join(repoRoot, requiredFile))) {
    failures.push(`Required release file is missing: ${requiredFile}`);
  }
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`[release-safety] ${failure}`));
  process.exit(1);
}

console.log("Release safety OK.");
