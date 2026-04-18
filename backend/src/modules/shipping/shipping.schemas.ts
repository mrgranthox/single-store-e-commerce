import { ShipmentStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

export const adminShipmentsQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.nativeEnum(ShipmentStatus).optional()
});

export const orderIdParamsSchema = z.object({
  orderId: z.string().uuid()
});

export const shipmentIdParamsSchema = z.object({
  shipmentId: z.string().uuid()
});

export const createShipmentBodySchema = z.object({
  warehouseId: z.string().uuid(),
  carrier: z.string().trim().min(1).max(120).optional(),
  trackingNumber: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().max(1_000).optional()
});

export const createTrackingEventBodySchema = z.object({
  eventType: z.string().trim().min(1).max(120).optional(),
  statusLabel: z.string().trim().min(1).max(160),
  shipmentStatus: z.nativeEnum(ShipmentStatus).optional(),
  occurredAt: z.string().datetime().optional(),
  location: z.string().trim().min(1).max(160).optional(),
  trackingNumber: z.string().trim().min(1).max(120).optional(),
  carrier: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().max(1_000).optional()
});

export const updateShipmentBodySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  shipmentStatus: z.nativeEnum(ShipmentStatus).optional(),
  trackingNumber: z.string().trim().min(1).max(120).optional(),
  carrier: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().max(1_000).optional()
});

export const bulkAdminShipmentStatusBodySchema = z.object({
  shipmentIds: z.array(z.string().uuid()).min(1).max(100),
  shipmentStatus: z.nativeEnum(ShipmentStatus),
  note: z.string().trim().max(1_000).optional()
});
