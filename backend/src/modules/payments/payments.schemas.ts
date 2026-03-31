import { PaymentState } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

const mobileMoneyDetailsSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  provider: z.string().trim().min(2).max(20).transform((value) => value.toLowerCase())
});

export const initializePaymentBodySchema = z.object({
  orderId: z.string().uuid(),
  paymentIdempotencyKey: z.string().trim().min(1).max(255),
  provider: z.string().trim().min(1).max(64).optional(),
  channel: z.enum(["card", "mobile_money"]).default("card"),
  mobileMoney: mobileMoneyDetailsSchema.optional()
}).superRefine((value, context) => {
  if (value.channel === "mobile_money" && !value.mobileMoney) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mobileMoney"],
      message: "mobileMoney is required when channel is mobile_money."
    });
  }
});

export const paymentIdParamsSchema = z.object({
  paymentId: z.string().uuid()
});

export const adminPaymentsQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  provider: z.string().trim().min(1).max(64).optional(),
  paymentState: z.nativeEnum(PaymentState).optional()
});

export const adminFailedPaymentsQuerySchema = paginationSchema.extend({
  provider: z.string().trim().min(1).max(64).optional()
});
