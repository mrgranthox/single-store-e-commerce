#!/usr/bin/env node
/**
 * Filesystem-only admin parity verifier.
 *
 * Verifies:
 * 1) every screen endpoint id exists in the admin endpoint catalog
 * 2) every screen permission hint maps to backend RBAC permission or approved alias
 * 3) every endpoint catalog path matches a backend route metadata entry
 * 4) every runtime admin API path matches a backend route metadata entry
 * 5) every screen endpoint id is backed by at least one runtime client call
 * 6) known compat-only paths are not used from the frontend runtime
 * 7) every permission string in backend route metadata exists in rbac.constants.ts
 * 8) screen permission hints overlap backend route metadata permissions for each referenced endpoint
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const screenCatalogPath = path.join(repoRoot, "admin-frontend/src/lib/contracts/admin-screen-catalog.ts");
const endpointCatalogPath = path.join(repoRoot, "admin-frontend/src/lib/contracts/admin-endpoints.ts");
const backendPermissionsPath = path.join(repoRoot, "backend/src/modules/roles-permissions/rbac.constants.ts");

const permissionAliasMap = {
  "catalog.products.mutate": ["catalog.products.write"],
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
  "customers.restore": ["customers.update_status"],
  "operations.dashboard.read": ["reports.read", "inventory.read", "orders.read"],
  "support.analytics.read": ["support.read"],
  "security.dashboard.read": ["security.events.read"],
  "system.observability.read": ["system.jobs.read", "integrations.webhooks.read"],
  "security.read": ["security.events.read", "security.audit.read"],
  "security.alerts.read": ["security.events.read"],
  "security.alerts.manage": ["security.events.read", "security.incidents.manage"],
  "security.events.manage": ["security.events.read", "security.incidents.manage"],
  "security.incidents.read": ["security.incidents.manage", "security.events.read"],
  "security.incidents.create": ["security.incidents.manage"],
  "security.risk.read": ["security.events.read"],
  "security.risk.review": ["security.events.read", "security.incidents.manage"],
  "payments.investigate": ["payments.read"],
  "inventory.read": ["catalog.products.read"],
  "inventory.warehouses.read": ["inventory.read"],
  "inventory.warehouses.mutate": ["inventory.manage_warehouses"],
  "inventory.adjust": ["inventory.read"],
  "orders.update": ["orders.override_fulfillment"],
  "reports.sales.read": ["reports.read"],
  "support.escalate": ["support.assign"],
  "marketing.promotions.rules.mutate": ["marketing.promotions.write"],
  "reports.products.read": ["reports.read"],
  "reports.inventory.read": ["reports.read"],
  "reports.customers.read": ["reports.read"],
  "reports.support.read": ["reports.read"],
  "reports.post_purchase.read": ["reports.read"],
  "reports.marketing.read": ["reports.read"],
  "marketing.analytics.read": ["reports.read", "marketing.coupons.read", "marketing.promotions.read"],
  "catalog.analytics.read": ["reports.read", "catalog.products.read"],
  "catalog.products.create": ["catalog.products.write", "catalog.categories.read", "catalog.brands.read"],
  "catalog.products.update": ["catalog.products.write", "catalog.products.read", "catalog.categories.read", "catalog.brands.read"],
  "catalog.products.change_price": ["catalog.products.read"],
  "customers.suspend": ["customers.update_status", "customers.write_notes"],
  "customers.reactivate": ["customers.update_status", "customers.write_notes"],
  "system.integrations.read": ["integrations.webhooks.read"],
  "system.notifications.retry": ["notifications.write"]
};

const compatPathMap = {
  "POST /api/admin/support/tickets/:param/reply": "POST /api/admin/support/tickets/:param/messages",
  "POST /api/admin/support/tickets/:param/internal-note":
    "POST /api/admin/support/tickets/:param/internal-notes"
};

const expandedRuntimeKeysFor = (method, routePath) => {
  const compactPath = routePath.replace(/\s+/g, "");
  if (compactPath === "/api/admin/settings/${scope}") {
    return ["checkout", "reviews", "support"].map((scope) => normalizeRouteKey(method, `/api/admin/settings/${scope}`));
  }
  if (compactPath === "/api/admin/reports/${segment}${overviewQuery(query)}") {
    return ["sales", "products", "inventory", "customers", "support", "refunds-returns", "marketing"].map((segment) =>
      normalizeRouteKey(method, `/api/admin/reports/${segment}`)
    );
  }
  return [normalizeRouteKey(method, compactPath)];
};

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const parseQuotedStrings = (chunk) => [...chunk.matchAll(/"([^"]+)"/g)].map((match) => match[1]);

const toPosix = (value) => value.split(path.sep).join("/");

const walk = (dir, predicate) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(fullPath, predicate));
      continue;
    }
    if (predicate(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
};

const normalizePath = (rawPath) => {
  let withoutInlineParams = "";
  for (let index = 0; index < rawPath.length; index += 1) {
    const char = rawPath[index];
    if (char === "$" && rawPath[index + 1] === "{") {
      let depth = 1;
      let quote = null;
      const useParam = withoutInlineParams.endsWith("/");
      index += 2;
      for (; index < rawPath.length; index += 1) {
        const inner = rawPath[index];
        const previous = rawPath[index - 1];
        if (quote) {
          if (inner === quote && previous !== "\\") {
            quote = null;
          }
          continue;
        }
        if (inner === '"' || inner === "'" || inner === "`") {
          quote = inner;
          continue;
        }
        if (inner === "{") {
          depth += 1;
          continue;
        }
        if (inner === "}") {
          depth -= 1;
          if (depth === 0) {
            break;
          }
        }
      }
      if (useParam) {
        withoutInlineParams += ":param";
      }
      continue;
    }
    withoutInlineParams += char;
  }
  const withoutQuery = withoutInlineParams.split("?")[0] ?? withoutInlineParams;
  return withoutQuery
    .replace(/\{[^}]+\}/g, ":param")
    .replace(/:[A-Za-z0-9_]+/g, ":param")
    .replace(/\/api\/v1\//g, "/api/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
};

const normalizeRouteKey = (method, rawPath) => `${method.toUpperCase()} ${normalizePath(rawPath)}`;

const extractBackendRouteMetadata = () => {
  const routeFiles = walk(path.join(repoRoot, "backend/src/modules"), (fullPath) => fullPath.endsWith(".routes.ts"));
  const routes = [];

  for (const filePath of routeFiles) {
    const text = read(filePath);
    const relative = toPosix(path.relative(repoRoot, filePath));
    for (const match of text.matchAll(/method:\s*"([A-Z]+)"[\s\S]*?path:\s*"([^"]+)"/g)) {
      const [, method, routePath] = match;
      routes.push({
        method,
        path: routePath,
        normalizedKey: normalizeRouteKey(method, routePath),
        sourceFile: relative,
        compat: relative.includes("admin-compat.routes.ts")
      });
    }
  }

  return routes;
};

const extractEndpointCatalog = () => {
  const text = read(endpointCatalogPath);
  return [...text.matchAll(/endpoint\("([^"]+)",\s*"([^"]+)",\s*"([A-Z]+)",\s*"([^"]+)"/g)].map(
    ([, id, group, method, routePath]) => ({
      id,
      group,
      method,
      path: routePath,
      normalizedKey: normalizeRouteKey(method, routePath)
    })
  );
};

const extractScreenCatalog = () => {
  const text = read(screenCatalogPath);
  return [...text.matchAll(/screen\(\{([\s\S]*?)\}\)/g)].map((match) => {
    const block = match[1];
    const idMatch = block.match(/id:\s*"([^"]+)"/);
    const endpointIdsMatch = block.match(/endpointIds:\s*\[([\s\S]*?)\]/);
    const permissionHintsMatch = block.match(/permissionHints:\s*\[([\s\S]*?)\]/);
    return {
      id: idMatch ? idMatch[1] : "<unknown-screen>",
      endpointIds: endpointIdsMatch ? parseQuotedStrings(endpointIdsMatch[1]) : [],
      permissionHints: permissionHintsMatch ? parseQuotedStrings(permissionHintsMatch[1]) : []
    };
  });
};

const extractRuntimeAdminPaths = () => {
  const sourceFiles = walk(path.join(repoRoot, "admin-frontend/src"), (fullPath) =>
    /\.(ts|tsx)$/.test(fullPath) &&
    !fullPath.endsWith("admin-endpoints.ts") &&
    !fullPath.endsWith("admin-screen-catalog.ts")
  );

  const paths = [];

  const readObjectLiteral = (text, startIndex) => {
    let depth = 0;
    let quote = null;

    for (let index = startIndex; index < text.length; index += 1) {
      const char = text[index];
      const previous = text[index - 1];

      if (quote) {
        if (char === quote && previous !== "\\") {
          quote = null;
        }
        continue;
      }

      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return text.slice(startIndex, index + 1);
        }
      }
    }

    return null;
  };

  for (const filePath of sourceFiles) {
    const text = read(filePath);
    const relative = toPosix(path.relative(repoRoot, filePath));
    const apiRequestMatches = [...text.matchAll(/apiRequest(?:<[^>]+>)?\(\{/g)];
    for (const match of apiRequestMatches) {
      const objectStart = (match.index ?? 0) + match[0].length - 1;
      const objectLiteral = readObjectLiteral(text, objectStart);
      if (!objectLiteral) {
        continue;
      }
      const pathMatch = objectLiteral.match(/path:\s*(["`])((?:\/api\/admin|\/api\/client-config\/admin)[\s\S]*?)\1/);
      if (!pathMatch) {
        continue;
      }
      const methodMatch = objectLiteral.match(/method:\s*"([A-Z]+)"/);
      const method = methodMatch?.[1] ?? "GET";
      const routePath = pathMatch[2].replace(/\s+/g, "");
      for (const normalizedKey of expandedRuntimeKeysFor(method, routePath)) {
        paths.push({
          method,
          path: routePath,
          normalizedKey,
          sourceFile: relative
        });
      }
    }

    for (const match of text.matchAll(/adminJsonGet(?:<[^>]+>)?\(\s*(["`])((?:\/api\/admin|\/api\/client-config\/admin)[\s\S]*?)\1/g)) {
      const routePath = match[2].replace(/\s+/g, "");
      for (const normalizedKey of expandedRuntimeKeysFor("GET", routePath)) {
        paths.push({
          method: "GET",
          path: routePath,
          normalizedKey,
          sourceFile: relative
        });
      }
    }

    for (const match of text.matchAll(/buildPath:\s*\(\)\s*=>\s*(["`])((?:\/api\/admin|\/api\/client-config\/admin)[\s\S]*?)\1/g)) {
      const routePath = match[2].replace(/\s+/g, "");
      for (const normalizedKey of expandedRuntimeKeysFor("GET", routePath)) {
        paths.push({
          method: "GET",
          path: routePath,
          normalizedKey,
          sourceFile: relative
        });
      }
    }

    for (const match of text.matchAll(/fetch\(\s*new URL\(\s*(["`])(\/api\/client-config\/admin[\s\S]*?)\1/g)) {
      const routePath = match[2].replace(/\s+/g, "");
      for (const normalizedKey of expandedRuntimeKeysFor("GET", routePath)) {
        paths.push({
          method: "GET",
          path: routePath,
          normalizedKey,
          sourceFile: relative
        });
      }
    }
  }

  return paths;
};

const expandedPermissionsFor = (code) => [code, ...(permissionAliasMap[code] ?? [])];

const backendPermissions = new Set(
  [...read(backendPermissionsPath).matchAll(/code:\s*"([^"]+)"/g)].map((match) => match[1])
);

const extractBackendRouteMetadataPermissionCodes = () => {
  const routeFiles = walk(path.join(repoRoot, "backend/src/modules"), (fullPath) => fullPath.endsWith(".routes.ts"));
  const references = [];
  for (const filePath of routeFiles) {
    const text = read(filePath);
    const relative = toPosix(path.relative(repoRoot, filePath));
    for (const match of text.matchAll(/permissions:\s*\[([^\]]*)\]/g)) {
      const inner = match[1];
      for (const codeMatch of inner.matchAll(/"([^"]+)"/g)) {
        references.push({ code: codeMatch[1], sourceFile: relative });
      }
    }
  }
  return references;
};

const extractBackendRouteMetadataEntries = () => {
  const routeFiles = walk(path.join(repoRoot, "backend/src/modules"), (fullPath) => fullPath.endsWith(".routes.ts"));
  const entries = [];
  for (const filePath of routeFiles) {
    const text = read(filePath);
    const relative = toPosix(path.relative(repoRoot, filePath));
    for (const match of text.matchAll(/\{\s*method:\s*"([A-Z]+)"[\s\S]*?path:\s*"([^"]+)"([\s\S]*?)\}/g)) {
      const [, method, routePath, tail] = match;
      const permissionsMatch = tail.match(/permissions:\s*\[([^\]]*)\]/);
      const permissions = permissionsMatch ? [...permissionsMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
      entries.push({
        method,
        path: routePath,
        normalizedKey: normalizeRouteKey(method, routePath),
        permissions,
        sourceFile: relative
      });
    }
  }
  return entries;
};

const backendRoutes = extractBackendRouteMetadata();
const endpointCatalog = extractEndpointCatalog();
const screenCatalog = extractScreenCatalog();
const runtimePaths = extractRuntimeAdminPaths();

const backendRouteKeySet = new Set(backendRoutes.map((route) => route.normalizedKey));
const runtimePathKeySet = new Set(runtimePaths.map((route) => route.normalizedKey));
const endpointById = new Map(endpointCatalog.map((endpoint) => [endpoint.id, endpoint]));
const backendMetadataPermissionRefs = extractBackendRouteMetadataPermissionCodes();
const backendMetadataEntries = extractBackendRouteMetadataEntries();
const backendPermissionsByRouteKey = new Map();

for (const entry of backendMetadataEntries) {
  if (!entry.permissions.length) {
    continue;
  }
  const existing = backendPermissionsByRouteKey.get(entry.normalizedKey) ?? new Set();
  for (const permission of entry.permissions) {
    existing.add(permission);
  }
  backendPermissionsByRouteKey.set(entry.normalizedKey, existing);
}

const errors = [];

for (const { code, sourceFile } of backendMetadataPermissionRefs) {
  if (!backendPermissions.has(code)) {
    errors.push(`[rbac] route metadata references unknown permission "${code}" in ${sourceFile}.`);
  }
}

for (const screen of screenCatalog) {
  const expandedScreenHints = new Set(
    screen.permissionHints.flatMap((hint) => expandedPermissionsFor(hint))
  );
  for (const endpointId of screen.endpointIds) {
    if (!endpointById.has(endpointId)) {
      errors.push(`[contracts] screen "${screen.id}" references unknown endpoint id "${endpointId}".`);
      continue;
    }
    const endpoint = endpointById.get(endpointId);
    if (endpoint && !runtimePathKeySet.has(endpoint.normalizedKey)) {
      errors.push(
        `[contracts] screen "${screen.id}" references endpoint "${endpointId}" (${endpoint.method} ${endpoint.path}) but no runtime admin client call matches it.`
      );
    }
    if (endpoint) {
      const backendRequiredPermissions = backendPermissionsByRouteKey.get(endpoint.normalizedKey);
      if (backendRequiredPermissions && backendRequiredPermissions.size > 0) {
        const hasOverlap = [...backendRequiredPermissions].some((permission) =>
          expandedScreenHints.has(permission)
        );
        if (!hasOverlap) {
          errors.push(
            `[rbac] screen "${screen.id}" endpoint "${endpointId}" (${endpoint.method} ${endpoint.path}) requires one of [${[...backendRequiredPermissions].join(", ")}] but screen permission hints are [${screen.permissionHints.join(", ")}].`
          );
        }
      }
    }
  }

  for (const hint of screen.permissionHints) {
    const isKnown = expandedPermissionsFor(hint).some((candidate) => backendPermissions.has(candidate));
    if (!isKnown) {
      errors.push(
        `[contracts] screen "${screen.id}" uses unknown permission hint "${hint}" (not in backend RBAC catalog or alias map).`
      );
    }
  }
}

for (const endpoint of endpointCatalog) {
  if (!backendRouteKeySet.has(endpoint.normalizedKey)) {
    errors.push(
      `[contracts] endpoint catalog entry "${endpoint.id}" (${endpoint.method} ${endpoint.path}) does not match any backend route metadata entry.`
    );
  }
}

for (const runtimePath of runtimePaths) {
  if (!backendRouteKeySet.has(runtimePath.normalizedKey)) {
    errors.push(
      `[runtime] admin client path ${runtimePath.method} ${runtimePath.path} in ${runtimePath.sourceFile} does not match backend route metadata.`
    );
  }

  const canonical = compatPathMap[runtimePath.normalizedKey];
  if (canonical) {
    errors.push(
      `[runtime] compat-only admin path ${runtimePath.method} ${runtimePath.path} in ${runtimePath.sourceFile} should use canonical ${canonical}.`
    );
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
  `Admin contracts OK: ${screenCatalog.length} screens, ${endpointCatalog.length} endpoint ids, ${runtimePaths.length} runtime admin calls, ${backendRoutes.length} backend metadata routes checked, ${backendMetadataPermissionRefs.length} backend metadata permission refs validated, ${backendMetadataEntries.length} backend metadata entries RBAC-aligned.`
);
