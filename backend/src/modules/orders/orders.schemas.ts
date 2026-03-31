import { PaymentState } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

const orderStatusSchema = z.enum([
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "CLOSED"
]);

export const orderIdParamsSchema = z.object({
  orderId: z.string().uuid()
});

export const assignWarehouseBodySchema = z.object({
  warehouseId: z.string().uuid(),
  reason: z.string().trim().min(1).max(160).optional(),
  note: z.string().trim().max(1_000).optional()
});

export const adminOrderCampaignAttributionBodySchema = z.object({
  campaignId: z.string().uuid().nullable(),
  note: z.string().trim().max(1_000).optional()
});

export const cancellationIdParamsSchema = z.object({
  cancellationId: z.string().uuid()
});

export const accountOrdersQuerySchema = paginationSchema.extend({
  status: orderStatusSchema.optional()
});

export const guestTrackOrderBodySchema = z.object({
  orderNumber: z.string().trim().min(1).max(64),
  email: z.string().trim().email()
});

export const customerCancelOrderBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
  note: z.string().trim().max(1_000).optional()
});

export const adminOrdersQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  status: orderStatusSchema.optional(),
  paymentState: z.nativeEnum(PaymentState).optional()
});

export const adminOrderStatusBodySchema = z.object({
  status: orderStatusSchema,
  reason: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().max(1_000).optional()
});

export const adminCancelOrderBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
  note: z.string().trim().max(1_000).optional()
});

export const adminQueueQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional()
});

export const adminCancellationRequestsQuerySchema = paginationSchema.extend({
  status: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : val),
    z.string().trim().min(1).max(80).optional()
  )
});

export const adminResolveCancellationBodySchema = z.object({
  note: z.string().trim().max(1_000).optional()
});
