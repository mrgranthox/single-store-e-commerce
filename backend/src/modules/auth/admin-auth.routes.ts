import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { rateLimit } from "../../common/middleware/rate-limit.middleware";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminStepUp } from "./admin-step-up.middleware";
import { requireAdminActor } from "../roles-permissions/rbac.middleware";
import {
  getAdminMe,
  listAdminSessions,
  postAdminForgotPassword,
  postAdminLogin,
  postAdminLogout,
  postAdminRefresh,
  postAdminResetPassword,
  postAdminStepUp,
  revokeAdminSession,
  revokeAllOtherAdminSessions
} from "./admin-auth.controller";
import {
  adminForgotPasswordBodySchema,
  adminLoginBodySchema,
  adminRefreshTokenBodySchema,
  adminResetPasswordBodySchema,
  adminStepUpBodySchema,
  revokeSessionBodySchema,
  sessionIdParamsSchema
} from "./admin-auth.schemas";

const router = Router();

const adminLoginRateLimit = rateLimit({
  keyPrefix: "rl:admin:login",
  maxRequests: 10,
  windowSeconds: 300,
  failClosed: true
});
const adminRefreshRateLimit = rateLimit({
  keyPrefix: "rl:admin:refresh",
  maxRequests: 30,
  windowSeconds: 300,
  failClosed: true
});
const adminStepUpRateLimit = rateLimit({
  keyPrefix: "rl:admin:step-up",
  maxRequests: 10,
  windowSeconds: 300,
  failClosed: true
});
const adminForgotPasswordRateLimit = rateLimit({
  keyPrefix: "rl:admin:forgot-password",
  maxRequests: 5,
  windowSeconds: 600,
  failClosed: true
});
const adminResetPasswordRateLimit = rateLimit({
  keyPrefix: "rl:admin:reset-password",
  maxRequests: 10,
  windowSeconds: 600,
  failClosed: true
});

router.post(
  "/admin/auth/login",
  adminLoginRateLimit,
  validateRequest({ body: adminLoginBodySchema }),
  postAdminLogin
);
router.post(
  "/admin/auth/refresh",
  adminRefreshRateLimit,
  validateRequest({ body: adminRefreshTokenBodySchema }),
  postAdminRefresh
);
router.post(
  "/admin/auth/step-up",
  requireAdminActor,
  adminStepUpRateLimit,
  validateRequest({ body: adminStepUpBodySchema }),
  postAdminStepUp
);
router.post(
  "/admin/auth/forgot-password",
  adminForgotPasswordRateLimit,
  validateRequest({ body: adminForgotPasswordBodySchema }),
  postAdminForgotPassword
);
router.post(
  "/admin/auth/reset-password",
  adminResetPasswordRateLimit,
  validateRequest({ body: adminResetPasswordBodySchema }),
  postAdminResetPassword
);
router.post("/admin/auth/logout", requireAdminActor, postAdminLogout);
router.get("/admin/me", requireAdminActor, getAdminMe);
router.get("/admin/auth/me", requireAdminActor, getAdminMe);
router.get("/admin/auth/sessions", requireAdminActor, listAdminSessions);
router.post(
  "/admin/auth/sessions/revoke-all",
  requireAdminActor,
  requireAdminStepUp(),
  validateRequest({ body: revokeSessionBodySchema }),
  revokeAllOtherAdminSessions
);
router.post(
  "/admin/auth/sessions/:sessionId/revoke",
  requireAdminActor,
  requireAdminStepUp(),
  validateRequest({ params: sessionIdParamsSchema, body: revokeSessionBodySchema }),
  revokeAdminSession
);

export const adminAuthRouteModule: RouteModule = {
  router,
  metadata: [
    {
      method: "POST",
      path: "/api/v1/admin/auth/login",
      summary: "Authenticate an admin and issue backend API session tokens.",
      tags: ["admin-auth"],
      auth: "public"
    },
    {
      method: "POST",
      path: "/api/v1/admin/auth/refresh",
      summary: "Rotate an admin API access token using a refresh token.",
      tags: ["admin-auth"],
      auth: "public"
    },
    {
      method: "POST",
      path: "/api/v1/admin/auth/step-up",
      summary: "Perform a step-up re-authentication and issue a one-time sensitive-action token.",
      tags: ["admin-auth"],
      auth: "admin"
    },
    {
      method: "POST",
      path: "/api/v1/admin/auth/forgot-password",
      summary: "Start the admin password reset flow.",
      tags: ["admin-auth"],
      auth: "public"
    },
    {
      method: "POST",
      path: "/api/v1/admin/auth/reset-password",
      summary: "Complete the admin password reset flow.",
      tags: ["admin-auth"],
      auth: "public"
    },
    {
      method: "POST",
      path: "/api/v1/admin/auth/logout",
      summary: "Revoke the current authenticated admin session.",
      tags: ["admin-auth"],
      auth: "admin"
    },
    {
      method: "GET",
      path: "/api/v1/admin/me",
      summary: "Return the current admin shell context, roles, permissions, and session state.",
      tags: ["admin-auth"],
      auth: "admin"
    },
    {
      method: "GET",
      path: "/api/v1/admin/auth/me",
      summary: "Compatibility alias for the current admin shell context endpoint.",
      tags: ["admin-auth"],
      auth: "admin"
    },
    {
      method: "GET",
      path: "/api/v1/admin/auth/sessions",
      summary: "List the current admin's visible sessions.",
      tags: ["admin-auth"],
      auth: "admin"
    },
    {
      method: "POST",
      path: "/api/v1/admin/auth/sessions/revoke-all",
      summary: "Revoke all other active sessions for the current admin.",
      tags: ["admin-auth"],
      auth: "admin"
    },
    {
      method: "POST",
      path: "/api/v1/admin/auth/sessions/:sessionId/revoke",
      summary: "Revoke a single admin session owned by the current admin.",
      tags: ["admin-auth"],
      auth: "admin"
    }
  ]
};
