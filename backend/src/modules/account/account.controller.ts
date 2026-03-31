import { z } from "zod";

import { requireCustomerUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams
} from "../../common/validation/validate-request";
import {
  accountPrivacyAnonymizeBodySchema,
  accountPreferencesBodySchema,
  accountProfileBodySchema,
  accountSessionIdParamsSchema,
  addressBodySchema,
  addressIdParamsSchema,
  changePasswordBodySchema,
  defaultAddressBodySchema,
  updateAddressBodySchema
} from "./account.schemas";
import {
  anonymizeAccountPrivacyData,
  changeAccountPassword,
  createAccountAddress,
  exportAccountPrivacyData,
  deleteAccountAddress,
  getAccountDashboard,
  getAccountPreferences,
  getAccountProfile,
  getAccountSecurity,
  listAccountAddresses,
  listAccountSecuritySessions,
  revokeAccountSecuritySession,
  setDefaultAccountAddress,
  updateAccountAddress,
  updateAccountPreferences,
  updateAccountProfile
} from "./account.service";

export const getAccountOverview = asyncHandler(async (request, response) => {
  const data = await getAccountDashboard(requireCustomerUserId(request.context.actor.userId));

  return sendSuccess(response, { data });
});

export const getProfile = asyncHandler(async (request, response) => {
  const data = await getAccountProfile(requireCustomerUserId(request.context.actor.userId));
  return sendSuccess(response, { data });
});

export const patchProfile = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof accountProfileBodySchema>>(request);
  const data = await updateAccountProfile({
    userId: requireCustomerUserId(request.context.actor.userId),
    clerkUserId: request.context.actor.clerkUserId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const getPreferences = asyncHandler(async (request, response) => {
  const data = await getAccountPreferences(requireCustomerUserId(request.context.actor.userId));
  return sendSuccess(response, { data });
});

export const patchPreferences = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof accountPreferencesBodySchema>>(request);
  const data = await updateAccountPreferences({
    userId: requireCustomerUserId(request.context.actor.userId),
    data: body
  });

  return sendSuccess(response, { data });
});

export const getAddresses = asyncHandler(async (request, response) => {
  const data = await listAccountAddresses(requireCustomerUserId(request.context.actor.userId));

  return sendSuccess(response, {
    data: {
      items: data.items
    }
  });
});

export const postAddress = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof addressBodySchema>>(request);
  const data = await createAccountAddress({
    userId: requireCustomerUserId(request.context.actor.userId),
    data: body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const patchAddress = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof addressIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateAddressBodySchema>>(request);
  const data = await updateAccountAddress({
    userId: requireCustomerUserId(request.context.actor.userId),
    addressId: params.addressId,
    data: body
  });

  return sendSuccess(response, { data });
});

export const deleteAddress = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof addressIdParamsSchema>>(request);
  const data = await deleteAccountAddress({
    userId: requireCustomerUserId(request.context.actor.userId),
    addressId: params.addressId
  });

  return sendSuccess(response, { data });
});

export const postDefaultAddress = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof addressIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof defaultAddressBodySchema>>(request);
  const data = await setDefaultAccountAddress({
    userId: requireCustomerUserId(request.context.actor.userId),
    addressId: params.addressId,
    scope: body.scope
  });

  return sendSuccess(response, { data });
});

export const getSecurity = asyncHandler(async (request, response) => {
  const data = await getAccountSecurity(requireCustomerUserId(request.context.actor.userId), request.context.sessionId);
  return sendSuccess(response, { data });
});

export const getSecuritySessions = asyncHandler(async (request, response) => {
  const data = await listAccountSecuritySessions(requireCustomerUserId(request.context.actor.userId), request.context.sessionId);
  return sendSuccess(response, {
    data: {
      items: data.items
    }
  });
});

export const deleteSecuritySession = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof accountSessionIdParamsSchema>>(request);
  const data = await revokeAccountSecuritySession({
    userId: requireCustomerUserId(request.context.actor.userId),
    sessionId: params.sessionId
  });

  return sendSuccess(response, { data });
});

export const postChangePassword = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof changePasswordBodySchema>>(request);
  const data = await changeAccountPassword({
    userId: requireCustomerUserId(request.context.actor.userId),
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
    signOutOtherSessions: body.signOutOtherSessions,
    currentSessionId: request.context.sessionId
  });

  return sendSuccess(response, { data });
});

export const getPrivacyExport = asyncHandler(async (request, response) => {
  const data = await exportAccountPrivacyData(requireCustomerUserId(request.context.actor.userId));
  return sendSuccess(response, { data });
});

export const postPrivacyAnonymize = asyncHandler(async (request, response) => {
  readValidatedBody<z.infer<typeof accountPrivacyAnonymizeBodySchema>>(request);
  const data = await anonymizeAccountPrivacyData({
    userId: requireCustomerUserId(request.context.actor.userId),
    currentSessionId: request.context.sessionId
  });

  return sendSuccess(response, { data });
});
