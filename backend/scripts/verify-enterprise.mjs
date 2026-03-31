#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["run", "verify:rbac-contracts"]],
  ["npm", ["run", "verify:admin-audit"]],
  ["npm", ["run", "verify:queue-contracts"]],
  ["npm", ["run", "verify:privacy-controls"]],
  ["npm", ["run", "verify:release-safety"]],
  ["npm", ["run", "verify:observability"]],
  ["npm", ["run", "verify:env-hygiene"]],
  ["npm", ["run", "typecheck"]]
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Enterprise verification OK.");
