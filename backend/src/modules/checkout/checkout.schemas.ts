import { z } from "zod";

const checkoutIdempotencyKeySchema = z.string().trim().min(8).max(200);
const mobileMoneyDetailsSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  provider: z.string().trim().min(2).max(20).transform((value) => value.toLowerCase())
});

const addressSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(4).max(40),
  country: z.string().trim().min(2).max(120),
  region: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(255),
  line2: z.string().trim().max(255).optional(),
  postalCode: z.string().trim().min(1).max(40)
});

export const validateCheckoutBodySchema = z.object({
  address: addressSchema,
  shippingMethodCode: z.string().trim().min(1).max(50).default("STANDARD")
});

export const createOrderBodySchema = z.object({
  checkoutIdempotencyKey: checkoutIdempotencyKeySchema,
  address: addressSchema,
  shippingMethodCode: z.string().trim().min(1).max(50).default("STANDARD"),
  campaignId: z.string().uuid().optional()
});

export const initializePaymentBodySchema = z.object({
  orderId: z.string().uuid(),
  paymentIdempotencyKey: checkoutIdempotencyKeySchema,
  provider: z.string().trim().min(1).max(60).optional(),
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
