import { z } from "zod";

const optionalResourceTypeSchema = z.enum(["image", "video", "raw"]).optional();
const optionalDeliveryTypeSchema = z.enum(["upload", "private"]).optional();

export const pageIdParamsSchema = z.object({
  pageId: z.string().uuid()
});

export const bannerIdParamsSchema = z.object({
  bannerId: z.string().uuid()
});

export const pageSlugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(160)
});

export const publicBannersQuerySchema = z.object({
  placement: z.string().trim().min(1).max(80).optional()
});

export const createPageBodySchema = z.object({
  slug: z.string().trim().min(1).max(160),
  title: z.string().trim().max(255).optional(),
  status: z.string().trim().min(1).max(50).default("PUBLISHED"),
  content: z.record(z.string(), z.unknown())
});

export const updatePageBodySchema = z.object({
  title: z.string().trim().max(255).optional(),
  status: z.string().trim().min(1).max(50).optional(),
  content: z.record(z.string(), z.unknown()).optional()
});

export const contentMutationBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1_000).optional()
});

export const createBannerBodySchema = z.object({
  placement: z.string().trim().min(1).max(80),
  status: z.string().trim().min(1).max(50).default("DRAFT"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  title: z.string().trim().max(255).optional(),
  mediaUrl: z.string().trim().url().optional(),
  mediaStorageProvider: z.string().trim().min(1).max(40).default("cloudinary"),
  mediaPublicId: z.string().trim().min(1).max(255).optional(),
  mediaResourceType: optionalResourceTypeSchema,
  mediaDeliveryType: optionalDeliveryTypeSchema,
  mediaMimeType: z.string().trim().max(120).optional(),
  mediaFileSizeBytes: z.coerce.number().int().min(0).optional(),
  mediaWidth: z.coerce.number().int().min(1).optional(),
  mediaHeight: z.coerce.number().int().min(1).optional(),
  mediaDurationSeconds: z.coerce.number().min(0).optional(),
  mediaOriginalFilename: z.string().trim().max(255).optional(),
  linkUrl: z.union([z.string().trim().url(), z.null()]).optional()
}).superRefine((value, context) => {
  if (value.mediaStorageProvider === "cloudinary" && value.mediaUrl && !value.mediaPublicId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mediaPublicId"],
      message: "mediaPublicId is required when mediaStorageProvider is cloudinary."
    });
  }
});

export const updateBannerBodySchema = z.object({
  placement: z.string().trim().min(1).max(80).optional(),
  status: z.string().trim().min(1).max(50).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  title: z.string().trim().max(255).optional(),
  mediaUrl: z.string().trim().url().optional(),
  mediaStorageProvider: z.string().trim().min(1).max(40).optional(),
  mediaPublicId: z.string().trim().min(1).max(255).optional(),
  mediaResourceType: optionalResourceTypeSchema,
  mediaDeliveryType: optionalDeliveryTypeSchema,
  mediaMimeType: z.string().trim().max(120).optional(),
  mediaFileSizeBytes: z.coerce.number().int().min(0).optional(),
  mediaWidth: z.coerce.number().int().min(1).optional(),
  mediaHeight: z.coerce.number().int().min(1).optional(),
  mediaDurationSeconds: z.coerce.number().min(0).optional(),
  mediaOriginalFilename: z.string().trim().max(255).optional(),
  linkUrl: z.union([z.string().trim().url(), z.null()]).optional()
});

export const contentMediaUploadIntentBodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  fileSizeBytes: z.coerce.number().int().min(1).optional(),
  resourceType: optionalResourceTypeSchema
});
