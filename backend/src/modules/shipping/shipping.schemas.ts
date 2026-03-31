import { ShipmentStatus } from "@prisma/client";
import { z } from "zod";

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
