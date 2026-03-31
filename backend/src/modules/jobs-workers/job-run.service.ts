import type { Job } from "bullmq";
import { JobRunStatus } from "@prisma/client";

import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";

const buildJobName = (job: Job) => `${job.queueName}:${job.name}`;

const buildQueuedJobMetadata = (job: Job, metadata?: Record<string, unknown>) => ({
  ...(metadata ?? {}),
  traceId:
    typeof metadata?.traceId === "string"
      ? metadata.traceId
      : typeof metadata?.requestId === "string"
        ? metadata.requestId
        : null,
  jobSnapshot: {
    queueName: job.queueName,
    jobName: job.name,
    payload: job.data
  }
});

const findLatestJobRun = (job: Job) =>
  prisma.jobRun.findFirst({
    where: {
      jobId: String(job.id),
      jobName: buildJobName(job)
    },
    orderBy: {
      createdAt: "desc"
    }
  });

export const jobRunService = {
  async recordQueued(job: Job, metadata?: Record<string, unknown>) {
    try {
      await prisma.jobRun.create({
        data: {
          jobId: String(job.id),
          jobName: buildJobName(job),
          status: JobRunStatus.QUEUED,
          metadata: toPrismaJsonValue(buildQueuedJobMetadata(job, metadata))
        }
      });
    } catch (error) {
      logger.warn({ error, jobId: job.id, queueName: job.queueName }, "Failed to record queued job.");
    }
  },

  async recordStarted(job: Job) {
    try {
      const existing = await findLatestJobRun(job);

      if (existing) {
        await prisma.jobRun.update({
          where: { id: existing.id },
          data: {
            status: JobRunStatus.RUNNING,
            startedAt: new Date()
          }
        });
        return;
      }

      await prisma.jobRun.create({
        data: {
          jobId: String(job.id),
          jobName: buildJobName(job),
          status: JobRunStatus.RUNNING,
          metadata: toPrismaJsonValue({ recreatedFromWorker: true })
        }
      });
    } catch (error) {
      logger.warn({ error, jobId: job.id, queueName: job.queueName }, "Failed to record started job.");
    }
  },

  async recordCompleted(job: Job, metadata?: Record<string, unknown>) {
    try {
      const existing = await findLatestJobRun(job);

      if (!existing) {
        await prisma.jobRun.create({
          data: {
            jobId: String(job.id),
            jobName: buildJobName(job),
            status: JobRunStatus.SUCCEEDED,
            finishedAt: new Date(),
            metadata: toPrismaJsonValue(metadata)
          }
        });
        return;
      }

      await prisma.jobRun.update({
        where: { id: existing.id },
        data: {
          status: JobRunStatus.SUCCEEDED,
          finishedAt: new Date(),
          ...(metadata ? { metadata: toPrismaJsonValue(metadata) } : {})
        }
      });
    } catch (error) {
      logger.warn(
        { error, jobId: job.id, queueName: job.queueName },
        "Failed to record completed job."
      );
    }
  },

  async recordFailed(job: Job, error: unknown) {
    try {
      const existing = await findLatestJobRun(job);
      const serializedError = toPrismaJsonValue(
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack
            }
          : error
      );

      if (!existing) {
        await prisma.jobRun.create({
          data: {
            jobId: String(job.id),
            jobName: buildJobName(job),
            status: JobRunStatus.FAILED,
            finishedAt: new Date(),
            error: serializedError
          }
        });
        return;
      }

      await prisma.jobRun.update({
        where: { id: existing.id },
        data: {
          status: JobRunStatus.FAILED,
          finishedAt: new Date(),
          ...(serializedError ? { error: serializedError } : {})
        }
      });
    } catch (recordingError) {
      logger.warn(
        { error: recordingError, jobId: job.id, queueName: job.queueName },
        "Failed to record failed job."
      );
    }
  }
};
