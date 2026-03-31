import { ProductStatus, VariantStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(150)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const optionalUuidSchema = z.string().uuid().nullable().optional();
const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");
const optionalMoneyAmountSchema = z.coerce.number().int().min(0).nullable().optional();
const optionalResourceTypeSchema = z.enum(["image", "video", "raw"]).optional();
const optionalDeliveryTypeSchema = z.enum(["upload", "private"]).optional();
const availabilityFilterSchema = z
  .enum(["in_stock", "low_stock", "out_of_stock", "available", "unavailable"])
  .optional();
const optionalCurrencySchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .nullable()
  .optional();
const reasonNoteSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1_000).optional()
});

/** Brand / category lifecycle (stored as string on taxonomy models). */
export const catalogTaxonomyStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const adminTaxonomyListQuerySchema = z.object({
  status: catalogTaxonomyStatusSchema.optional()
});

export const publicCatalogListQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  categorySlug: slugSchema.optional(),
  brandSlug: slugSchema.optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  availability: availabilityFilterSchema,
  sortBy: z.enum(["updatedAt", "createdAt", "title"]).default("updatedAt"),
  sortOrder: sortOrderSchema
});

export const publicSearchQuerySchema = paginationSchema.extend({
  page_size: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().min(1).max(200),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  availability: availabilityFilterSchema,
  sortBy: z.enum(["updatedAt", "createdAt", "title"]).default("updatedAt"),
  sortOrder: sortOrderSchema
});

export const adminCatalogListQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  dateFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(["updatedAt", "createdAt", "title", "status"]).default("updatedAt"),
  sortOrder: sortOrderSchema
});

export const productSlugParamsSchema = z.object({
  productSlug: slugSchema
});

export const categorySlugParamsSchema = z.object({
  categorySlug: slugSchema
});

export const brandSlugParamsSchema = z.object({
  brandSlug: slugSchema
});

export const productIdParamsSchema = z.object({
  productId: z.string().uuid()
});

export const adminProductAnalyticsQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).default("30d")
});

export const variantIdParamsSchema = z.object({
  variantId: z.string().uuid()
});

export const mediaIdParamsSchema = z.object({
  mediaId: z.string().uuid()
});

export const categoryIdParamsSchema = z.object({
  categoryId: z.string().uuid()
});

export const brandIdParamsSchema = z.object({
  brandId: z.string().uuid()
});

export const createProductBodySchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10_000).optional(),
  richDescription: z.string().trim().max(50_000).optional(),
  metaTitle: z.string().trim().max(255).optional(),
  metaDescription: z.string().trim().max(2000).optional(),
  scheduledPublishAt: z.coerce.date().optional(),
  brandId: optionalUuidSchema,
  categoryIds: z.array(z.string().uuid()).default([]),
  attributes: z.record(z.string(), z.unknown()).optional(),
  initialVariantSku: z.string().trim().min(1).max(120).optional()
});

export const updateProductBodySchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  richDescription: z.string().trim().max(50_000).nullable().optional(),
  metaTitle: z.string().trim().max(255).nullable().optional(),
  metaDescription: z.string().trim().max(2000).nullable().optional(),
  scheduledPublishAt: z.coerce.date().nullable().optional(),
  brandId: optionalUuidSchema,
  categoryIds: z.array(z.string().uuid()).optional(),
  merchandisingFeatured: z.boolean().optional(),
  merchandisingHomeHighlight: z.boolean().optional(),
  merchandisingSearchBoost: z.coerce.number().int().min(0).max(100).optional(),
  scheduledListPriceVariantId: z.string().uuid().nullable().optional(),
  scheduledListPriceAmountCents: optionalMoneyAmountSchema,
  scheduledListPriceCurrency: optionalCurrencySchema,
  scheduledPriceEffectiveAt: z.coerce.date().nullable().optional(),
  scheduledPriceNote: z.string().trim().max(500).nullable().optional()
});

export const bulkArchiveVariantsBodySchema = z.object({
  variantIds: z.array(z.string().uuid()).min(1).max(50)
});

export const applyScheduledPricingBodySchema = z.object({
  force: z.boolean().optional()
});

export const createVariantBodySchema = z
  .object({
    sku: z.string().trim().min(1).max(120),
    attributes: z.record(z.string(), z.unknown()).optional(),
    priceAmountCents: optionalMoneyAmountSchema,
    compareAtPriceAmountCents: optionalMoneyAmountSchema,
    costAmountCents: optionalMoneyAmountSchema,
    priceCurrency: optionalCurrencySchema,
    status: z.nativeEnum(VariantStatus).default(VariantStatus.ACTIVE)
  })
  .superRefine((value, context) => {
    if (value.compareAtPriceAmountCents != null && value.priceAmountCents == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compareAtPriceAmountCents"],
        message: "compareAtPriceAmountCents requires priceAmountCents."
      });
    }

    if ((value.priceAmountCents != null || value.compareAtPriceAmountCents != null) && !value.priceCurrency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceCurrency"],
        message: "priceCurrency is required when variant pricing is provided."
      });
    }

    if (
      value.compareAtPriceAmountCents != null &&
      value.priceAmountCents != null &&
      value.compareAtPriceAmountCents < value.priceAmountCents
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compareAtPriceAmountCents"],
        message: "compareAtPriceAmountCents must be greater than or equal to priceAmountCents."
      });
    }
  });

export const updateVariantBodySchema = z.object({
  sku: z.string().trim().min(1).max(120).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  priceAmountCents: optionalMoneyAmountSchema,
  compareAtPriceAmountCents: optionalMoneyAmountSchema,
  costAmountCents: optionalMoneyAmountSchema,
  priceCurrency: optionalCurrencySchema,
  status: z.nativeEnum(VariantStatus).optional()
});

export const createMediaBodySchema = z.object({
  url: z.string().url(),
  kind: z.string().trim().min(1).max(40),
  variantId: optionalUuidSchema,
  sortOrder: z.coerce.number().int().min(0).default(0),
  storageProvider: z.string().trim().min(1).max(40).default("cloudinary"),
  publicId: z.string().trim().min(1).max(255).optional(),
  resourceType: optionalResourceTypeSchema,
  deliveryType: optionalDeliveryTypeSchema,
  mimeType: z.string().trim().max(120).optional(),
  fileSizeBytes: z.coerce.number().int().min(0).optional(),
  width: z.coerce.number().int().min(1).optional(),
  height: z.coerce.number().int().min(1).optional(),
  durationSeconds: z.coerce.number().min(0).optional(),
  originalFilename: z.string().trim().max(255).optional()
}).superRefine((value, context) => {
  if (value.storageProvider === "cloudinary" && !value.publicId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publicId"],
      message: "publicId is required when storageProvider is cloudinary."
    });
  }
});

export const createMediaUploadIntentBodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  fileSizeBytes: z.coerce.number().int().min(1).optional(),
  variantId: optionalUuidSchema,
  resourceType: optionalResourceTypeSchema
});

const createTaxonomyStatusSchema = z.enum(["DRAFT", "ACTIVE"]).optional();

export const createCategoryBodySchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(120),
  /** Defaults to DRAFT so new categories are not public until published. */
  status: createTaxonomyStatusSchema
});

export const updateCategoryBodySchema = z.object({
  slug: slugSchema.optional(),
  name: z.string().trim().min(1).max(120).optional()
});

const optionalBrandBannerIdSchema = z.string().uuid().nullable().optional();
const optionalHttpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((s) => s.length === 0 || /^https?:\/\//i.test(s), "Must be an http(s) URL.")
  .optional();
const galleryImageUrlsSchema = z
  .array(
    z
      .string()
      .trim()
      .max(2048)
      .refine((s) => /^https?:\/\//i.test(s), "Each image must be an http(s) URL.")
  )
  .max(30)
  .optional();

export const createBrandBodySchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(120),
  status: createTaxonomyStatusSchema,
  bannerId: z.string().uuid().optional(),
  logoUrl: optionalHttpUrlSchema,
  galleryImageUrls: galleryImageUrlsSchema
});

export const updateBrandBodySchema = z.object({
  slug: slugSchema.optional(),
  name: z.string().trim().min(1).max(120).optional(),
  bannerId: optionalBrandBannerIdSchema,
  logoUrl: z
    .union([
      z
        .string()
        .trim()
        .max(2048)
        .refine((s) => s.length === 0 || /^https?:\/\//i.test(s), "Must be an http(s) URL."),
      z.null()
    ])
    .optional(),
  galleryImageUrls: z
    .array(
      z
        .string()
        .trim()
        .max(2048)
        .refine((s) => /^https?:\/\//i.test(s), "Each image must be an http(s) URL.")
    )
    .max(30)
    .nullable()
    .optional()
});

export const publicReviewsQuerySchema = paginationSchema;
export const productMutationBodySchema = reasonNoteSchema;

export const updateProductPricingBodySchema = z.object({
  variants: z
    .array(
      z
        .object({
          variantId: z.string().uuid(),
          priceAmountCents: optionalMoneyAmountSchema,
          compareAtPriceAmountCents: optionalMoneyAmountSchema,
          costAmountCents: optionalMoneyAmountSchema,
          priceCurrency: optionalCurrencySchema
        })
        .superRefine((value, context) => {
          if (value.compareAtPriceAmountCents != null && value.priceAmountCents == null) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["compareAtPriceAmountCents"],
              message: "compareAtPriceAmountCents requires priceAmountCents."
            });
          }

          if (
            (value.priceAmountCents != null || value.compareAtPriceAmountCents != null) &&
            !value.priceCurrency
          ) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["priceCurrency"],
              message: "priceCurrency is required when variant pricing is provided."
            });
          }

          if (
            value.compareAtPriceAmountCents != null &&
            value.priceAmountCents != null &&
            value.compareAtPriceAmountCents < value.priceAmountCents
          ) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["compareAtPriceAmountCents"],
              message: "compareAtPriceAmountCents must be greater than or equal to priceAmountCents."
            });
          }
        })
    )
    .min(1)
});

export const reorderProductMediaBodySchema = z.object({
  items: z
    .array(
      z.object({
        mediaId: z.string().uuid(),
        sortOrder: z.coerce.number().int().min(0)
      })
    )
    .min(1)
});

export const updateProductMediaBodySchema = z.object({
  variantId: z.union([z.string().uuid(), z.null()]).optional()
});
