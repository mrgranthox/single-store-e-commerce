import { adminScreenCatalog } from "@/lib/contracts/admin-screen-catalog";

/**
 * Resolve the first catalog screen whose path pattern matches the pathname
 * (same rules as the admin shell breadcrumb).
 */
export const findAdminScreenByPathname = (pathname: string) =>
  adminScreenCatalog.find((screenItem) => {
    const pattern = screenItem.path
      .replace(/:[^/]+/g, "[^/]+")
      .replace(/\//g, "\\/");
    return new RegExp(`^${pattern}$`).test(pathname);
  });
