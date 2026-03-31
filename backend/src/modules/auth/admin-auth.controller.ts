import { z } from "zod";

import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams
} from "../../common/validation/validate-request";
import {
  createAdminStepUpToken,
  getCurrentAdminShell,
  forgotAdminPassword,
  loginAdmin,
  listAdminSessionsForSelf,
  refreshAdminSession,
  resetAdminPassword,
  revokeAdminSessionForSelf,
  revokeOtherAdminSessionsForSelf
} from "./admin-auth.service";
import { logoutActorSession } from "./customer-auth.service";
import {
  adminForgotPasswordBodySchema,
  adminLoginBodySchema,
  adminRefreshTokenBodySchema,
  adminResetPasswordBodySchema,
  adminStepUpBodySchema,
  revokeSessionBodySchema,
  sessionIdParamsSchema
} from "./admin-auth.schemas";

type RevokeSessionBody = z.infer<typeof revokeSessionBodySchema>;

export const postAdminLogin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof adminLoginBodySchema>>(request);
  const data = await loginAdmin({
    ...body,
    ipAddress: request.context.ipAddress,
    userAgent: request.context.userAgent
  });

  return sendSuccess(response, { data });
});

export const postAdminRefresh = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof adminRefreshTokenBodySchema>>(request);
  const data = await refreshAdminSession({
    ...body,
    ipAddress: request.context.ipAddress,
    userAgent: request.context.userAgent
  });

  return sendSuccess(response, { data });
});

export const postAdminStepUp = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof adminStepUpBodySchema>>(request);
  const data = await createAdminStepUpToken({
    adminUserId: requireAdminUserId(request.context.actor.adminUserId),
    email: body.email,
    password: body.password,
    ipAddress: request.context.ipAddress,
    userAgent: request.context.userAgent
  });

  return sendSuccess(response, { data });
});

export const postAdminForgotPassword = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof adminForgotPasswordBodySchema>>(request);
  const data = await forgotAdminPassword(body);

  return sendSuccess(response, { data });
});

export const postAdminResetPassword = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof adminResetPasswordBodySchema>>(request);
  const data = await resetAdminPassword(body);

  return sendSuccess(response, { data });
});

export const postAdminLogout = asyncHandler(async (request, response) => {
  const data = await logoutActorSession({
    actor: request.context.actor,
    sessionId: request.context.sessionId
  });

  return sendSuccess(response, { data });
});

export const getAdminMe = asyncHandler(async (request, response) => {
  const data = await getCurrentAdminShell({
    adminUserId: requireAdminUserId(request.context.actor.adminUserId),
    sessionId: request.context.sessionId
  });

  return sendSuccess(response, { data });
});

export const listAdminSessions = asyncHandler(async (request, response) => {
  const data = await listAdminSessionsForSelf(requireAdminUserId(request.context.actor.adminUserId));

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: {
      total: data.total,
      active: data.active
    }
  });
});

export const revokeAdminSession = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof sessionIdParamsSchema>>(request);
  const body = readValidatedBody<RevokeSessionBody>(request);
  const data = await revokeAdminSessionForSelf({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    targetSessionId: params.sessionId,
    reason: body.reason,
    note: body.note
  });

  return sendSuccess(response, { data });
});

export const revokeAllOtherAdminSessions = asyncHandler(async (request, response) => {
  const body = readValidatedBody<RevokeSessionBody>(request);
  const data = await revokeOtherAdminSessionsForSelf({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    currentSessionId: request.context.sessionId,
    reason: body.reason,
    note: body.note
  });

  return sendSuccess(response, { data });
});
