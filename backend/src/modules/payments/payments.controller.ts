import type { RequestHandler } from "express";
import { z } from "zod";

import { invalidInputError } from "../../common/errors/app-error";
import { sendError, sendSuccess } from "../../common/http/response";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import { asyncHandler } from "../../common/middleware/async-handler";
import { logger } from "../../config/logger";
import { captureSentryException } from "../../config/sentry";
import type { CartActorContext } from "../cart/cart.shared";
import {
  adminFailedPaymentsQuerySchema,
  adminPaymentsQuerySchema,
  initializePaymentBodySchema,
  paymentIdParamsSchema
} from "./payments.schemas";
import {
  getAdminPaymentDetail,
  getAdminPaymentTransactions,
  initializePublicPayment,
  listAdminFailedPaymentInvestigations,
  listAdminPayments,
  receivePaymentWebhook
} from "./payments.service";

const buildCheckoutContext = (request: {
  context: Pick<CartActorContext, "actor" | "sessionId">;
}): CartActorContext => ({
  actor: request.context.actor,
  sessionId: request.context.sessionId
});

export const initializePaymentPublic = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof initializePaymentBodySchema>>(request);
  const data = await initializePublicPayment(buildCheckoutContext(request), body);

  return sendSuccess(response, { data });
});

export const handlePaymentWebhook: RequestHandler = asyncHandler(async (request, response) => {
  const requestId = request.context.requestId;
  const input = {
    requestId,
    rawBody: request.rawBody,
    headers: request.headers,
    ipAddress: request.context.ipAddress,
    payload: request.body
  };

  try {
    const result = await receivePaymentWebhook(input);

    if (!result.accepted) {
      logger.warn(
        {
          requestId,
          webhookEventId: result.webhookEventId,
          reason: result.reason
        },
        "Payment webhook was rejected before queueing."
      );

      return sendError(
        response,
        invalidInputError(result.reason ?? "The payment webhook was rejected before queueing.", {
          webhookEventId: result.webhookEventId
        }),
        requestId
      );
    }
  } catch (error) {
    logger.error({ requestId, error }, "Payment webhook processing failed before acknowledgment.");
    captureSentryException(error, { requestId });
    throw error;
  }

  return sendSuccess(response, {
    statusCode: 200,
    data: { received: true }
  });
});

export const listPaymentsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminPaymentsQuerySchema>>(request);
  const data = await listAdminPayments(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getPaymentAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof paymentIdParamsSchema>>(request);
  const data = await getAdminPaymentDetail(params.paymentId);

  return sendSuccess(response, { data });
});

export const listPaymentTransactionsAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof paymentIdParamsSchema>>(request);
  const data = await getAdminPaymentTransactions(params.paymentId);

  return sendSuccess(response, { data });
});

export const listFailedPaymentsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminFailedPaymentsQuerySchema>>(request);
  const data = await listAdminFailedPaymentInvestigations(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});
