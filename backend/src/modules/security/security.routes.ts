import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  getSecurityDashboardAdmin,
  getSecurityEventAdmin,
  listLoginEventsAdmin,
  listRiskSignalsAdmin,
  listSecurityEventsAdmin,
  notifySecurityEventAdmin,
  requestSecurityEventIpBlockAdmin,
  resolveSecurityEventAdmin,
  reviewRiskSignalAdmin
} from "./security.controller";
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

const router = Router();

router.get(
  "/admin/security/dashboard",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  getSecurityDashboardAdmin
);
router.get(
  "/admin/security/events",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  validateRequest({ query: securityEventsQuerySchema }),
  listSecurityEventsAdmin
);
router.get(
  "/admin/security-events",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  validateRequest({ query: securityEventsQuerySchema }),
  listSecurityEventsAdmin
);
router.get(
  "/admin/security/events/:eventId",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  validateRequest({ params: securityEventIdParamsSchema }),
  getSecurityEventAdmin
);
router.get(
  "/admin/security-events/:eventId",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  validateRequest({ params: securityEventIdParamsSchema }),
  getSecurityEventAdmin
);
router.post(
  "/admin/security/events/:eventId/resolve",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: securityEventIdParamsSchema, body: resolveSecurityEventBodySchema }),
  resolveSecurityEventAdmin
);
router.post(
  "/admin/security-events/:eventId/status",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: securityEventIdParamsSchema, body: resolveSecurityEventBodySchema }),
  resolveSecurityEventAdmin
);
router.post(
  "/admin/security/events/:eventId/notify",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: securityEventIdParamsSchema, body: securityEventNoteBodySchema }),
  notifySecurityEventAdmin
);
router.post(
  "/admin/security/events/:eventId/request-ip-block",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: securityEventIdParamsSchema, body: securityEventNoteBodySchema }),
  requestSecurityEventIpBlockAdmin
);
router.post(
  "/admin/security-events/:eventId/notify",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: securityEventIdParamsSchema, body: securityEventNoteBodySchema }),
  notifySecurityEventAdmin
);
router.post(
  "/admin/security-events/:eventId/request-ip-block",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: securityEventIdParamsSchema, body: securityEventNoteBodySchema }),
  requestSecurityEventIpBlockAdmin
);
router.get(
  "/admin/security/risk-signals",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  validateRequest({ query: riskSignalsQuerySchema }),
  listRiskSignalsAdmin
);
router.get(
  "/admin/risk-signals",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  validateRequest({ query: riskSignalsQuerySchema }),
  listRiskSignalsAdmin
);
router.post(
  "/admin/security/risk-signals/:riskSignalId/review",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: riskSignalIdParamsSchema, body: reviewRiskSignalBodySchema }),
  reviewRiskSignalAdmin
);
router.post(
  "/admin/risk-signals/:riskSignalId/review",
  requireAdminActor,
  requirePermissions(["security.incidents.manage"]),
  validateRequest({ params: riskSignalIdParamsSchema, body: reviewRiskSignalBodySchema }),
  reviewRiskSignalAdmin
);
router.get(
  "/admin/security/login-events",
  requireAdminActor,
  requirePermissions(["security.events.read"]),
  validateRequest({ query: loginEventsQuerySchema }),
  listLoginEventsAdmin
);

export const securityRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/admin/security/dashboard", summary: "Fetch security dashboard metrics.", tags: ["security"], auth: "admin", permissions: ["security.events.read"] },
    { method: "GET", path: "/api/v1/admin/security/events", summary: "List security events.", tags: ["security"], auth: "admin", permissions: ["security.events.read"] },
    { method: "GET", path: "/api/v1/admin/security/events/:eventId", summary: "Fetch security event detail.", tags: ["security"], auth: "admin", permissions: ["security.events.read"] },
    { method: "POST", path: "/api/v1/admin/security/events/:eventId/resolve", summary: "Resolve a security event.", tags: ["security"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "GET", path: "/api/v1/admin/security/risk-signals", summary: "List risk signals.", tags: ["security"], auth: "admin", permissions: ["security.events.read"] },
    { method: "POST", path: "/api/v1/admin/security/risk-signals/:riskSignalId/review", summary: "Mark a risk signal reviewed.", tags: ["security"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "GET", path: "/api/v1/admin/security/login-events", summary: "List login events.", tags: ["security"], auth: "admin", permissions: ["security.events.read"] },
    { method: "GET", path: "/api/v1/admin/security-events", summary: "List security events through the plain admin contract.", tags: ["security"], auth: "admin", permissions: ["security.events.read"] },
    { method: "GET", path: "/api/v1/admin/security-events/:eventId", summary: "Fetch security event detail through the plain admin contract.", tags: ["security"], auth: "admin", permissions: ["security.events.read"] },
    { method: "POST", path: "/api/v1/admin/security-events/:eventId/status", summary: "Update security event status through the plain admin contract.", tags: ["security"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "POST", path: "/api/v1/admin/security-events/:eventId/notify", summary: "Open a follow-up alert for a security event.", tags: ["security"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "POST", path: "/api/v1/admin/security-events/:eventId/request-ip-block", summary: "Record an IP block request on event metadata.", tags: ["security"], auth: "admin", permissions: ["security.incidents.manage"] },
    { method: "GET", path: "/api/v1/admin/risk-signals", summary: "List risk signals through the plain admin contract.", tags: ["security"], auth: "admin", permissions: ["security.events.read"] },
    { method: "POST", path: "/api/v1/admin/risk-signals/:riskSignalId/review", summary: "Review or escalate a risk signal (plain contract).", tags: ["security"], auth: "admin", permissions: ["security.incidents.manage"] }
  ]
};
