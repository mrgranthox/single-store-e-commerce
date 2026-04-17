import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { rateLimit, rateLimitKeyFromActorOrIp } from "../../common/middleware/rate-limit.middleware";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminStepUp } from "../auth/admin-step-up.middleware";
import { requireCustomerActor } from "../auth/auth.middleware";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  createBroadcastAdmin,
  createNotificationAdmin,
  getNotificationAdmin,
  listMyNotifications,
  listNotificationsAdmin,
  previewBroadcastSegmentAdmin,
  retryNotificationAdmin
} from "./notifications.controller";
import {
  adminNotificationsQuerySchema,
  broadcastNotificationsBodySchema,
  broadcastSegmentPreviewQuerySchema,
  createNotificationBodySchema,
  notificationIdParamsSchema,
  notificationsQuerySchema
} from "./notifications.schemas";

const router = Router();

const adminNotificationCreateRateLimit = rateLimit({
  keyPrefix: "rl:admin:notifications:create",
  maxRequests: 30,
  windowSeconds: 300,
  failClosed: true,
  keyResolver: rateLimitKeyFromActorOrIp
});

const adminNotificationRetryRateLimit = rateLimit({
  keyPrefix: "rl:admin:notifications:retry",
  maxRequests: 40,
  windowSeconds: 300,
  failClosed: true,
  keyResolver: rateLimitKeyFromActorOrIp
});

const adminNotificationBroadcastRateLimit = rateLimit({
  keyPrefix: "rl:admin:notifications:broadcast",
  maxRequests: 5,
  windowSeconds: 3600,
  failClosed: true,
  keyResolver: rateLimitKeyFromActorOrIp
});

router.get(
  "/notifications",
  requireCustomerActor,
  validateRequest({ query: notificationsQuerySchema }),
  listMyNotifications
);

router.get(
  "/admin/notifications",
  requireAdminActor,
  requirePermissions(["notifications.read"]),
  validateRequest({ query: adminNotificationsQuerySchema }),
  listNotificationsAdmin
);
router.get(
  "/admin/notifications/broadcast/segment-preview",
  requireAdminActor,
  requirePermissions(["notifications.read"]),
  validateRequest({ query: broadcastSegmentPreviewQuerySchema }),
  previewBroadcastSegmentAdmin
);
router.post(
  "/admin/notifications/broadcast",
  requireAdminActor,
  requirePermissions(["notifications.write"]),
  requireAdminStepUp(),
  adminNotificationBroadcastRateLimit,
  validateRequest({ body: broadcastNotificationsBodySchema }),
  createBroadcastAdmin
);
router.get(
  "/admin/notifications/:notificationId",
  requireAdminActor,
  requirePermissions(["notifications.read"]),
  validateRequest({ params: notificationIdParamsSchema }),
  getNotificationAdmin
);
router.post(
  "/admin/notifications",
  requireAdminActor,
  requirePermissions(["notifications.write"]),
  requireAdminStepUp(),
  adminNotificationCreateRateLimit,
  validateRequest({ body: createNotificationBodySchema }),
  createNotificationAdmin
);
router.post(
  "/admin/notifications/:notificationId/retry",
  requireAdminActor,
  requirePermissions(["notifications.write"]),
  requireAdminStepUp(),
  adminNotificationRetryRateLimit,
  validateRequest({ params: notificationIdParamsSchema }),
  retryNotificationAdmin
);

export const notificationsRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/notifications", summary: "List the authenticated customer's notifications.", tags: ["notifications"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/admin/notifications", summary: "List notifications.", tags: ["notifications"], auth: "admin", permissions: ["notifications.read"] },
    {
      method: "GET",
      path: "/api/v1/admin/notifications/broadcast/segment-preview",
      summary: "Count recipients for a broadcast segment.",
      tags: ["notifications"],
      auth: "admin",
      permissions: ["notifications.read"]
    },
    {
      method: "POST",
      path: "/api/v1/admin/notifications/broadcast",
      summary: "Enqueue one email notification per recipient for a segment.",
      tags: ["notifications"],
      auth: "admin",
      permissions: ["notifications.write"]
    },
    { method: "GET", path: "/api/v1/admin/notifications/:notificationId", summary: "Fetch notification detail.", tags: ["notifications"], auth: "admin", permissions: ["notifications.read"] },
    { method: "POST", path: "/api/v1/admin/notifications", summary: "Create and enqueue a notification.", tags: ["notifications"], auth: "admin", permissions: ["notifications.write"] },
    { method: "POST", path: "/api/v1/admin/notifications/:notificationId/retry", summary: "Retry notification delivery.", tags: ["notifications"], auth: "admin", permissions: ["notifications.write"] }
  ]
};
