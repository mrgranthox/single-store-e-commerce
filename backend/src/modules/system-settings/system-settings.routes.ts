import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminStepUp } from "../auth/admin-step-up.middleware";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import { listSettingsAdmin, updateSettingsAdmin } from "./system-settings.controller";
import { updateSettingsBodySchema } from "./system-settings.schemas";
import {
  listSystemSettingsByPrefix,
  updateSystemSettingsByPrefix
} from "./system-settings.service";

const router = Router();

const listCheckoutSettingsAdmin = asyncHandler(async (_request, response) => {
  const data = await listSystemSettingsByPrefix("checkout.");
  return sendSuccess(response, { data });
});

const updateCheckoutSettingsAdmin = asyncHandler(async (request, response) => {
  const data = await updateSystemSettingsByPrefix({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    prefix: "checkout.",
    settings: request.body.settings
  });
  return sendSuccess(response, { data });
});

router.get(
  "/admin/system/settings",
  requireAdminActor,
  requirePermissions(["settings.read"]),
  listSettingsAdmin
);
router.patch(
  "/admin/system/settings",
  requireAdminActor,
  requirePermissions(["settings.write"]),
  requireAdminStepUp(),
  validateRequest({ body: updateSettingsBodySchema }),
  updateSettingsAdmin
);
router.get(
  "/admin/settings",
  requireAdminActor,
  requirePermissions(["settings.read"]),
  listSettingsAdmin
);
router.patch(
  "/admin/settings",
  requireAdminActor,
  requirePermissions(["settings.write"]),
  requireAdminStepUp(),
  validateRequest({ body: updateSettingsBodySchema }),
  updateSettingsAdmin
);
router.get(
  "/admin/settings/checkout",
  requireAdminActor,
  requirePermissions(["settings.read"]),
  listCheckoutSettingsAdmin
);
router.patch(
  "/admin/settings/checkout",
  requireAdminActor,
  requirePermissions(["settings.write"]),
  requireAdminStepUp(),
  validateRequest({ body: updateSettingsBodySchema }),
  updateCheckoutSettingsAdmin
);

export const systemSettingsRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/admin/system/settings", summary: "List runtime system settings.", tags: ["settings"], auth: "admin", permissions: ["settings.read"] },
    { method: "PATCH", path: "/api/v1/admin/system/settings", summary: "Update runtime system settings.", tags: ["settings"], auth: "admin", permissions: ["settings.write"] },
    { method: "GET", path: "/api/v1/admin/settings", summary: "List runtime settings through the plain admin contract.", tags: ["settings"], auth: "admin", permissions: ["settings.read"] },
    { method: "PATCH", path: "/api/v1/admin/settings", summary: "Update runtime settings through the plain admin contract.", tags: ["settings"], auth: "admin", permissions: ["settings.write"] },
    { method: "GET", path: "/api/v1/admin/settings/checkout", summary: "List checkout-scoped runtime settings.", tags: ["settings"], auth: "admin", permissions: ["settings.read"] },
    { method: "PATCH", path: "/api/v1/admin/settings/checkout", summary: "Update checkout-scoped runtime settings.", tags: ["settings"], auth: "admin", permissions: ["settings.write"] }
  ]
};
