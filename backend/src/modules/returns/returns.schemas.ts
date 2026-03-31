import { RefundState, ReturnStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

export const orderIdParamsSchema = z.object({
  orderId: z.string().uuid()
});

export const returnIdParamsSchema = z.object({
  returnId: z.string().uuid()
});

export const refundIdParamsSchema = z.object({
  refundId: z.string().uuid()
});

export const financeExceptionIdParamsSchema = z.object({
  exceptionId: z.string().uuid()
});

export const createReturnBodySchema = z.object({
  customerReason: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(999),
        reason: z.string().trim().min(1).max(200).optional()
      })
    )
    .min(1)
}).refine((value) => Boolean(value.customerReason ?? value.description), {
  message: "customerReason or description is required.",
  path: ["customerReason"]
});

export const adminReturnsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ReturnStatus).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  reason_contains: z.string().trim().min(1).max(200).optional()
});

export const adminRefundsQuerySchema = paginationSchema.extend({
  state: z.nativeEnum(RefundState).optional(),
  q: z.string().trim().min(1).max(200).optional()
});

export const adminApproveReturnBodySchema = z.object({
  note: z.string().trim().max(1_000).optional()
});

export const adminRejectReturnBodySchema = z.object({
  note: z.string().trim().min(1).max(1_000)
});

export const adminMarkReceivedBodySchema = z.object({
  note: z.string().trim().max(1_000).optional(),
  restockItems: z.boolean().default(true)
});

export const adminCompleteReturnBodySchema = z.object({
  note: z.string().trim().max(1_000).optional()
});

export const adminApproveRefundBodySchema = z.object({
  note: z.string().trim().max(1_000).optional()
});

export const adminRejectRefundBodySchema = z.object({
  note: z.string().trim().min(1).max(1_000)
});

export const adminCompleteRefundBodySchema = z.object({
  note: z.string().trim().max(1_000).optional(),
  providerRefundRef: z.string().trim().min(1).max(255).optional()
});

export const resolveFinanceExceptionBodySchema = z.object({
  note: z.string().trim().min(1).max(1_000)
});
