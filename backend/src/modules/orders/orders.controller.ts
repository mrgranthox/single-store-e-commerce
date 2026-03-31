import { z } from "zod";

import {
  requireAdminUserId,
  requireCustomerUserId
} from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import {
  accountOrdersQuerySchema,
  assignWarehouseBodySchema,
  adminCancelOrderBodySchema,
  adminCancellationRequestsQuerySchema,
  adminOrderCampaignAttributionBodySchema,
  adminOrderStatusBodySchema,
  adminResolveCancellationBodySchema,
  adminOrdersQuerySchema,
  adminQueueQuerySchema,
  cancellationIdParamsSchema,
  customerCancelOrderBodySchema,
  guestTrackOrderBodySchema,
  orderIdParamsSchema
} from "./orders.schemas";
import {
  approveAdminCancellationRequest,
  assignAdminOrderWarehouse,
  getAccountOrderEligibility,
  cancelAdminOrder,
  patchAdminOrderCampaignAttribution,
  getAccountOrderDetail,
  getAccountOrderTracking,
  getAdminOrderDetail,
  getAdminOrderTimeline,
  listAccountOrders,
  listAdminCancellationRequests,
  listAdminDispatchQueue,
  listAdminFulfillmentQueue,
  listAdminOrders,
  rejectAdminCancellationRequest,
  requestAccountOrderCancellation,
  trackGuestOrder,
  updateAdminOrderStatus
} from "./orders.service";

export const listCustomerOrders = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof accountOrdersQuerySchema>>(request);
  const data = await listAccountOrders(requireCustomerUserId(request.context.actor.userId), query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getCustomerOrder = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const data = await getAccountOrderDetail(requireCustomerUserId(request.context.actor.userId), params.orderId);

  return sendSuccess(response, { data });
});

export const getCustomerOrderTracking = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const data = await getAccountOrderTracking(requireCustomerUserId(request.context.actor.userId), params.orderId);

  return sendSuccess(response, { data });
});

export const getCustomerOrderEligibility = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const data = await getAccountOrderEligibility(requireCustomerUserId(request.context.actor.userId), params.orderId);

  return sendSuccess(response, { data });
});

export const createCustomerOrderCancellation = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof customerCancelOrderBodySchema>>(request);
  const data = await requestAccountOrderCancellation(requireCustomerUserId(request.context.actor.userId), {
    orderId: params.orderId,
    ...body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const createGuestOrderTrackingLookup = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof guestTrackOrderBodySchema>>(request);
  const data = await trackGuestOrder(body);

  return sendSuccess(response, { data });
});

export const listOrdersAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminOrdersQuerySchema>>(request);
  const data = await listAdminOrders(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getOrderAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const data = await getAdminOrderDetail(params.orderId);

  return sendSuccess(response, { data });
});

export const getOrderTimelineAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const data = await getAdminOrderTimeline(params.orderId);

  return sendSuccess(response, { data });
});

export const updateOrderStatusAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminOrderStatusBodySchema>>(request);
  const data = await updateAdminOrderStatus({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    orderId: params.orderId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const assignOrderWarehouseAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof assignWarehouseBodySchema>>(request);
  const data = await assignAdminOrderWarehouse({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    orderId: params.orderId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const patchOrderCampaignAttributionAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminOrderCampaignAttributionBodySchema>>(request);
  const data = await patchAdminOrderCampaignAttribution({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    orderId: params.orderId,
    campaignId: body.campaignId,
    note: body.note
  });

  return sendSuccess(response, { data });
});

export const cancelOrderAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminCancelOrderBodySchema>>(request);
  const data = await cancelAdminOrder({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    orderId: params.orderId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const listFulfillmentQueueAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminQueueQuerySchema>>(request);
  const data = await listAdminFulfillmentQueue(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const listDispatchQueueAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminQueueQuerySchema>>(request);
  const data = await listAdminDispatchQueue(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const listOrderCancellationRequestsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminCancellationRequestsQuerySchema>>(request);
  const data = await listAdminCancellationRequests(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: {
      ...data.pagination,
      queueStats: data.queueStats
    }
  });
});

export const approveOrderCancellationRequestAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof cancellationIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminResolveCancellationBodySchema>>(request);
  const data = await approveAdminCancellationRequest({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    cancellationId: params.cancellationId,
    note: body.note
  });

  return sendSuccess(response, { data });
});

export const rejectOrderCancellationRequestAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof cancellationIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminResolveCancellationBodySchema>>(request);
  const data = await rejectAdminCancellationRequest({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    cancellationId: params.cancellationId,
    note: body.note
  });

  return sendSuccess(response, { data });
});
