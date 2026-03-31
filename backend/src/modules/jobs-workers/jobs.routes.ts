import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor } from "../roles-permissions/rbac.middleware";
import { requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  enqueueDiagnosticPing,
  getTrackedJobRun,
  getTrackedWebhookEvent,
  listQueueConfiguration,
  listTrackedJobRuns,
  listTrackedWebhookEvents,
  retryTrackedJobRun,
  retryTrackedWebhookEvent
} from "./jobs.controller";
import {
  jobRunIdParamsSchema,
  listJobRunsQuerySchema,
  retryJobRunBodySchema,
  listWebhookEventsQuerySchema,
  webhookEventIdParamsSchema
} from "./monitoring.schemas";

const router = Router();

router.get(
  "/system/jobs/queues",
  requireAdminActor,
  requirePermissions(["system.jobs.read"]),
  listQueueConfiguration
);
router.get(
  "/system/jobs/runs",
  requireAdminActor,
  requirePermissions(["system.jobs.read"]),
  validateRequest({ query: listJobRunsQuerySchema }),
  listTrackedJobRuns
);
router.get(
  "/admin/jobs",
  requireAdminActor,
  requirePermissions(["system.jobs.read"]),
  validateRequest({ query: listJobRunsQuerySchema }),
  listTrackedJobRuns
);
router.get(
  "/system/jobs/runs/:jobRunId",
  requireAdminActor,
  requirePermissions(["system.jobs.read"]),
  validateRequest({ params: jobRunIdParamsSchema }),
  getTrackedJobRun
);
router.get(
  "/admin/jobs/:jobRunId",
  requireAdminActor,
  requirePermissions(["system.jobs.read"]),
  validateRequest({ params: jobRunIdParamsSchema }),
  getTrackedJobRun
);
router.post(
  "/system/jobs/runs/:jobRunId/retry",
  requireAdminActor,
  requirePermissions(["system.jobs.retry", "system.jobs.run"], "any"),
  validateRequest({ params: jobRunIdParamsSchema, body: retryJobRunBodySchema }),
  retryTrackedJobRun
);
router.post(
  "/admin/jobs/:jobRunId/retry",
  requireAdminActor,
  requirePermissions(["system.jobs.retry", "system.jobs.run"], "any"),
  validateRequest({ params: jobRunIdParamsSchema, body: retryJobRunBodySchema }),
  retryTrackedJobRun
);

router.post(
  "/system/jobs/diagnostics/ping",
  requireAdminActor,
  requirePermissions(["system.jobs.run"]),
  enqueueDiagnosticPing
);
router.get(
  "/system/webhooks/events",
  requireAdminActor,
  requirePermissions(["integrations.webhooks.read"]),
  validateRequest({ query: listWebhookEventsQuerySchema }),
  listTrackedWebhookEvents
);
router.get(
  "/admin/webhooks",
  requireAdminActor,
  requirePermissions(["integrations.webhooks.read"]),
  validateRequest({ query: listWebhookEventsQuerySchema }),
  listTrackedWebhookEvents
);
router.get(
  "/system/webhooks/events/:webhookEventId",
  requireAdminActor,
  requirePermissions(["integrations.webhooks.read"]),
  validateRequest({ params: webhookEventIdParamsSchema }),
  getTrackedWebhookEvent
);
router.get(
  "/admin/webhooks/:webhookEventId",
  requireAdminActor,
  requirePermissions(["integrations.webhooks.read"]),
  validateRequest({ params: webhookEventIdParamsSchema }),
  getTrackedWebhookEvent
);
router.post(
  "/system/webhooks/events/:webhookEventId/retry",
  requireAdminActor,
  requirePermissions(["system.webhooks.retry", "integrations.webhooks.write"], "any"),
  validateRequest({ params: webhookEventIdParamsSchema }),
  retryTrackedWebhookEvent
);
router.post(
  "/admin/webhooks/:webhookEventId/retry",
  requireAdminActor,
  requirePermissions(["system.webhooks.retry", "integrations.webhooks.write"], "any"),
  validateRequest({ params: webhookEventIdParamsSchema }),
  retryTrackedWebhookEvent
);

export const jobsRouteModule: RouteModule = {
  router,
  metadata: [
    {
      method: "GET",
      path: "/api/v1/system/jobs/queues",
      summary: "List configured operational queues.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["system.jobs.read"]
    },
    {
      method: "POST",
      path: "/api/v1/system/jobs/diagnostics/ping",
      summary: "Enqueue a diagnostic worker ping job.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["system.jobs.run"]
    },
    {
      method: "GET",
      path: "/api/v1/system/jobs/runs",
      summary: "List tracked job runs for the operational jobs monitor.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["system.jobs.read"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/jobs",
      summary: "List tracked job runs through the admin contract.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["system.jobs.read"]
    },
    {
      method: "GET",
      path: "/api/v1/system/jobs/runs/:jobRunId",
      summary: "Fetch a tracked job run by id.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["system.jobs.read"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/jobs/:jobRunId",
      summary: "Fetch a tracked job run through the admin contract.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["system.jobs.read"]
    },
    {
      method: "POST",
      path: "/api/v1/system/jobs/runs/:jobRunId/retry",
      summary: "Replay a retryable tracked job run.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["system.jobs.retry"]
    },
    {
      method: "POST",
      path: "/api/v1/admin/jobs/:jobRunId/retry",
      summary: "Replay a retryable job through the admin contract.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["system.jobs.retry"]
    },
    {
      method: "GET",
      path: "/api/v1/system/webhooks/events",
      summary: "List recorded webhook events for operational monitoring.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["integrations.webhooks.read"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/webhooks",
      summary: "List recorded webhook events through the admin contract.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["integrations.webhooks.read"]
    },
    {
      method: "GET",
      path: "/api/v1/system/webhooks/events/:webhookEventId",
      summary: "Fetch a recorded webhook event with processing attempts.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["integrations.webhooks.read"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/webhooks/:webhookEventId",
      summary: "Fetch a webhook event through the admin contract.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["integrations.webhooks.read"]
    },
    {
      method: "POST",
      path: "/api/v1/system/webhooks/events/:webhookEventId/retry",
      summary: "Replay a retryable webhook event.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["system.webhooks.retry"]
    },
    {
      method: "POST",
      path: "/api/v1/admin/webhooks/:webhookEventId/retry",
      summary: "Replay a retryable webhook through the admin contract.",
      tags: ["jobs-workers"],
      auth: "admin",
      permissions: ["system.webhooks.retry"]
    }
  ]
};
