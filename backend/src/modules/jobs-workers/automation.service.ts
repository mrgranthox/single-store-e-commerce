import type { Job } from "bullmq";

import { logger } from "../../config/logger";
import { queues } from "../../config/queue";
import { processScheduledCatalogAutomationJob } from "../catalog/catalog.service";
import { processPendingPaymentReconciliationJob } from "../payments/payments.service";
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
  }
];

let schedulesRegistered = false;

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
    default:
      return null;
  }
};
