import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { rateLimit } from "../../common/middleware/rate-limit.middleware";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAuthenticatedActor } from "./auth.middleware";
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
  getAuthSession,
  postClerkWebhook,
  postForgotPassword,
  postLogin,
  postLogout,
  postRefresh,
  postRegister,
  postResendVerification,
  postResetPassword,
  postVerifyEmail
} from "./customer-auth.controller";

const router = Router();

const customerRegisterRateLimit = rateLimit({
  keyPrefix: "rl:customer:register",
  maxRequests: 5,
  windowSeconds: 3600,
  failClosed: true
});
const customerLoginRateLimit = rateLimit({
  keyPrefix: "rl:customer:login",
  maxRequests: 10,
  windowSeconds: 300,
  failClosed: true
});
const customerRefreshRateLimit = rateLimit({
  keyPrefix: "rl:customer:refresh",
  maxRequests: 30,
  windowSeconds: 300,
  failClosed: true
});
const customerForgotPasswordRateLimit = rateLimit({
  keyPrefix: "rl:customer:forgot-password",
  maxRequests: 5,
  windowSeconds: 600,
  failClosed: true
});
const customerResetPasswordRateLimit = rateLimit({
  keyPrefix: "rl:customer:reset-password",
  maxRequests: 10,
  windowSeconds: 600,
  failClosed: true
});
const customerVerifyEmailRateLimit = rateLimit({
  keyPrefix: "rl:customer:verify-email",
  maxRequests: 15,
  windowSeconds: 300,
  failClosed: true
});
const customerResendVerificationRateLimit = rateLimit({
  keyPrefix: "rl:customer:resend-verification",
  maxRequests: 3,
  windowSeconds: 600,
  failClosed: true
});
const clerkWebhookRateLimit = rateLimit({
  keyPrefix: "rl:webhook:clerk",
  maxRequests: 200,
  windowSeconds: 60,
  failClosed: false
});

router.post(
  "/auth/register",
  customerRegisterRateLimit,
  validateRequest({ body: registerBodySchema }),
  postRegister
);
router.post("/auth/login", customerLoginRateLimit, validateRequest({ body: loginBodySchema }), postLogin);
router.post("/auth/refresh", customerRefreshRateLimit, validateRequest({ body: refreshTokenBodySchema }), postRefresh);
router.get("/auth/session", getAuthSession);
router.post("/auth/logout", requireAuthenticatedActor, postLogout);
router.post(
  "/auth/forgot-password",
  customerForgotPasswordRateLimit,
  validateRequest({ body: forgotPasswordBodySchema }),
  postForgotPassword
);
router.post(
  "/auth/reset-password",
  customerResetPasswordRateLimit,
  validateRequest({ body: resetPasswordBodySchema }),
  postResetPassword
);
router.post(
  "/auth/verify-email",
  customerVerifyEmailRateLimit,
  validateRequest({ body: verifyEmailBodySchema }),
  postVerifyEmail
);
router.post(
  "/auth/resend-verification",
  customerResendVerificationRateLimit,
  validateRequest({ body: resendVerificationBodySchema }),
  postResendVerification
);
router.post(
  "/auth/verify-email/resend",
  customerResendVerificationRateLimit,
  validateRequest({ body: resendVerificationBodySchema }),
  postResendVerification
);
router.post(
  "/auth/verify-email/confirm",
  customerVerifyEmailRateLimit,
  validateRequest({ body: verifyEmailBodySchema }),
  postVerifyEmail
);

router.post(
  "/mobile/auth/register",
  customerRegisterRateLimit,
  validateRequest({ body: registerBodySchema }),
  postRegister
);
router.post("/mobile/auth/login", customerLoginRateLimit, validateRequest({ body: loginBodySchema }), postLogin);
router.post("/mobile/auth/refresh", customerRefreshRateLimit, validateRequest({ body: refreshTokenBodySchema }), postRefresh);
router.get("/mobile/auth/session", getAuthSession);
router.post("/mobile/auth/logout", requireAuthenticatedActor, postLogout);
router.post(
  "/mobile/auth/forgot-password",
  customerForgotPasswordRateLimit,
  validateRequest({ body: forgotPasswordBodySchema }),
  postForgotPassword
);
router.post(
  "/mobile/auth/reset-password",
  customerResetPasswordRateLimit,
  validateRequest({ body: resetPasswordBodySchema }),
  postResetPassword
);
router.post(
  "/mobile/auth/verify-email",
  customerVerifyEmailRateLimit,
  validateRequest({ body: verifyEmailBodySchema }),
  postVerifyEmail
);
router.post(
  "/mobile/auth/resend-verification",
  customerResendVerificationRateLimit,
  validateRequest({ body: resendVerificationBodySchema }),
  postResendVerification
);

router.post("/webhooks/clerk", clerkWebhookRateLimit, postClerkWebhook);

export const customerAuthRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "POST", path: "/api/v1/auth/register", summary: "Register a customer account.", tags: ["auth"], auth: "public" },
    { method: "POST", path: "/api/v1/auth/login", summary: "Authenticate a customer and issue backend API session tokens.", tags: ["auth"], auth: "public" },
    { method: "POST", path: "/api/v1/auth/refresh", summary: "Rotate a customer API access token using a refresh token.", tags: ["auth"], auth: "public" },
    { method: "GET", path: "/api/v1/auth/session", summary: "Return the current actor and session summary.", tags: ["auth"], auth: "public" },
    { method: "POST", path: "/api/v1/auth/logout", summary: "Revoke the current authenticated session.", tags: ["auth"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/auth/forgot-password", summary: "Start the customer password reset flow.", tags: ["auth"], auth: "public" },
    { method: "POST", path: "/api/v1/auth/reset-password", summary: "Complete the customer password reset flow.", tags: ["auth"], auth: "public" },
    { method: "POST", path: "/api/v1/auth/verify-email", summary: "Confirm a customer email verification token.", tags: ["auth"], auth: "public" },
    { method: "POST", path: "/api/v1/auth/resend-verification", summary: "Resend a customer verification email.", tags: ["auth"], auth: "public" },
    { method: "POST", path: "/api/v1/auth/verify-email/resend", summary: "Compatibility alias for resending a customer verification email.", tags: ["auth"], auth: "public" },
    { method: "POST", path: "/api/v1/auth/verify-email/confirm", summary: "Compatibility alias for confirming a customer email verification token.", tags: ["auth"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/auth/register", summary: "Register a mobile customer account.", tags: ["auth", "mobile"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/auth/login", summary: "Authenticate a mobile customer and issue backend API session tokens.", tags: ["auth", "mobile"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/auth/refresh", summary: "Rotate a mobile customer API access token using a refresh token.", tags: ["auth", "mobile"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/auth/session", summary: "Return mobile session state for the current actor.", tags: ["auth", "mobile"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/auth/logout", summary: "Revoke the current authenticated mobile session.", tags: ["auth", "mobile"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/mobile/auth/forgot-password", summary: "Start the mobile customer password reset flow.", tags: ["auth", "mobile"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/auth/reset-password", summary: "Complete the mobile customer password reset flow.", tags: ["auth", "mobile"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/auth/verify-email", summary: "Confirm a mobile customer email verification token.", tags: ["auth", "mobile"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/auth/resend-verification", summary: "Resend a mobile customer verification email.", tags: ["auth", "mobile"], auth: "public" },
    { method: "POST", path: "/api/v1/webhooks/clerk", summary: "Process Clerk user synchronization webhooks.", tags: ["auth"], auth: "public" }
  ]
};
