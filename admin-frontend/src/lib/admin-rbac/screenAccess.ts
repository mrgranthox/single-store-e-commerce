/** Mirrors backend `FULL_ACCESS_ADMIN_ROLE_CODES` — full UI access without listing every permission. */
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";

export const ADMIN_FULL_ACCESS_ROLE_CODES = ["super_admin", "platform_admin"] as const;

const fullAccessRoleSet = new Set<string>(ADMIN_FULL_ACCESS_ROLE_CODES);

const actorHasFullAccessRole = (roleCodes: readonly string[] | undefined) =>
  (roleCodes ?? []).some((role) => fullAccessRoleSet.has(role));

/**
 * Route-level gate: user may open the screen if they hold **any** of the catalog
 * `permissionHints`. Hints should mirror the real backend permission codes required
 * for at least one supported action on the screen.
 *
 * `super_admin` and `platform_admin` may open any screen (backend enforces the same for API).
 */
export const adminMayAccessScreen = (
  actorPermissions: readonly string[] | undefined,
  permissionHints: readonly string[],
  actorRoleCodes?: readonly string[] | undefined
) => {
  if (permissionHints.length === 0) {
    return true;
  }
  if (actorHasFullAccessRole(actorRoleCodes)) {
    return true;
  }
  const granted = actorPermissions ?? [];
  if (granted.length === 0) {
    return false;
  }
  return adminHasAnyPermission(granted, permissionHints);
};
