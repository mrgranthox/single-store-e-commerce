import { JobRunStatus, WebhookEventStatus } from "@prisma/client";
import { z } from "zod";

const paginationNumber = z.coerce.number().int().min(1);

const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  });

export const paginationQuerySchema = z.object({
  page: paginationNumber.default(1),
  pageSize: paginationNumber.max(100).default(20)
});

export const listJobRunsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(JobRunStatus).optional(),
  jobName: z.string().trim().min(1).max(255).optional(),
  startedAfter: optionalIsoDate,
  startedBefore: optionalIsoDate
});

export const listWebhookEventsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(WebhookEventStatus).optional(),
  provider: z.string().trim().min(1).max(100).optional(),
  eventType: z.string().trim().min(1).max(255).optional(),
  receivedAfter: optionalIsoDate,
  receivedBefore: optionalIsoDate
});

export const jobRunIdParamsSchema = z.object({
  jobRunId: z.string().uuid()
});

export const webhookEventIdParamsSchema = z.object({
  webhookEventId: z.string().uuid()
});

export const retryJobRunBodySchema = z
  .object({
    queueName: z.string().trim().min(1).max(120).optional(),
    jobName: z.string().trim().min(1).max(160).optional(),
    payload: z.record(z.string(), z.unknown()).optional()
  })
  .superRefine((value, context) => {
    const hasAnyOverrideField =
      value.queueName !== undefined || value.jobName !== undefined || value.payload !== undefined;

    if (!hasAnyOverrideField) {
      return;
    }

    if (!value.queueName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["queueName"],
        message: "queueName is required when supplying a retry override."
      });
    }

    if (!value.jobName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jobName"],
        message: "jobName is required when supplying a retry override."
      });
    }

    if (!value.payload) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payload"],
        message: "payload is required when supplying a retry override."
      });
    }
  });
