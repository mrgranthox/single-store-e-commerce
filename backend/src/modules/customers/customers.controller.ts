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
  adminCustomersQuerySchema,
  customerIdParamsSchema,
  customerInternalActionBodySchema,
  customerNoteBodySchema,
  customerStatusBodySchema
} from "./customers.schemas";
import {
  createAdminCustomerNote,
  getAdminCustomerActivity,
  getAdminCustomerDetail,
  getAdminCustomerRisk,
  listAdminCustomerOrders,
  listAdminCustomerReviews,
  listAdminCustomers,
  listAdminCustomerSupport,
  performAdminCustomerInternalAction,
  restoreAdminCustomer,
  suspendAdminCustomer
} from "./customers.service";

export const listCustomersAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminCustomersQuerySchema>>(request);
  const data = await listAdminCustomers(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: {
      ...data.pagination,
      matchingSummary: data.matchingSummary
    }
  });
});

export const getCustomerAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof customerIdParamsSchema>>(request);
  const data = await getAdminCustomerDetail(params.customerId);

  return sendSuccess(response, { data });
});

export const getCustomerActivityAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof customerIdParamsSchema>>(request);
  const data = await getAdminCustomerActivity(params.customerId);

  return sendSuccess(response, { data });
});

export const listCustomerOrdersAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof customerIdParamsSchema>>(request);
  const query = readValidatedQuery<z.infer<typeof adminCustomersQuerySchema>>(request);
  const data = await listAdminCustomerOrders(params.customerId, query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const listCustomerSupportAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof customerIdParamsSchema>>(request);
  const query = readValidatedQuery<z.infer<typeof adminCustomersQuerySchema>>(request);
  const data = await listAdminCustomerSupport(params.customerId, query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const listCustomerReviewsAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof customerIdParamsSchema>>(request);
  const query = readValidatedQuery<z.infer<typeof adminCustomersQuerySchema>>(request);
  const data = await listAdminCustomerReviews(params.customerId, query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getCustomerRiskAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof customerIdParamsSchema>>(request);
  const data = await getAdminCustomerRisk(params.customerId);

  return sendSuccess(response, { data });
});

export const suspendCustomerAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof customerIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof customerStatusBodySchema>>(request);
  const data = await suspendAdminCustomer({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    customerId: params.customerId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const restoreCustomerAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof customerIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof customerStatusBodySchema>>(request);
  const data = await restoreAdminCustomer({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    customerId: params.customerId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const createCustomerNoteAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof customerIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof customerNoteBodySchema>>(request);
  const data = await createAdminCustomerNote({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    customerId: params.customerId,
    note: body.note
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const postCustomerInternalActionAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof customerIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof customerInternalActionBodySchema>>(request);
  const actorAdminUserId = requireAdminUserId(request.context.actor.adminUserId);

  const data = await performAdminCustomerInternalAction(
    body.kind === "NOTE"
      ? {
          actorAdminUserId,
          customerId: params.customerId,
          kind: "NOTE",
          note: body.note
        }
      : {
          actorAdminUserId,
          customerId: params.customerId,
          kind: "ESCALATE",
          category: body.category,
          observation: body.observation
        }
  );

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});
