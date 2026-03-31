import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  createCustomerNoteAdmin,
  getCustomerActivityAdmin,
  getCustomerAdmin,
  getCustomerRiskAdmin,
  listCustomerOrdersAdmin,
  listCustomerReviewsAdmin,
  listCustomerSupportAdmin,
  listCustomersAdmin,
  postCustomerInternalActionAdmin,
  restoreCustomerAdmin,
  suspendCustomerAdmin
} from "./customers.controller";
import {
  adminCustomersQuerySchema,
  customerIdParamsSchema,
  customerInternalActionBodySchema,
  customerNoteBodySchema,
  customerStatusBodySchema
} from "./customers.schemas";

const router = Router();

router.get(
  "/admin/customers",
  requireAdminActor,
  requirePermissions(["customers.read"]),
  validateRequest({ query: adminCustomersQuerySchema }),
  listCustomersAdmin
);
router.get(
  "/admin/customers/:customerId",
  requireAdminActor,
  requirePermissions(["customers.read"]),
  validateRequest({ params: customerIdParamsSchema }),
  getCustomerAdmin
);
router.get(
  "/admin/customers/:customerId/activity",
  requireAdminActor,
  requirePermissions(["customers.read"]),
  validateRequest({ params: customerIdParamsSchema }),
  getCustomerActivityAdmin
);
router.get(
  "/admin/customers/:customerId/orders",
  requireAdminActor,
  requirePermissions(["customers.read"]),
  validateRequest({ params: customerIdParamsSchema, query: adminCustomersQuerySchema }),
  listCustomerOrdersAdmin
);
router.get(
  "/admin/customers/:customerId/support",
  requireAdminActor,
  requirePermissions(["customers.read"]),
  validateRequest({ params: customerIdParamsSchema, query: adminCustomersQuerySchema }),
  listCustomerSupportAdmin
);
router.get(
  "/admin/customers/:customerId/reviews",
  requireAdminActor,
  requirePermissions(["customers.read"]),
  validateRequest({ params: customerIdParamsSchema, query: adminCustomersQuerySchema }),
  listCustomerReviewsAdmin
);
router.get(
  "/admin/customers/:customerId/risk",
  requireAdminActor,
  requirePermissions(["customers.read"]),
  validateRequest({ params: customerIdParamsSchema }),
  getCustomerRiskAdmin
);
router.post(
  "/admin/customers/:customerId/suspend",
  requireAdminActor,
  requirePermissions(["customers.update_status"]),
  validateRequest({ params: customerIdParamsSchema, body: customerStatusBodySchema }),
  suspendCustomerAdmin
);
router.post(
  "/admin/customers/:customerId/restore",
  requireAdminActor,
  requirePermissions(["customers.update_status"]),
  validateRequest({ params: customerIdParamsSchema, body: customerStatusBodySchema }),
  restoreCustomerAdmin
);
router.post(
  "/admin/customers/:customerId/reactivate",
  requireAdminActor,
  requirePermissions(["customers.update_status"]),
  validateRequest({ params: customerIdParamsSchema, body: customerStatusBodySchema }),
  restoreCustomerAdmin
);
router.post(
  "/admin/customers/:customerId/notes",
  requireAdminActor,
  requirePermissions(["customers.write_notes"]),
  validateRequest({ params: customerIdParamsSchema, body: customerNoteBodySchema }),
  createCustomerNoteAdmin
);
router.post(
  "/admin/customers/:customerId/internal-actions",
  requireAdminActor,
  requirePermissions(["customers.write_notes"]),
  validateRequest({ params: customerIdParamsSchema, body: customerInternalActionBodySchema }),
  postCustomerInternalActionAdmin
);

export const customersRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/admin/customers", summary: "List admin-visible customers.", tags: ["customers"], auth: "admin", permissions: ["customers.read"] },
    { method: "GET", path: "/api/v1/admin/customers/:customerId", summary: "Fetch admin customer detail.", tags: ["customers"], auth: "admin", permissions: ["customers.read"] },
    { method: "GET", path: "/api/v1/admin/customers/:customerId/activity", summary: "Fetch customer activity timeline.", tags: ["customers"], auth: "admin", permissions: ["customers.read"] },
    { method: "GET", path: "/api/v1/admin/customers/:customerId/orders", summary: "List orders for one customer.", tags: ["customers"], auth: "admin", permissions: ["customers.read"] },
    { method: "GET", path: "/api/v1/admin/customers/:customerId/support", summary: "List support tickets for one customer.", tags: ["customers"], auth: "admin", permissions: ["customers.read"] },
    { method: "GET", path: "/api/v1/admin/customers/:customerId/reviews", summary: "List reviews for one customer.", tags: ["customers"], auth: "admin", permissions: ["customers.read"] },
    { method: "GET", path: "/api/v1/admin/customers/:customerId/risk", summary: "Fetch customer risk and security signals.", tags: ["customers"], auth: "admin", permissions: ["customers.read"] },
    { method: "POST", path: "/api/v1/admin/customers/:customerId/suspend", summary: "Suspend a customer account.", tags: ["customers"], auth: "admin", permissions: ["customers.update_status"] },
    { method: "POST", path: "/api/v1/admin/customers/:customerId/restore", summary: "Restore a suspended customer account.", tags: ["customers"], auth: "admin", permissions: ["customers.update_status"] },
    { method: "POST", path: "/api/v1/admin/customers/:customerId/reactivate", summary: "Reactivate a suspended customer account.", tags: ["customers"], auth: "admin", permissions: ["customers.update_status"] },
    { method: "POST", path: "/api/v1/admin/customers/:customerId/notes", summary: "Create an internal customer note.", tags: ["customers"], auth: "admin", permissions: ["customers.write_notes"] },
    { method: "POST", path: "/api/v1/admin/customers/:customerId/internal-actions", summary: "Internal note or security escalation (audited).", tags: ["customers"], auth: "admin", permissions: ["customers.write_notes"] }
  ]
};
