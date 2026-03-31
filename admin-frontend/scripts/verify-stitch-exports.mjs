#!/usr/bin/env node
/**
 * Verifies every Stitch slug in stitch-screen-map.ts has code.html + screen.png
 * under docs/admin frontend UI /stitch/<slug>/. Run from repo root:
 *   node admin-frontend/scripts/verify-stitch-exports.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const mapFile = path.join(repoRoot, "admin-frontend/src/lib/stitch/stitch-screen-map.ts");
const stitchRoot = path.join(repoRoot, "docs/admin frontend UI /stitch");

const text = fs.readFileSync(mapFile, "utf8");
const start = text.indexOf("stitchExportSlugByScreenId");
const brace = text.indexOf("{", start);
const end = text.indexOf("};", brace);
const block = text.slice(brace, end + 1);
const pairs = [...block.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)];
const slugs = [...new Set(pairs.map((m) => m[2]))];

let errors = 0;
for (const slug of slugs.sort()) {
  const dir = path.join(stitchRoot, slug);
  const html = path.join(dir, "code.html");
  const png = path.join(dir, "screen.png");
  const miss = [];
  if (!fs.existsSync(html)) miss.push("code.html");
  if (!fs.existsSync(png)) miss.push("screen.png");
  if (miss.length) {
    console.error(`[stitch] ${slug}: missing ${miss.join(", ")} (${dir})`);
    errors++;
  }
}

if (errors) {
  console.error(`\nStitch export verification failed: ${errors} folder(s) incomplete.`);
  process.exit(1);
}

console.log(`Stitch OK: ${slugs.length} export folder(s) under docs (code.html + screen.png).`);
