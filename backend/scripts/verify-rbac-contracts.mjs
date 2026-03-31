#!/usr/bin/env node
/**
 * Verifies backend route permission contracts:
 * 1) every permission in requirePermissions([...]) exists in RBAC catalog
 * 2) every metadata.permissions entry exists in RBAC catalog
 *
 * Run from repo root:
 *   node backend/scripts/verify-rbac-contracts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const modulesRoot = path.join(repoRoot, "backend/src/modules");
const rbacCatalogPath = path.join(
  repoRoot,
  "backend/src/modules/roles-permissions/rbac.constants.ts"
);

const read = (filePath) => fs.readFileSync(filePath, "utf8");

const collectRouteFiles = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectRouteFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".routes.ts")) {
      out.push(full);
    }
  }
  return out;
};

const parseQuotedStrings = (chunk) =>
  [...chunk.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const rbacText = read(rbacCatalogPath);
const knownPermissions = new Set(
  [...rbacText.matchAll(/code:\s*"([^"]+)"/g)].map((m) => m[1])
);

const routeFiles = collectRouteFiles(modulesRoot);
const errors = [];

for (const filePath of routeFiles) {
  const text = read(filePath);
  const relPath = path.relative(repoRoot, filePath);

  for (const match of text.matchAll(/requirePermissions\(\s*\[([\s\S]*?)\]/g)) {
    const perms = parseQuotedStrings(match[1]);
    for (const perm of perms) {
      if (!knownPermissions.has(perm)) {
        errors.push(
          `[rbac-contracts] Unknown permission "${perm}" in requirePermissions(...) at ${relPath}`
        );
      }
    }
  }

  for (const match of text.matchAll(/permissions:\s*\[([\s\S]*?)\]/g)) {
    const perms = parseQuotedStrings(match[1]);
    for (const perm of perms) {
      if (!knownPermissions.has(perm)) {
        errors.push(
          `[rbac-contracts] Unknown permission "${perm}" in route metadata permissions at ${relPath}`
        );
      }
    }
  }
}

if (errors.length > 0) {
  for (const err of errors) {
    console.error(err);
  }
  console.error(`\nRBAC contract verification failed: ${errors.length} issue(s).`);
  process.exit(1);
}

console.log(
  `RBAC contracts OK: ${routeFiles.length} route modules validated against ${knownPermissions.size} RBAC permissions.`
);
