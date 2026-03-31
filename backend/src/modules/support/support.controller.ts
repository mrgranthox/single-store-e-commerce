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
  adminTicketsQuerySchema,
  assignTicketBodySchema,
  bulkAssignTicketsBodySchema,
  bulkStatusTicketsBodySchema,
  createInternalNoteBodySchema,
  createTicketAttachmentBodySchema,
  ticketAttachmentUploadIntentBodySchema,
  createTicketBodySchema,
  createTicketMessageBodySchema,
  recordSupportTicketCsatBodySchema,
  supportReportsQuerySchema,
  ticketIdParamsSchema,
  updateTicketStatusBodySchema
} from "./support.schemas";
import {
  assignAdminTicket,
  bulkAssignSupportTickets,
  bulkUpdateSupportTicketStatus,
  createAdminInternalNote,
  createAdminTicketMessage,
  createCustomerTicket,
  createCustomerTicketAttachment,
  createCustomerTicketAttachmentUploadIntent,
  createCustomerTicketMessage,
  getAdminTicketDetail,
  getCustomerTicketDetail,
  getSupportComplaintsQueue,
  getSupportPrePurchaseQueue,
  getSupportQueueSla,
  getSupportReports,
  listAdminTickets,
  listCustomerTickets,
  recordAdminTicketCsat,
  updateAdminTicketStatus
} from "./support.service";

export const listTicketsCustomer = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminTicketsQuerySchema>>(request);
  const data = await listCustomerTickets(requireCustomerUserId(request.context.actor.userId), query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const createTicketCustomer = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createTicketBodySchema>>(request);
  const data = await createCustomerTicket(requireCustomerUserId(request.context.actor.userId), body);

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const getTicketCustomer = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof ticketIdParamsSchema>>(request);
  const data = await getCustomerTicketDetail(requireCustomerUserId(request.context.actor.userId), params.ticketId);

  return sendSuccess(response, { data });
});

export const createTicketMessageCustomer = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof ticketIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof createTicketMessageBodySchema>>(request);
  const data = await createCustomerTicketMessage(requireCustomerUserId(request.context.actor.userId), {
    ticketId: params.ticketId,
    body: body.body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const createTicketAttachmentCustomer = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof ticketIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof createTicketAttachmentBodySchema>>(request);
  const data = await createCustomerTicketAttachment(requireCustomerUserId(request.context.actor.userId), {
    ticketId: params.ticketId,
    ...body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const createTicketAttachmentUploadIntentCustomer = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof ticketIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof ticketAttachmentUploadIntentBodySchema>>(request);
  const data = await createCustomerTicketAttachmentUploadIntent(requireCustomerUserId(request.context.actor.userId), {
    ticketId: params.ticketId,
    ...body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const listTicketsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminTicketsQuerySchema>>(request);
  const viewerAdminUserId =
    query.assignment === "me" ? requireAdminUserId(request.context.actor.adminUserId) : undefined;
  const data = await listAdminTickets({
    ...query,
    viewerAdminUserId
  });

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getTicketAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof ticketIdParamsSchema>>(request);
  const data = await getAdminTicketDetail(params.ticketId);

  return sendSuccess(response, { data });
});

export const assignTicketAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof ticketIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof assignTicketBodySchema>>(request);
  const data = await assignAdminTicket({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ticketId: params.ticketId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const updateTicketStatusAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof ticketIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateTicketStatusBodySchema>>(request);
  const data = await updateAdminTicketStatus({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ticketId: params.ticketId,
    ...body
  });

  return sendSuccess(response, { data });
});

export const recordTicketCsatAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof ticketIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof recordSupportTicketCsatBodySchema>>(request);
  const data = await recordAdminTicketCsat({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ticketId: params.ticketId,
    csatScore: body.csatScore,
    note: body.note
  });

  return sendSuccess(response, { data });
});

export const bulkAssignTicketsAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof bulkAssignTicketsBodySchema>>(request);
  const data = await bulkAssignSupportTickets({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ticketIds: body.ticketIds,
    assignedToAdminUserId: body.assignedToAdminUserId
  });

  return sendSuccess(response, { data });
});

export const bulkStatusTicketsAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof bulkStatusTicketsBodySchema>>(request);
  const data = await bulkUpdateSupportTicketStatus({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ticketIds: body.ticketIds,
    status: body.status,
    note: body.note
  });

  return sendSuccess(response, { data });
});

export const createTicketMessageAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof ticketIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof createTicketMessageBodySchema>>(request);
  const data = await createAdminTicketMessage({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ticketId: params.ticketId,
    body: body.body
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const createInternalNoteAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof ticketIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof createInternalNoteBodySchema>>(request);
  const data = await createAdminInternalNote({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ticketId: params.ticketId,
    note: body.note
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const getSupportQueueSlaAdmin = asyncHandler(async (_request, response) => {
  const data = await getSupportQueueSla();
  return sendSuccess(response, { data });
});

export const getSupportPrePurchaseQueueAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminTicketsQuerySchema>>(request);
  const viewerAdminUserId =
    query.assignment === "me" ? requireAdminUserId(request.context.actor.adminUserId) : undefined;
  const data = await getSupportPrePurchaseQueue({
    ...query,
    viewerAdminUserId
  });

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getSupportComplaintsQueueAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminTicketsQuerySchema>>(request);
  const viewerAdminUserId =
    query.assignment === "me" ? requireAdminUserId(request.context.actor.adminUserId) : undefined;
  const data = await getSupportComplaintsQueue({
    ...query,
    viewerAdminUserId
  });

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getSupportReportsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof supportReportsQuerySchema>>(request);
  const data = await getSupportReports({ period: query.period ?? "weekly" });
  return sendSuccess(response, { data });
});

export const getSupportIssueOptionsCustomer = asyncHandler(async (_request, response) => {
  return sendSuccess(response, {
    data: {
      items: [
        {
          code: "delivery_issue",
          label: "Delivery issue",
          requiresOrder: true
        },
        {
          code: "order_issue",
          label: "Order issue",
          requiresOrder: true
        },
        {
          code: "payment_issue",
          label: "Payment issue",
          requiresOrder: true
        },
        {
          code: "return_refund",
          label: "Return or refund",
          requiresOrder: true
        },
        {
          code: "product_question",
          label: "Product question",
          requiresOrder: false
        },
        {
          code: "account_issue",
          label: "Account issue",
          requiresOrder: false
        },
        {
          code: "other",
          label: "Other",
          requiresOrder: false
        }
      ]
    }
  });
});
