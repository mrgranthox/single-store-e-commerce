#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const assetsDir = path.join(root, "dist", "assets");

if (!fs.existsSync(assetsDir)) {
  console.error("[perf-budget] dist/assets does not exist. Run the build first.");
  process.exit(1);
}

const assetFiles = fs.readdirSync(assetsDir).filter((file) => file.endsWith(".js"));
const assetSizes = assetFiles.map((file) => ({
  file,
  bytes: fs.statSync(path.join(assetsDir, file)).size
}));

const totalJsBytes = assetSizes.reduce((sum, asset) => sum + asset.bytes, 0);
const largestChunk = assetSizes.sort((a, b) => b.bytes - a.bytes)[0] ?? { file: "n/a", bytes: 0 };

if (totalJsBytes > 2_000_000) {
  console.error(`[perf-budget] Total JS bundle exceeds budget: ${totalJsBytes} bytes.`);
  process.exit(1);
}

if (largestChunk.bytes > 600_000) {
  console.error(
    `[perf-budget] Largest JS chunk exceeds budget: ${largestChunk.file} (${largestChunk.bytes} bytes).`
  );
  process.exit(1);
}

console.log(
  `Performance budget OK. total=${totalJsBytes} bytes largest=${largestChunk.file}:${largestChunk.bytes} bytes`
);
