#!/usr/bin/env node
/**
 * Verifies admin frontend contract drift:
 * 1) every screen endpoint id exists in admin-endpoints catalog
 * 2) every screen permission hint maps to backend RBAC permission or approved alias
 *
 * Run from repo root:
 *   node admin-frontend/scripts/verify-admin-contracts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const screenCatalogPath = path.join(
  repoRoot,
  "admin-frontend/src/lib/contracts/admin-screen-catalog.ts"
);
const endpointCatalogPath = path.join(
  repoRoot,
  "admin-frontend/src/lib/contracts/admin-endpoints.ts"
);
const backendPermissionsPath = path.join(
  repoRoot,
  "backend/src/modules/roles-permissions/rbac.constants.ts"
);

const permissionAliasMap = {
  "catalog.products.mutate": ["catalog.products.write"],
  "catalog.products.create": ["catalog.products.write"],
  "catalog.products.update": ["catalog.products.write"],
  "catalog.variants.mutate": ["catalog.products.write"],
  "catalog.variants.read": ["catalog.products.read"],
  "catalog.media.mutate": ["catalog.products.write"],
  "catalog.media.read": ["catalog.products.read"],
  "catalog.categories.mutate": ["catalog.categories.write"],
  "catalog.brands.mutate": ["catalog.brands.write"],
  "catalog.reviews.read": ["reviews.moderate"],
  "catalog.reviews.moderate": ["reviews.moderate"],
  "content.pages.mutate": ["content.pages.write"],
  "content.banners.read": ["content.pages.read"],
  "content.banners.mutate": ["content.pages.write"],
  "marketing.coupons.mutate": ["marketing.coupons.write"],
  "marketing.promotions.mutate": ["marketing.promotions.write"],
  "customers.note": ["customers.write_notes"],
  "customers.suspend": ["customers.update_status"],
  "customers.reactivate": ["customers.update_status"],
  "customers.restore": ["customers.update_status"],
  "security.read": ["security.events.read", "security.audit.read"],
  "security.alerts.read": ["security.events.read"],
  "security.alerts.manage": ["security.events.read"],
  "security.events.manage": ["security.events.read"],
  "security.incidents.read": ["security.incidents.manage"],
  "security.incidents.create": ["security.incidents.manage"],
  "security.risk.read": ["security.events.read"],
  "security.risk.review": ["security.events.read"],
  "payments.investigate": ["payments.read"],
  "inventory.warehouses.read": ["inventory.read"],
  "inventory.warehouses.mutate": ["inventory.manage_warehouses"],
  "support.escalate": ["support.assign"],
  "marketing.promotions.rules.mutate": ["marketing.promotions.write"],
  "reports.products.read": ["reports.read"],
  "reports.inventory.read": ["reports.read"],
  "reports.customers.read": ["reports.read"],
  "reports.support.read": ["reports.read"],
  "reports.post_purchase.read": ["reports.read"],
  "reports.marketing.read": ["reports.read"],
  "marketing.analytics.read": ["reports.read"],
  "catalog.analytics.read": ["reports.read"],
  "system.integrations.read": ["integrations.webhooks.read"],
  "system.notifications.retry": ["notifications.write"]
};

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const parseQuotedStrings = (chunk) =>
  [...chunk.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const screenText = read(screenCatalogPath);
const endpointText = read(endpointCatalogPath);
const backendPermissionsText = read(backendPermissionsPath);

const endpointIds = new Set(
  [...endpointText.matchAll(/endpoint\("([^"]+)"/g)].map((m) => m[1])
);

const backendPermissions = new Set(
  [...backendPermissionsText.matchAll(/code:\s*"([^"]+)"/g)].map((m) => m[1])
);

const screenBlocks = [...screenText.matchAll(/screen\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);

const errors = [];

for (const block of screenBlocks) {
  const idMatch = block.match(/id:\s*"([^"]+)"/);
  const screenId = idMatch ? idMatch[1] : "<unknown-screen>";

  const endpointIdsMatch = block.match(/endpointIds:\s*\[([\s\S]*?)\]/);
  if (endpointIdsMatch) {
    const ids = parseQuotedStrings(endpointIdsMatch[1]);
    for (const id of ids) {
      if (!endpointIds.has(id)) {
        errors.push(
          `[contracts] screen "${screenId}" references unknown endpoint id "${id}".`
        );
      }
    }
  }

  const permissionHintsMatch = block.match(/permissionHints:\s*\[([\s\S]*?)\]/);
  if (permissionHintsMatch) {
    const hints = parseQuotedStrings(permissionHintsMatch[1]);
    for (const hint of hints) {
      const aliasTargets = permissionAliasMap[hint] ?? [];
      const isKnown =
        backendPermissions.has(hint) ||
        aliasTargets.some((target) => backendPermissions.has(target));
      if (!isKnown) {
        errors.push(
          `[contracts] screen "${screenId}" uses unknown permission hint "${hint}" (not in backend RBAC catalog or alias map).`
        );
      }
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  console.error(`\nAdmin contract verification failed: ${errors.length} issue(s).`);
  process.exit(1);
}

console.log(
  `Admin contracts OK: ${screenBlocks.length} screens validated against endpoint + permission catalogs.`
);
