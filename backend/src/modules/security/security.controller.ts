import { z } from "zod";

import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import {
  loginEventsQuerySchema,
  resolveSecurityEventBodySchema,
  reviewRiskSignalBodySchema,
  riskSignalIdParamsSchema,
  riskSignalsQuerySchema,
  securityEventIdParamsSchema,
  securityEventNoteBodySchema,
  securityEventsQuerySchema
} from "./security.schemas";
import {
  getSecurityDashboard,
  getSecurityEventDetail,
  listLoginEvents,
  listRiskSignals,
  listSecurityEvents,
  notifySecurityEventFollowUp,
  requestSecurityEventIpBlock,
  resolveSecurityEvent,
  reviewRiskSignal
} from "./security.service";

export const getSecurityDashboardAdmin = asyncHandler(async (_request, response) => {
  const data = await getSecurityDashboard();
  return sendSuccess(response, { data });
});

export const listSecurityEventsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof securityEventsQuerySchema>>(request);
  const data = await listSecurityEvents(query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});

export const getSecurityEventAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof securityEventIdParamsSchema>>(request);
  const data = await getSecurityEventDetail(params.eventId);
  return sendSuccess(response, { data });
});

export const resolveSecurityEventAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof securityEventIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof resolveSecurityEventBodySchema>>(request);
  const data = await resolveSecurityEvent({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    eventId: params.eventId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const notifySecurityEventAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof securityEventIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof securityEventNoteBodySchema>>(request);
  const data = await notifySecurityEventFollowUp({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    eventId: params.eventId,
    note: body.note
  });
  return sendSuccess(response, { data });
});

export const requestSecurityEventIpBlockAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof securityEventIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof securityEventNoteBodySchema>>(request);
  const data = await requestSecurityEventIpBlock({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    eventId: params.eventId,
    note: body.note
  });
  return sendSuccess(response, { data });
});

export const listRiskSignalsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof riskSignalsQuerySchema>>(request);
  const data = await listRiskSignals(query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});

export const reviewRiskSignalAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof riskSignalIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof reviewRiskSignalBodySchema>>(request);
  const data = await reviewRiskSignal({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    riskSignalId: params.riskSignalId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const listLoginEventsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof loginEventsQuerySchema>>(request);
  const data = await listLoginEvents(query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});
