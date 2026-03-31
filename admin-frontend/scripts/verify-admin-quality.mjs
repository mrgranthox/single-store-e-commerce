#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const failures = [];

for (const requiredFile of [
  "playwright.config.ts",
  "tests/e2e/system-settings.spec.ts",
  "lhci.config.cjs"
]) {
  if (!fs.existsSync(path.join(root, requiredFile))) {
    failures.push(`Missing ${requiredFile}.`);
  }
}

const confirmDialog = fs.readFileSync(
  path.join(root, "src/components/primitives/ConfirmDialog.tsx"),
  "utf8"
);
if (!confirmDialog.includes("aria-modal") || !confirmDialog.includes("Escape")) {
  failures.push("ConfirmDialog accessibility hardening is incomplete.");
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`[admin-quality] ${failure}`));
  process.exit(1);
}

console.log("Admin quality checks OK.");
