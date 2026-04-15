import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { rateLimit, rateLimitKeyFromActorOrIp } from "../../common/middleware/rate-limit.middleware";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminStepUp } from "../auth/admin-step-up.middleware";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  createAdminInvitationController,
  createAdminUserController,
  getAdminUserController,
  listAdminInvitationsController,
  listAdminUsersController,
  listAdminUserSessionsController,
  reactivateAdminUserController,
  resendAdminInvitationController,
  revokeAdminInvitationController,
  revokeAdminUserSessionController,
  suspendAdminUserController,
  updateAdminUserController,
  updateAdminUserRolesController
} from "./admin-users.controller";
import {
  adminInvitationIdParamsSchema,
  adminInvitationsQuerySchema,
  adminStatusMutationBodySchema,
  adminUserIdParamsSchema,
  adminUserSessionParamsSchema,
  adminUsersQuerySchema,
  createAdminInvitationBodySchema,
  createAdminUserBodySchema,
  revokeAdminInvitationBodySchema,
  updateAdminUserBodySchema,
  updateAdminUserRolesBodySchema
} from "./admin-users.schemas";

const router = Router();

const adminInvitationRateLimit = rateLimit({
  keyPrefix: "rl:admin:admin-invitations",
  maxRequests: 20,
  windowSeconds: 600,
  failClosed: true,
  keyResolver: rateLimitKeyFromActorOrIp
});

const adminInvitationRevokeRateLimit = rateLimit({
  keyPrefix: "rl:admin:admin-invitations:revoke",
  maxRequests: 15,
  windowSeconds: 600,
  failClosed: true,
  keyResolver: rateLimitKeyFromActorOrIp
});

const adminSessionRevokeRateLimit = rateLimit({
  keyPrefix: "rl:admin:admin-users:session-revoke",
  maxRequests: 30,
  windowSeconds: 300,
  failClosed: true,
  keyResolver: rateLimitKeyFromActorOrIp
});

router.get(
  "/admin/admin-users",
  requireAdminActor,
  requirePermissions(["admin.users.read"]),
  validateRequest({ query: adminUsersQuerySchema }),
  listAdminUsersController
);
router.post(
  "/admin/admin-users",
  requireAdminActor,
  requirePermissions(["admin.users.create"]),
  requireAdminStepUp(),
  validateRequest({ body: createAdminUserBodySchema }),
  createAdminUserController
);
router.get(
  "/admin/admin-users/invitations",
  requireAdminActor,
  requirePermissions(["admin.users.invitations.manage"]),
  validateRequest({ query: adminInvitationsQuerySchema }),
  listAdminInvitationsController
);
router.post(
  "/admin/admin-users/invitations",
  requireAdminActor,
  requirePermissions(["admin.users.invitations.manage"]),
  requireAdminStepUp(),
  adminInvitationRateLimit,
  validateRequest({ body: createAdminInvitationBodySchema }),
  createAdminInvitationController
);
router.post(
  "/admin/admin-users/invitations/:invitationId/resend",
  requireAdminActor,
  requirePermissions(["admin.users.invitations.manage"]),
  requireAdminStepUp(),
  adminInvitationRateLimit,
  validateRequest({ params: adminInvitationIdParamsSchema }),
  resendAdminInvitationController
);
router.post(
  "/admin/admin-users/invitations/:invitationId/revoke",
  requireAdminActor,
  requirePermissions(["admin.users.invitations.manage"]),
  requireAdminStepUp(),
  adminInvitationRevokeRateLimit,
  validateRequest({ params: adminInvitationIdParamsSchema, body: revokeAdminInvitationBodySchema }),
  revokeAdminInvitationController
);
router.get(
  "/admin/admin-users/:adminUserId",
  requireAdminActor,
  requirePermissions(["admin.users.read"]),
  validateRequest({ params: adminUserIdParamsSchema }),
  getAdminUserController
);
router.patch(
  "/admin/admin-users/:adminUserId",
  requireAdminActor,
  requirePermissions(["admin.users.update"]),
  validateRequest({ params: adminUserIdParamsSchema, body: updateAdminUserBodySchema }),
  updateAdminUserController
);
router.patch(
  "/admin/admin-users/:adminUserId/roles",
  requireAdminActor,
  requirePermissions(["admin.users.manage_roles"]),
  requireAdminStepUp(),
  validateRequest({ params: adminUserIdParamsSchema, body: updateAdminUserRolesBodySchema }),
  updateAdminUserRolesController
);
router.post(
  "/admin/admin-users/:adminUserId/suspend",
  requireAdminActor,
  requirePermissions(["admin.users.update_status"]),
  requireAdminStepUp(),
  validateRequest({ params: adminUserIdParamsSchema, body: adminStatusMutationBodySchema }),
  suspendAdminUserController
);
router.post(
  "/admin/admin-users/:adminUserId/reactivate",
  requireAdminActor,
  requirePermissions(["admin.users.update_status"]),
  requireAdminStepUp(),
  validateRequest({ params: adminUserIdParamsSchema, body: adminStatusMutationBodySchema }),
  reactivateAdminUserController
);
router.get(
  "/admin/admin-users/:adminUserId/sessions",
  requireAdminActor,
  requirePermissions(["admin.users.sessions.read"]),
  validateRequest({ params: adminUserIdParamsSchema }),
  listAdminUserSessionsController
);
router.post(
  "/admin/admin-users/:adminUserId/sessions/:sessionId/revoke",
  requireAdminActor,
  requirePermissions(["admin.users.sessions.revoke"]),
  requireAdminStepUp(),
  adminSessionRevokeRateLimit,
  validateRequest({ params: adminUserSessionParamsSchema, body: adminStatusMutationBodySchema }),
  revokeAdminUserSessionController
);

export const adminUsersRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/admin/admin-users", summary: "List admin users.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.read"] },
    { method: "POST", path: "/api/v1/admin/admin-users", summary: "Create an admin user linked to a Clerk identity.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.create"] },
    { method: "GET", path: "/api/v1/admin/admin-users/invitations", summary: "List admin invitations.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.invitations.manage"] },
    { method: "POST", path: "/api/v1/admin/admin-users/invitations", summary: "Create an admin invitation.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.invitations.manage"] },
    { method: "POST", path: "/api/v1/admin/admin-users/invitations/:invitationId/resend", summary: "Resend an admin invitation.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.invitations.manage"] },
    { method: "POST", path: "/api/v1/admin/admin-users/invitations/:invitationId/revoke", summary: "Revoke an admin invitation.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.invitations.manage"] },
    { method: "GET", path: "/api/v1/admin/admin-users/:adminUserId", summary: "Fetch admin user detail.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.read"] },
    { method: "PATCH", path: "/api/v1/admin/admin-users/:adminUserId", summary: "Update admin user profile metadata.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.update"] },
    { method: "PATCH", path: "/api/v1/admin/admin-users/:adminUserId/roles", summary: "Update admin user roles.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.manage_roles"] },
    { method: "POST", path: "/api/v1/admin/admin-users/:adminUserId/suspend", summary: "Suspend an admin user.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.update_status"] },
    { method: "POST", path: "/api/v1/admin/admin-users/:adminUserId/reactivate", summary: "Reactivate an admin user.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.update_status"] },
    { method: "GET", path: "/api/v1/admin/admin-users/:adminUserId/sessions", summary: "List sessions for an admin user.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.sessions.read"] },
    { method: "POST", path: "/api/v1/admin/admin-users/:adminUserId/sessions/:sessionId/revoke", summary: "Revoke a session for an admin user.", tags: ["admin-users"], auth: "admin", permissions: ["admin.users.sessions.revoke"] }
  ]
};
