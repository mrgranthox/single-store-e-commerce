import { z } from "zod";

import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import { readValidatedBody } from "../../common/validation/validate-request";
import {
  createOrderBodySchema,
  initializePaymentBodySchema,
  validateCheckoutBodySchema
} from "./checkout.schemas";
import {
  createOrderFromCheckout,
  getCheckoutEligibility,
  initializeCheckoutPayment,
  validateCheckout
} from "./checkout.service";

const buildContext = (request: {
  context: {
    actor: Parameters<typeof getCheckoutEligibility>[0]["actor"];
    sessionId: string | null;
  };
}) => ({
  actor: request.context.actor,
  sessionId: request.context.sessionId
});

export const getCheckoutEligibilityController = asyncHandler(async (request, response) => {
  const data = await getCheckoutEligibility(buildContext(request));
  return sendSuccess(response, { data });
});

export const validateCheckoutController = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof validateCheckoutBodySchema>>(request);
  const data = await validateCheckout(buildContext(request), body);
  return sendSuccess(response, { data });
});

export const createOrderController = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createOrderBodySchema>>(request);
  const data = await createOrderFromCheckout(buildContext(request), body);
  return sendSuccess(response, { statusCode: 201, data: { entity: data } });
});

export const initializePaymentController = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof initializePaymentBodySchema>>(request);
  const data = await initializeCheckoutPayment(buildContext(request), body);
  return sendSuccess(response, { data: { entity: data } });
});
