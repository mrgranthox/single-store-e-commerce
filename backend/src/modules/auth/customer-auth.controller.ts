import { z } from "zod";

import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import { readValidatedBody } from "../../common/validation/validate-request";
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  refreshTokenBodySchema,
  registerBodySchema,
  resendVerificationBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema
} from "./customer-auth.schemas";
import {
  forgotCustomerPassword,
  getCurrentAuthSession,
  handleClerkWebhook,
  loginCustomer,
  logoutActorSession,
  refreshCustomerSession,
  registerCustomer,
  resendCustomerVerification,
  resetCustomerPassword,
  verifyCustomerEmail
} from "./customer-auth.service";

export const postRegister = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof registerBodySchema>>(request);
  const data = await registerCustomer(body);

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const postLogin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof loginBodySchema>>(request);
  const data = await loginCustomer({
    ...body,
    userAgent: request.context.userAgent
  });

  return sendSuccess(response, { data });
});

export const postRefresh = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof refreshTokenBodySchema>>(request);
  const data = await refreshCustomerSession(body);

  return sendSuccess(response, { data });
});

export const getAuthSession = asyncHandler(async (request, response) => {
  const data = await getCurrentAuthSession({
    actor: request.context.actor,
    sessionId: request.context.sessionId
  });

  return sendSuccess(response, { data });
});

export const postLogout = asyncHandler(async (request, response) => {
  const data = await logoutActorSession({
    actor: request.context.actor,
    sessionId: request.context.sessionId
  });

  return sendSuccess(response, { data });
});

export const postForgotPassword = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof forgotPasswordBodySchema>>(request);
  const data = await forgotCustomerPassword(body);

  return sendSuccess(response, { data });
});

export const postResetPassword = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof resetPasswordBodySchema>>(request);
  const data = await resetCustomerPassword(body);

  return sendSuccess(response, { data });
});

export const postVerifyEmail = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof verifyEmailBodySchema>>(request);
  const data = await verifyCustomerEmail(body);

  return sendSuccess(response, { data });
});

export const postResendVerification = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof resendVerificationBodySchema>>(request);
  const data = await resendCustomerVerification(body);

  return sendSuccess(response, { data });
});

export const postClerkWebhook = asyncHandler(async (request, response) => {
  const data = await handleClerkWebhook(request);

  return sendSuccess(response, {
    statusCode: 202,
    data
  });
});
