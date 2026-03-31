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
  alertIdParamsSchema,
  alertsQuerySchema,
  assignAlertBodySchema,
  bulkAssignAlertsBodySchema,
  bulkAlertIdsBodySchema,
  closeIncidentBodySchema,
  createIncidentBodySchema,
  incidentIdParamsSchema,
  incidentsQuerySchema,
  resolveAlertBodySchema,
  updateIncidentBodySchema
} from "./alerts-incidents.schemas";
import {
  acknowledgeAlert,
  assignAlert,
  bulkAcknowledgeAlerts,
  bulkAssignAlerts,
  createIncident,
  getAlertDetail,
  getIncidentDetail,
  listAlerts,
  listIncidents,
  resolveAlert,
  updateIncident
} from "./alerts-incidents.service";

export const listAlertsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof alertsQuerySchema>>(request);
  const data = await listAlerts(query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});

export const getAlertAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof alertIdParamsSchema>>(request);
  const data = await getAlertDetail(params.alertId);
  return sendSuccess(response, { data });
});

export const assignAlertAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof alertIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof assignAlertBodySchema>>(request);
  const data = await assignAlert({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    alertId: params.alertId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const acknowledgeAlertAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof alertIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof resolveAlertBodySchema>>(request);
  const data = await acknowledgeAlert({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    alertId: params.alertId,
    note: body.note
  });
  return sendSuccess(response, { data });
});

export const resolveAlertAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof alertIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof resolveAlertBodySchema>>(request);
  const data = await resolveAlert({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    alertId: params.alertId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const bulkAcknowledgeAlertsAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof bulkAlertIdsBodySchema>>(request);
  const data = await bulkAcknowledgeAlerts({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    alertIds: body.alertIds,
    note: body.note
  });
  return sendSuccess(response, { data });
});

export const bulkAssignAlertsAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof bulkAssignAlertsBodySchema>>(request);
  const data = await bulkAssignAlerts({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    alertIds: body.alertIds,
    assignedToAdminUserId: body.assignedToAdminUserId,
    note: body.note
  });
  return sendSuccess(response, { data });
});

export const listIncidentsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof incidentsQuerySchema>>(request);
  const data = await listIncidents(query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});

export const getIncidentAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof incidentIdParamsSchema>>(request);
  const data = await getIncidentDetail(params.incidentId);
  return sendSuccess(response, { data });
});

export const createIncidentAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createIncidentBodySchema>>(request);
  const data = await createIncident({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });
  return sendSuccess(response, { statusCode: 201, data });
});

export const updateIncidentAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof incidentIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateIncidentBodySchema>>(request);
  const data = await updateIncident({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    incidentId: params.incidentId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const closeIncidentAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof incidentIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof closeIncidentBodySchema>>(request);
  const data = await updateIncident({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    incidentId: params.incidentId,
    status: "CLOSED",
    summary: body.note
  });
  return sendSuccess(response, { data });
});
