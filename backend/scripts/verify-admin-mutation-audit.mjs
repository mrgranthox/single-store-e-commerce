#!/usr/bin/env node
/**
 * Verifies admin mutation services have auditability coverage.
 *
 * Rule:
 * - Exported admin mutation functions must either:
 *   1) write both auditLog + adminActionLog directly, or
 *   2) delegate to another compliant mutation function, or
 *   3) include an explicit exemption marker comment:
 *      "audit-admin-action-exempt"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const modulesRoot = path.join(repoRoot, "backend/src/modules");
const baselinePath = path.join(repoRoot, "backend/scripts/admin-mutation-audit-baseline.json");

const MUTATION_VERBS = [
  "create",
  "update",
  "patch",
  "delete",
  "remove",
  "cancel",
  "approve",
  "reject",
  "assign",
  "retry",
  "resolve",
  "close",
  "complete",
  "run",
  "trigger"
];

const read = (filePath) => fs.readFileSync(filePath, "utf8");

const collectServiceFiles = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectServiceFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".service.ts")) {
      out.push(full);
    }
  }
  return out;
};

const isAdminMutationName = (name) => {
  if (!name.includes("Admin")) {
    return false;
  }
  const lower = name.toLowerCase();
  return MUTATION_VERBS.some((verb) => lower.startsWith(verb));
};

const findMatchingBrace = (text, openIndex) => {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
};

const extractExportedFunctions = (text) => {
  const functions = [];
  const exportRegex = /export\s+const\s+([A-Za-z0-9_]+)\s*=/g;

  for (const match of text.matchAll(exportRegex)) {
    const name = match[1];
    const start = match.index ?? -1;
    if (start < 0) {
      continue;
    }

    const arrowIndex = text.indexOf("=>", start);
    if (arrowIndex < 0) {
      continue;
    }
    const firstBrace = text.indexOf("{", arrowIndex);
    if (firstBrace < 0) {
      continue;
    }
    const endBrace = findMatchingBrace(text, firstBrace);
    if (endBrace < 0) {
      continue;
    }

    const body = text.slice(firstBrace, endBrace + 1);
    functions.push({ name, body });
  }

  return functions;
};

const hasDirectLogs = (body) =>
  /(?:^|[^\w])[A-Za-z0-9_]+\.auditLog\.create\(/.test(body) &&
  /(?:^|[^\w])[A-Za-z0-9_]+\.adminActionLog\.create\(/.test(body);

const hasExemption = (body) => body.includes("audit-admin-action-exempt");
const hasKnownAuditHelperDelegation = (body) =>
  /\b(record[A-Za-z0-9_]*AdminMutation|recordCatalogMutation|recordMarketingMutation|recordReturnAdminMutation|recordShipmentAdminMutation|recordSupportAdminMutation|recordContentAdminMutation)\s*\(/.test(
    body
  );

const serviceFiles = collectServiceFiles(modulesRoot);
const errors = [];
let checkedFunctions = 0;

for (const filePath of serviceFiles) {
  const text = read(filePath);
  const relPath = path.relative(repoRoot, filePath);
  const exportedFunctions = extractExportedFunctions(text);
  const adminMutations = exportedFunctions.filter((fn) => isAdminMutationName(fn.name));

  if (adminMutations.length === 0) {
    continue;
  }

  const compliantByName = new Set(
    adminMutations
      .filter(
        (fn) =>
          hasDirectLogs(fn.body) || hasKnownAuditHelperDelegation(fn.body) || hasExemption(fn.body)
      )
      .map((fn) => fn.name)
  );

  let changed = true;
  while (changed) {
    changed = false;
    for (const fn of adminMutations) {
      if (compliantByName.has(fn.name)) {
        continue;
      }
      for (const targetName of compliantByName) {
        if (new RegExp(`\\b${targetName}\\s*\\(`).test(fn.body)) {
          compliantByName.add(fn.name);
          changed = true;
          break;
        }
      }
    }
  }

  for (const fn of adminMutations) {
    checkedFunctions += 1;
    if (!compliantByName.has(fn.name)) {
      errors.push(
        `${relPath}::${fn.name}`
      );
    }
  }
}

const baseline = new Set(JSON.parse(read(baselinePath)));
const current = new Set(errors);
const unexpected = [...current].filter((item) => !baseline.has(item)).sort();
const resolved = [...baseline].filter((item) => !current.has(item)).sort();

if (unexpected.length > 0) {
  for (const item of unexpected) {
    console.error(
      `[admin-audit-contracts] New uncovered admin mutation detected: ${item} (missing direct audit+adminAction log writes and no compliant delegation/exemption marker).`
    );
  }
  console.error(`\nAdmin mutation audit verification failed: ${unexpected.length} new issue(s).`);
  process.exit(1);
}

if (resolved.length > 0) {
  console.log(`[admin-audit-contracts] Coverage improved for ${resolved.length} baseline item(s).`);
}

console.log(
  `Admin mutation audit contracts OK: ${checkedFunctions} admin mutation service functions validated (${errors.length} known baseline gap(s), ${unexpected.length} new).`
);
