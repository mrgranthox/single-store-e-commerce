import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireCustomerActor } from "../auth/auth.middleware";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  approveOrderCancellationRequestAdmin,
  assignOrderWarehouseAdmin,
  cancelOrderAdmin,
  createCustomerOrderCancellation,
  createGuestOrderTrackingLookup,
  getCustomerOrder,
  getCustomerOrderTracking,
  getOrderAdmin,
  getOrderTimelineAdmin,
  listOrderCancellationRequestsAdmin,
  listCustomerOrders,
  listDispatchQueueAdmin,
  listFulfillmentQueueAdmin,
  listOrdersAdmin,
  rejectOrderCancellationRequestAdmin,
  updateOrderStatusAdmin,
  patchOrderCampaignAttributionAdmin
} from "./orders.controller";
import {
  accountOrdersQuerySchema,
  assignWarehouseBodySchema,
  adminCancelOrderBodySchema,
  adminOrderCampaignAttributionBodySchema,
  adminCancellationRequestsQuerySchema,
  adminOrderStatusBodySchema,
  adminResolveCancellationBodySchema,
  adminOrdersQuerySchema,
  adminQueueQuerySchema,
  cancellationIdParamsSchema,
  customerCancelOrderBodySchema,
  guestTrackOrderBodySchema,
  orderIdParamsSchema
} from "./orders.schemas";

const router = Router();

router.post("/track-order", validateRequest({ body: guestTrackOrderBodySchema }), createGuestOrderTrackingLookup);
router.post("/orders/track", validateRequest({ body: guestTrackOrderBodySchema }), createGuestOrderTrackingLookup);

router.get("/account/orders", requireCustomerActor, validateRequest({ query: accountOrdersQuerySchema }), listCustomerOrders);
router.get("/account/orders/:orderId", requireCustomerActor, validateRequest({ params: orderIdParamsSchema }), getCustomerOrder);
router.get("/account/orders/:orderId/tracking", requireCustomerActor, validateRequest({ params: orderIdParamsSchema }), getCustomerOrderTracking);
router.post(
  "/account/orders/:orderId/cancel",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema, body: customerCancelOrderBodySchema }),
  createCustomerOrderCancellation
);

router.get(
  "/admin/orders",
  requireAdminActor,
  requirePermissions(["orders.read"]),
  validateRequest({ query: adminOrdersQuerySchema }),
  listOrdersAdmin
);
router.get(
  "/admin/orders/fulfillment-queue",
  requireAdminActor,
  requirePermissions(["orders.read"]),
  validateRequest({ query: adminQueueQuerySchema }),
  listFulfillmentQueueAdmin
);
router.get(
  "/admin/orders/dispatch-queue",
  requireAdminActor,
  requirePermissions(["orders.read"]),
  validateRequest({ query: adminQueueQuerySchema }),
  listDispatchQueueAdmin
);
router.get(
  "/admin/orders/cancellation-requests",
  requireAdminActor,
  requirePermissions(["orders.read"]),
  validateRequest({ query: adminCancellationRequestsQuerySchema }),
  listOrderCancellationRequestsAdmin
);
router.post(
  "/admin/orders/cancellation-requests/:cancellationId/approve",
  requireAdminActor,
  requirePermissions(["orders.cancel"]),
  validateRequest({ params: cancellationIdParamsSchema, body: adminResolveCancellationBodySchema }),
  approveOrderCancellationRequestAdmin
);
router.post(
  "/admin/orders/cancellation-requests/:cancellationId/reject",
  requireAdminActor,
  requirePermissions(["orders.cancel"]),
  validateRequest({ params: cancellationIdParamsSchema, body: adminResolveCancellationBodySchema }),
  rejectOrderCancellationRequestAdmin
);
router.get(
  "/admin/orders/:orderId",
  requireAdminActor,
  requirePermissions(["orders.read"]),
  validateRequest({ params: orderIdParamsSchema }),
  getOrderAdmin
);
router.get(
  "/admin/orders/:orderId/timeline",
  requireAdminActor,
  requirePermissions(["orders.read"]),
  validateRequest({ params: orderIdParamsSchema }),
  getOrderTimelineAdmin
);
router.post(
  "/admin/orders/:orderId/status",
  requireAdminActor,
  requirePermissions(["orders.update"]),
  validateRequest({ params: orderIdParamsSchema, body: adminOrderStatusBodySchema }),
  updateOrderStatusAdmin
);
router.post(
  "/admin/orders/:orderId/assign-warehouse",
  requireAdminActor,
  requirePermissions(["orders.override_fulfillment"]),
  validateRequest({ params: orderIdParamsSchema, body: assignWarehouseBodySchema }),
  assignOrderWarehouseAdmin
);
router.post(
  "/admin/orders/:orderId/campaign-attribution",
  requireAdminActor,
  requirePermissions(["orders.update"]),
  validateRequest({ params: orderIdParamsSchema, body: adminOrderCampaignAttributionBodySchema }),
  patchOrderCampaignAttributionAdmin
);
router.post(
  "/admin/orders/:orderId/cancel",
  requireAdminActor,
  requirePermissions(["orders.cancel"]),
  validateRequest({ params: orderIdParamsSchema, body: adminCancelOrderBodySchema }),
  cancelOrderAdmin
);

export const ordersRouteModule: RouteModule = {
  router,
  metadata: [
    {
      method: "POST",
      path: "/api/v1/track-order",
      summary: "Track a guest order through the top-level compatibility alias.",
      tags: ["orders"],
      auth: "public"
    },
    {
      method: "POST",
      path: "/api/v1/orders/track",
      summary: "Track a guest order by order number and email address.",
      tags: ["orders"],
      auth: "public"
    },
    {
      method: "GET",
      path: "/api/v1/account/orders",
      summary: "List the authenticated customer's orders.",
      tags: ["orders"],
      auth: "authenticated"
    },
    {
      method: "GET",
      path: "/api/v1/account/orders/:orderId",
      summary: "Fetch authenticated customer order detail.",
      tags: ["orders"],
      auth: "authenticated"
    },
    {
      method: "GET",
      path: "/api/v1/account/orders/:orderId/tracking",
      summary: "Fetch shipment tracking detail for an authenticated customer's order.",
      tags: ["orders"],
      auth: "authenticated"
    },
    {
      method: "POST",
      path: "/api/v1/account/orders/:orderId/cancel",
      summary: "Submit a customer cancellation request for an eligible order.",
      tags: ["orders"],
      auth: "authenticated"
    },
    {
      method: "GET",
      path: "/api/v1/admin/orders",
      summary: "List admin-visible orders with customer and payment context.",
      tags: ["orders"],
      auth: "admin",
      permissions: ["orders.read"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/orders/fulfillment-queue",
      summary: "List orders waiting in the fulfillment queue.",
      tags: ["orders"],
      auth: "admin",
      permissions: ["orders.read"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/orders/dispatch-queue",
      summary: "List orders with shipments waiting to dispatch.",
      tags: ["orders"],
      auth: "admin",
      permissions: ["orders.read"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/orders/:orderId",
      summary: "Fetch admin order detail.",
      tags: ["orders"],
      auth: "admin",
      permissions: ["orders.read"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/orders/:orderId/timeline",
      summary: "Fetch the combined admin timeline for an order.",
      tags: ["orders"],
      auth: "admin",
      permissions: ["orders.read"]
    },
    {
      method: "POST",
      path: "/api/v1/admin/orders/:orderId/status",
      summary: "Update an order status through an allowed transition.",
      tags: ["orders"],
      auth: "admin",
      permissions: ["orders.update"]
    },
    {
      method: "POST",
      path: "/api/v1/admin/orders/:orderId/assign-warehouse",
      summary: "Assign a preferred fulfillment warehouse before shipment creation.",
      tags: ["orders"],
      auth: "admin",
      permissions: ["orders.override_fulfillment"]
    },
    {
      method: "POST",
      path: "/api/v1/admin/orders/:orderId/cancel",
      summary: "Cancel an eligible order as an admin-sensitive action.",
      tags: ["orders"],
      auth: "admin",
      permissions: ["orders.cancel"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/orders/cancellation-requests",
      summary: "List pending and resolved order cancellation requests.",
      tags: ["orders"],
      auth: "admin",
      permissions: ["orders.read"]
    },
    {
      method: "POST",
      path: "/api/v1/admin/orders/cancellation-requests/:cancellationId/approve",
      summary: "Approve a customer cancellation request and cancel the order.",
      tags: ["orders"],
      auth: "admin",
      permissions: ["orders.cancel"]
    },
    {
      method: "POST",
      path: "/api/v1/admin/orders/cancellation-requests/:cancellationId/reject",
      summary: "Reject a customer cancellation request.",
      tags: ["orders"],
      auth: "admin",
      permissions: ["orders.cancel"]
    }
  ]
};
