import { z } from "zod";

const optionalResourceTypeSchema = z.enum(["image", "video", "raw"]).optional();
const optionalDeliveryTypeSchema = z.enum(["upload", "private"]).optional();
const internalHrefSchema = z.string().trim().min(1).max(255);
const imageUrlSchema = z.string().trim().url().max(2_000);

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

const sectionHeaderInputSchema = z.object({
  isVisible: z.boolean(),
  eyebrow: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(600),
  ctaLabel: z.union([z.string().trim().min(1).max(80), z.null()]).optional(),
  ctaHref: z.union([internalHrefSchema, z.null()]).optional()
});

const homepageTrustBadgeInputSchema = z.object({
  iconName: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().min(1).max(160),
  href: z.union([internalHrefSchema, z.null()]).optional(),
  ariaLabel: z.union([z.string().trim().min(1).max(255), z.null()]).optional()
});

const homepageCategoryTileInputSchema = z.object({
  categoryId: z.union([z.string().uuid(), z.null()]).optional(),
  slug: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(200),
  imageUrl: imageUrlSchema
});

const homepageFeaturedProductInputSchema = z.object({
  productId: z.string().uuid()
});

const productIdsSchema = z.array(z.string().uuid()).max(6);

const homepageBrandSpotlightInputSchema = z.object({
  brandId: z.union([z.string().uuid(), z.null()]).optional(),
  slug: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  tagline: z.string().trim().min(1).max(255),
  heroImageUrl: imageUrlSchema,
  ctaLabel: z.string().trim().min(1).max(80),
  productIds: productIdsSchema
});

const homepageCampaignSpotlightInputSchema = z.object({
  campaignId: z.union([z.string().uuid(), z.null()]).optional(),
  slug: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().min(1).max(255),
  heroImageUrl: imageUrlSchema,
  label: z.string().trim().min(1).max(80),
  ctaLabel: z.string().trim().min(1).max(80),
  layout: z.enum(["FEATURE", "SPLIT"]),
  productIds: productIdsSchema
});

const homepagePromoOfferInputSchema = z.object({
  badge: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(40),
  headline: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(400),
  terms: z.string().trim().min(1).max(400),
  bannerImageUrl: imageUrlSchema,
  ctaLabel: z.string().trim().min(1).max(80),
  ctaHref: internalHrefSchema,
  productIds: productIdsSchema
});

const homepageTestimonialInputSchema = z.object({
  quote: z.string().trim().min(1).max(600),
  customerName: z.string().trim().min(1).max(120),
  imageUrl: imageUrlSchema,
  statusLabel: z.union([z.string().trim().min(1).max(80), z.null()]).optional()
});

export const updateHomepageDraftBodySchema = z.object({
  hero: z.object({
    eyebrow: z.string().trim().min(1).max(80),
    titlePrefix: z.string().trim().min(1).max(120),
    titleAccent: z.union([z.string().trim().min(1).max(120), z.null()]).optional(),
    titleSuffix: z.union([z.string().trim().min(1).max(40), z.null()]).optional(),
    body: z.string().trim().min(1).max(500),
    primaryCtaLabel: z.string().trim().min(1).max(80),
    primaryCtaHref: internalHrefSchema,
    backgroundImageUrl: imageUrlSchema,
    backgroundImageAlt: z.union([z.string().trim().min(1).max(255), z.null()]).optional()
  }),
  sectionHeaders: z.object({
    category: sectionHeaderInputSchema,
    featured: sectionHeaderInputSchema,
    brand: sectionHeaderInputSchema,
    campaign: sectionHeaderInputSchema,
    promo: sectionHeaderInputSchema,
    testimonial: sectionHeaderInputSchema
  }),
  trustBadges: z.array(homepageTrustBadgeInputSchema).max(8),
  categoryTiles: z.array(homepageCategoryTileInputSchema).max(8),
  featuredProducts: z.array(homepageFeaturedProductInputSchema).max(12),
  brandSpotlights: z.array(homepageBrandSpotlightInputSchema).max(6),
  campaignSpotlights: z.array(homepageCampaignSpotlightInputSchema).max(4),
  promoOffers: z.array(homepagePromoOfferInputSchema).max(6),
  testimonials: z.array(homepageTestimonialInputSchema).max(6)
});
