import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { adminScreenCatalog } from "@/lib/contracts/admin-screen-catalog";

const pathToRegex = (path: string) => {
  const pattern = path.replace(/:[^/]+/g, "[^/]+").replace(/\//g, "\\/");
  return new RegExp(`^${pattern}$`);
};

/** Current catalog screen for the URL, if any (used for Stitch breadcrumbs / chrome). */
export const useMatchedAdminScreen = () => {
  const { pathname } = useLocation();

  return useMemo(
    () => adminScreenCatalog.find((s) => pathToRegex(s.path).test(pathname)),
    [pathname]
  );
};
