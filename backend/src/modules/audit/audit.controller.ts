import { z } from "zod";

import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import {
  adminActionsQuerySchema,
  auditLogsQuerySchema,
  entityTimelineParamsSchema,
  timelineQuerySchema
} from "./audit.schemas";
import {
  getEntityTimeline,
  listAdminActionLogs,
  listAuditLogs,
  listTimelineEvents
} from "./audit.service";

export const listAuditLogsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof auditLogsQuerySchema>>(request);
  const data = await listAuditLogs(query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});

export const listAdminActionsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminActionsQuerySchema>>(request);
  const data = await listAdminActionLogs(query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});

export const listTimelineAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof timelineQuerySchema>>(request);
  const data = await listTimelineEvents(query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});

export const getEntityTimelineAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof entityTimelineParamsSchema>>(request);
  const query = readValidatedQuery<z.infer<typeof timelineQuerySchema>>(request);
  const data = await getEntityTimeline(params.entityType, params.entityId, query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});
