import { z } from "zod";

import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import {
  adminInvitationIdParamsSchema,
  adminInvitationsQuerySchema,
  adminStatusMutationBodySchema,
  adminUserIdParamsSchema,
  adminUserSessionParamsSchema,
  adminUsersQuerySchema,
  createAdminInvitationBodySchema,
  createAdminUserBodySchema,
  revokeAdminInvitationBodySchema,
  updateAdminUserBodySchema,
  updateAdminUserRolesBodySchema
} from "./admin-users.schemas";
import {
  createAdminInvitation,
  createAdminUser,
  getAdminUserDetail,
  listAdminInvitations,
  listAdminUsers,
  listAdminUserSessions,
  reactivateAdminUser,
  resendAdminInvitation,
  revokeAdminInvitation,
  revokeAdminUserSession,
  suspendAdminUser,
  updateAdminUserProfile,
  updateAdminUserRoles
} from "./admin-users.service";

export const listAdminUsersController = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminUsersQuerySchema>>(request);
  const data = await listAdminUsers(query);
  return sendSuccess(response, { data: { items: data.items, availableRoles: data.availableRoles }, meta: data.pagination });
});

export const createAdminUserController = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createAdminUserBodySchema>>(request);
  const data = await createAdminUser({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });
  return sendSuccess(response, { statusCode: 201, data });
});

export const getAdminUserController = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof adminUserIdParamsSchema>>(request);
  const data = await getAdminUserDetail(params.adminUserId);
  return sendSuccess(response, { data });
});

export const updateAdminUserController = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof adminUserIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateAdminUserBodySchema>>(request);
  const data = await updateAdminUserProfile({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    adminUserId: params.adminUserId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const updateAdminUserRolesController = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof adminUserIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateAdminUserRolesBodySchema>>(request);
  const data = await updateAdminUserRoles({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    adminUserId: params.adminUserId,
    roleCodes: body.roleCodes
  });
  return sendSuccess(response, { data });
});

export const suspendAdminUserController = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof adminUserIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminStatusMutationBodySchema>>(request);
  const data = await suspendAdminUser({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    adminUserId: params.adminUserId,
    reason: body.reason || undefined,
    note: body.note || undefined
  });
  return sendSuccess(response, { data });
});

export const reactivateAdminUserController = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof adminUserIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminStatusMutationBodySchema>>(request);
  const data = await reactivateAdminUser({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    adminUserId: params.adminUserId,
    reason: body.reason || undefined,
    note: body.note || undefined
  });
  return sendSuccess(response, { data });
});

export const listAdminUserSessionsController = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof adminUserIdParamsSchema>>(request);
  const data = await listAdminUserSessions(params.adminUserId);
  return sendSuccess(response, { data: { items: data.items }, meta: { total: data.total, active: data.active } });
});

export const revokeAdminUserSessionController = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof adminUserSessionParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminStatusMutationBodySchema>>(request);
  const data = await revokeAdminUserSession({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    adminUserId: params.adminUserId,
    sessionId: params.sessionId,
    reason: body.reason || undefined,
    note: body.note || undefined
  });
  return sendSuccess(response, { data });
});

export const listAdminInvitationsController = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminInvitationsQuerySchema>>(request);
  const data = await listAdminInvitations(query);
  return sendSuccess(response, { data: { items: data.items, availableRoles: data.availableRoles }, meta: data.pagination });
});

export const createAdminInvitationController = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createAdminInvitationBodySchema>>(request);
  const data = await createAdminInvitation({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });
  return sendSuccess(response, { statusCode: 201, data });
});

export const resendAdminInvitationController = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof adminInvitationIdParamsSchema>>(request);
  const data = await resendAdminInvitation({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    invitationId: params.invitationId
  });
  return sendSuccess(response, { data });
});

export const revokeAdminInvitationController = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof adminInvitationIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof revokeAdminInvitationBodySchema>>(request);
  const data = await revokeAdminInvitation({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    invitationId: params.invitationId,
    note: body.note
  });
  return sendSuccess(response, { data });
});
