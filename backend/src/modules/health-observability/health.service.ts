import { JobRunStatus, Prisma, WebhookEventStatus } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

import { env } from "../../config/env";
import { checkDatabaseConnection, prisma } from "../../config/prisma";
import { checkRedisConnection } from "../../config/redis";
import { logger } from "../../config/logger";
import { readWorkerHeartbeat } from "./worker-heartbeat.service";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const emptyWebhookHourly = () =>
  Array.from({ length: 24 }, (_, hour) => ({
    hour,
    received: 0,
    failed: 0
  }));

const loadWorkload24h = async () => {
  const windowStart = new Date(Date.now() - DAY_MS);
  const buckets = emptyWebhookHourly();
  const alignedWindowStart = new Date(windowStart);
  alignedWindowStart.setUTCMinutes(0, 0, 0);

  const [failedJobs24h, succeededTerminal24h, terminalJobs24h, webhookHourlyRows, failingProviderGroups] =
    await Promise.all([
      prisma.jobRun.count({
        where: {
          status: JobRunStatus.FAILED,
          createdAt: { gte: windowStart }
        }
      }),
      prisma.jobRun.count({
        where: {
          status: JobRunStatus.SUCCEEDED,
          createdAt: { gte: windowStart }
        }
      }),
      prisma.jobRun.count({
        where: {
          status: {
            in: [JobRunStatus.SUCCEEDED, JobRunStatus.FAILED]
          },
          createdAt: { gte: windowStart }
        }
      }),
      prisma.$queryRaw<Array<{ slot: number; received: bigint; failed: bigint }>>(Prisma.sql`
        SELECT
          FLOOR(EXTRACT(EPOCH FROM (date_trunc('hour', "receivedAt") - ${alignedWindowStart}::timestamp)) / 3600)::int AS slot,
          COUNT(*)::bigint AS received,
          COUNT(*) FILTER (
            WHERE status::text IN (${WebhookEventStatus.FAILED}, ${WebhookEventStatus.DEAD_LETTERED})
          )::bigint AS failed
        FROM "WebhookEvent"
        WHERE "receivedAt" >= ${alignedWindowStart}
        GROUP BY slot
        ORDER BY slot ASC
      `),
      prisma.webhookEvent.groupBy({
        by: ["provider"],
        where: {
          receivedAt: { gte: windowStart },
          status: {
            in: [WebhookEventStatus.FAILED, WebhookEventStatus.DEAD_LETTERED]
          }
        },
        _count: { _all: true }
      })
    ]);

  let webhookReceived24h = 0;
  let webhookFailed24h = 0;

  for (const row of webhookHourlyRows) {
    const slot = row.slot;
    if (slot < 0 || slot > 23) {
      continue;
    }
    const cell = buckets[slot];
    if (!cell) {
      continue;
    }
    cell.received = Number(row.received);
    cell.failed = Number(row.failed);
    webhookReceived24h += cell.received;
    webhookFailed24h += cell.failed;
  }
  const webhookDeliveryRate24hPct =
    webhookReceived24h > 0
      ? Math.round(((webhookReceived24h - webhookFailed24h) / webhookReceived24h) * 1000) / 10
      : 100;
  const jobSuccessRate24hPct =
    terminalJobs24h > 0
      ? Math.round((succeededTerminal24h / terminalJobs24h) * 1000) / 10
      : terminalJobs24h === 0 && succeededTerminal24h === 0 && failedJobs24h === 0
        ? null
        : 100;

  return {
    failedJobs24h,
    failingIntegrationProviders: failingProviderGroups.length,
    webhookHourly: buckets,
    webhookDeliveryRate24hPct,
    jobSuccessRate24hPct,
    succeededJobs24h: succeededTerminal24h,
    terminalJobs24h
  };
};

const measureCheck = async (probe: () => Promise<unknown>): Promise<boolean> => {
  try {
    await probe();
    return true;
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Readiness dependency check failed."
    );
    return false;
  }
};

export const getHealthSnapshot = () => ({
  status: "ok" as const,
  now: new Date().toISOString(),
  environment: env.NODE_ENV,
  uptimeSeconds: Math.round(process.uptime())
});

const loadLatestLocalMigrationName = async () => {
  const migrationsDir = path.resolve(process.cwd(), "prisma", "migrations");

  try {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .at(-1) ?? null;
  } catch {
    return null;
  }
};

const loadLatestAppliedMigrationName = async () => {
  const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>(Prisma.sql`
    SELECT migration_name
    FROM _prisma_migrations
    WHERE finished_at IS NOT NULL
    ORDER BY finished_at DESC, migration_name DESC
    LIMIT 1
  `);

  return rows[0]?.migration_name ?? null;
};

export const getReadinessSnapshot = async () => {
  const [databaseOk, redisOk] = await Promise.all([
    measureCheck(checkDatabaseConnection),
    measureCheck(checkRedisConnection)
  ]);

  let migrationsOk = false;
  let latestLocalMigration: string | null = null;
  let latestAppliedMigration: string | null = null;
  let workerHeartbeatAgeSeconds: number | null = null;
  let workerOk = env.NODE_ENV !== "production";

  if (databaseOk) {
    try {
      [latestLocalMigration, latestAppliedMigration] = await Promise.all([
        loadLatestLocalMigrationName(),
        loadLatestAppliedMigrationName()
      ]);
      migrationsOk =
        latestLocalMigration === null
          ? true
          : latestAppliedMigration !== null && latestLocalMigration === latestAppliedMigration;
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Migration readiness check failed."
      );
    }
  }

  if (redisOk) {
    try {
      const heartbeat = await readWorkerHeartbeat();
      if (heartbeat) {
        workerHeartbeatAgeSeconds = Math.max(
          0,
          Math.round((Date.now() - new Date(heartbeat.observedAt).getTime()) / 1000)
        );
      }
      workerOk =
        env.NODE_ENV !== "production" ||
        (workerHeartbeatAgeSeconds !== null &&
          workerHeartbeatAgeSeconds <= env.WORKER_HEARTBEAT_TTL_SECONDS);
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Worker readiness check failed."
      );
    }
  }

  const ready = databaseOk && redisOk && migrationsOk && workerOk;

  let workload24h = {
    failedJobs24h: 0,
    failingIntegrationProviders: 0,
    webhookHourly: emptyWebhookHourly(),
    webhookDeliveryRate24hPct: 100 as number | null,
    jobSuccessRate24hPct: null as number | null,
    succeededJobs24h: 0,
    terminalJobs24h: 0
  };

  if (databaseOk) {
    try {
      workload24h = await loadWorkload24h();
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "System health workload snapshot failed."
      );
    }
  }

  const deploymentCell = env.DEPLOYMENT_CELL?.trim() || null;
  const appReleaseLabel = env.APP_RELEASE_LABEL?.trim() || null;

  return {
    status: ready ? ("ready" as const) : ("degraded" as const),
    now: new Date().toISOString(),
    runtime: {
      uptimeSeconds: Math.round(process.uptime()),
      environment: env.NODE_ENV
    },
    workload24h,
    deployment: {
      cell: deploymentCell,
      release: appReleaseLabel
    },
    checks: {
      migrations: {
        ok: migrationsOk,
        latestLocalMigration,
        latestAppliedMigration
      },
      workers: {
        ok: workerOk,
        heartbeatAgeSeconds: workerHeartbeatAgeSeconds,
        ttlSeconds: env.WORKER_HEARTBEAT_TTL_SECONDS
      }
    },
    dependencies: [
      { id: "postgres", label: "PostgreSQL", ok: databaseOk, role: "Primary datastore" },
      { id: "redis", label: "Redis & queues", ok: redisOk, role: "BullMQ & cache" },
      { id: "migrations", label: "Schema migrations", ok: migrationsOk, role: "Schema compatibility" },
      {
        id: "workers",
        label: "Background workers",
        ok: workerOk,
        role: "Payments, webhooks, and notifications"
      }
    ] as const
  };
};
