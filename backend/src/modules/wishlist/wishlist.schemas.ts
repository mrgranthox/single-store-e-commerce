import { z } from "zod";

export const wishlistListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

export const createWishlistItemBodySchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional()
});

export const wishlistItemIdParamsSchema = z
  .object({
    itemId: z.string().uuid().optional(),
    wishlistItemId: z.string().uuid().optional()
  })
  .refine((value) => Boolean(value.itemId ?? value.wishlistItemId), {
    message: "A wishlist item id is required.",
    path: ["itemId"]
  });
