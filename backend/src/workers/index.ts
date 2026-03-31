import { Worker, type Job } from "bullmq";
import os from "node:os";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { createBullMqConnection, queueNames } from "../config/queue";
import { prisma } from "../config/prisma";
import { closeRedisConnection } from "../config/redis";
import { flushSentry } from "../config/sentry";
import {
  processAutomationJob,
  registerAutomationSchedules
} from "../modules/jobs-workers/automation.service";
import { jobRunService } from "../modules/jobs-workers/job-run.service";
import { processNotificationJob } from "../modules/notifications/notifications.service";
import {
  processPaymentWebhookJob,
  processPendingPaymentReconciliationJob
} from "../modules/payments/payments.service";
import {
  clearWorkerHeartbeat,
  writeWorkerHeartbeat
} from "../modules/health-observability/worker-heartbeat.service";

const unsupportedJobHandler = async (job: Job) => {
  throw new Error(
    `No processor has been implemented for job "${job.name}" on queue "${job.queueName}" yet.`
  );
};

const processors: Record<string, (job: Job) => Promise<unknown>> = {
  [queueNames.payments]: (job) => {
    if (job.name === "payments.reconcile-pending") {
      return processPendingPaymentReconciliationJob(
        job as Job<{ maxPayments?: number; staleMinutes?: number }>
      );
    }

    return unsupportedJobHandler(job);
  },
  [queueNames.webhooks]: (job) => {
    if (job.name === "payments.process-webhook") {
      return processPaymentWebhookJob(job as Job<{ webhookEventId: string }>);
    }

    return unsupportedJobHandler(job);
  },
  [queueNames.notifications]: (job) => {
    if (job.name === "notifications.deliver") {
      return processNotificationJob(job as Job<{ notificationId: string }>);
    }

    return unsupportedJobHandler(job);
  },
  [queueNames.reconciliation]: async (job) => {
    if (job.name === "system.ping") {
      return {
        ok: true,
        processedAt: new Date().toISOString()
      };
    }

    const automationResult = await processAutomationJob(job);
    if (automationResult !== null) {
      return automationResult;
    }

    return unsupportedJobHandler(job);
  }
};

const workerDefinitions = Object.values(queueNames).map((queueName) => {
  const worker = new Worker(
    queueName,
    async (job) => {
      const processor = processors[queueName];

      if (!processor) {
        throw new Error(`No worker processor is registered for queue "${queueName}".`);
      }

      await jobRunService.recordStarted(job);

      try {
        const result = await processor(job);
        await jobRunService.recordCompleted(job, {
          result
        });
        return result;
      } catch (error) {
        await jobRunService.recordFailed(job, error);
        throw error;
      }
    },
    {
      prefix: env.QUEUE_PREFIX,
      concurrency: queueName === queueNames.reconciliation ? 2 : 5,
      connection: createBullMqConnection(`worker:${queueName}`),
      lockDuration: 30_000,
      maxStalledCount: 1
    }
  );

  worker.on("ready", () => {
    logger.info({ queueName }, "Worker queue is ready.");
  });

  worker.on("active", (job) => {
    logger.info({ queueName, jobId: job.id, jobName: job.name }, "Worker job started.");
  });

  worker.on("completed", (job) => {
    logger.info({ queueName, jobId: job.id, jobName: job.name }, "Worker job completed.");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      { queueName, jobId: job?.id, jobName: job?.name, error },
      "Worker job failed."
    );
  });

  return worker;
});

const SHUTDOWN_TIMEOUT_MS = 60_000;

let shutdownStarted = false;
let heartbeatTimer: NodeJS.Timeout | null = null;

const startWorkerHeartbeat = async () => {
  await writeWorkerHeartbeat({
    pid: process.pid,
    hostname: os.hostname(),
    queues: Object.values(queueNames)
  });

  heartbeatTimer = setInterval(() => {
    void writeWorkerHeartbeat({
      pid: process.pid,
      hostname: os.hostname(),
      queues: Object.values(queueNames)
    }).catch((error) => {
      logger.warn({ error }, "Worker heartbeat update failed.");
    });
  }, env.WORKER_HEARTBEAT_INTERVAL_SECONDS * 1000);
  heartbeatTimer.unref();
};

const shutdown = async (signal: string) => {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  logger.info({ signal }, "Shutting down workers.");

  const forceExit = setTimeout(() => {
    logger.error({ signal }, "Worker shutdown timed out; forcing exit.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    await Promise.allSettled([clearWorkerHeartbeat()]);
    await Promise.allSettled(workerDefinitions.map((worker) => worker.close()));
    await Promise.allSettled([prisma.$disconnect(), closeRedisConnection(), flushSentry()]);
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    logger.error({ error, signal }, "Worker shutdown failed.");
    clearTimeout(forceExit);
    process.exit(1);
  }
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

void Promise.all(workerDefinitions.map((worker) => worker.waitUntilReady())).then(() => {
  return registerAutomationSchedules().then(() => {
    return startWorkerHeartbeat().then(() => {
      logger.info(
        {
          queues: Object.values(queueNames)
        },
        "Worker baseline started."
      );
    });
  });
}).catch((error) => {
  logger.error({ error }, "Worker startup failed.");
  process.exit(1);
});
