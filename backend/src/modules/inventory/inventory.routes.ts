import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  createInventoryAdjustmentBodySchema,
  createWarehouseBodySchema,
  inventoryMovementsQuerySchema,
  inventoryQueueQuerySchema,
  inventoryStocksQuerySchema,
  updateWarehouseBodySchema,
  warehouseIdParamsSchema
} from "./inventory.schemas";
import {
  createAdminInventoryAdjustments,
  createAdminWarehouse,
  getAdminInventoryOverview,
  getAdminWarehouse,
  listAdminInventoryMovements,
  listAdminInventoryStocks,
  listAdminLowStockInventory,
  listAdminOutOfStockInventory,
  listAdminWarehouses,
  updateAdminWarehouse
} from "./inventory.controller";

const router = Router();

router.get("/admin/inventory/overview", requireAdminActor, requirePermissions(["inventory.read"]), getAdminInventoryOverview);
router.get(
  "/admin/inventory/stocks",
  requireAdminActor,
  requirePermissions(["inventory.read"]),
  validateRequest({ query: inventoryStocksQuerySchema }),
  listAdminInventoryStocks
);
router.get(
  "/admin/inventory/low-stock",
  requireAdminActor,
  requirePermissions(["inventory.read"]),
  validateRequest({ query: inventoryQueueQuerySchema }),
  listAdminLowStockInventory
);
router.get(
  "/admin/inventory/out-of-stock",
  requireAdminActor,
  requirePermissions(["inventory.read"]),
  validateRequest({ query: inventoryQueueQuerySchema }),
  listAdminOutOfStockInventory
);
router.get(
  "/admin/inventory/movements",
  requireAdminActor,
  requirePermissions(["inventory.read"]),
  validateRequest({ query: inventoryMovementsQuerySchema }),
  listAdminInventoryMovements
);
router.post(
  "/admin/inventory/adjustments",
  requireAdminActor,
  requirePermissions(["inventory.adjust"]),
  validateRequest({ body: createInventoryAdjustmentBodySchema }),
  createAdminInventoryAdjustments
);
router.get("/admin/inventory/warehouses", requireAdminActor, requirePermissions(["inventory.read"]), listAdminWarehouses);
router.post(
  "/admin/inventory/warehouses",
  requireAdminActor,
  requirePermissions(["inventory.manage_warehouses"]),
  validateRequest({ body: createWarehouseBodySchema }),
  createAdminWarehouse
);
router.get(
  "/admin/inventory/warehouses/:warehouseId",
  requireAdminActor,
  requirePermissions(["inventory.read"]),
  validateRequest({ params: warehouseIdParamsSchema }),
  getAdminWarehouse
);
router.patch(
  "/admin/inventory/warehouses/:warehouseId",
  requireAdminActor,
  requirePermissions(["inventory.manage_warehouses"]),
  validateRequest({ params: warehouseIdParamsSchema, body: updateWarehouseBodySchema }),
  updateAdminWarehouse
);

export const inventoryRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/admin/inventory/overview", summary: "Get inventory overview totals.", tags: ["inventory"], auth: "admin", permissions: ["inventory.read"] },
    { method: "GET", path: "/api/v1/admin/inventory/stocks", summary: "List inventory stock rows with health filters.", tags: ["inventory"], auth: "admin", permissions: ["inventory.read"] },
    { method: "GET", path: "/api/v1/admin/inventory/low-stock", summary: "List low-stock inventory rows.", tags: ["inventory"], auth: "admin", permissions: ["inventory.read"] },
    { method: "GET", path: "/api/v1/admin/inventory/out-of-stock", summary: "List out-of-stock inventory rows.", tags: ["inventory"], auth: "admin", permissions: ["inventory.read"] },
    { method: "GET", path: "/api/v1/admin/inventory/movements", summary: "List inventory movement history.", tags: ["inventory"], auth: "admin", permissions: ["inventory.read"] },
    { method: "POST", path: "/api/v1/admin/inventory/adjustments", summary: "Create manual inventory adjustments.", tags: ["inventory"], auth: "admin", permissions: ["inventory.adjust"] },
    { method: "GET", path: "/api/v1/admin/inventory/warehouses", summary: "List warehouses.", tags: ["inventory"], auth: "admin", permissions: ["inventory.read"] },
    { method: "POST", path: "/api/v1/admin/inventory/warehouses", summary: "Create a warehouse.", tags: ["inventory"], auth: "admin", permissions: ["inventory.manage_warehouses"] },
    { method: "GET", path: "/api/v1/admin/inventory/warehouses/:warehouseId", summary: "Get warehouse detail.", tags: ["inventory"], auth: "admin", permissions: ["inventory.read"] },
    { method: "PATCH", path: "/api/v1/admin/inventory/warehouses/:warehouseId", summary: "Update a warehouse.", tags: ["inventory"], auth: "admin", permissions: ["inventory.manage_warehouses"] }
  ]
};
