import { z } from "zod";

import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import { readValidatedBody } from "../../common/validation/validate-request";
import { updateSettingsBodySchema } from "./system-settings.schemas";
import { listSystemSettings, updateSystemSettings } from "./system-settings.service";

export const listSettingsAdmin = asyncHandler(async (_request, response) => {
  const data = await listSystemSettings();
  return sendSuccess(response, { data });
});

export const updateSettingsAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof updateSettingsBodySchema>>(request);
  const data = await updateSystemSettings({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    settings: body.settings
  });
  return sendSuccess(response, { data });
});
