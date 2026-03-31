import { UserStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

export const customerIdParamsSchema = z.object({
  customerId: z.string().uuid()
});

const optionalIsoDate = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  });

export const adminCustomersQuerySchema = paginationSchema
  .extend({
    status: z.nativeEnum(UserStatus).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    joined_after: optionalIsoDate,
    joined_before: optionalIsoDate,
    min_orders: z.coerce.number().int().min(0).max(1_000_000).optional(),
    max_orders: z.coerce.number().int().min(0).max(1_000_000).optional(),
    min_ltv_cents: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    max_ltv_cents: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional()
  })
  .refine(
    (value) =>
      !(
        value.min_orders != null &&
        value.max_orders != null &&
        value.max_orders < value.min_orders
      ),
    {
      path: ["max_orders"],
      message: "max_orders must be greater than or equal to min_orders."
    }
  )
  .refine(
    (value) =>
      !(
        value.min_ltv_cents != null &&
        value.max_ltv_cents != null &&
        value.max_ltv_cents < value.min_ltv_cents
      ),
    {
      path: ["max_ltv_cents"],
      message: "max_ltv_cents must be greater than or equal to min_ltv_cents."
    }
  );

export const customerStatusBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
  note: z.string().trim().max(1_000).optional()
});

export const customerNoteBodySchema = z.object({
  note: z.string().trim().min(1).max(2_000)
});

export const customerInternalActionBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("NOTE"),
    note: z.string().trim().min(1).max(2_000)
  }),
  z.object({
    kind: z.literal("ESCALATE"),
    category: z.string().trim().min(1).max(120),
    observation: z.string().trim().min(1).max(2_000)
  })
]);
