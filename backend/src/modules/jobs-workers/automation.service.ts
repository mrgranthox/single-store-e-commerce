import type { Job } from "bullmq";

import { logger } from "../../config/logger";
import { queues } from "../../config/queue";
import { processScheduledCatalogAutomationJob } from "../catalog/catalog.service";
import { processPendingPaymentReconciliationJob } from "../payments/payments.service";
import { processScheduledShipmentAutomationJob } from "../shipping/shipping.service";
import { processSupportSlaSweepJob } from "../support/support.service";

type AutomationSchedule = {
  queue: keyof typeof queues;
  jobName: string;
  jobId: string;
  repeatEveryMs: number;
  payload?: Record<string, unknown>;
};

const MINUTE_MS = 60_000;

const automationSchedules: AutomationSchedule[] = [
  {
    queue: "payments",
    jobName: "payments.reconcile-pending",
    jobId: "payments-reconcile-pending",
    repeatEveryMs: 5 * MINUTE_MS,
    payload: {
      maxPayments: 50,
      staleMinutes: 15
    }
  },
  {
    queue: "reconciliation",
    jobName: "support.scan-sla",
    jobId: "support-scan-sla",
    repeatEveryMs: 5 * MINUTE_MS
  },
  {
    queue: "reconciliation",
    jobName: "catalog.publish-due-products",
    jobId: "catalog-publish-due-products",
    repeatEveryMs: MINUTE_MS
  },
  {
    queue: "reconciliation",
    jobName: "catalog.apply-due-pricing",
    jobId: "catalog-apply-due-pricing",
    repeatEveryMs: MINUTE_MS
  },
  {
    queue: "reconciliation",
    jobName: "shipments.auto-progress",
    jobId: "shipments-auto-progress",
    repeatEveryMs: MINUTE_MS,
    payload: {
      staleHours: 24,
      batchSize: 100
    }
  }
];

let schedulesRegistered = false;

const automationJobNames = new Set(automationSchedules.map((schedule) => schedule.jobName));

/** Removes persisted BullMQ repeatables so they stop firing after schedules were disabled or redeployed. */
export const clearAutomationRepeatables = async () => {
  const queueKeys = [...new Set(automationSchedules.map((schedule) => schedule.queue))];
  let removed = 0;

  for (const queueKey of queueKeys) {
    const queue = queues[queueKey];
    const repeatables = await queue.getRepeatableJobs();
    for (const entry of repeatables) {
      if (automationJobNames.has(entry.name)) {
        await queue.removeRepeatableByKey(entry.key);
        removed += 1;
      }
    }
  }

  schedulesRegistered = false;

  logger.info({ removed }, "Cleared automation repeatable job definitions from Redis.");
};

export const registerAutomationSchedules = async () => {
  if (schedulesRegistered) {
    return;
  }

  for (const schedule of automationSchedules) {
    await queues[schedule.queue].add(schedule.jobName, schedule.payload ?? {}, {
      jobId: schedule.jobId,
      repeat: {
        every: schedule.repeatEveryMs
      }
    });
  }

  schedulesRegistered = true;

  logger.info(
    {
      schedules: automationSchedules.map((schedule) => ({
        queue: schedule.queue,
        jobName: schedule.jobName,
        repeatEveryMs: schedule.repeatEveryMs
      }))
    },
    "Registered automation schedules."
  );
};

export const processAutomationJob = async (job: Job) => {
  switch (job.name) {
    case "payments.reconcile-pending":
      return processPendingPaymentReconciliationJob(job as Job<{ maxPayments?: number; staleMinutes?: number }>);
    case "support.scan-sla":
      return processSupportSlaSweepJob();
    case "catalog.publish-due-products":
    case "catalog.apply-due-pricing":
      return processScheduledCatalogAutomationJob(job as Job<Record<string, never>>);
    case "shipments.auto-progress":
      return processScheduledShipmentAutomationJob(
        (job as Job<{ staleHours?: number; batchSize?: number }>).data
      );
    default:
      return null;
  }
};
