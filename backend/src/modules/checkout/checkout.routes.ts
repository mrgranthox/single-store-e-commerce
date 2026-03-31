import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { rateLimit, rateLimitKeyFromActorOrIp } from "../../common/middleware/rate-limit.middleware";
import { validateRequest } from "../../common/validation/validate-request";
import {
  createOrderController,
  getCheckoutEligibilityController,
  initializePaymentController,
  validateCheckoutController
} from "./checkout.controller";
import {
  createOrderBodySchema,
  initializePaymentBodySchema,
  validateCheckoutBodySchema
} from "./checkout.schemas";

const router = Router();

const checkoutReadRateLimit = rateLimit({
  keyPrefix: "rl:checkout:read",
  maxRequests: 60,
  windowSeconds: 60,
  failClosed: true
});
const checkoutMutationRateLimit = rateLimit({
  keyPrefix: "rl:checkout:mutation",
  maxRequests: 20,
  windowSeconds: 300,
  failClosed: true,
  keyResolver: rateLimitKeyFromActorOrIp
});

router.get("/checkout/eligibility", checkoutReadRateLimit, getCheckoutEligibilityController);
router.post(
  "/checkout/validate",
  checkoutMutationRateLimit,
  validateRequest({ body: validateCheckoutBodySchema }),
  validateCheckoutController
);
router.post(
  "/checkout/create-order",
  checkoutMutationRateLimit,
  validateRequest({ body: createOrderBodySchema }),
  createOrderController
);
router.post(
  "/checkout/initialize-payment",
  checkoutMutationRateLimit,
  validateRequest({ body: initializePaymentBodySchema }),
  initializePaymentController
);

export const checkoutRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/checkout/eligibility", summary: "Get checkout eligibility for the current cart.", tags: ["checkout"], auth: "public" },
    { method: "POST", path: "/api/v1/checkout/validate", summary: "Validate checkout for the current cart.", tags: ["checkout"], auth: "public" },
    { method: "POST", path: "/api/v1/checkout/create-order", summary: "Create an order from the current cart.", tags: ["checkout"], auth: "public" },
    { method: "POST", path: "/api/v1/checkout/initialize-payment", summary: "Initialize payment for an order pending payment.", tags: ["checkout"], auth: "public" }
  ]
};
