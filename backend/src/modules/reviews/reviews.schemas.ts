import { ReviewStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

export const reviewIdParamsSchema = z.object({
  reviewId: z.string().uuid()
});

export const orderIdParamsSchema = z.object({
  orderId: z.string().uuid()
});

export const productSlugParamsSchema = z.object({
  productSlug: z.string().trim().min(1).max(160)
});

export const createReviewBodySchema = z.object({
  orderItemId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(255).optional(),
  body: z.string().trim().max(2_000).optional(),
  comment: z.string().trim().max(2_000).optional()
});

export const updateReviewBodySchema = z.object({
  title: z.string().trim().max(255).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  body: z.string().trim().max(2_000).optional(),
  comment: z.string().trim().max(2_000).optional()
});

export const myReviewsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ReviewStatus).optional()
});

export const adminReviewsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ReviewStatus).optional(),
  q: z.string().trim().min(1).max(200).optional()
});

export const moderateReviewBodySchema = z.object({
  status: z.nativeEnum(ReviewStatus),
  moderationNote: z.string().trim().max(1_000).optional()
});
