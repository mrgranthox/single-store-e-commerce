import { prisma } from "../../config/prisma";

import type { RequestActor } from "../../common/types/request-context";

import { FULL_ACCESS_ADMIN_ROLE_CODES } from "./rbac.constants";

const fullAccessRoleSet = new Set<string>(FULL_ACCESS_ADMIN_ROLE_CODES);

export const adminActorHasFullAccessRole = (actor: RequestActor) =>
  actor.kind === "admin" && actor.roles.some((role) => fullAccessRoleSet.has(role));

export const loadAdminAuthorization = async (input: {
  adminUserId?: string;
  clerkUserId?: string;
}) => {
  const conditions = [
    input.adminUserId ? { id: input.adminUserId } : null,
    input.clerkUserId ? { clerkAdminUserId: input.clerkUserId } : null
  ].filter(Boolean) as Array<{ id?: string; clerkAdminUserId?: string }>;

  if (conditions.length === 0) {
    return null;
  }

  const adminUser = await prisma.adminUser.findFirst({
    where: {
      OR: conditions
    },
    include: {
      roles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!adminUser) {
    return null;
  }

  const roles = adminUser.roles.map((entry) => entry.role.code);
  const permissions = [
    ...new Set(
      adminUser.roles.flatMap((entry) =>
        entry.role.rolePermissions.map((rolePermission) => rolePermission.permission.code)
      )
    )
  ];

  return {
    adminUser,
    roles,
    permissions
  };
};

export const actorHasPermissions = (
  actor: RequestActor,
  requiredPermissions: string[],
  match: "all" | "any" = "all"
) => {
  if (requiredPermissions.length === 0) {
    return true;
  }

  if (adminActorHasFullAccessRole(actor)) {
    return true;
  }

  const permissionSet = new Set(actor.permissions);

  if (match === "any") {
    return requiredPermissions.some((permission) => permissionSet.has(permission));
  }

  return requiredPermissions.every((permission) => permissionSet.has(permission));
};
