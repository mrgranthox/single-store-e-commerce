import { z } from "zod";

import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import { readValidatedBody, readValidatedParams, readValidatedQuery } from "../../common/validation/validate-request";
import {
  bulkUpdateAdminShipments,
  createAdminShipment,
  createAdminShipmentTrackingEvent,
  getAdminShipmentDetail,
  getAdminShipmentTracking,
  listAdminShipments,
  listPublicShippingMethods,
  updateAdminShipment
} from "./shipping.service";
import {
  adminShipmentsQuerySchema,
  bulkAdminShipmentStatusBodySchema,
  createShipmentBodySchema,
  createTrackingEventBodySchema,
  orderIdParamsSchema,
  shipmentIdParamsSchema,
  updateShipmentBodySchema
} from "./shipping.schemas";

export const listShippingMethodsPublic = asyncHandler(async (_request, response) => {
  const data = listPublicShippingMethods();
  return sendSuccess(response, { data });
});

export const listShipmentsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminShipmentsQuerySchema>>(request);
  const data = await listAdminShipments(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const bulkUpdateShipmentsAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof bulkAdminShipmentStatusBodySchema>>(request);
  const data = await bulkUpdateAdminShipments({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    shipmentIds: body.shipmentIds,
    shipmentStatus: body.shipmentStatus,
    note: body.note
  });

  return sendSuccess(response, { data });
});

export const createShipmentAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof createShipmentBodySchema>>(request);
  const data = await createAdminShipment({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    orderId: params.orderId,
    ...body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const getShipmentAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof shipmentIdParamsSchema>>(request);
  const data = await getAdminShipmentDetail(params.shipmentId);

  return sendSuccess(response, { data });
});

export const updateShipmentAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof shipmentIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateShipmentBodySchema>>(request);
  const data = await updateAdminShipment({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    shipmentId: params.shipmentId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const getShipmentTrackingAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof shipmentIdParamsSchema>>(request);
  const data = await getAdminShipmentTracking(params.shipmentId);

  return sendSuccess(response, { data });
});

export const createShipmentTrackingEventAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof shipmentIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof createTrackingEventBodySchema>>(request);
  const data = await createAdminShipmentTrackingEvent({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    shipmentId: params.shipmentId,
    ...body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});
