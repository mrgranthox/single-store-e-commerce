import { createServer } from "node:http";

import { createApp } from "./app";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { prisma } from "../config/prisma";
import { closeRedisConnection } from "../config/redis";
import { closeQueues } from "../config/queue";
import { flushSentry } from "../config/sentry";

const app = createApp();
const server = createServer(app);

const SHUTDOWN_TIMEOUT_MS = 25_000;

let shutdownStarted = false;

const shutdown = async (signal: string) => {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  logger.info({ signal }, "Shutting down backend API.");

  const forceExit = setTimeout(() => {
    logger.error({ signal }, "Shutdown timed out; forcing exit.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await Promise.allSettled([prisma.$disconnect(), closeRedisConnection(), closeQueues(), flushSentry()]);
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    logger.error({ error, signal }, "Shutdown failed.");
    clearTimeout(forceExit);
    process.exit(1);
  }
};

server.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV
    },
    "Backend API listening."
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
