import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { sendSuccess } from "../../common/http/response";
import { validateRequest } from "../../common/validation/validate-request";
import { requireCustomerActor } from "../auth/auth.middleware";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import { getPublicSupportCaptchaConfiguration } from "../security/captcha.service";
import {
  assignTicketAdmin,
  createInternalNoteAdmin,
  createTicketAttachmentCustomer,
  createTicketAttachmentUploadIntentCustomer,
  createTicketCustomer,
  createTicketMessageAdmin,
  createTicketMessageCustomer,
  bulkAssignTicketsAdmin,
  bulkStatusTicketsAdmin,
  getSupportComplaintsQueueAdmin,
  getSupportPrePurchaseQueueAdmin,
  getSupportQueueSlaAdmin,
  getSupportReportsAdmin,
  getTicketAdmin,
  getTicketCustomer,
  listTicketsAdmin,
  listTicketsCustomer,
  updateTicketStatusAdmin,
  recordTicketCsatAdmin
} from "./support.controller";
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

const router = Router();

router.get("/support/public-config", (_request, response) => {
  return sendSuccess(response, {
    data: {
      support: {
        contactEndpoint: "/api/support/contact",
        uploadIntentEndpoint: "/api/support/contact/upload-intents",
        productInquiryPattern: "/api/products/:slug/inquiry",
        productInquiryUploadPattern: "/api/products/:slug/inquiry/attachments/upload-intents",
        abuseChallenge: getPublicSupportCaptchaConfiguration()
      }
    }
  });
});

router.get("/support", requireCustomerActor, validateRequest({ query: adminTicketsQuerySchema }), listTicketsCustomer);
router.post("/support", requireCustomerActor, validateRequest({ body: createTicketBodySchema }), createTicketCustomer);
router.get("/support/:ticketId", requireCustomerActor, validateRequest({ params: ticketIdParamsSchema }), getTicketCustomer);
router.post(
  "/support/:ticketId/messages",
  requireCustomerActor,
  validateRequest({ params: ticketIdParamsSchema, body: createTicketMessageBodySchema }),
  createTicketMessageCustomer
);
router.post(
  "/support/:ticketId/attachments",
  requireCustomerActor,
  validateRequest({ params: ticketIdParamsSchema, body: createTicketAttachmentBodySchema }),
  createTicketAttachmentCustomer
);
router.post(
  "/support/:ticketId/attachments/upload-intents",
  requireCustomerActor,
  validateRequest({ params: ticketIdParamsSchema, body: ticketAttachmentUploadIntentBodySchema }),
  createTicketAttachmentUploadIntentCustomer
);

router.get(
  "/admin/support/tickets",
  requireAdminActor,
  requirePermissions(["support.read"]),
  validateRequest({ query: adminTicketsQuerySchema }),
  listTicketsAdmin
);
router.post(
  "/admin/support/tickets/bulk-assign",
  requireAdminActor,
  requirePermissions(["support.assign"]),
  validateRequest({ body: bulkAssignTicketsBodySchema }),
  bulkAssignTicketsAdmin
);
router.post(
  "/admin/support/tickets/bulk-status",
  requireAdminActor,
  requirePermissions(["support.assign"]),
  validateRequest({ body: bulkStatusTicketsBodySchema }),
  bulkStatusTicketsAdmin
);
router.get(
  "/admin/support/tickets/:ticketId",
  requireAdminActor,
  requirePermissions(["support.read"]),
  validateRequest({ params: ticketIdParamsSchema }),
  getTicketAdmin
);
router.post(
  "/admin/support/tickets/:ticketId/assign",
  requireAdminActor,
  requirePermissions(["support.assign"]),
  validateRequest({ params: ticketIdParamsSchema, body: assignTicketBodySchema }),
  assignTicketAdmin
);
router.post(
  "/admin/support/tickets/:ticketId/status",
  requireAdminActor,
  requirePermissions(["support.assign"]),
  validateRequest({ params: ticketIdParamsSchema, body: updateTicketStatusBodySchema }),
  updateTicketStatusAdmin
);
router.post(
  "/admin/support/tickets/:ticketId/csat",
  requireAdminActor,
  requirePermissions(["support.reply"]),
  validateRequest({ params: ticketIdParamsSchema, body: recordSupportTicketCsatBodySchema }),
  recordTicketCsatAdmin
);
router.post(
  "/admin/support/tickets/:ticketId/messages",
  requireAdminActor,
  requirePermissions(["support.reply"]),
  validateRequest({ params: ticketIdParamsSchema, body: createTicketMessageBodySchema }),
  createTicketMessageAdmin
);
router.post(
  "/admin/support/tickets/:ticketId/internal-notes",
  requireAdminActor,
  requirePermissions(["support.reply"]),
  validateRequest({ params: ticketIdParamsSchema, body: createInternalNoteBodySchema }),
  createInternalNoteAdmin
);
router.get(
  "/admin/support/queues/sla",
  requireAdminActor,
  requirePermissions(["support.read"]),
  getSupportQueueSlaAdmin
);
router.get(
  "/admin/support/queues/pre-purchase",
  requireAdminActor,
  requirePermissions(["support.read"]),
  validateRequest({ query: adminTicketsQuerySchema }),
  getSupportPrePurchaseQueueAdmin
);
router.get(
  "/admin/support/queues/complaints",
  requireAdminActor,
  requirePermissions(["support.read"]),
  validateRequest({ query: adminTicketsQuerySchema }),
  getSupportComplaintsQueueAdmin
);
router.get(
  "/admin/support/reports",
  requireAdminActor,
  requirePermissions(["support.read"]),
  validateRequest({ query: supportReportsQuerySchema }),
  getSupportReportsAdmin
);

export const supportRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/support/public-config", summary: "Return public support abuse-challenge and endpoint configuration.", tags: ["support"], auth: "public" },
    { method: "GET", path: "/api/v1/support", summary: "List the authenticated customer's support tickets.", tags: ["support"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/support", summary: "Create a support ticket for the authenticated customer.", tags: ["support"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/support/:ticketId", summary: "Fetch support ticket detail for the authenticated customer.", tags: ["support"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/support/:ticketId/messages", summary: "Append a customer message to a support ticket.", tags: ["support"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/support/:ticketId/attachments", summary: "Attach a file reference to a support ticket.", tags: ["support"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/support/:ticketId/attachments/upload-intents", summary: "Create a signed upload intent for a support attachment.", tags: ["support"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/admin/support/tickets", summary: "List admin-visible support tickets.", tags: ["support"], auth: "admin", permissions: ["support.read"] },
    { method: "POST", path: "/api/v1/admin/support/tickets/bulk-assign", summary: "Bulk assign support tickets.", tags: ["support"], auth: "admin", permissions: ["support.assign"] },
    { method: "POST", path: "/api/v1/admin/support/tickets/bulk-status", summary: "Bulk update support ticket status.", tags: ["support"], auth: "admin", permissions: ["support.assign"] },
    { method: "GET", path: "/api/v1/admin/support/tickets/:ticketId", summary: "Fetch admin support ticket detail.", tags: ["support"], auth: "admin", permissions: ["support.read"] },
    { method: "POST", path: "/api/v1/admin/support/tickets/:ticketId/assign", summary: "Assign or unassign a support ticket.", tags: ["support"], auth: "admin", permissions: ["support.assign"] },
    { method: "POST", path: "/api/v1/admin/support/tickets/:ticketId/status", summary: "Update support ticket status.", tags: ["support"], auth: "admin", permissions: ["support.assign"] },
    { method: "POST", path: "/api/v1/admin/support/tickets/:ticketId/csat", summary: "Record a 1–5 CSAT score for a closed ticket.", tags: ["support"], auth: "admin", permissions: ["support.reply"] },
    { method: "POST", path: "/api/v1/admin/support/tickets/:ticketId/messages", summary: "Append an admin reply to a support ticket.", tags: ["support"], auth: "admin", permissions: ["support.reply"] },
    { method: "POST", path: "/api/v1/admin/support/tickets/:ticketId/internal-notes", summary: "Append an internal note to a support ticket.", tags: ["support"], auth: "admin", permissions: ["support.reply"] },
    { method: "GET", path: "/api/v1/admin/support/queues/sla", summary: "Fetch SLA-sensitive support queue metrics.", tags: ["support"], auth: "admin", permissions: ["support.read"] },
    { method: "GET", path: "/api/v1/admin/support/queues/pre-purchase", summary: "Fetch the pre-purchase support queue.", tags: ["support"], auth: "admin", permissions: ["support.read"] },
    { method: "GET", path: "/api/v1/admin/support/queues/complaints", summary: "Fetch the complaints support queue.", tags: ["support"], auth: "admin", permissions: ["support.read"] },
    { method: "GET", path: "/api/v1/admin/support/reports", summary: "Fetch support reporting aggregates.", tags: ["support"], auth: "admin", permissions: ["support.read"] }
  ]
};
