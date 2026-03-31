import { InventoryMovementType } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

const warehouseCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/);

const adjustmentItemSchema = z.object({
  variantId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  deltaOnHand: z.coerce.number().int().refine((value) => value !== 0, {
    message: "deltaOnHand must not be zero."
  })
});

export const inventoryQueueQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  warehouseId: z.string().uuid().optional(),
  sortBy: z.enum(["updatedAt", "available", "sku", "productTitle"]).default("updatedAt"),
  sortOrder: sortOrderSchema
});

export const inventoryStocksQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  warehouseId: z.string().uuid().optional(),
  sortBy: z.enum(["updatedAt", "available", "sku", "productTitle"]).default("productTitle"),
  sortOrder: sortOrderSchema,
  healthFilter: z.enum(["all", "healthy", "low_stock", "out_of_stock"]).default("all"),
  minAvailable: z.coerce.number().int().optional(),
  maxAvailable: z.coerce.number().int().optional()
});

export const inventoryMovementsQuerySchema = paginationSchema.extend({
  sku: z.string().trim().min(1).max(120).optional(),
  warehouseId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  actorAdminUserId: z.string().uuid().optional(),
  movementType: z.nativeEnum(InventoryMovementType).optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
  sortOrder: sortOrderSchema
});

export const createInventoryAdjustmentBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
  note: z.string().trim().max(1_000).optional(),
  confirmationReason: z.string().trim().max(500).optional(),
  items: z.array(adjustmentItemSchema).min(1).max(100)
});

const warehouseOperationalStatusSchema = z.enum(["ACTIVE", "MAINTENANCE", "OFFLINE"]);

export const createWarehouseBodySchema = z.object({
  code: warehouseCodeSchema,
  name: z.string().trim().min(1).max(120),
  metadata: z.unknown().optional(),
  operationalStatus: warehouseOperationalStatusSchema.optional()
});

export const updateWarehouseBodySchema = z
  .object({
    code: warehouseCodeSchema.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    metadata: z.unknown().optional().nullable(),
    operationalStatus: warehouseOperationalStatusSchema.optional()
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.metadata !== undefined ||
      value.operationalStatus !== undefined,
    {
      message: "At least one warehouse field must be provided."
    }
  );

export const warehouseIdParamsSchema = z.object({
  warehouseId: z.string().uuid()
});
