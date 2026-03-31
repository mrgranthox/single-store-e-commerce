import type { RequestHandler } from "express";

import { forbiddenError } from "../../common/errors/app-error";
import { env } from "../../config/env";
import { asyncHandler } from "../../common/middleware/async-handler";
import { requireAdminUserId } from "../../common/http/controller-actor";
import { consumeAdminStepUpToken } from "./admin-auth.service";

const STEP_UP_HEADER = "x-admin-step-up-token";

export const requireAdminStepUp = (): RequestHandler =>
  asyncHandler(async (request, _response, next) => {
    if (!env.ADMIN_REQUIRE_STEP_UP_FOR_SENSITIVE_ACTIONS) {
      return next();
    }

    const token = request.header(STEP_UP_HEADER)?.trim();
    if (!token) {
      return next(
        forbiddenError(
          `Sensitive admin actions require a fresh step-up token in the ${STEP_UP_HEADER} header.`
        )
      );
    }

    await consumeAdminStepUpToken({
      token,
      adminUserId: requireAdminUserId(request.context.actor.adminUserId)
    });

    return next();
  });
