import type { RequestHandler } from "express";

import { prisma } from "../../config/prisma";
import { safeGetClerkAuth } from "../../config/clerk";
import { logger } from "../../config/logger";
import { env } from "../../config/env";
import { asyncHandler } from "../../common/middleware/async-handler";
import { anonymousActor, type RequestActor } from "../../common/types/request-context";
import {
  accountLockedError,
  accountSuspendedError,
  forbiddenError,
  unauthorizedError
} from "../../common/errors/app-error";
import { loadAdminAuthorization } from "../roles-permissions/rbac.service";
import { findCustomerApiSessionByAccessToken, touchCustomerApiSession } from "./api-session.service";
import { findAdminApiSessionByAccessToken, touchAdminApiSession } from "./admin-api-session.service";
import { touchSession, upsertSessionForActor, validateSessionForActor } from "./session.service";
import { syncCustomerUserFromClerkUserId } from "./clerk-sync.service";

const parseCsvHeader = (value?: string | null) =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];

const isLoopbackAddress = (value?: string | null) => {
  if (!value) {
    return false;
  }

  const normalized = value.replace(/^::ffff:/, "").trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
};

export const canUseDevAuthBypass = (input: {
  allowBypass: boolean;
  nodeEnv: string;
  ipAddress?: string | null;
}) => {
  if (!input.allowBypass) {
    return false;
  }

  if (input.nodeEnv === "test") {
    return true;
  }

  return input.nodeEnv === "development" && isLoopbackAddress(input.ipAddress);
};

const parseBearerToken = (request: Parameters<RequestHandler>[0]) => {
  const authorization = request.header("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, value] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !value?.trim()) {
    return null;
  }

  return value.trim();
};

const resolveDevBypassActor = (request: Parameters<RequestHandler>[0]): RequestActor | null => {
  if (
    !canUseDevAuthBypass({
      allowBypass: env.ALLOW_DEV_AUTH_BYPASS,
      nodeEnv: env.NODE_ENV,
      ipAddress: request.context.ipAddress
    })
  ) {
    return null;
  }

  const adminUserId = request.header("x-dev-admin-user-id");
  const userId = request.header("x-dev-user-id");
  const clerkUserId = request.header("x-dev-clerk-user-id") ?? undefined;
  const email = request.header("x-dev-email") ?? undefined;

  if (adminUserId) {
    return {
      kind: "admin",
      isAuthenticated: true,
      actorId: adminUserId,
      adminUserId,
      clerkUserId,
      email,
      adminStatus: undefined,
      roles: parseCsvHeader(request.header("x-dev-roles")),
      permissions: parseCsvHeader(request.header("x-dev-permissions"))
    };
  }

  if (userId) {
    return {
      kind: "customer",
      isAuthenticated: true,
      actorId: userId,
      userId,
      clerkUserId,
      email,
      userStatus: undefined,
      roles: [],
      permissions: []
    };
  }

  return null;
};

const hydrateAdminActor = async (actor: RequestActor): Promise<RequestActor> => {
  const authorization = await loadAdminAuthorization({
    adminUserId: actor.adminUserId,
    clerkUserId: actor.clerkUserId
  });

  if (!authorization) {
    return actor;
  }

  return {
    ...actor,
    actorId: authorization.adminUser.id,
    adminUserId: authorization.adminUser.id,
    clerkUserId: authorization.adminUser.clerkAdminUserId,
    email: authorization.adminUser.email,
    adminStatus: authorization.adminUser.status,
    roles: [...new Set([...actor.roles, ...authorization.roles])],
    permissions: [...new Set([...actor.permissions, ...authorization.permissions])]
  };
};

const hydrateCustomerActor = async (clerkUserId: string): Promise<RequestActor | null> => {
  const user = await prisma.user.findUnique({
    where: {
      clerkUserId
    }
  });

  if (!user) {
    return null;
  }

  return {
    kind: "customer",
    isAuthenticated: true,
    actorId: user.id,
    userId: user.id,
    clerkUserId: user.clerkUserId,
    email: user.email,
    userStatus: user.status,
    roles: [],
    permissions: []
  };
};

const hydrateClerkActor = async (clerkUserId: string): Promise<RequestActor | null> => {
  const adminAuthorization = await loadAdminAuthorization({
    clerkUserId
  });

  if (adminAuthorization) {
    return {
      kind: "admin",
      isAuthenticated: true,
      actorId: adminAuthorization.adminUser.id,
      adminUserId: adminAuthorization.adminUser.id,
      clerkUserId: adminAuthorization.adminUser.clerkAdminUserId,
      email: adminAuthorization.adminUser.email,
      adminStatus: adminAuthorization.adminUser.status,
      roles: adminAuthorization.roles,
      permissions: adminAuthorization.permissions
    };
  }

  return hydrateCustomerActor(clerkUserId);
};

const validateAndTrackSession = async (
  request: Parameters<RequestHandler>[0],
  actor: RequestActor
) => {
  if (!request.context.sessionId) {
    return true;
  }

  await upsertSessionForActor({
    sessionId: request.context.sessionId,
    actor,
    deviceLabel: request.context.userAgent,
    ipAddress: request.context.ipAddress,
    ipCountry: null,
    ipRegion: null
  });

  const sessionValidation = await validateSessionForActor({
    sessionId: request.context.sessionId,
    actor
  });

  if (!sessionValidation.valid) {
    logger.warn(
      {
        requestId: request.context.requestId,
        sessionId: request.context.sessionId,
        reason: sessionValidation.reason
      },
      "Rejected auth because the supplied session is not active for this actor."
    );
    request.context.actor = anonymousActor();
    return false;
  }

  void touchSession(request.context.sessionId);
  return true;
};

// Clerk-backed request auth is the primary path.
// The local header bypass remains available only when explicitly enabled for development.
export const optionalAuth = asyncHandler(async (request, _response, next) => {
  const apiAccessToken = parseBearerToken(request);

  if (apiAccessToken?.startsWith("eaa_")) {
    const apiSession = await findAdminApiSessionByAccessToken(apiAccessToken);

    if (apiSession && !apiSession.revokedAt && apiSession.accessTokenExpiresAt > new Date()) {
      request.context.sessionId = apiSession.sessionId;

      const roles = apiSession.adminUser.roles.map((entry) => entry.role.code);
      const permissions = [
        ...new Set(
          apiSession.adminUser.roles.flatMap((entry) =>
            entry.role.rolePermissions.map((rolePermission) => rolePermission.permission.code)
          )
        )
      ];

      const actor: RequestActor = {
        kind: "admin",
        isAuthenticated: true,
        actorId: apiSession.adminUser.id,
        adminUserId: apiSession.adminUser.id,
        clerkUserId: apiSession.adminUser.clerkAdminUserId,
        email: apiSession.adminUser.email,
        adminStatus: apiSession.adminUser.status,
        roles,
        permissions
      };

      const validSession = await validateAndTrackSession(request, actor);
      if (!validSession) {
        return next();
      }

      request.context.actor = actor;
      void touchAdminApiSession(apiAccessToken);
      return next();
    }

    request.context.actor = anonymousActor();
    return next();
  }

  if (apiAccessToken?.startsWith("eca_")) {
    const apiSession = await findCustomerApiSessionByAccessToken(apiAccessToken);

    if (apiSession && !apiSession.revokedAt && apiSession.accessTokenExpiresAt > new Date()) {
      request.context.sessionId = apiSession.sessionId;

      const actor: RequestActor = {
        kind: "customer",
        isAuthenticated: true,
        actorId: apiSession.user.id,
        userId: apiSession.user.id,
        clerkUserId: apiSession.user.clerkUserId,
        email: apiSession.user.email,
        userStatus: apiSession.user.status,
        roles: [],
        permissions: []
      };

      const validSession = await validateAndTrackSession(request, actor);
      if (!validSession) {
        return next();
      }

      request.context.actor = actor;
      void touchCustomerApiSession(apiAccessToken);
      return next();
    }

    request.context.actor = anonymousActor();
    return next();
  }

  const clerkAuth = safeGetClerkAuth(request);

  if (clerkAuth?.userId) {
    request.context.sessionId = clerkAuth.sessionId ?? request.context.sessionId;

    const clerkActor = await hydrateClerkActor(clerkAuth.userId);

    if (!clerkActor) {
      let syncedUser = null;

      try {
        syncedUser = await syncCustomerUserFromClerkUserId(clerkAuth.userId);
      } catch (error) {
        logger.warn(
          {
            requestId: request.context.requestId,
            clerkUserId: clerkAuth.userId,
            error
          },
          "Failed to synchronize the Clerk user into backend customer state."
        );
      }

      if (!syncedUser) {
        logger.warn(
          {
            requestId: request.context.requestId,
            clerkUserId: clerkAuth.userId
          },
          "Clerk authenticated user is not yet mapped to a backend user or admin record."
        );
        request.context.actor = anonymousActor();
        return next();
      }

      const fallbackActor: RequestActor = {
        kind: "customer",
        isAuthenticated: true,
        actorId: syncedUser.id,
        userId: syncedUser.id,
        clerkUserId: syncedUser.clerkUserId,
        email: syncedUser.email,
        userStatus: syncedUser.status,
        roles: [],
        permissions: []
      };

      const validSession = await validateAndTrackSession(request, fallbackActor);
      if (!validSession) {
        return next();
      }

      request.context.actor = fallbackActor;
      return next();
    }

    const validSession = await validateAndTrackSession(request, clerkActor);
    if (!validSession) {
      return next();
    }

    request.context.actor = clerkActor;
    return next();
  }

  const bypassActor = resolveDevBypassActor(request);

  if (!bypassActor) {
    if (
      env.ALLOW_DEV_AUTH_BYPASS &&
      (request.header("x-dev-admin-user-id") ||
        request.header("x-dev-user-id") ||
        request.header("x-dev-clerk-user-id"))
    ) {
      logger.warn(
        {
          requestId: request.context.requestId,
          ipAddress: request.context.ipAddress,
          nodeEnv: env.NODE_ENV
        },
        "Rejected development auth bypass headers outside local development or test."
      );
    }
    request.context.actor = anonymousActor();
    return next();
  }

  if (bypassActor.kind === "admin") {
    try {
      const hydratedActor = await hydrateAdminActor(bypassActor);
      const validSession = await validateAndTrackSession(request, hydratedActor);
      if (!validSession) {
        return next();
      }

      request.context.actor = hydratedActor;
    } catch (error) {
      logger.warn(
        {
          requestId: request.context.requestId,
          error
        },
        "Failed to hydrate admin actor from the database. Falling back to header-scoped auth."
      );
      request.context.actor = request.context.sessionId ? anonymousActor() : bypassActor;
    }

    return next();
  }

  if (bypassActor.kind === "customer") {
    const hydratedCustomerActor = bypassActor.clerkUserId
      ? await hydrateCustomerActor(bypassActor.clerkUserId)
      : bypassActor;

    const actor = hydratedCustomerActor ?? bypassActor;
    const validSession = await validateAndTrackSession(request, actor);
    if (!validSession) {
      return next();
    }

    request.context.actor = actor;
    return next();
  }

  request.context.actor = bypassActor;
  next();
});

export const requireAuthenticatedActor: RequestHandler = (request, _response, next) => {
  if (!request.context.actor.isAuthenticated) {
    return next(unauthorizedError());
  }

  next();
};

export const requireCustomerActor: RequestHandler = (request, _response, next) => {
  if (!request.context.actor.isAuthenticated) {
    return next(unauthorizedError());
  }

  if (request.context.actor.kind !== "customer") {
    return next(forbiddenError("A customer actor is required for this route."));
  }

  if (
    request.context.actor.userStatus === "SUSPENDED" ||
    request.context.actor.userStatus === "DEACTIVATED"
  ) {
    return next(accountSuspendedError());
  }

  if (request.context.actor.userStatus === "LOCKED") {
    return next(accountLockedError());
  }

  next();
};
