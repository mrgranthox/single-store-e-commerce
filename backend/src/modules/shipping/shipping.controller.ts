import { z } from "zod";

import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import { readValidatedBody, readValidatedParams } from "../../common/validation/validate-request";
import {
  createAdminShipment,
  createAdminShipmentTrackingEvent,
  getAdminShipmentDetail,
  getAdminShipmentTracking,
  listPublicShippingMethods,
  updateAdminShipment
} from "./shipping.service";
import {
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
