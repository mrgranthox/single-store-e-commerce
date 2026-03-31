import { z } from "zod";

import {
  requireAdminUserId,
  requireCustomerUserId
} from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import {
  adminApproveRefundBodySchema,
  adminApproveReturnBodySchema,
  adminCompleteRefundBodySchema,
  adminCompleteReturnBodySchema,
  adminMarkReceivedBodySchema,
  adminRefundsQuerySchema,
  adminRejectRefundBodySchema,
  adminRejectReturnBodySchema,
  adminReturnsQuerySchema,
  createReturnBodySchema,
  financeExceptionIdParamsSchema,
  orderIdParamsSchema,
  refundIdParamsSchema,
  resolveFinanceExceptionBodySchema,
  returnIdParamsSchema
} from "./returns.schemas";
import {
  approveAdminRefund,
  approveAdminReturn,
  completeAdminRefund,
  completeAdminReturn,
  createCustomerReturnRequest,
  getCustomerOrderRefundEligibility,
  getCustomerOrderReturnEligibility,
  getAdminRefundDetail,
  getAdminReturnDetail,
  getCustomerReturnDetail,
  listAdminRefunds,
  listAdminReturns,
  listCustomerRefunds,
  listCustomerReturns,
  listFinancialExceptions,
  markAdminReturnReceived,
  rejectAdminRefund,
  rejectAdminReturn,
  resolveFinancialException
} from "./returns.service";

export const listReturnsCustomer = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminReturnsQuerySchema>>(request);
  const data = await listCustomerReturns(requireCustomerUserId(request.context.actor.userId), query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getReturnCustomer = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof returnIdParamsSchema>>(request);
  const data = await getCustomerReturnDetail(requireCustomerUserId(request.context.actor.userId), params.returnId);

  return sendSuccess(response, { data });
});

export const createReturnRequestCustomer = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof createReturnBodySchema>>(request);
  const data = await createCustomerReturnRequest(requireCustomerUserId(request.context.actor.userId), {
    orderId: params.orderId,
    customerReason: body.customerReason ?? body.description!,
    items: body.items.map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity
    }))
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const getReturnEligibilityCustomer = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const data = await getCustomerOrderReturnEligibility(requireCustomerUserId(request.context.actor.userId), params.orderId);

  return sendSuccess(response, { data });
});

export const getRefundEligibilityCustomer = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const data = await getCustomerOrderRefundEligibility(requireCustomerUserId(request.context.actor.userId), params.orderId);

  return sendSuccess(response, { data });
});

export const listRefundsCustomer = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminRefundsQuerySchema>>(request);
  const data = await listCustomerRefunds(requireCustomerUserId(request.context.actor.userId), query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const listReturnsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminReturnsQuerySchema>>(request);
  const data = await listAdminReturns(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getReturnAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof returnIdParamsSchema>>(request);
  const data = await getAdminReturnDetail(params.returnId);

  return sendSuccess(response, { data });
});

export const approveReturnAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof returnIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminApproveReturnBodySchema>>(request);
  const data = await approveAdminReturn({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    returnId: params.returnId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const rejectReturnAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof returnIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminRejectReturnBodySchema>>(request);
  const data = await rejectAdminReturn({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    returnId: params.returnId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const markReturnReceivedAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof returnIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminMarkReceivedBodySchema>>(request);
  const data = await markAdminReturnReceived({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    returnId: params.returnId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const completeReturnAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof returnIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminCompleteReturnBodySchema>>(request);
  const data = await completeAdminReturn({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    returnId: params.returnId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const listRefundsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminRefundsQuerySchema>>(request);
  const data = await listAdminRefunds(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getRefundAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof refundIdParamsSchema>>(request);
  const data = await getAdminRefundDetail(params.refundId);

  return sendSuccess(response, { data });
});

export const approveRefundAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof refundIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminApproveRefundBodySchema>>(request);
  const data = await approveAdminRefund({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    refundId: params.refundId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const rejectRefundAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof refundIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminRejectRefundBodySchema>>(request);
  const data = await rejectAdminRefund({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    refundId: params.refundId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const completeRefundAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof refundIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof adminCompleteRefundBodySchema>>(request);
  const data = await completeAdminRefund({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    refundId: params.refundId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const listFinanceExceptionsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminRefundsQuerySchema>>(request);
  const data = await listFinancialExceptions(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const resolveFinanceExceptionAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof financeExceptionIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof resolveFinanceExceptionBodySchema>>(request);
  const data = await resolveFinancialException({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    exceptionId: params.exceptionId,
    note: body.note
  });

  return sendSuccess(response, { data });
});
