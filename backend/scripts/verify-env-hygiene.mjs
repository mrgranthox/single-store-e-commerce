#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const backendDir = process.cwd();
const repoRoot = path.resolve(backendDir, "..");

const collectFiles = (directory, predicate, files = []) => {
  if (!fs.existsSync(directory)) {
    return files;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules" || entry.name === ".prisma") {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, predicate, files);
      continue;
    }

    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
};

const assertNoDirectEnvAccess = ({
  rootDir,
  allowedRelativePath,
  pattern,
  label
}) => {
  const violations = [];
  const files = collectFiles(rootDir, (filePath) => /\.(ts|tsx|js|mjs|cjs)$/.test(filePath));

  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath);
    if (relativePath === allowedRelativePath) {
      continue;
    }

    const contents = fs.readFileSync(filePath, "utf8");
    if (pattern.test(contents)) {
      violations.push(path.relative(repoRoot, filePath));
    }
  }

  if (violations.length > 0) {
    return [`${label} found outside the approved config module:`, ...violations.map((file) => `- ${file}`)];
  }

  return [];
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const disallowedScriptAssignments = ({ filePath, allowedKeys = [] }) => {
  const allowedKeySet = new Set(allowedKeys);
  const packageJson = readJson(filePath);
  const failures = [];

  for (const [scriptName, command] of Object.entries(packageJson.scripts ?? {})) {
    const matches = [...command.matchAll(/\b([A-Z][A-Z0-9_]*)=([^\s]+)/g)]
      .map((match) => match[1])
      .filter((key) => !allowedKeySet.has(key));

    if (matches.length > 0) {
      failures.push(
        `${path.relative(repoRoot, filePath)} script "${scriptName}" hardcodes env assignments: ${[
          ...new Set(matches)
        ].join(", ")}`
      );
    }
  }

  return failures;
};

const failures = [
  ...assertNoDirectEnvAccess({
    rootDir: path.join(backendDir, "src"),
    allowedRelativePath: path.join("config", "env.ts"),
    pattern: /\bprocess\.env\b/,
    label: "Direct backend process.env access"
  }),
  ...assertNoDirectEnvAccess({
    rootDir: path.join(repoRoot, "admin-frontend", "src"),
    allowedRelativePath: path.join("lib", "config", "env.ts"),
    pattern: /\bimport\.meta\.env\b/,
    label: "Direct frontend import.meta.env access"
  }),
  ...disallowedScriptAssignments({
    filePath: path.join(backendDir, "package.json"),
    allowedKeys: ["NODE_ENV"]
  }),
  ...disallowedScriptAssignments({
    filePath: path.join(repoRoot, "admin-frontend", "package.json"),
    allowedKeys: ["NODE_ENV"]
  })
];

if (failures.length > 0) {
  console.error("Environment hygiene verification failed.");
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("Environment hygiene verification OK.");
