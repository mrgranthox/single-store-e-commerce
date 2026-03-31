import { z } from "zod";

const quantitySchema = z.coerce.number().int().min(1).max(999);

export const cartItemIdParamsSchema = z.object({
  itemId: z.string().uuid()
});

export const addCartItemBodySchema = z.object({
  variantId: z.string().uuid(),
  quantity: quantitySchema
});

export const updateCartItemBodySchema = z.object({
  quantity: quantitySchema
});

export const applyCouponBodySchema = z.object({
  code: z.string().trim().min(1).max(120).transform((value) => value.toUpperCase())
});
