import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { rateLimit, rateLimitKeyFromActorOrIp } from "../../common/middleware/rate-limit.middleware";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  getPaymentAdmin,
  handlePaymentWebhook,
  initializePaymentPublic,
  listFailedPaymentsAdmin,
  listPaymentTransactionsAdmin,
  listPaymentsAdmin
} from "./payments.controller";
import {
  adminFailedPaymentsQuerySchema,
  adminPaymentsQuerySchema,
  initializePaymentBodySchema,
  paymentIdParamsSchema
} from "./payments.schemas";

const router = Router();

const paymentInitializeRateLimit = rateLimit({
  keyPrefix: "rl:payment:initialize",
  maxRequests: 10,
  windowSeconds: 60,
  failClosed: true,
  keyResolver: rateLimitKeyFromActorOrIp
});
const paystackWebhookRateLimit = rateLimit({
  keyPrefix: "rl:paystack:webhook",
  maxRequests: 200,
  windowSeconds: 60,
  failClosed: true
});

router.post(
  "/payments/initialize",
  paymentInitializeRateLimit,
  validateRequest({ body: initializePaymentBodySchema }),
  initializePaymentPublic
);
router.post("/payments/webhook", paystackWebhookRateLimit, handlePaymentWebhook);

router.get(
  "/admin/payments",
  requireAdminActor,
  requirePermissions(["payments.read"]),
  validateRequest({ query: adminPaymentsQuerySchema }),
  listPaymentsAdmin
);
router.get(
  "/admin/payments/failed-investigations",
  requireAdminActor,
  requirePermissions(["payments.read"]),
  validateRequest({ query: adminFailedPaymentsQuerySchema }),
  listFailedPaymentsAdmin
);
router.get(
  "/admin/payments/:paymentId",
  requireAdminActor,
  requirePermissions(["payments.read"]),
  validateRequest({ params: paymentIdParamsSchema }),
  getPaymentAdmin
);
router.get(
  "/admin/payments/:paymentId/transactions",
  requireAdminActor,
  requirePermissions(["payments.read"]),
  validateRequest({ params: paymentIdParamsSchema }),
  listPaymentTransactionsAdmin
);

export const paymentsRouteModule: RouteModule = {
  router,
  metadata: [
    {
      method: "POST",
      path: "/api/v1/payments/initialize",
      summary: "Initialize payment for an order pending payment.",
      tags: ["payments"],
      auth: "public"
    },
    {
      method: "POST",
      path: "/api/v1/payments/webhook",
      summary: "Receive and queue verified payment provider webhooks.",
      tags: ["payments"],
      auth: "public"
    },
    {
      method: "GET",
      path: "/api/v1/admin/payments",
      summary: "List admin-visible payments and payment state.",
      tags: ["payments"],
      auth: "admin",
      permissions: ["payments.read"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/payments/failed-investigations",
      summary: "List failed payments for finance investigation views.",
      tags: ["payments"],
      auth: "admin",
      permissions: ["payments.read"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/payments/:paymentId",
      summary: "Fetch admin payment detail.",
      tags: ["payments"],
      auth: "admin",
      permissions: ["payments.read"]
    },
    {
      method: "GET",
      path: "/api/v1/admin/payments/:paymentId/transactions",
      summary: "Fetch provider transaction history for a payment.",
      tags: ["payments"],
      auth: "admin",
      permissions: ["payments.read"]
    }
  ]
};
