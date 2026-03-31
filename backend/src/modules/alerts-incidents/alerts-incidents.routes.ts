import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  acknowledgeAlertAdmin,
  assignAlertAdmin,
  bulkAcknowledgeAlertsAdmin,
  bulkAssignAlertsAdmin,
  closeIncidentAdmin,
  createIncidentAdmin,
  getAlertAdmin,
  getIncidentAdmin,
  listAlertsAdmin,
  listIncidentsAdmin,
  resolveAlertAdmin,
  updateIncidentAdmin
} from "./alerts-incidents.controller";
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

const router = Router();

router.get(
  "/admin/alerts",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  validateRequest({ query: alertsQuerySchema }),
  listAlertsAdmin
);
router.post(
  "/admin/alerts/bulk-acknowledge",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ body: bulkAlertIdsBodySchema }),
  bulkAcknowledgeAlertsAdmin
);
router.post(
  "/admin/alerts/bulk-assign",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ body: bulkAssignAlertsBodySchema }),
  bulkAssignAlertsAdmin
);
router.get(
  "/admin/alerts/:alertId",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  validateRequest({ params: alertIdParamsSchema }),
  getAlertAdmin
);
router.post(
  "/admin/alerts/:alertId/assign",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: alertIdParamsSchema, body: assignAlertBodySchema }),
  assignAlertAdmin
);
router.post(
  "/admin/alerts/:alertId/acknowledge",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: alertIdParamsSchema, body: resolveAlertBodySchema }),
  acknowledgeAlertAdmin
);
router.post(
  "/admin/alerts/:alertId/resolve",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: alertIdParamsSchema, body: resolveAlertBodySchema }),
  resolveAlertAdmin
);

router.get(
  "/admin/incidents",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  validateRequest({ query: incidentsQuerySchema }),
  listIncidentsAdmin
);
router.get(
  "/admin/incidents/:incidentId",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  validateRequest({ params: incidentIdParamsSchema }),
  getIncidentAdmin
);
router.post(
  "/admin/incidents",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ body: createIncidentBodySchema }),
  createIncidentAdmin
);
router.patch(
  "/admin/incidents/:incidentId",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: incidentIdParamsSchema, body: updateIncidentBodySchema }),
  updateIncidentAdmin
);
router.post(
  "/admin/incidents/:incidentId/close",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: incidentIdParamsSchema, body: closeIncidentBodySchema }),
  closeIncidentAdmin
);

export const alertsIncidentsRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/admin/alerts", summary: "List operational alerts.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.events.read"] },
    { method: "GET", path: "/api/v1/admin/alerts/:alertId", summary: "Fetch alert detail.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.events.read"] },
    { method: "POST", path: "/api/v1/admin/alerts/:alertId/assign", summary: "Assign an alert.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "POST", path: "/api/v1/admin/alerts/:alertId/acknowledge", summary: "Acknowledge an alert.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "POST", path: "/api/v1/admin/alerts/:alertId/resolve", summary: "Resolve an alert.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "POST", path: "/api/v1/admin/alerts/bulk-acknowledge", summary: "Acknowledge multiple alerts.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "POST", path: "/api/v1/admin/alerts/bulk-assign", summary: "Assign multiple alerts.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "GET", path: "/api/v1/admin/incidents", summary: "List incidents.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.events.read"] },
    { method: "GET", path: "/api/v1/admin/incidents/:incidentId", summary: "Fetch incident detail.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.events.read"] },
    { method: "POST", path: "/api/v1/admin/incidents", summary: "Create an incident.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "PATCH", path: "/api/v1/admin/incidents/:incidentId", summary: "Update an incident.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "POST", path: "/api/v1/admin/incidents/:incidentId/close", summary: "Close an incident.", tags: ["alerts-incidents"], auth: "admin", permissions: ["security.incidents.manage"] }
  ]
};
