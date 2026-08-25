import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const candidates = [
  { command: "node", args: ["dist/prisma/seed.js"], path: "dist/prisma/seed.js" },
  { command: "tsx", args: ["prisma/seed.ts"], path: "prisma/seed.ts" }
];

const selected = candidates.find((candidate) => existsSync(candidate.path));

if (!selected) {
  console.error("No Prisma seed entrypoint found. Build the backend or restore prisma/seed.ts.");
  process.exit(1);
}

const child = spawn(selected.command, selected.args, {
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Prisma seed terminated by signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
