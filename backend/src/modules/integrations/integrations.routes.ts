import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  getIntegrationExceptionsAdmin,
  getIntegrationHealthAdmin,
  getIntegrationProvidersAdmin
} from "./integrations.controller";

const router = Router();

router.get(
  "/admin/integrations/health",
  requireAdminActor,
  requirePermissions(["integrations.webhooks.read", "system.jobs.read"], "any"),
  getIntegrationHealthAdmin
);
router.get(
  "/admin/integrations/providers",
  requireAdminActor,
  requirePermissions(["integrations.webhooks.read", "notifications.read"], "any"),
  getIntegrationProvidersAdmin
);
router.get(
  "/admin/integrations/exceptions",
  requireAdminActor,
  requirePermissions(["integrations.webhooks.read", "notifications.read", "payments.read"], "any"),
  getIntegrationExceptionsAdmin
);

export const integrationsRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/admin/integrations/health", summary: "Fetch provider and delivery integration health.", tags: ["integrations"], auth: "admin", permissions: ["integrations.webhooks.read", "system.jobs.read"] },
    { method: "GET", path: "/api/v1/admin/integrations/providers", summary: "Fetch recent provider webhook and notification activity.", tags: ["integrations"], auth: "admin", permissions: ["integrations.webhooks.read", "notifications.read"] },
    { method: "GET", path: "/api/v1/admin/integrations/exceptions", summary: "Fetch failed provider, delivery, and finance exceptions.", tags: ["integrations"], auth: "admin", permissions: ["integrations.webhooks.read", "notifications.read", "payments.read"] }
  ]
};
