import type { JobRunStatus, Prisma, WebhookEventStatus } from "@prisma/client";

import { invalidInputError, notFoundError } from "../../common/errors/app-error";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { queueNames, queues } from "../../config/queue";
import { prisma } from "../../config/prisma";
import { jobRunService } from "./job-run.service";
import { inferRetryConfigFromJobRun } from "./retry.helpers";
import { webhookRecorderService } from "./webhook-recorder.service";

type PaginationInput = {
  page: number;
  pageSize: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const buildPagination = (pagination: PaginationInput) => ({
  skip: (pagination.page - 1) * pagination.pageSize,
  take: pagination.pageSize
});

const resolveQueueByName = (queueName: string) => {
  const queueKey = (Object.entries(queueNames).find(([, value]) => value === queueName)?.[0] ??
    null) as keyof typeof queues | null;

  return queueKey ? queues[queueKey] : null;
};

export const listJobRuns = async (
  input: PaginationInput & {
    status?: JobRunStatus;
    jobName?: string;
    startedAfter?: Date;
    startedBefore?: Date;
  }
) => {
  const startedAt: Prisma.DateTimeFilter | undefined =
    input.startedAfter || input.startedBefore
      ? {
          ...(input.startedAfter ? { gte: input.startedAfter } : {}),
          ...(input.startedBefore ? { lte: input.startedBefore } : {})
        }
      : undefined;

  const where: Prisma.JobRunWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.jobName
      ? {
          jobName: {
            contains: input.jobName,
            mode: "insensitive" as const
          }
        }
      : {}),
    ...(startedAt ? { startedAt } : {})
  };

  const [items, total] = await Promise.all([
    prisma.jobRun.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      ...buildPagination(input)
    }),
    prisma.jobRun.count({ where })
  ]);

  return {
    items,
    total
  };
};

export const getJobRunDetail = async (jobRunId: string) => {
  const jobRun = await prisma.jobRun.findUnique({
    where: {
      id: jobRunId
    }
  });

  if (!jobRun) {
    throw notFoundError("The requested job run was not found.");
  }

  return jobRun;
};

export const listWebhookEvents = async (
  input: PaginationInput & {
    status?: WebhookEventStatus;
    provider?: string;
    eventType?: string;
    receivedAfter?: Date;
    receivedBefore?: Date;
  }
) => {
  const receivedAt: Prisma.DateTimeFilter | undefined =
    input.receivedAfter || input.receivedBefore
      ? {
          ...(input.receivedAfter ? { gte: input.receivedAfter } : {}),
          ...(input.receivedBefore ? { lte: input.receivedBefore } : {})
        }
      : undefined;

  const where: Prisma.WebhookEventWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.provider
      ? {
          provider: {
            contains: input.provider,
            mode: "insensitive" as const
          }
        }
      : {}),
    ...(input.eventType
      ? {
          eventType: {
            contains: input.eventType,
            mode: "insensitive" as const
          }
        }
      : {}),
    ...(receivedAt ? { receivedAt } : {})
  };

  const [items, total]: [Prisma.WebhookEventGetPayload<{ include: { attempts: true } }>[], number] =
    await Promise.all([
    prisma.webhookEvent.findMany({
      where,
      orderBy: [{ receivedAt: "desc" }],
      include: {
        attempts: {
          orderBy: {
            attemptNo: "desc"
          }
        }
      },
      ...buildPagination(input)
    }),
    prisma.webhookEvent.count({ where })
  ]);

  return {
    items: items.map((event) => ({
      id: event.id,
      provider: event.provider,
      eventType: event.eventType,
      status: event.status,
      signatureValid: event.signatureValid,
      receivedAt: event.receivedAt,
      createdAt: event.createdAt,
      attemptCount: event.attempts.length,
      latestAttempt: event.attempts[0]
        ? {
            id: event.attempts[0].id,
            attemptNo: event.attempts[0].attemptNo,
            status: event.attempts[0].status,
            startedAt: event.attempts[0].startedAt,
            finishedAt: event.attempts[0].finishedAt
          }
        : null
    })),
    total
  };
};

export const getWebhookEventDetail = async (webhookEventId: string) => {
  const event = await prisma.webhookEvent.findUnique({
    where: {
      id: webhookEventId
    },
    include: {
      attempts: {
        orderBy: {
          attemptNo: "desc"
        }
      }
    }
  });

  if (!event) {
    throw notFoundError("The requested webhook event was not found.");
  }

  return event;
};

export const retryWebhookEvent = async (input: {
  webhookEventId: string;
  actorAdminUserId: string;
}) => {
  const webhookEvent = await prisma.webhookEvent.findUnique({
    where: {
      id: input.webhookEventId
    }
  });

  if (!webhookEvent) {
    throw notFoundError("The requested webhook event was not found.");
  }

  if (!webhookEvent.signatureValid) {
    throw invalidInputError("Webhook events with invalid signatures cannot be retried.");
  }

  if (webhookEvent.status !== "FAILED" && webhookEvent.status !== "DEAD_LETTERED") {
    throw invalidInputError("Only failed or dead-lettered webhook events can be replayed.");
  }

  const job = await queues.webhooks.add(
    "payments.process-webhook",
    {
      webhookEventId: webhookEvent.id,
      replayedByAdminUserId: input.actorAdminUserId
    },
    {
      jobId: `payment-webhook-${webhookEvent.id}-retry-${Date.now()}`
    }
  );

  await jobRunService.recordQueued(job, {
    trigger: "manual_retry",
    webhookEventId: webhookEvent.id,
    replaySafety: {
      sourceType: "WEBHOOK_EVENT",
      sourceId: webhookEvent.id,
      sourceStatus: webhookEvent.status,
      replayedByAdminUserId: input.actorAdminUserId
    },
    retry: {
      queueName: queueNames.webhooks,
      jobName: job.name,
      payload: {
        webhookEventId: webhookEvent.id
      }
    }
  });

  await webhookRecorderService.markQueued(webhookEvent.id);
  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "system.webhooks.retry",
        entityType: "WEBHOOK_EVENT",
        entityId: webhookEvent.id,
        metadata: toPrismaJsonValue({
          previousStatus: webhookEvent.status,
          replayJobId: job.id,
          queue: queueNames.webhooks
        })
      }
    }),
    prisma.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        screen: "system.webhooks",
        actionCode: "system.webhooks.retry",
        entityType: "WEBHOOK_EVENT",
        entityId: webhookEvent.id,
        before: toPrismaJsonValue({
          status: webhookEvent.status
        }),
        after: toPrismaJsonValue({
          status: "QUEUED",
          replayJobId: job.id
        })
      }
    })
  ]);

  return {
    webhookEventId: webhookEvent.id,
    jobId: job.id,
    queue: queueNames.webhooks,
    status: "QUEUED"
  };
};

export const retryJobRun = async (
  input: {
    jobRunId: string;
    actorAdminUserId: string;
  },
  override: {
    queueName: string;
    jobName: string;
    payload: Record<string, unknown>;
  } | null
) => {
  const jobRun = await prisma.jobRun.findUnique({
    where: {
      id: input.jobRunId
    }
  });

  if (!jobRun) {
    throw notFoundError("The requested job run was not found.");
  }

  if (jobRun.status !== "FAILED") {
    throw invalidInputError("Only failed job runs can be replayed.");
  }

  const retryConfig = inferRetryConfigFromJobRun({
    jobName: jobRun.jobName,
    jobId: jobRun.jobId,
    metadata: jobRun.metadata
  }) ?? override;

  if (
    !retryConfig ||
    typeof retryConfig.queueName !== "string" ||
    typeof retryConfig.jobName !== "string" ||
    !isRecord(retryConfig.payload)
  ) {
    throw invalidInputError("This job run does not contain enough retry metadata to be replayed.");
  }

  const queue = resolveQueueByName(retryConfig.queueName);

  if (!queue) {
    throw invalidInputError("The queued job cannot be retried because its queue is unavailable.");
  }

  const job = await queue.add(retryConfig.jobName, retryConfig.payload, {
    jobId: `${String(jobRun.jobId)}-retry-${Date.now()}`
  });

  await jobRunService.recordQueued(job, {
    trigger: override ? "manual_retry_override" : "manual_retry",
    retriedFromJobRunId: jobRun.id,
    replaySafety: {
      sourceType: "JOB_RUN",
      sourceId: jobRun.id,
      sourceStatus: jobRun.status,
      replayedByAdminUserId: input.actorAdminUserId
    },
    retry: {
      queueName: retryConfig.queueName,
      jobName: retryConfig.jobName,
      payload: retryConfig.payload
    },
    ...(override
      ? {
          retryOverride: {
            queueName: override.queueName,
            jobName: override.jobName
          }
        }
      : {})
  });

  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "system.jobs.retry",
        entityType: "JOB_RUN",
        entityId: jobRun.id,
        metadata: toPrismaJsonValue({
          previousStatus: jobRun.status,
          replayJobId: job.id,
          queueName: retryConfig.queueName,
          jobName: retryConfig.jobName,
          overrideApplied: Boolean(override)
        })
      }
    }),
    prisma.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        screen: "system.jobs",
        actionCode: "system.jobs.retry",
        entityType: "JOB_RUN",
        entityId: jobRun.id,
        before: toPrismaJsonValue({
          status: jobRun.status
        }),
        after: toPrismaJsonValue({
          status: "QUEUED",
          replayJobId: job.id,
          queueName: retryConfig.queueName
        })
      }
    })
  ]);

  return {
    jobRunId: jobRun.id,
    replayJobId: job.id,
    queue: retryConfig.queueName,
    status: "QUEUED"
  };
};
