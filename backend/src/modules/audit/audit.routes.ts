import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  getEntityTimelineAdmin,
  listAdminActionsAdmin,
  listAuditLogsAdmin,
  listTimelineAdmin
} from "./audit.controller";
import {
  adminActionsQuerySchema,
  auditLogsQuerySchema,
  entityTimelineParamsSchema,
  timelineQuerySchema
} from "./audit.schemas";

const router = Router();

router.get(
  "/admin/audit/logs",
  requireAdminActor,
  requirePermissions(["security.audit.read"]),
  validateRequest({ query: auditLogsQuerySchema }),
  listAuditLogsAdmin
);
router.get(
  "/admin/audit-logs",
  requireAdminActor,
  requirePermissions(["security.audit.read"]),
  validateRequest({ query: auditLogsQuerySchema }),
  listAuditLogsAdmin
);
router.get(
  "/admin/audit/admin-actions",
  requireAdminActor,
  requirePermissions(["security.audit.read"]),
  validateRequest({ query: adminActionsQuerySchema }),
  listAdminActionsAdmin
);
router.get(
  "/admin/admin-action-logs",
  requireAdminActor,
  requirePermissions(["security.audit.read"]),
  validateRequest({ query: adminActionsQuerySchema }),
  listAdminActionsAdmin
);
router.get(
  "/admin/audit/timeline",
  requireAdminActor,
  requirePermissions(["security.audit.read"]),
  validateRequest({ query: timelineQuerySchema }),
  listTimelineAdmin
);
router.get(
  "/admin/user-activity",
  requireAdminActor,
  requirePermissions(["security.audit.read"]),
  validateRequest({ query: timelineQuerySchema }),
  listTimelineAdmin
);
router.get(
  "/admin/audit/entities/:entityType/:entityId/timeline",
  requireAdminActor,
  requirePermissions(["security.audit.read"]),
  validateRequest({ params: entityTimelineParamsSchema, query: timelineQuerySchema }),
  getEntityTimelineAdmin
);

export const auditRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/admin/audit/logs", summary: "List audit log records.", tags: ["audit"], auth: "admin", permissions: ["security.audit.read"] },
    { method: "GET", path: "/api/v1/admin/audit/admin-actions", summary: "List admin action log records.", tags: ["audit"], auth: "admin", permissions: ["security.audit.read"] },
    { method: "GET", path: "/api/v1/admin/audit/timeline", summary: "List timeline events across entities.", tags: ["audit"], auth: "admin", permissions: ["security.audit.read"] },
    { method: "GET", path: "/api/v1/admin/audit/entities/:entityType/:entityId/timeline", summary: "Fetch an entity timeline.", tags: ["audit"], auth: "admin", permissions: ["security.audit.read"] },
    { method: "GET", path: "/api/v1/admin/audit-logs", summary: "List audit log records through the plain admin contract.", tags: ["audit"], auth: "admin", permissions: ["security.audit.read"] },
    { method: "GET", path: "/api/v1/admin/admin-action-logs", summary: "List admin action logs through the plain admin contract.", tags: ["audit"], auth: "admin", permissions: ["security.audit.read"] },
    { method: "GET", path: "/api/v1/admin/user-activity", summary: "List user-facing timeline activity through the plain admin contract.", tags: ["audit"], auth: "admin", permissions: ["security.audit.read"] }
  ]
};
