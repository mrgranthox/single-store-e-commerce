import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  bulkUpdateShipmentsAdmin,
  createShipmentAdmin,
  createShipmentTrackingEventAdmin,
  getShipmentAdmin,
  getShipmentTrackingAdmin,
  listShipmentsAdmin,
  listShippingMethodsPublic,
  updateShipmentAdmin
} from "./shipping.controller";
import {
  adminShipmentsQuerySchema,
  bulkAdminShipmentStatusBodySchema,
  createShipmentBodySchema,
  createTrackingEventBodySchema,
  orderIdParamsSchema,
  shipmentIdParamsSchema,
  updateShipmentBodySchema
} from "./shipping.schemas";

const router = Router();

router.get("/shipping", listShippingMethodsPublic);

router.post(
  "/admin/orders/:orderId/shipments",
  requireAdminActor,
  requirePermissions(["orders.override_fulfillment"]),
  validateRequest({ params: orderIdParamsSchema, body: createShipmentBodySchema }),
  createShipmentAdmin
);
router.get(
  "/admin/shipments",
  requireAdminActor,
  requirePermissions(["orders.read"]),
  validateRequest({ query: adminShipmentsQuerySchema }),
  listShipmentsAdmin
);
router.post(
  "/admin/shipments/bulk-status",
  requireAdminActor,
  requirePermissions(["orders.override_fulfillment"]),
  validateRequest({ body: bulkAdminShipmentStatusBodySchema }),
  bulkUpdateShipmentsAdmin
);
router.get(
  "/admin/shipments/:shipmentId",
  requireAdminActor,
  requirePermissions(["orders.read"]),
  validateRequest({ params: shipmentIdParamsSchema }),
  getShipmentAdmin
);
router.patch(
  "/admin/shipments/:shipmentId",
  requireAdminActor,
  requirePermissions(["orders.override_fulfillment"]),
  validateRequest({ params: shipmentIdParamsSchema, body: updateShipmentBodySchema }),
  updateShipmentAdmin
);
router.get(
  "/admin/shipments/:shipmentId/tracking",
  requireAdminActor,
  requirePermissions(["orders.read"]),
  validateRequest({ params: shipmentIdParamsSchema }),
  getShipmentTrackingAdmin
);
router.post(
  "/admin/shipments/:shipmentId/tracking-events",
  requireAdminActor,
  requirePermissions(["orders.override_fulfillment"]),
  validateRequest({ params: shipmentIdParamsSchema, body: createTrackingEventBodySchema }),
  createShipmentTrackingEventAdmin
);

export const shippingRouteModule: RouteModule = {
  router,
  metadata: [
    {
      method: "GET",
      path: "/api/v1/shipping",
      summary: "List currently available shipping methods.",
      tags: ["shipping"],
      auth: "public"
    },
    {
      method: "POST",
      path: "/api/v1/admin/orders/:orderId/shipments",
      summary: "Create a shipment for an eligible order.",
      tags: ["shipping"],
      auth: "admin",
      permissions: ["orders.override_fulfillment"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/shipments",
      summary: "List shipments with search, status filter, and pagination.",
      tags: ["shipping"],
      auth: "admin",
      permissions: ["orders.read"]
    },
    {
      method: "POST",
      path: "/api/v1/admin/shipments/bulk-status",
      summary: "Bulk set shipment status; each id is validated independently.",
      tags: ["shipping"],
      auth: "admin",
      permissions: ["orders.override_fulfillment"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/shipments/:shipmentId",
      summary: "Fetch shipment detail with tracking history.",
      tags: ["shipping"],
      auth: "admin",
      permissions: ["orders.read"]
    },
    {
      method: "PATCH",
      path: "/api/v1/admin/shipments/:shipmentId",
      summary: "Update a shipment's warehouse, carrier, tracking number, or status.",
      tags: ["shipping"],
      auth: "admin",
      permissions: ["orders.override_fulfillment"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/shipments/:shipmentId/tracking",
      summary: "Fetch tracking events for a shipment.",
      tags: ["shipping"],
      auth: "admin",
      permissions: ["orders.read"]
    },
    {
      method: "POST",
      path: "/api/v1/admin/shipments/:shipmentId/tracking-events",
      summary: "Append a tracking event and optionally advance shipment status.",
      tags: ["shipping"],
      auth: "admin",
      permissions: ["orders.override_fulfillment"]
    }
  ]
};
