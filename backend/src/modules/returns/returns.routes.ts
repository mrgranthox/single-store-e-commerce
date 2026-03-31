import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireCustomerActor } from "../auth/auth.middleware";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  approveRefundAdmin,
  approveReturnAdmin,
  completeRefundAdmin,
  completeReturnAdmin,
  createReturnRequestCustomer,
  getRefundAdmin,
  getReturnAdmin,
  getReturnCustomer,
  listFinanceExceptionsAdmin,
  listRefundsAdmin,
  listRefundsCustomer,
  listReturnsAdmin,
  listReturnsCustomer,
  markReturnReceivedAdmin,
  rejectRefundAdmin,
  rejectReturnAdmin,
  resolveFinanceExceptionAdmin
} from "./returns.controller";
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

const router = Router();

router.get("/returns", requireCustomerActor, validateRequest({ query: adminReturnsQuerySchema }), listReturnsCustomer);
router.get("/returns/:returnId", requireCustomerActor, validateRequest({ params: returnIdParamsSchema }), getReturnCustomer);
router.post(
  "/orders/:orderId/return-request",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema, body: createReturnBodySchema }),
  createReturnRequestCustomer
);
router.get("/refunds", requireCustomerActor, validateRequest({ query: adminRefundsQuerySchema }), listRefundsCustomer);

router.get(
  "/admin/returns",
  requireAdminActor,
  requirePermissions(["orders.read"]),
  validateRequest({ query: adminReturnsQuerySchema }),
  listReturnsAdmin
);
router.get(
  "/admin/returns/:returnId",
  requireAdminActor,
  requirePermissions(["orders.read"]),
  validateRequest({ params: returnIdParamsSchema }),
  getReturnAdmin
);
router.post(
  "/admin/returns/:returnId/approve",
  requireAdminActor,
  requirePermissions(["orders.update"]),
  validateRequest({ params: returnIdParamsSchema, body: adminApproveReturnBodySchema }),
  approveReturnAdmin
);
router.post(
  "/admin/returns/:returnId/reject",
  requireAdminActor,
  requirePermissions(["orders.update"]),
  validateRequest({ params: returnIdParamsSchema, body: adminRejectReturnBodySchema }),
  rejectReturnAdmin
);
router.post(
  "/admin/returns/:returnId/mark-received",
  requireAdminActor,
  requirePermissions(["orders.update"]),
  validateRequest({ params: returnIdParamsSchema, body: adminMarkReceivedBodySchema }),
  markReturnReceivedAdmin
);
router.post(
  "/admin/returns/:returnId/complete",
  requireAdminActor,
  requirePermissions(["orders.update"]),
  validateRequest({ params: returnIdParamsSchema, body: adminCompleteReturnBodySchema }),
  completeReturnAdmin
);

router.get(
  "/admin/refunds",
  requireAdminActor,
  requirePermissions(["payments.read"]),
  validateRequest({ query: adminRefundsQuerySchema }),
  listRefundsAdmin
);
router.get(
  "/admin/refunds/:refundId",
  requireAdminActor,
  requirePermissions(["payments.read"]),
  validateRequest({ params: refundIdParamsSchema }),
  getRefundAdmin
);
router.post(
  "/admin/refunds/:refundId/approve",
  requireAdminActor,
  requirePermissions(["refunds.approve"]),
  validateRequest({ params: refundIdParamsSchema, body: adminApproveRefundBodySchema }),
  approveRefundAdmin
);
router.post(
  "/admin/refunds/:refundId/reject",
  requireAdminActor,
  requirePermissions(["refunds.approve"]),
  validateRequest({ params: refundIdParamsSchema, body: adminRejectRefundBodySchema }),
  rejectRefundAdmin
);
router.post(
  "/admin/refunds/:refundId/mark-completed",
  requireAdminActor,
  requirePermissions(["refunds.approve"]),
  validateRequest({ params: refundIdParamsSchema, body: adminCompleteRefundBodySchema }),
  completeRefundAdmin
);

router.get(
  "/admin/finance/exceptions",
  requireAdminActor,
  requirePermissions(["payments.read"]),
  validateRequest({ query: adminRefundsQuerySchema }),
  listFinanceExceptionsAdmin
);
router.post(
  "/admin/finance/exceptions/:exceptionId/resolve",
  requireAdminActor,
  requirePermissions(["payments.read"]),
  validateRequest({ params: financeExceptionIdParamsSchema, body: resolveFinanceExceptionBodySchema }),
  resolveFinanceExceptionAdmin
);

export const returnsRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/returns", summary: "List the authenticated customer's return requests.", tags: ["returns"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/returns/:returnId", summary: "Fetch return detail for the authenticated customer.", tags: ["returns"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/orders/:orderId/return-request", summary: "Submit a return request for an eligible order.", tags: ["returns"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/refunds", summary: "List refunds visible to the authenticated customer.", tags: ["refunds"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/admin/returns", summary: "List admin-visible return requests.", tags: ["returns"], auth: "admin", permissions: ["orders.read"] },
    { method: "GET", path: "/api/v1/admin/returns/:returnId", summary: "Fetch admin return detail.", tags: ["returns"], auth: "admin", permissions: ["orders.read"] },
    { method: "POST", path: "/api/v1/admin/returns/:returnId/approve", summary: "Approve a return request.", tags: ["returns"], auth: "admin", permissions: ["orders.update"] },
    { method: "POST", path: "/api/v1/admin/returns/:returnId/reject", summary: "Reject a return request.", tags: ["returns"], auth: "admin", permissions: ["orders.update"] },
    { method: "POST", path: "/api/v1/admin/returns/:returnId/mark-received", summary: "Mark a return as physically received.", tags: ["returns"], auth: "admin", permissions: ["orders.update"] },
    { method: "POST", path: "/api/v1/admin/returns/:returnId/complete", summary: "Complete a processed return.", tags: ["returns"], auth: "admin", permissions: ["orders.update"] },
    { method: "GET", path: "/api/v1/admin/refunds", summary: "List admin-visible refunds.", tags: ["refunds"], auth: "admin", permissions: ["payments.read"] },
    { method: "GET", path: "/api/v1/admin/refunds/:refundId", summary: "Fetch admin refund detail.", tags: ["refunds"], auth: "admin", permissions: ["payments.read"] },
    { method: "POST", path: "/api/v1/admin/refunds/:refundId/approve", summary: "Approve a refund for provider processing.", tags: ["refunds"], auth: "admin", permissions: ["refunds.approve"] },
    { method: "POST", path: "/api/v1/admin/refunds/:refundId/reject", summary: "Reject a refund request.", tags: ["refunds"], auth: "admin", permissions: ["refunds.approve"] },
    { method: "POST", path: "/api/v1/admin/refunds/:refundId/mark-completed", summary: "Mark a refund as completed.", tags: ["refunds"], auth: "admin", permissions: ["refunds.approve"] },
    { method: "GET", path: "/api/v1/admin/finance/exceptions", summary: "List financial exceptions for finance investigation.", tags: ["finance"], auth: "admin", permissions: ["payments.read"] },
    { method: "POST", path: "/api/v1/admin/finance/exceptions/:exceptionId/resolve", summary: "Resolve a financial exception.", tags: ["finance"], auth: "admin", permissions: ["payments.read"] }
  ]
};
