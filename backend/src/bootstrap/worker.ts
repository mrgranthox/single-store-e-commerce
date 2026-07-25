import { createServer } from "node:http";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { initializeSentry, registerRuntimeErrorHandlers } from "../config/sentry";

initializeSentry("worker");
registerRuntimeErrorHandlers("worker");

// Cloud Run services require a listening HTTP port for startup/readiness probes.
createServer((req, res) => {
  const path = req.url?.split("?")[0] ?? "/";
  if (path === "/health" || path === "/ready" || path === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ success: true, data: { role: "worker", status: "ok" } }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ success: false, error: { code: "NOT_FOUND" } }));
}).listen(env.PORT, "0.0.0.0", () => {
  logger.info({ port: env.PORT }, "Worker health listener started.");
});

void import("../workers/index");
