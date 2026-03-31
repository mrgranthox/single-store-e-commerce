import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  getCustomersAdmin,
  getDashboardAdmin,
  getMarketingAdmin,
  getPostPurchaseAdmin,
  getProductsAdmin,
  getSalesAdmin,
  getSupportAdmin
} from "./reports.controller";
import { reportsDateRangeQuerySchema } from "./reports.schemas";

const router = Router();

router.get(
  "/admin/reports/overview",
  requireAdminActor,
  requirePermissions(["reports.read"]),
  validateRequest({ query: reportsDateRangeQuerySchema }),
  getDashboardAdmin
);
router.get(
  "/admin/reports/dashboard",
  requireAdminActor,
  requirePermissions(["reports.read"]),
  validateRequest({ query: reportsDateRangeQuerySchema }),
  getDashboardAdmin
);
router.get(
  "/admin/reports/sales",
  requireAdminActor,
  requirePermissions(["reports.read"]),
  validateRequest({ query: reportsDateRangeQuerySchema }),
  getSalesAdmin
);
router.get(
  "/admin/reports/inventory",
  requireAdminActor,
  requirePermissions(["reports.read"]),
  validateRequest({ query: reportsDateRangeQuerySchema }),
  getProductsAdmin
);
router.get(
  "/admin/reports/products",
  requireAdminActor,
  requirePermissions(["reports.read"]),
  validateRequest({ query: reportsDateRangeQuerySchema }),
  getProductsAdmin
);
router.get(
  "/admin/reports/customers",
  requireAdminActor,
  requirePermissions(["reports.read"]),
  validateRequest({ query: reportsDateRangeQuerySchema }),
  getCustomersAdmin
);
router.get(
  "/admin/reports/support",
  requireAdminActor,
  requirePermissions(["reports.read"]),
  validateRequest({ query: reportsDateRangeQuerySchema }),
  getSupportAdmin
);
router.get(
  "/admin/reports/refunds-returns",
  requireAdminActor,
  requirePermissions(["reports.read"]),
  validateRequest({ query: reportsDateRangeQuerySchema }),
  getPostPurchaseAdmin
);
router.get(
  "/admin/reports/post-purchase",
  requireAdminActor,
  requirePermissions(["reports.read"]),
  validateRequest({ query: reportsDateRangeQuerySchema }),
  getPostPurchaseAdmin
);
router.get(
  "/admin/reports/marketing",
  requireAdminActor,
  requirePermissions(["reports.read"]),
  validateRequest({ query: reportsDateRangeQuerySchema }),
  getMarketingAdmin
);

export const reportsRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/admin/reports/overview", summary: "Fetch operational overview KPIs.", tags: ["reports"], auth: "admin", permissions: ["reports.read"] },
    { method: "GET", path: "/api/v1/admin/reports/dashboard", summary: "Fetch operational dashboard KPIs.", tags: ["reports"], auth: "admin", permissions: ["reports.read"] },
    { method: "GET", path: "/api/v1/admin/reports/sales", summary: "Fetch sales reporting data.", tags: ["reports"], auth: "admin", permissions: ["reports.read"] },
    { method: "GET", path: "/api/v1/admin/reports/inventory", summary: "Fetch inventory reporting data.", tags: ["reports"], auth: "admin", permissions: ["reports.read"] },
    { method: "GET", path: "/api/v1/admin/reports/products", summary: "Fetch product performance reporting data.", tags: ["reports"], auth: "admin", permissions: ["reports.read"] },
    { method: "GET", path: "/api/v1/admin/reports/customers", summary: "Fetch customer reporting data.", tags: ["reports"], auth: "admin", permissions: ["reports.read"] },
    { method: "GET", path: "/api/v1/admin/reports/support", summary: "Fetch support reporting data.", tags: ["reports"], auth: "admin", permissions: ["reports.read"] },
    { method: "GET", path: "/api/v1/admin/reports/refunds-returns", summary: "Fetch returns and refunds reporting data.", tags: ["reports"], auth: "admin", permissions: ["reports.read"] },
    { method: "GET", path: "/api/v1/admin/reports/post-purchase", summary: "Fetch returns, refunds, and reviews reporting data.", tags: ["reports"], auth: "admin", permissions: ["reports.read"] },
    { method: "GET", path: "/api/v1/admin/reports/marketing", summary: "Fetch marketing reporting data.", tags: ["reports"], auth: "admin", permissions: ["reports.read"] }
  ]
};
