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
  adminNotificationsQuerySchema,
  broadcastNotificationsBodySchema,
  broadcastSegmentPreviewQuerySchema,
  createNotificationBodySchema,
  notificationIdParamsSchema,
  notificationsQuerySchema
} from "./notifications.schemas";
import {
  broadcastAdminNotifications,
  countBroadcastRecipients,
  createAdminNotification,
  getAdminNotificationDetail,
  listAdminNotifications,
  listCustomerNotifications,
  retryAdminNotification
} from "./notifications.service";

export const listMyNotifications = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof notificationsQuerySchema>>(request);
  const data = await listCustomerNotifications(requireCustomerUserId(request.context.actor.userId), query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});

export const listNotificationsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminNotificationsQuerySchema>>(request);
  const data = await listAdminNotifications(query);
  return sendSuccess(response, { data: { items: data.items }, meta: data.pagination });
});

export const getNotificationAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof notificationIdParamsSchema>>(request);
  const data = await getAdminNotificationDetail(params.notificationId);
  return sendSuccess(response, { data });
});

export const createNotificationAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createNotificationBodySchema>>(request);
  const data = await createAdminNotification({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });
  return sendSuccess(response, { statusCode: 201, data });
});

export const previewBroadcastSegmentAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof broadcastSegmentPreviewQuerySchema>>(request);
  const recipientCount = await countBroadcastRecipients(query.segment);
  return sendSuccess(response, {
    data: {
      segment: query.segment,
      recipientCount
    }
  });
});

export const createBroadcastAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof broadcastNotificationsBodySchema>>(request);
  const data = await broadcastAdminNotifications({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    segment: body.segment,
    type: body.type,
    payload: body.payload
  });
  return sendSuccess(response, { data });
});

export const retryNotificationAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof notificationIdParamsSchema>>(request);
  const data = await retryAdminNotification({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    notificationId: params.notificationId
  });
  return sendSuccess(response, { data });
});
