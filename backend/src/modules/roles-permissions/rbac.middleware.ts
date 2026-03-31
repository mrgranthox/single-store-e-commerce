import type { RequestHandler } from "express";

import {
  accountLockedError,
  accountSuspendedError,
  authRequiredError,
  forbiddenError
} from "../../common/errors/app-error";
import { actorHasPermissions } from "./rbac.service";

export const requireAdminActor: RequestHandler = (request, _response, next) => {
  if (!request.context.actor.isAuthenticated) {
    return next(authRequiredError("Admin authentication is required."));
  }

  if (request.context.actor.kind !== "admin") {
    return next(forbiddenError("An admin actor is required for this route."));
  }

  if (request.context.actor.adminStatus === "LOCKED") {
    return next(accountLockedError("The admin account is locked."));
  }

  if (
    request.context.actor.adminStatus === "SUSPENDED" ||
    request.context.actor.adminStatus === "DEACTIVATED"
  ) {
    return next(accountSuspendedError("The admin account is suspended or deactivated."));
  }

  next();
};

export const requirePermissions = (
  permissions: string[],
  match: "all" | "any" = "all"
): RequestHandler => {
  return (request, _response, next) => {
    if (!request.context.actor.isAuthenticated) {
      return next(authRequiredError("Admin authentication is required."));
    }

    if (request.context.actor.kind !== "admin") {
      return next(forbiddenError("An admin actor is required for permission-gated routes."));
    }

    if (!actorHasPermissions(request.context.actor, permissions, match)) {
      return next(
        forbiddenError("You do not have the required permissions for this operation.")
      );
    }

    next();
  };
};
