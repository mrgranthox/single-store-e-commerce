import type { RequestHandler } from "express";
import { z } from "zod";

import { requireAdminUserId } from "../../common/http/controller-actor";
import { queueNames, queueOperationalContracts, queues } from "../../config/queue";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import { jobRunService } from "./job-run.service";
import {
  getJobRunDetail,
  getWebhookEventDetail,
  listJobRuns,
  listWebhookEvents,
  retryJobRun,
  retryWebhookEvent
} from "./monitoring.service";
import {
  jobRunIdParamsSchema,
  listJobRunsQuerySchema,
  retryJobRunBodySchema,
  listWebhookEventsQuerySchema,
  webhookEventIdParamsSchema
} from "./monitoring.schemas";

export const listQueueConfiguration: RequestHandler = (_request, response) => {
  return sendSuccess(response, {
    data: {
      queues: Object.values(queueNames),
      contracts: queueOperationalContracts
    }
  });
};

export const enqueueDiagnosticPing = asyncHandler(async (request, response) => {
  const job = await queues.reconciliation.add(
    "system.ping",
    {
      requestId: request.context.requestId,
      requestedAt: new Date().toISOString(),
      actorId: request.context.actor.actorId
    },
    {
      jobId: `system-ping:${request.context.requestId}`
    }
  );

  await jobRunService.recordQueued(job, {
    trigger: "manual",
    requestId: request.context.requestId,
    actorId: request.context.actor.actorId,
    retry: {
      queueName: queueNames.reconciliation,
      jobName: job.name,
      payload: {
        requestId: request.context.requestId,
        requestedAt: new Date().toISOString(),
        actorId: request.context.actor.actorId
      }
    }
  });

  return sendSuccess(response, {
    statusCode: 202,
    data: {
      jobId: job.id,
      jobName: job.name,
      queue: queueNames.reconciliation,
      status: "QUEUED"
    }
  });
});

export const listTrackedJobRuns = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof listJobRunsQuerySchema>>(request);
  const data = await listJobRuns({
    page: query.page,
    pageSize: query.pageSize,
    status: query.status,
    jobName: query.jobName,
    startedAfter: query.startedAfter,
    startedBefore: query.startedBefore
  });

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total: data.total
    }
  });
});

export const getTrackedJobRun = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof jobRunIdParamsSchema>>(request);
  const data = await getJobRunDetail(params.jobRunId);

  return sendSuccess(response, { data });
});

export const listTrackedWebhookEvents = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof listWebhookEventsQuerySchema>>(request);
  const data = await listWebhookEvents({
    page: query.page,
    pageSize: query.pageSize,
    status: query.status,
    provider: query.provider,
    eventType: query.eventType,
    receivedAfter: query.receivedAfter,
    receivedBefore: query.receivedBefore
  });

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total: data.total
    }
  });
});

export const getTrackedWebhookEvent = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof webhookEventIdParamsSchema>>(request);
  const data = await getWebhookEventDetail(params.webhookEventId);

  return sendSuccess(response, { data });
});

export const retryTrackedJobRun = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof jobRunIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof retryJobRunBodySchema>>(request);
  const override =
    body.queueName && body.jobName && body.payload
      ? {
          queueName: body.queueName,
          jobName: body.jobName,
          payload: body.payload
        }
      : null;
  const data = await retryJobRun(
    {
      jobRunId: params.jobRunId,
      actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId)
    },
    override
  );

  return sendSuccess(response, {
    statusCode: 202,
    data
  });
});

export const retryTrackedWebhookEvent = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof webhookEventIdParamsSchema>>(request);
  const data = await retryWebhookEvent({
    webhookEventId: params.webhookEventId,
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId)
  });

  return sendSuccess(response, {
    statusCode: 202,
    data
  });
});
