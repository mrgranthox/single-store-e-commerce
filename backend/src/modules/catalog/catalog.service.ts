import type { Job } from "bullmq";
import {
  PaymentState,
  Prisma,
  ProductStatus,
  RefundState,
  ReviewStatus,
  ReturnStatus,
  VariantStatus
} from "@prisma/client";

import {
  conflictError,
  invalidInputError,
  invalidStateTransitionError,
  notFoundError
} from "../../common/errors/app-error";
import {
  buildPagination,
  buildPaginationPayload,
  type PaginationInput
} from "../../common/http/pagination";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import {
  createSignedUploadIntent,
  destroyCloudinaryAsset,
  resolveCloudinaryAsset
} from "../../config/cloudinary";
import { prisma } from "../../config/prisma";

type BrandShape = {
  id: string;
  slug: string;
  name: string;
  status: string;
  bannerId?: string | null;
  logoUrl?: string | null;
  galleryImageUrls?: string[];
} | null;

type CategoryShape = {
  category: {
    id: string;
    slug: string;
    name: string;
    status: string;
  };
};

type InventoryStockShape = {
  id: string;
  onHand: number;
  reserved: number;
  reorderLevel: number;
  warehouse?: {
    id: string;
    code: string;
    name: string;
  } | null;
};

type MediaShape = {
  id: string;
  url: string;
  storageProvider: string;
  publicId: string | null;
  resourceType: string | null;
  deliveryType: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  originalFilename: string | null;
  kind: string;
  sortOrder: number;
  variantId: string | null;
};

type VariantShape = {
  id: string;
  sku: string;
  attributes: Prisma.JsonValue | null;
  priceAmountCents: number | null;
  compareAtPriceAmountCents: number | null;
  costAmountCents: number | null;
  priceCurrency: string | null;
  status: string;
  media: MediaShape[];
  inventoryStocks: InventoryStockShape[];
};

type ReviewShape = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: Date;
  user: {
    firstName: string | null;
    lastName: string | null;
  } | null;
};

type ProductShape = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  richDescription: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  scheduledPublishAt: Date | null;
  merchandisingFeatured: boolean;
  merchandisingHomeHighlight: boolean;
  merchandisingSearchBoost: number;
  scheduledListPriceVariantId: string | null;
  scheduledListPriceAmountCents: number | null;
  scheduledListPriceCurrency: string | null;
  scheduledPriceEffectiveAt: Date | null;
  scheduledPriceNote: string | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  brand: BrandShape;
  categories: CategoryShape[];
  media: MediaShape[];
  variants: VariantShape[];
  reviews?: ReviewShape[];
};

const productListInclude = {
  brand: true,
  categories: {
    include: {
      category: true
    }
  },
  media: {
    orderBy: {
      sortOrder: "asc" as const
    }
  },
  variants: {
    where: {
      status: "ACTIVE"
    },
    include: {
      media: {
        orderBy: {
          sortOrder: "asc" as const
        }
      },
      inventoryStocks: true
    }
  },
  reviews: {
    where: {
      status: ReviewStatus.PUBLISHED
    },
    select: {
      id: true,
      rating: true,
      body: true,
      createdAt: true,
      user: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  }
} satisfies Prisma.ProductInclude;

/** Admin list + detail: include every variant status for accurate SKU and stock signals. */
const adminCatalogProductInclude = {
  brand: true,
  categories: {
    include: {
      category: true
    }
  },
  media: {
    orderBy: {
      sortOrder: "asc" as const
    }
  },
  variants: {
    include: {
      media: {
        orderBy: {
          sortOrder: "asc" as const
        }
      },
      inventoryStocks: {
        include: {
          warehouse: true
        }
      }
    }
  },
  reviews: productListInclude.reviews
} satisfies Prisma.ProductInclude;

const buildDateRangeFilter = (dateFrom?: string, dateTo?: string) => {
  if (!dateFrom && !dateTo) {
    return undefined;
  }

  return {
    gte: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined,
    lte: dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined
  };
};

const formatVariantOptionLabel = (attributes: Prisma.JsonValue | null | undefined): string => {
  if (attributes == null || typeof attributes !== "object" || Array.isArray(attributes)) {
    return "Default";
  }

  const record = attributes as Record<string, unknown>;
  const entries = Object.entries(record).filter(
    ([, value]) => value != null && String(value).trim() !== ""
  );

  if (entries.length === 0) {
    return "Default";
  }

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
};

const deriveInventorySummary = (variants: VariantShape[]) => {
  const totals = variants.flatMap((variant) => variant.inventoryStocks).reduce(
    (summary, stock) => {
      const available = stock.onHand - stock.reserved;

      return {
        onHand: summary.onHand + stock.onHand,
        reserved: summary.reserved + stock.reserved,
        available: summary.available + available,
        lowStock: summary.lowStock || (available > 0 && available <= stock.reorderLevel)
      };
    },
    { onHand: 0, reserved: 0, available: 0, lowStock: false }
  );

  return totals;
};

const deriveReviewSummary = (reviews: ReviewShape[] = []) => {
  if (reviews.length === 0) {
    return {
      averageRating: null,
      totalReviews: 0
    };
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);

  return {
    averageRating: Number((totalRating / reviews.length).toFixed(2)),
    totalReviews: reviews.length
  };
};

const serializeVariantPricing = (variant: VariantShape) =>
  variant.priceAmountCents != null && variant.priceCurrency
    ? {
        amountCents: variant.priceAmountCents,
        currency: variant.priceCurrency,
        compareAtAmountCents: variant.compareAtPriceAmountCents
      }
    : null;

const deriveProductPricing = (variants: VariantShape[]) => {
  const pricedVariants = variants.filter(
    (variant) => variant.priceAmountCents != null && variant.priceCurrency
  );

  if (pricedVariants.length === 0) {
    return null;
  }

  const primaryVariant = pricedVariants[0]!;
  const amountValues = pricedVariants
    .map((variant) => variant.priceAmountCents)
    .filter((value): value is number => value != null);

  return {
    currency: primaryVariant.priceCurrency,
    amountCents: primaryVariant.priceAmountCents,
    compareAtAmountCents: primaryVariant.compareAtPriceAmountCents,
    minAmountCents: Math.min(...amountValues),
    maxAmountCents: Math.max(...amountValues)
  };
};

const deriveReorderThresholdSummary = (variants: VariantShape[]) => {
  const levels = variants.flatMap((variant) =>
    variant.inventoryStocks.map((stock) => stock.reorderLevel)
  );

  if (levels.length === 0) {
    return {
      minReorderLevel: null as number | null,
      maxReorderLevel: null as number | null
    };
  }

  return {
    minReorderLevel: Math.min(...levels),
    maxReorderLevel: Math.max(...levels)
  };
};

const deriveAdminCostMarginSummary = (
  variants: VariantShape[],
  pricing: ReturnType<typeof deriveProductPricing>
) => {
  if (!pricing) {
    return {
      minCostCents: null as number | null,
      maxCostCents: null as number | null,
      marginPercent: null as number | null,
      marginBasis: "primary_variant" as const,
      currency: null as string | null
    };
  }

  const pricedVariants = variants.filter(
    (variant) => variant.priceAmountCents != null && variant.priceCurrency
  );

  const costValues = variants
    .map((variant) => variant.costAmountCents)
    .filter((value): value is number => value != null);

  const minCost = costValues.length > 0 ? Math.min(...costValues) : null;
  const maxCost = costValues.length > 0 ? Math.max(...costValues) : null;

  const primary = pricedVariants[0];
  let marginPercent: number | null = null;

  if (
    primary &&
    primary.costAmountCents != null &&
    primary.priceAmountCents != null &&
    primary.priceAmountCents > 0
  ) {
    marginPercent = Number(
      (
        ((primary.priceAmountCents - primary.costAmountCents) / primary.priceAmountCents) *
        100
      ).toFixed(1)
    );
  }

  return {
    minCostCents: minCost,
    maxCostCents: maxCost,
    marginPercent,
    marginBasis: "primary_variant" as const,
    currency: pricing.currency
  };
};

const serializeBrand = (brand: BrandShape) =>
  brand
    ? {
        id: brand.id,
        slug: brand.slug,
        name: brand.name,
        status: brand.status,
        ...(brand.logoUrl ? { logoUrl: brand.logoUrl } : {}),
        ...(brand.galleryImageUrls && brand.galleryImageUrls.length > 0
          ? { imageUrls: brand.galleryImageUrls }
          : {}),
        ...(brand.bannerId ? { linkedBannerId: brand.bannerId } : {})
      }
    : null;

const serializeCategories = (categories: CategoryShape[]) =>
  categories.map((entry) => ({
    id: entry.category.id,
    slug: entry.category.slug,
    name: entry.category.name,
    status: entry.category.status
  }));

const selectPrimaryMedia = (product: ProductShape) => {
  const variantMedia = product.variants.flatMap((variant) => variant.media);
  return [...product.media, ...variantMedia][0] ?? null;
};

const serializeMediaAsset = (media: MediaShape) => ({
  id: media.id,
  url: media.url,
  storageProvider: media.storageProvider,
  publicId: media.publicId,
  resourceType: media.resourceType,
  deliveryType: media.deliveryType,
  mimeType: media.mimeType,
  fileSizeBytes: media.fileSizeBytes,
  width: media.width,
  height: media.height,
  durationSeconds: media.durationSeconds,
  originalFilename: media.originalFilename,
  kind: media.kind,
  sortOrder: media.sortOrder,
  variantId: media.variantId
});

// TODO(platform-spec): The approved schema currently has no dedicated pricing columns.
const serializePublicProductCard = (product: ProductShape) => {
  const inventory = deriveInventorySummary(product.variants);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    brand: serializeBrand(product.brand),
    categories: serializeCategories(product.categories),
    primaryMedia: selectPrimaryMedia(product),
    pricing: deriveProductPricing(product.variants),
    availability: {
      inStock: inventory.available > 0,
      availableQuantity: inventory.available,
      lowStock: inventory.lowStock
    },
    reviewSummary: deriveReviewSummary(product.reviews)
  };
};

const serializeAdminProductListItem = (product: ProductShape) => {
  const inventory = deriveInventorySummary(product.variants);
  const pricing = deriveProductPricing(product.variants);
  const primaryMedia = selectPrimaryMedia(product);
  const activeVariants = product.variants.filter((variant) => variant.status === "ACTIVE");
  const primaryVariant = activeVariants[0] ?? product.variants[0];
  const categories = serializeCategories(product.categories);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    status: product.status,
    updatedAt: product.updatedAt,
    thumbnailUrl: primaryMedia?.url ?? null,
    primarySku: primaryVariant?.sku ?? null,
    categoryLabels: categories.map((c) => c.name),
    brand: product.brand
      ? {
          id: product.brand.id,
          name: product.brand.name
        }
      : null,
    pricing,
    visibility:
      product.status === ProductStatus.PUBLISHED
        ? "Public"
        : product.status === ProductStatus.ARCHIVED
          ? "Hidden"
          : "Private",
    inventorySummary: {
      onHand: inventory.onHand,
      reserved: inventory.reserved,
      available: inventory.available,
      lowStock: inventory.lowStock
    }
  };
};

const serializeVariant = (
  variant: VariantShape,
  fallbackMedia: MediaShape[],
  options: { exposeCost?: boolean } = {}
) => {
  const inventory = deriveInventorySummary([{ ...variant }]);

  return {
    id: variant.id,
    sku: variant.sku,
    status: variant.status,
    attributes: variant.attributes,
    media: (variant.media.length > 0 ? variant.media : fallbackMedia).map(serializeMediaAsset),
    pricing: serializeVariantPricing(variant),
    availability: {
      inStock: inventory.available > 0,
      availableQuantity: inventory.available,
      lowStock: inventory.lowStock
    },
    ...(options.exposeCost ? { costAmountCents: variant.costAmountCents } : {})
  };
};

const serializePublicProductDetail = (product: ProductShape, relatedProducts: ProductShape[]) => {
  const inventory = deriveInventorySummary(product.variants);
  const reviewSummary = deriveReviewSummary(product.reviews);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    brand: serializeBrand(product.brand),
    categories: serializeCategories(product.categories),
    media: product.media.map(serializeMediaAsset),
    variants: product.variants.map((variant) => serializeVariant(variant, product.media)),
    pricing: deriveProductPricing(product.variants),
    eligibility: {
      canPurchase: inventory.available > 0
    },
    availability: {
      inStock: inventory.available > 0,
      availableQuantity: inventory.available,
      lowStock: inventory.lowStock,
      message:
        inventory.available > 0
          ? inventory.lowStock
            ? "Low stock available."
            : "In stock."
          : "Out of stock."
    },
    reviewSummary,
    relatedProducts: relatedProducts.map(serializePublicProductCard),
    supportInquiryContext: {
      productId: product.id,
      productSlug: product.slug,
      productTitle: product.title
    }
  };
};

const serializeAdminProductDetail = (product: ProductShape) => {
  const inventory = deriveInventorySummary(product.variants);
  const pricing = deriveProductPricing(product.variants);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    richDescription: product.richDescription,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    scheduledPublishAt: product.scheduledPublishAt,
    merchandising: {
      featured: product.merchandisingFeatured,
      homeHighlight: product.merchandisingHomeHighlight,
      searchBoost: product.merchandisingSearchBoost
    },
    scheduledPricing: {
      variantId: product.scheduledListPriceVariantId,
      listPriceAmountCents: product.scheduledListPriceAmountCents,
      listPriceCurrency: product.scheduledListPriceCurrency,
      effectiveAt: product.scheduledPriceEffectiveAt,
      note: product.scheduledPriceNote
    },
    status: product.status,
    brand: serializeBrand(product.brand),
    categories: serializeCategories(product.categories),
    media: product.media.map(serializeMediaAsset),
    variants: product.variants.map((variant) => serializeVariant(variant, product.media, { exposeCost: true })),
    inventorySummary: inventory,
    pricing,
    reorderThresholdSummary: deriveReorderThresholdSummary(product.variants),
    costMarginSummary: deriveAdminCostMarginSummary(product.variants, pricing),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
};

const matchesPublicPricingFilter = (
  pricing: ReturnType<typeof deriveProductPricing>,
  input: {
    minPrice?: number;
    maxPrice?: number;
  }
) => {
  if (input.minPrice == null && input.maxPrice == null) {
    return true;
  }

  if (!pricing) {
    return false;
  }

  if (input.minPrice != null && pricing.maxAmountCents < input.minPrice) {
    return false;
  }

  if (input.maxPrice != null && pricing.minAmountCents > input.maxPrice) {
    return false;
  }

  return true;
};

const matchesPublicRatingFilter = (
  reviewSummary: ReturnType<typeof deriveReviewSummary>,
  rating?: number
) => {
  if (rating == null) {
    return true;
  }

  return reviewSummary.averageRating != null && reviewSummary.averageRating >= rating;
};

const matchesPublicAvailabilityFilter = (
  inventory: ReturnType<typeof deriveInventorySummary>,
  availability?: "in_stock" | "low_stock" | "out_of_stock" | "available" | "unavailable"
) => {
  if (!availability) {
    return true;
  }

  switch (availability) {
    case "low_stock":
      return inventory.available > 0 && inventory.lowStock;
    case "out_of_stock":
    case "unavailable":
      return inventory.available <= 0;
    case "in_stock":
    case "available":
    default:
      return inventory.available > 0;
  }
};

const assertCategoryIdsExist = async (
  categoryIds: string[],
  transaction: Prisma.TransactionClient | typeof prisma = prisma
) => {
  if (categoryIds.length === 0) {
    return;
  }

  const uniqueCategoryIds = [...new Set(categoryIds)];
  const count = await transaction.category.count({
    where: {
      id: {
        in: uniqueCategoryIds
      },
      status: "ACTIVE"
    }
  });

  if (count !== uniqueCategoryIds.length) {
    throw invalidInputError("One or more category ids are invalid or not active for merchandising.");
  }
};

const assertBrandExists = async (
  brandId: string | null | undefined,
  transaction: Prisma.TransactionClient | typeof prisma = prisma
) => {
  if (!brandId) {
    return;
  }

  const brand = await transaction.brand.findUnique({
    where: {
      id: brandId
    }
  });

  if (!brand) {
    throw invalidInputError("The supplied brand id is invalid.");
  }

  if (brand.status !== "ACTIVE") {
    throw invalidInputError("The brand must be active before it can be assigned to products.");
  }
};

const createProductCategories = async (
  transaction: Prisma.TransactionClient,
  productId: string,
  categoryIds: string[]
) => {
  if (categoryIds.length === 0) {
    return;
  }

  await transaction.productCategory.createMany({
    data: [...new Set(categoryIds)].map((categoryId) => ({
      productId,
      categoryId
    })),
    skipDuplicates: true
  });
};

const replaceProductCategories = async (
  transaction: Prisma.TransactionClient,
  productId: string,
  categoryIds: string[]
) => {
  await transaction.productCategory.deleteMany({
    where: {
      productId
    }
  });

  await createProductCategories(transaction, productId, categoryIds);
};

const recordCatalogMutation = async (
  transaction: Prisma.TransactionClient,
  input: {
    actorAdminUserId: string;
    actionCode: string;
    entityType: string;
    entityId: string;
    reason?: string;
    note?: string;
    before?: unknown;
    after?: unknown;
    eventType: string;
  }
) => {
  await Promise.all([
    transaction.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason,
        note: input.note,
        before: toPrismaJsonValue(input.before),
        after: toPrismaJsonValue(input.after)
      }
    }),
    transaction.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorAdminUserId: input.actorAdminUserId,
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason,
        note: input.note,
        metadata: toPrismaJsonValue({
          actionCode: input.actionCode,
          eventType: input.eventType
        })
      }
    }),
    transaction.timelineEvent.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.eventType,
        actorAdminUserId: input.actorAdminUserId,
        actorType: "ADMIN",
        payload: toPrismaJsonValue({
          reason: input.reason,
          note: input.note
        })
      }
    })
  ]);
};

const recordSystemCatalogMutation = async (
  transaction: Prisma.TransactionClient,
  input: {
    actionCode: string;
    entityId: string;
    eventType: string;
    before?: unknown;
    after?: unknown;
    metadata?: Record<string, unknown>;
  }
) => {
  await Promise.all([
    transaction.auditLog.create({
      data: {
        actorType: "SYSTEM",
        actionCode: input.actionCode,
        entityType: "PRODUCT",
        entityId: input.entityId,
        metadata: toPrismaJsonValue({
          before: input.before,
          after: input.after,
          ...(input.metadata ?? {})
        })
      }
    }),
    transaction.timelineEvent.create({
      data: {
        entityType: "PRODUCT",
        entityId: input.entityId,
        eventType: input.eventType,
        actorType: "SYSTEM",
        payload: toPrismaJsonValue({
          after: input.after,
          ...(input.metadata ?? {})
        })
      }
    })
  ]);
};

const mapPrismaWriteError = (error: unknown, entityName: string) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw conflictError(`A ${entityName} with the same unique field already exists.`, error.meta);
    }

    if (error.code === "P2025") {
      throw notFoundError(`The requested ${entityName} was not found.`);
    }
  }

  throw error;
};

const getProductByIdOrThrow = async (
  productId: string,
  publishedOnly = false,
  options: { adminCatalogInclude?: boolean } = {}
) => {
  const include = options.adminCatalogInclude ? adminCatalogProductInclude : productListInclude;

  const product = publishedOnly
    ? await prisma.product.findFirst({
        where: {
          id: productId,
          status: ProductStatus.PUBLISHED
        },
        include: productListInclude
      })
    : await prisma.product.findUnique({
        where: {
          id: productId
        },
        include
      });

  if (!product) {
    throw notFoundError("The requested product was not found.");
  }

  return product as ProductShape;
};

const getProductBySlugOrThrow = async (productSlug: string) => {
  const product = await prisma.product.findFirst({
    where: {
      slug: productSlug,
      status: ProductStatus.PUBLISHED
    },
    include: productListInclude
  });

  if (!product) {
    throw notFoundError("The requested product was not found.");
  }

  return product as ProductShape;
};

export const listPublicProducts = async (
  input: PaginationInput & {
    q?: string;
    categorySlug?: string;
    brandSlug?: string;
    categoryId?: string;
    brandId?: string;
    minPrice?: number;
    maxPrice?: number;
    rating?: number;
    availability?: "in_stock" | "low_stock" | "out_of_stock" | "available" | "unavailable";
    sortBy: "updatedAt" | "createdAt" | "title";
    sortOrder: "asc" | "desc";
  }
) => {
  const where: Prisma.ProductWhereInput = {
    status: ProductStatus.PUBLISHED,
    ...(input.q
      ? {
          OR: [
            {
              title: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              description: {
                contains: input.q,
                mode: "insensitive"
              }
            }
          ]
        }
      : {}),
    ...(input.categorySlug
      ? {
          categories: {
            some: {
              category: {
                slug: input.categorySlug,
                status: "ACTIVE"
              }
            }
          }
        }
      : {}),
    ...(input.categoryId
      ? {
          categories: {
            some: {
              categoryId: input.categoryId
            }
          }
        }
      : {}),
    ...(input.brandSlug
      ? {
          brand: {
            slug: input.brandSlug,
            status: "ACTIVE"
          }
        }
      : {}),
    ...(input.brandId
      ? {
          brandId: input.brandId
        }
      : {})
  };

  const products = (await prisma.product.findMany({
    where,
    include: productListInclude,
    orderBy: {
      [input.sortBy]: input.sortOrder
    }
  })) as ProductShape[];

  const filteredProducts = products.filter((product) => {
    const inventory = deriveInventorySummary(product.variants);
    const pricing = deriveProductPricing(product.variants);
    const reviewSummary = deriveReviewSummary(product.reviews);

    return (
      matchesPublicPricingFilter(pricing, input) &&
      matchesPublicRatingFilter(reviewSummary, input.rating) &&
      matchesPublicAvailabilityFilter(inventory, input.availability)
    );
  });

  const pagination = buildPagination(input);
  const paginatedProducts = filteredProducts.slice(
    pagination.skip,
    pagination.skip + pagination.take
  );

  return {
    items: paginatedProducts.map((product) => serializePublicProductCard(product)),
    pagination: buildPaginationPayload(input, filteredProducts.length)
  };
};

export const getPublicProductDetail = async (productSlug: string) => {
  const product = await getProductBySlugOrThrow(productSlug);
  const categoryIds = product.categories.map((entry) => entry.category.id);

  const relatedProducts = categoryIds.length
    ? ((await prisma.product.findMany({
        where: {
          status: ProductStatus.PUBLISHED,
          id: {
            not: product.id
          },
          categories: {
            some: {
              categoryId: {
                in: categoryIds
              }
            }
          }
        },
        include: productListInclude,
        take: 4,
        orderBy: {
          updatedAt: "desc"
        }
      })) as ProductShape[])
    : [];

  return serializePublicProductDetail(product, relatedProducts);
};

export const listCatalogCategories = async () => {
  const categories = await prisma.category.findMany({
    where: {
      status: "ACTIVE"
    },
    orderBy: {
      name: "asc"
    },
    include: {
      _count: {
        select: {
          products: true
        }
      }
    }
  });

  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    status: category.status,
    productCount: category._count.products
  }));
};

export const getCategoryCatalogView = async (
  categorySlug: string,
  input: PaginationInput & {
    q?: string;
    sortBy: "updatedAt" | "createdAt" | "title";
    sortOrder: "asc" | "desc";
  }
) => {
  const category = await prisma.category.findUnique({
    where: {
      slug: categorySlug
    }
  });

  if (!category || category.status !== "ACTIVE") {
    throw notFoundError("The requested category was not found.");
  }

  const result = await listPublicProducts({
    ...input,
    categorySlug
  });

  return {
    category,
    ...result
  };
};

export const getBrandCatalogView = async (
  brandSlug: string,
  input: PaginationInput & {
    q?: string;
    sortBy: "updatedAt" | "createdAt" | "title";
    sortOrder: "asc" | "desc";
  }
) => {
  const brand = await prisma.brand.findUnique({
    where: {
      slug: brandSlug
    },
    include: {
      linkedBanner: {
        select: {
          id: true,
          title: true,
          mediaUrl: true,
          linkUrl: true,
          placement: true,
          status: true
        }
      }
    }
  });

  if (!brand || brand.status !== "ACTIVE") {
    throw notFoundError("The requested brand was not found.");
  }

  const result = await listPublicProducts({
    ...input,
    brandSlug
  });

  const { linkedBanner, ...brandScalars } = brand;

  return {
    brand: {
      ...brandScalars,
      linkedBanner:
        linkedBanner && linkedBanner.status?.toUpperCase() === "PUBLISHED" ? linkedBanner : null
    },
    ...result
  };
};

export const listPublicProductReviews = async (productSlug: string, input: PaginationInput) => {
  const product = await prisma.product.findFirst({
    where: {
      slug: productSlug,
      status: ProductStatus.PUBLISHED
    }
  });

  if (!product) {
    throw notFoundError("The requested product was not found.");
  }

  const where: Prisma.ReviewWhereInput = {
    productId: product.id,
    status: ReviewStatus.PUBLISHED
  };

  const [reviews, totalItems] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      ...buildPagination(input)
    }),
    prisma.review.count({ where })
  ]);

  return {
    items: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      body: review.body,
      createdAt: review.createdAt,
      authorName:
        review.user?.firstName || review.user?.lastName
          ? [review.user?.firstName, review.user?.lastName].filter(Boolean).join(" ")
          : "Anonymous"
    })),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const listAdminProducts = async (
  input: PaginationInput & {
    q?: string;
    status?: ProductStatus;
    categoryId?: string;
    brandId?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy: "updatedAt" | "createdAt" | "title" | "status";
    sortOrder: "asc" | "desc";
  }
) => {
  const where: Prisma.ProductWhereInput = {
    ...(input.q
      ? {
          OR: [
            {
              title: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              slug: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              variants: {
                some: {
                  sku: {
                    contains: input.q,
                    mode: "insensitive"
                  }
                }
              }
            }
          ]
        }
      : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.brandId ? { brandId: input.brandId } : {}),
    ...(input.categoryId
      ? {
          categories: {
            some: {
              categoryId: input.categoryId
            }
          }
        }
      : {}),
    ...(buildDateRangeFilter(input.dateFrom, input.dateTo)
      ? {
          updatedAt: buildDateRangeFilter(input.dateFrom, input.dateTo)
        }
      : {})
  };

  const [products, totalItems] = await Promise.all([
    prisma.product.findMany({
      where,
      include: adminCatalogProductInclude,
      orderBy: {
        [input.sortBy]: input.sortOrder
      },
      ...buildPagination(input)
    }),
    prisma.product.count({ where })
  ]);

  return {
    items: products.map((product) => serializeAdminProductListItem(product as ProductShape)),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAdminProductDetail = async (productId: string) => {
  const product = await getProductByIdOrThrow(productId, false, { adminCatalogInclude: true });
  const base = serializeAdminProductDetail(product);

  const [reviewCount, reviewAvg, recentReviewsRaw] = await Promise.all([
    prisma.review.count({ where: { productId } }),
    prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true }
    }),
    prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        rating: true,
        body: true,
        status: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } }
      }
    })
  ]);

  const avgRating = reviewAvg._avg.rating;

  return {
    ...base,
    reviewSummary: {
      averageRating:
        avgRating != null && reviewCount > 0 ? Number(Number(avgRating).toFixed(2)) : null,
      totalReviews: reviewCount
    },
    recentReviews: recentReviewsRaw.map((r) => ({
      id: r.id,
      rating: r.rating,
      bodySnippet: (r.body ?? "").slice(0, 120),
      status: r.status,
      createdAt: r.createdAt,
      authorName:
        [r.user?.firstName, r.user?.lastName].filter(Boolean).join(" ") || "Anonymous"
    }))
  };
};

export const createAdminProduct = async (input: {
  actorAdminUserId: string;
  slug: string;
  title: string;
  description?: string;
  richDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  scheduledPublishAt?: Date;
  brandId?: string | null;
  categoryIds: string[];
  attributes?: Record<string, unknown>;
  initialVariantSku?: string;
}) => {
  if (input.attributes && !input.initialVariantSku) {
    throw invalidInputError(
      "Variant attributes require initialVariantSku because attributes are variant-level in the approved schema."
    );
  }

  try {
    return await runInTransaction(async (transaction) => {
      await assertBrandExists(input.brandId, transaction);
      await assertCategoryIdsExist(input.categoryIds, transaction);

      const product = await transaction.product.create({
        data: {
          slug: input.slug,
          title: input.title,
          description: input.description,
          richDescription: input.richDescription ?? null,
          metaTitle: input.metaTitle ?? null,
          metaDescription: input.metaDescription ?? null,
          scheduledPublishAt: input.scheduledPublishAt ?? null,
          brandId: input.brandId ?? null
        }
      });

      await createProductCategories(transaction, product.id, input.categoryIds);

      if (input.initialVariantSku) {
        await transaction.productVariant.create({
          data: {
            productId: product.id,
            sku: input.initialVariantSku,
            attributes: toPrismaJsonValue(input.attributes) ?? Prisma.JsonNull
          }
        });
      }

      await recordCatalogMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "catalog.products.create",
        entityType: "PRODUCT",
        entityId: product.id,
        before: null,
        after: {
          slug: product.slug,
          title: product.title
        },
        eventType: "PRODUCT_CREATED"
      });

      return {
        id: product.id
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "product");
  }
};

export const updateAdminProduct = async (input: {
  actorAdminUserId: string;
  productId: string;
  title?: string;
  description?: string | null;
  richDescription?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  scheduledPublishAt?: Date | null;
  brandId?: string | null;
  categoryIds?: string[];
  merchandisingFeatured?: boolean;
  merchandisingHomeHighlight?: boolean;
  merchandisingSearchBoost?: number;
  scheduledListPriceVariantId?: string | null;
  scheduledListPriceAmountCents?: number | null;
  scheduledListPriceCurrency?: string | null;
  scheduledPriceEffectiveAt?: Date | null;
  scheduledPriceNote?: string | null;
}) => {
  try {
    return await runInTransaction(async (transaction) => {
      const existingProduct = await transaction.product.findUnique({
        where: {
          id: input.productId
        },
        include: {
          categories: true
        }
      });

      if (!existingProduct) {
        throw notFoundError("The requested product was not found.");
      }

      await assertBrandExists(input.brandId, transaction);

      if (input.categoryIds) {
        await assertCategoryIdsExist(input.categoryIds, transaction);
      }

      const data: Prisma.ProductUncheckedUpdateInput = {};

      if (input.title !== undefined) {
        data.title = input.title;
      }

      if (input.description !== undefined) {
        data.description = input.description;
      }

      if (input.richDescription !== undefined) {
        data.richDescription = input.richDescription;
      }

      if (input.metaTitle !== undefined) {
        data.metaTitle = input.metaTitle;
      }

      if (input.metaDescription !== undefined) {
        data.metaDescription = input.metaDescription;
      }

      if (input.scheduledPublishAt !== undefined) {
        data.scheduledPublishAt = input.scheduledPublishAt;
      }

      if (input.merchandisingFeatured !== undefined) {
        data.merchandisingFeatured = input.merchandisingFeatured;
      }

      if (input.merchandisingHomeHighlight !== undefined) {
        data.merchandisingHomeHighlight = input.merchandisingHomeHighlight;
      }

      if (input.merchandisingSearchBoost !== undefined) {
        data.merchandisingSearchBoost = input.merchandisingSearchBoost;
      }

      if (input.scheduledListPriceVariantId !== undefined) {
        if (input.scheduledListPriceVariantId) {
          const v = await transaction.productVariant.findFirst({
            where: {
              id: input.scheduledListPriceVariantId,
              productId: input.productId
            }
          });
          if (!v) {
            throw invalidInputError("The scheduled price variant does not belong to this product.");
          }
        }
        data.scheduledListPriceVariantId = input.scheduledListPriceVariantId;
      }

      if (input.scheduledListPriceAmountCents !== undefined) {
        data.scheduledListPriceAmountCents = input.scheduledListPriceAmountCents;
      }

      if (input.scheduledListPriceCurrency !== undefined) {
        data.scheduledListPriceCurrency = input.scheduledListPriceCurrency;
      }

      if (input.scheduledPriceEffectiveAt !== undefined) {
        data.scheduledPriceEffectiveAt = input.scheduledPriceEffectiveAt;
      }

      if (input.scheduledPriceNote !== undefined) {
        data.scheduledPriceNote = input.scheduledPriceNote;
      }

      if (input.brandId !== undefined) {
        data.brandId = input.brandId;
      }

      await transaction.product.update({
        where: {
          id: input.productId
        },
        data
      });

      if (input.categoryIds) {
        await replaceProductCategories(transaction, input.productId, input.categoryIds);
      }

      await recordCatalogMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "catalog.products.update",
        entityType: "PRODUCT",
        entityId: input.productId,
        before: {
          title: existingProduct.title,
          description: existingProduct.description,
          richDescription: existingProduct.richDescription,
          metaTitle: existingProduct.metaTitle,
          metaDescription: existingProduct.metaDescription,
          scheduledPublishAt: existingProduct.scheduledPublishAt,
          merchandisingFeatured: existingProduct.merchandisingFeatured,
          merchandisingHomeHighlight: existingProduct.merchandisingHomeHighlight,
          merchandisingSearchBoost: existingProduct.merchandisingSearchBoost,
          scheduledListPriceVariantId: existingProduct.scheduledListPriceVariantId,
          scheduledListPriceAmountCents: existingProduct.scheduledListPriceAmountCents,
          scheduledListPriceCurrency: existingProduct.scheduledListPriceCurrency,
          scheduledPriceEffectiveAt: existingProduct.scheduledPriceEffectiveAt,
          scheduledPriceNote: existingProduct.scheduledPriceNote,
          brandId: existingProduct.brandId,
          categoryIds: existingProduct.categories.map((entry) => entry.categoryId)
        },
        after: {
          title: input.title ?? existingProduct.title,
          description: input.description ?? existingProduct.description,
          richDescription: input.richDescription ?? existingProduct.richDescription,
          metaTitle: input.metaTitle ?? existingProduct.metaTitle,
          metaDescription: input.metaDescription ?? existingProduct.metaDescription,
          scheduledPublishAt: input.scheduledPublishAt ?? existingProduct.scheduledPublishAt,
          merchandisingFeatured: input.merchandisingFeatured ?? existingProduct.merchandisingFeatured,
          merchandisingHomeHighlight:
            input.merchandisingHomeHighlight ?? existingProduct.merchandisingHomeHighlight,
          merchandisingSearchBoost: input.merchandisingSearchBoost ?? existingProduct.merchandisingSearchBoost,
          scheduledListPriceVariantId:
            input.scheduledListPriceVariantId ?? existingProduct.scheduledListPriceVariantId,
          scheduledListPriceAmountCents:
            input.scheduledListPriceAmountCents ?? existingProduct.scheduledListPriceAmountCents,
          scheduledListPriceCurrency:
            input.scheduledListPriceCurrency ?? existingProduct.scheduledListPriceCurrency,
          scheduledPriceEffectiveAt:
            input.scheduledPriceEffectiveAt ?? existingProduct.scheduledPriceEffectiveAt,
          scheduledPriceNote: input.scheduledPriceNote ?? existingProduct.scheduledPriceNote,
          brandId: input.brandId ?? existingProduct.brandId,
          categoryIds: input.categoryIds ?? existingProduct.categories.map((entry) => entry.categoryId)
        },
        eventType: "PRODUCT_UPDATED"
      });
    });
    return getAdminProductDetail(input.productId);
  } catch (error) {
    mapPrismaWriteError(error, "product");
  }
};

export const mutateAdminProductStatus = async (input: {
  actorAdminUserId: string;
  productId: string;
  action: "publish" | "unpublish" | "archive";
  reason?: string;
  note?: string;
}) => {
  const nextStatus =
    input.action === "publish"
      ? ProductStatus.PUBLISHED
      : input.action === "unpublish"
        ? ProductStatus.DRAFT
        : ProductStatus.ARCHIVED;

  try {
    return await runInTransaction(async (transaction) => {
      const existingProduct = await transaction.product.findUnique({
        where: {
          id: input.productId
        }
      });

      if (!existingProduct) {
        throw notFoundError("The requested product was not found.");
      }

      if (input.action === "publish" && existingProduct.status === ProductStatus.ARCHIVED) {
        throw invalidStateTransitionError("Archived products cannot be republished.");
      }

      if (input.action === "unpublish" && existingProduct.status === ProductStatus.ARCHIVED) {
        throw invalidStateTransitionError("Archived products cannot be unpublished.");
      }

      await transaction.product.update({
        where: {
          id: input.productId
        },
        data: {
          status: nextStatus
        }
      });

      await recordCatalogMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: `catalog.products.${input.action}`,
        entityType: "PRODUCT",
        entityId: input.productId,
        reason: input.reason,
        note: input.note,
        before: {
          status: existingProduct.status
        },
        after: {
          status: nextStatus
        },
        eventType: `PRODUCT_${input.action.toUpperCase()}`
      });

      return {
        id: input.productId,
        status: nextStatus
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "product");
  }
};

const analyticsPeriodRange = (period: "7d" | "30d" | "90d") => {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);
  const periodLabel = period === "7d" ? "Last 7 days" : period === "90d" ? "Last 90 days" : "Last 30 days";
  return { start, end, periodLabel };
};

export const getAdminProductAnalytics = async (productId: string, period: "7d" | "30d" | "90d") => {
  await getProductByIdOrThrow(productId);
  const { start, end, periodLabel } = analyticsPeriodRange(period);

  const paidPaymentStates: PaymentState[] = [PaymentState.PAID, PaymentState.PARTIALLY_REFUNDED];

  const [orderItems, allPaidItems, reviewGroups, zeroStockMovements, refundAgg, returnQty] =
    await Promise.all([
      prisma.orderItem.findMany({
        where: {
          variant: { productId },
          order: {
            status: { not: "CANCELLED" },
            createdAt: { gte: start, lte: end },
            payments: { some: { paymentState: { in: paidPaymentStates } } }
          }
        },
        select: {
          quantity: true,
          unitPriceAmountCents: true,
          unitPriceCurrency: true,
          order: { select: { id: true, createdAt: true } }
        }
      }),
      prisma.orderItem.findMany({
        where: {
          order: {
            status: { not: "CANCELLED" },
            createdAt: { gte: start, lte: end },
            payments: { some: { paymentState: { in: paidPaymentStates } } }
          }
        },
        select: {
          quantity: true,
          unitPriceAmountCents: true,
          unitPriceCurrency: true,
          variant: { select: { productId: true } }
        }
      }),
      prisma.review.groupBy({
        by: ["rating"],
        where: {
          productId,
          status: ReviewStatus.PUBLISHED
        },
        _count: { rating: true }
      }),
      prisma.inventoryMovement.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          resultingOnHand: 0,
          inventoryStock: { variant: { productId } }
        },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          inventoryStock: {
            include: {
              warehouse: true,
              variant: { select: { sku: true } }
            }
          }
        }
      }),
      prisma.refundItem.aggregate({
        where: {
          createdAt: { gte: start, lte: end },
          orderItem: { variant: { productId } },
          refund: { state: RefundState.COMPLETED }
        },
        _sum: { amountCents: true }
      }),
      prisma.returnItem.aggregate({
        where: {
          createdAt: { gte: start, lte: end },
          variant: { productId },
          return: { status: { in: [ReturnStatus.COMPLETED, ReturnStatus.RECEIVED] } }
        },
        _sum: { quantity: true }
      })
    ]);

  let revenueCents = 0;
  let unitsSold = 0;
  const primaryCurrency = orderItems[0]?.unitPriceCurrency ?? "USD";
  const orderIds = new Set<string>();
  const trend = new Map<string, { revenueCents: number; unitsSold: number }>();

  for (const row of orderItems) {
    if (row.unitPriceCurrency !== primaryCurrency) {
      continue;
    }
    const line = row.quantity * row.unitPriceAmountCents;
    revenueCents += line;
    unitsSold += row.quantity;
    orderIds.add(row.order.id);
    const day = row.order.createdAt.toISOString().slice(0, 10);
    const prev = trend.get(day) ?? { revenueCents: 0, unitsSold: 0 };
    prev.revenueCents += line;
    prev.unitsSold += row.quantity;
    trend.set(day, prev);
  }

  let catalogRevenueSameCurrency = 0;
  for (const row of allPaidItems) {
    if (row.unitPriceCurrency !== primaryCurrency) {
      continue;
    }
    catalogRevenueSameCurrency += row.quantity * row.unitPriceAmountCents;
  }

  const refundCents = refundAgg._sum.amountCents ?? 0;
  const returnedUnits = returnQty._sum.quantity ?? 0;

  const refundRatePercent =
    revenueCents > 0 ? Number(((refundCents / revenueCents) * 100).toFixed(2)) : null;
  const returnRatePercent =
    unitsSold > 0 ? Number(((returnedUnits / unitsSold) * 100).toFixed(2)) : null;

  const productRevenueForShare = allPaidItems
    .filter((row) => row.variant.productId === productId && row.unitPriceCurrency === primaryCurrency)
    .reduce((sum, row) => sum + row.quantity * row.unitPriceAmountCents, 0);

  const revenueShare =
    catalogRevenueSameCurrency > 0
      ? {
          productPercent: Number(((productRevenueForShare / catalogRevenueSameCurrency) * 100).toFixed(2)),
          restPercent: Number(
            (((catalogRevenueSameCurrency - productRevenueForShare) / catalogRevenueSameCurrency) * 100).toFixed(2)
          )
        }
      : null;

  const reviewDistribution: {
    star1: number;
    star2: number;
    star3: number;
    star4: number;
    star5: number;
  } = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0 };

  for (const g of reviewGroups) {
    const key = `star${g.rating}` as keyof typeof reviewDistribution;
    if (key in reviewDistribution) {
      reviewDistribution[key] = g._count.rating;
    }
  }

  const hasReviews = Object.values(reviewDistribution).some((n) => n > 0);

  const salesTrend = [...trend.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, revenueCents: v.revenueCents, unitsSold: v.unitsSold }));

  const stockoutEvents = zeroStockMovements.map((m) => ({
    startedAt: m.createdAt.toISOString(),
    endedAt: null as string | null,
    durationLabel: `${m.inventoryStock.variant.sku} @ ${m.inventoryStock.warehouse.code} → 0 on hand`
  }));

  return {
    implemented: true as const,
    period,
    periodLabel,
    primaryCurrency,
    metrics: {
      revenueCents,
      unitsSold,
      returnRatePercent,
      refundRatePercent,
      views: null as number | null,
      orders: orderIds.size,
      conversionRate: null as number | null
    },
    salesTrend,
    stockoutEvents,
    reviewDistribution: hasReviews ? reviewDistribution : null,
    revenueShare
  };
};

export const getAdminProductActivity = async (productId: string) => {
  await getProductByIdOrThrow(productId);

  return prisma.timelineEvent.findMany({
    where: {
      entityType: "PRODUCT",
      entityId: productId
    },
    orderBy: {
      occurredAt: "desc"
    }
  });
};

export const bulkArchiveAdminProductVariants = async (input: {
  actorAdminUserId: string;
  productId: string;
  variantIds: string[];
}) => {
  try {
    return await runInTransaction(async (transaction) => {
      const variants = await transaction.productVariant.findMany({
        where: {
          productId: input.productId,
          id: {
            in: input.variantIds
          }
        }
      });

      if (variants.length !== input.variantIds.length) {
        throw notFoundError("One or more variants were not found for this product.");
      }

      for (const variant of variants) {
        await transaction.productVariant.update({
          where: {
            id: variant.id
          },
          data: {
            status: VariantStatus.ARCHIVED
          }
        });

        await recordCatalogMutation(transaction, {
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "catalog.variants.archive",
          entityType: "PRODUCT",
          entityId: input.productId,
          before: {
            variantId: variant.id,
            sku: variant.sku,
            status: variant.status
          },
          after: {
            variantId: variant.id,
            sku: variant.sku,
            status: VariantStatus.ARCHIVED
          },
          eventType: "PRODUCT_VARIANT_ARCHIVED"
        });
      }

      return {
        archived: variants.length
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "product variant");
  }
};

export const applyAdminProductScheduledPricing = async (input: {
  actorAdminUserId: string;
  productId: string;
  force?: boolean;
}) => {
  const product = await prisma.product.findUnique({
    where: {
      id: input.productId
    }
  });

  if (!product) {
    throw notFoundError("The requested product was not found.");
  }

  if (
    !product.scheduledListPriceVariantId ||
    product.scheduledListPriceAmountCents == null ||
    !product.scheduledListPriceCurrency
  ) {
    throw invalidInputError("No scheduled list price is configured for this product.");
  }

  const now = new Date();
  if (!input.force && product.scheduledPriceEffectiveAt && product.scheduledPriceEffectiveAt > now) {
    throw invalidInputError("Scheduled effective time is still in the future. Use force to apply early.");
  }

  await updateAdminProductPricing({
    actorAdminUserId: input.actorAdminUserId,
    productId: input.productId,
    variants: [
      {
        variantId: product.scheduledListPriceVariantId,
        priceAmountCents: product.scheduledListPriceAmountCents,
        priceCurrency: product.scheduledListPriceCurrency
      }
    ]
  });

  await prisma.product.update({
    where: {
      id: input.productId
    },
    data: {
      scheduledListPriceVariantId: null,
      scheduledListPriceAmountCents: null,
      scheduledListPriceCurrency: null,
      scheduledPriceEffectiveAt: null,
      scheduledPriceNote: null
    }
  });

  return getAdminProductPricing(input.productId);
};

const publishScheduledProduct = async (productId: string) =>
  runInTransaction(async (transaction) => {
    const product = await transaction.product.findUnique({
      where: {
        id: productId
      }
    });

    if (!product || product.status !== ProductStatus.DRAFT || !product.scheduledPublishAt) {
      return false;
    }

    await transaction.product.update({
      where: {
        id: product.id
      },
      data: {
        status: ProductStatus.PUBLISHED,
        scheduledPublishAt: null
      }
    });

    await recordSystemCatalogMutation(transaction, {
      actionCode: "catalog.products.publish.scheduled",
      entityId: product.id,
      eventType: "PRODUCT_SCHEDULED_PUBLISH_APPLIED",
      before: {
        status: product.status,
        scheduledPublishAt: product.scheduledPublishAt
      },
      after: {
        status: ProductStatus.PUBLISHED,
        scheduledPublishAt: null
      }
    });

    return true;
  });

const applyScheduledProductPricingAutomation = async (productId: string) =>
  runInTransaction(async (transaction) => {
    const product = await transaction.product.findUnique({
      where: {
        id: productId
      }
    });

    if (
      !product ||
      !product.scheduledListPriceVariantId ||
      product.scheduledListPriceAmountCents == null ||
      !product.scheduledListPriceCurrency
    ) {
      return false;
    }

    const variant = await transaction.productVariant.findFirst({
      where: {
        id: product.scheduledListPriceVariantId,
        productId: product.id
      }
    });

    if (!variant) {
      return false;
    }

    await transaction.productVariant.update({
      where: {
        id: variant.id
      },
      data: {
        priceAmountCents: product.scheduledListPriceAmountCents,
        priceCurrency: product.scheduledListPriceCurrency
      }
    });

    await transaction.product.update({
      where: {
        id: product.id
      },
      data: {
        scheduledListPriceVariantId: null,
        scheduledListPriceAmountCents: null,
        scheduledListPriceCurrency: null,
        scheduledPriceEffectiveAt: null,
        scheduledPriceNote: null
      }
    });

    await recordSystemCatalogMutation(transaction, {
      actionCode: "catalog.products.pricing.schedule.apply",
      entityId: product.id,
      eventType: "PRODUCT_SCHEDULED_PRICING_APPLIED",
      before: {
        variantId: variant.id,
        priceAmountCents: variant.priceAmountCents,
        priceCurrency: variant.priceCurrency,
        scheduledListPriceAmountCents: product.scheduledListPriceAmountCents,
        scheduledListPriceCurrency: product.scheduledListPriceCurrency,
        scheduledPriceEffectiveAt: product.scheduledPriceEffectiveAt
      },
      after: {
        variantId: variant.id,
        priceAmountCents: product.scheduledListPriceAmountCents,
        priceCurrency: product.scheduledListPriceCurrency,
        scheduledListPriceAmountCents: null,
        scheduledListPriceCurrency: null,
        scheduledPriceEffectiveAt: null
      }
    });

    return true;
  });

export const processScheduledCatalogAutomationJob = async (job: Job<Record<string, never>>) => {
  const now = new Date();

  if (job.name === "catalog.publish-due-products") {
    const dueProducts = await prisma.product.findMany({
      where: {
        status: ProductStatus.DRAFT,
        scheduledPublishAt: {
          lte: now
        }
      },
      orderBy: {
        scheduledPublishAt: "asc"
      },
      take: 50,
      select: {
        id: true
      }
    });

    let published = 0;

    for (const product of dueProducts) {
      if (await publishScheduledProduct(product.id)) {
        published += 1;
      }
    }

    return {
      scanned: dueProducts.length,
      published
    };
  }

  if (job.name === "catalog.apply-due-pricing") {
    const dueProducts = await prisma.product.findMany({
      where: {
        scheduledListPriceVariantId: {
          not: null
        },
        scheduledListPriceAmountCents: {
          not: null
        },
        scheduledListPriceCurrency: {
          not: null
        },
        scheduledPriceEffectiveAt: {
          lte: now
        }
      },
      orderBy: {
        scheduledPriceEffectiveAt: "asc"
      },
      take: 50,
      select: {
        id: true
      }
    });

    let applied = 0;

    for (const product of dueProducts) {
      if (await applyScheduledProductPricingAutomation(product.id)) {
        applied += 1;
      }
    }

    return {
      scanned: dueProducts.length,
      applied
    };
  }

  throw invalidInputError("Unsupported catalog automation job.");
};

export const listAdminProductVariants = async (productId: string) => {
  const product = await getProductByIdOrThrow(productId, false, { adminCatalogInclude: true });
  return product.variants.map((variant) => serializeVariant(variant, product.media, { exposeCost: true }));
};

export const createAdminProductVariant = async (input: {
  actorAdminUserId: string;
  productId: string;
  sku: string;
  attributes?: Record<string, unknown>;
  priceAmountCents?: number | null;
  compareAtPriceAmountCents?: number | null;
  costAmountCents?: number | null;
  priceCurrency?: string | null;
  status: VariantStatus;
}) => {
  try {
    return await runInTransaction(async (transaction) => {
      const product = await transaction.product.findUnique({
        where: {
          id: input.productId
        }
      });

      if (!product) {
        throw notFoundError("The requested product was not found.");
      }

      const variant = await transaction.productVariant.create({
        data: {
          productId: input.productId,
          sku: input.sku,
          attributes: toPrismaJsonValue(input.attributes) ?? Prisma.JsonNull,
          priceAmountCents: input.priceAmountCents ?? null,
          compareAtPriceAmountCents: input.compareAtPriceAmountCents ?? null,
          costAmountCents: input.costAmountCents ?? null,
          priceCurrency: input.priceCurrency ?? null,
          status: input.status
        }
      });

      await recordCatalogMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "catalog.variants.create",
        entityType: "PRODUCT",
        entityId: input.productId,
        after: {
          variantId: variant.id,
          sku: variant.sku,
          priceAmountCents: variant.priceAmountCents,
          compareAtPriceAmountCents: variant.compareAtPriceAmountCents,
          priceCurrency: variant.priceCurrency
        },
        eventType: "PRODUCT_VARIANT_CREATED"
      });

      return {
        id: variant.id
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "product variant");
  }
};

export const updateAdminProductVariant = async (input: {
  actorAdminUserId: string;
  variantId: string;
  sku?: string;
  attributes?: Record<string, unknown>;
  priceAmountCents?: number | null;
  compareAtPriceAmountCents?: number | null;
  costAmountCents?: number | null;
  priceCurrency?: string | null;
  status?: VariantStatus;
}) => {
  try {
    return await runInTransaction(async (transaction) => {
      const existingVariant = await transaction.productVariant.findUnique({
        where: {
          id: input.variantId
        }
      });

      if (!existingVariant) {
        throw notFoundError("The requested product variant was not found.");
      }

      await transaction.productVariant.update({
        where: {
          id: input.variantId
        },
        data: {
          sku: input.sku,
          attributes: input.attributes === undefined ? undefined : toPrismaJsonValue(input.attributes),
          priceAmountCents: input.priceAmountCents,
          compareAtPriceAmountCents: input.compareAtPriceAmountCents,
          costAmountCents: input.costAmountCents,
          priceCurrency: input.priceCurrency,
          status: input.status
        }
      });

      await recordCatalogMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "catalog.variants.update",
        entityType: "PRODUCT",
        entityId: existingVariant.productId,
        before: {
          sku: existingVariant.sku,
          status: existingVariant.status,
          attributes: existingVariant.attributes,
          priceAmountCents: existingVariant.priceAmountCents,
          compareAtPriceAmountCents: existingVariant.compareAtPriceAmountCents,
          costAmountCents: existingVariant.costAmountCents,
          priceCurrency: existingVariant.priceCurrency
        },
        after: {
          sku: input.sku ?? existingVariant.sku,
          status: input.status ?? existingVariant.status,
          attributes: input.attributes ?? existingVariant.attributes,
          priceAmountCents: input.priceAmountCents ?? existingVariant.priceAmountCents,
          compareAtPriceAmountCents:
            input.compareAtPriceAmountCents ?? existingVariant.compareAtPriceAmountCents,
          costAmountCents: input.costAmountCents ?? existingVariant.costAmountCents,
          priceCurrency: input.priceCurrency ?? existingVariant.priceCurrency
        },
        eventType: "PRODUCT_VARIANT_UPDATED"
      });

      return {
        id: input.variantId
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "product variant");
  }
};

export const listAdminProductMedia = async (productId: string) => {
  const product = await getProductByIdOrThrow(productId);
  return product.media.map((media) => serializeMediaAsset(media as MediaShape));
};

export const createAdminProductMediaUploadIntent = async (input: {
  productId: string;
  variantId?: string | null;
  actorAdminUserId: string;
  fileName: string;
  contentType: string;
  fileSizeBytes?: number;
  resourceType?: "image" | "video" | "raw";
}) => {
  const product = await prisma.product.findUnique({
    where: {
      id: input.productId
    }
  });

  if (!product) {
    throw notFoundError("The requested product was not found.");
  }

  if (input.variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: input.variantId,
        productId: input.productId
      }
    });

    if (!variant) {
      throw invalidInputError("The supplied variant does not belong to the requested product.");
    }
  }

  return {
    // audit-admin-action-exempt: signed upload intent generation is non-persistent.
    entity: createSignedUploadIntent({
      scope: "catalog_product",
      entityId: input.productId,
      secondaryId: input.variantId,
      actorId: input.actorAdminUserId,
      fileName: input.fileName,
      contentType: input.contentType,
      fileSizeBytes: input.fileSizeBytes,
      requestedResourceType: input.resourceType
    })
  };
};

export const createAdminProductMedia = async (input: {
  actorAdminUserId: string;
  productId: string;
  url: string;
  kind: string;
  variantId?: string | null;
  sortOrder: number;
  storageProvider: string;
  publicId?: string;
  resourceType?: "image" | "video" | "raw";
  deliveryType?: "upload" | "private";
  mimeType?: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  originalFilename?: string;
}) => {
  const resolvedAsset =
    input.storageProvider === "cloudinary"
      ? await resolveCloudinaryAsset("catalog_product", {
          publicId: input.publicId!,
          resourceType: input.resourceType,
          deliveryType: input.deliveryType,
          secureUrl: input.url
        })
      : null;

  try {
    return await runInTransaction(async (transaction) => {
      const product = await transaction.product.findUnique({
        where: {
          id: input.productId
        }
      });

      if (!product) {
        throw notFoundError("The requested product was not found.");
      }

      if (input.variantId) {
        const variant = await transaction.productVariant.findFirst({
          where: {
            id: input.variantId,
            productId: input.productId
          }
        });

        if (!variant) {
          throw invalidInputError("The supplied variant does not belong to the requested product.");
        }
      }

      const media = await transaction.productMedia.create({
        data: {
          productId: input.productId,
          variantId: input.variantId ?? null,
          url: resolvedAsset?.url ?? input.url,
          storageProvider: input.storageProvider,
          publicId: resolvedAsset?.publicId ?? input.publicId,
          resourceType: resolvedAsset?.resourceType ?? input.resourceType,
          deliveryType: resolvedAsset?.deliveryType ?? input.deliveryType ?? "upload",
          mimeType: input.mimeType ?? resolvedAsset?.mimeType ?? null,
          fileSizeBytes: input.fileSizeBytes ?? resolvedAsset?.fileSizeBytes ?? null,
          width: input.width ?? resolvedAsset?.width ?? null,
          height: input.height ?? resolvedAsset?.height ?? null,
          durationSeconds: input.durationSeconds ?? resolvedAsset?.durationSeconds ?? null,
          originalFilename:
            input.originalFilename ?? resolvedAsset?.originalFilename ?? null,
          kind: input.kind,
          sortOrder: input.sortOrder
        }
      });

      await recordCatalogMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "catalog.media.create",
        entityType: "PRODUCT",
        entityId: input.productId,
        after: {
          mediaId: media.id,
          kind: media.kind
        },
        eventType: "PRODUCT_MEDIA_CREATED"
      });

      return {
        id: media.id
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "product media");
  }
};

export const updateAdminProductMedia = async (input: {
  actorAdminUserId: string;
  mediaId: string;
  variantId?: string | null;
}) => {
  try {
    return await runInTransaction(async (transaction) => {
      const existing = await transaction.productMedia.findUnique({
        where: {
          id: input.mediaId
        }
      });

      if (!existing) {
        throw notFoundError("The requested product media was not found.");
      }

      if (input.variantId === undefined) {
        return {
          id: existing.id,
          productId: existing.productId,
          variantId: existing.variantId
        };
      }

      if (input.variantId) {
        const variant = await transaction.productVariant.findFirst({
          where: {
            id: input.variantId,
            productId: existing.productId
          }
        });

        if (!variant) {
          throw invalidInputError("The supplied variant does not belong to this product.");
        }
      }

      const updated = await transaction.productMedia.update({
        where: {
          id: input.mediaId
        },
        data: {
          variantId: input.variantId ?? null
        }
      });

      await recordCatalogMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "catalog.media.update",
        entityType: "PRODUCT",
        entityId: existing.productId,
        before: {
          variantId: existing.variantId
        },
        after: {
          variantId: updated.variantId
        },
        eventType: "PRODUCT_MEDIA_UPDATED"
      });

      return {
        id: updated.id,
        productId: updated.productId,
        variantId: updated.variantId
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "product media");
  }
};

export const deleteAdminProductMedia = async (input: {
  actorAdminUserId: string;
  mediaId: string;
  productId?: string;
}) => {
  const deletedMedia = await runInTransaction(async (transaction) => {
    const media = await transaction.productMedia.findUnique({
      where: {
        id: input.mediaId
      }
    });

    if (!media) {
      throw notFoundError("The requested product media was not found.");
    }

    if (input.productId && media.productId !== input.productId) {
      throw invalidInputError("The requested media does not belong to the supplied product.");
    }

    await transaction.productMedia.delete({
      where: {
        id: input.mediaId
      }
    });

    await recordCatalogMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "catalog.media.delete",
      entityType: "PRODUCT",
      entityId: media.productId,
      before: {
        mediaId: media.id,
        kind: media.kind,
        url: media.url
      },
      eventType: "PRODUCT_MEDIA_DELETED"
    });

    return {
      deleted: true,
      media
    };
  });

  if (deletedMedia.media.storageProvider === "cloudinary" && deletedMedia.media.publicId) {
    const [productMediaCount, supportAttachmentCount, bannerCount] = await Promise.all([
      prisma.productMedia.count({
        where: {
          publicId: deletedMedia.media.publicId
        }
      }),
      prisma.supportAttachment.count({
        where: {
          publicId: deletedMedia.media.publicId
        }
      }),
      prisma.banner.count({
        where: {
          mediaPublicId: deletedMedia.media.publicId
        }
      })
    ]);

    if (productMediaCount + supportAttachmentCount + bannerCount === 0) {
      await destroyCloudinaryAsset({
        publicId: deletedMedia.media.publicId,
        resourceType: deletedMedia.media.resourceType,
        deliveryType: deletedMedia.media.deliveryType
      }).catch(() => {
        return null;
      });
    }
  }

  return {
    deleted: true
  };
};

export const reorderAdminProductMedia = async (input: {
  actorAdminUserId: string;
  productId: string;
  items: Array<{
    mediaId: string;
    sortOrder: number;
  }>;
}) => {
  const mediaIds = [...new Set(input.items.map((item) => item.mediaId))];

  if (mediaIds.length !== input.items.length) {
    throw conflictError("Each media item can only appear once in a reorder request.");
  }

  return runInTransaction(async (transaction) => {
    const media = await transaction.productMedia.findMany({
      where: {
        id: {
          in: mediaIds
        },
        productId: input.productId
      }
    });

    if (media.length !== mediaIds.length) {
      throw notFoundError("One or more product media items were not found for this product.");
    }

    for (const item of input.items) {
      await transaction.productMedia.update({
        where: {
          id: item.mediaId
        },
        data: {
          sortOrder: item.sortOrder
        }
      });
    }

    await recordCatalogMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "catalog.media.reorder",
      entityType: "PRODUCT",
      entityId: input.productId,
      after: {
        items: input.items
      },
      eventType: "PRODUCT_MEDIA_REORDERED"
    });

    return listAdminProductMedia(input.productId);
  });
};

export const getAdminProductPricing = async (productId: string) => {
  const product = await getProductByIdOrThrow(productId, false, { adminCatalogInclude: true });

  return {
    productId: product.id,
    pricing: deriveProductPricing(product.variants),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      status: variant.status,
      costAmountCents: variant.costAmountCents,
      pricing: serializeVariantPricing(variant)
    }))
  };
};

export const updateAdminProductPricing = async (input: {
  actorAdminUserId: string;
  productId: string;
  variants: Array<{
    variantId: string;
    priceAmountCents?: number | null;
    compareAtPriceAmountCents?: number | null;
    costAmountCents?: number | null;
    priceCurrency?: string | null;
  }>;
}) =>
  runInTransaction(async (transaction) => {
    const product = await transaction.product.findUnique({
      where: {
        id: input.productId
      }
    });

    if (!product) {
      throw notFoundError("The requested product was not found.");
    }

    const variants = await transaction.productVariant.findMany({
      where: {
        id: {
          in: input.variants.map((variant) => variant.variantId)
        },
        productId: input.productId
      }
    });

    if (variants.length !== input.variants.length) {
      throw notFoundError("One or more product variants were not found for the supplied product.");
    }

    const existingById = new Map(variants.map((variant) => [variant.id, variant]));

    const beforeVariants = input.variants.map((patch) => {
      const existingVariant = existingById.get(patch.variantId)!;
      return {
        variantId: existingVariant.id,
        sku: existingVariant.sku,
        priceAmountCents: existingVariant.priceAmountCents,
        compareAtPriceAmountCents: existingVariant.compareAtPriceAmountCents,
        costAmountCents: existingVariant.costAmountCents,
        priceCurrency: existingVariant.priceCurrency
      };
    });

    for (const patch of input.variants) {
      const existingVariant = existingById.get(patch.variantId);

      if (!existingVariant) {
        throw notFoundError("The requested product variant was not found.");
      }

      await transaction.productVariant.update({
        where: {
          id: existingVariant.id
        },
        data: {
          priceAmountCents: patch.priceAmountCents ?? existingVariant.priceAmountCents,
          compareAtPriceAmountCents:
            patch.compareAtPriceAmountCents ?? existingVariant.compareAtPriceAmountCents,
          costAmountCents: patch.costAmountCents ?? existingVariant.costAmountCents,
          priceCurrency: patch.priceCurrency ?? existingVariant.priceCurrency
        }
      });
    }

    const afterVariants = input.variants.map((patch) => {
      const existingVariant = existingById.get(patch.variantId)!;
      return {
        variantId: patch.variantId,
        sku: existingVariant.sku,
        priceAmountCents: patch.priceAmountCents ?? existingVariant.priceAmountCents,
        compareAtPriceAmountCents:
          patch.compareAtPriceAmountCents ?? existingVariant.compareAtPriceAmountCents,
        costAmountCents: patch.costAmountCents ?? existingVariant.costAmountCents,
        priceCurrency: patch.priceCurrency ?? existingVariant.priceCurrency
      };
    });

    await recordCatalogMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "catalog.products.pricing.update",
      entityType: "PRODUCT",
      entityId: input.productId,
      before: {
        variants: beforeVariants
      },
      after: {
        variants: afterVariants
      },
      eventType: "PRODUCT_PRICING_UPDATED"
    });

    return getAdminProductPricing(input.productId);
  });

export const getAdminProductInventorySummary = async (productId: string) => {
  const product = await getProductByIdOrThrow(productId, false, { adminCatalogInclude: true });
  const inventorySummary = deriveInventorySummary(product.variants);

  const stockRows = product.variants.flatMap((variant) => {
    const label = formatVariantOptionLabel(variant.attributes);

    return variant.inventoryStocks.map((stock) => {
      const available = stock.onHand - stock.reserved;
      const wh = stock.warehouse;

      return {
        variantId: variant.id,
        variantLabel: label,
        variantSku: variant.sku,
        variantStatus: variant.status,
        warehouse: wh
          ? { id: wh.id, code: wh.code, name: wh.name }
          : { id: "", code: "—", name: "Unassigned" },
        onHand: stock.onHand,
        reserved: stock.reserved,
        available,
        reorderLevel: stock.reorderLevel,
        lowStock: available > 0 && available <= stock.reorderLevel,
        outOfStock: available <= 0
      };
    });
  });

  return {
    productId: product.id,
    inventorySummary,
    stockRows,
    variants: product.variants.map((variant) => {
      const inventory = deriveInventorySummary([{ ...variant }]);

      return {
        id: variant.id,
        sku: variant.sku,
        status: variant.status,
        optionLabel: formatVariantOptionLabel(variant.attributes),
        inventorySummary: inventory
      };
    })
  };
};

export const listAdminCategories = async (input?: { status?: string }) => {
  const categories = await prisma.category.findMany({
    where: input?.status
      ? {
          status: input.status
        }
      : undefined,
    orderBy: {
      name: "asc"
    },
    include: {
      _count: {
        select: {
          products: true
        }
      }
    }
  });

  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    status: category.status,
    productCount: category._count.products,
    updatedAt: category.updatedAt
  }));
};

export const getAdminCategoryById = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: {
          products: true
        }
      }
    }
  });

  if (!category) {
    throw notFoundError("The requested category was not found.");
  }

  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    status: category.status,
    productCount: category._count.products,
    updatedAt: category.updatedAt
  };
};

export const createAdminCategory = async (input: {
  actorAdminUserId: string;
  slug: string;
  name: string;
  status?: "DRAFT" | "ACTIVE";
}) => {
  try {
    return await runInTransaction(async (transaction) => {
      const status = input.status ?? "DRAFT";
      const category = await transaction.category.create({
        data: {
          slug: input.slug,
          name: input.name,
          status
        }
      });

      await recordCatalogMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "catalog.categories.create",
        entityType: "CATEGORY",
        entityId: category.id,
        after: {
          slug: category.slug,
          name: category.name,
          status: category.status
        },
        eventType: "CATEGORY_CREATED"
      });

      return {
        id: category.id
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "category");
  }
};

export const updateAdminCategory = async (input: {
  actorAdminUserId: string;
  categoryId: string;
  slug?: string;
  name?: string;
}) => {
  try {
    return await runInTransaction(async (transaction) => {
      const existingCategory = await transaction.category.findUnique({
        where: {
          id: input.categoryId
        }
      });

      if (!existingCategory) {
        throw notFoundError("The requested category was not found.");
      }

      if (existingCategory.status === "ARCHIVED") {
        throw invalidInputError("Archived categories cannot be edited. Restore them to active first.");
      }

      await transaction.category.update({
        where: {
          id: input.categoryId
        },
        data: {
          slug: input.slug,
          name: input.name
        }
      });

      await recordCatalogMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "catalog.categories.update",
        entityType: "CATEGORY",
        entityId: input.categoryId,
        before: {
          slug: existingCategory.slug,
          name: existingCategory.name,
          status: existingCategory.status
        },
        after: {
          slug: input.slug ?? existingCategory.slug,
          name: input.name ?? existingCategory.name,
          status: existingCategory.status
        },
        eventType: "CATEGORY_UPDATED"
      });

      return {
        id: input.categoryId
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "category");
  }
};

const assertBannerExistsForCatalog = async (transaction: Prisma.TransactionClient, bannerId: string) => {
  const row = await transaction.banner.findUnique({
    where: { id: bannerId },
    select: { id: true }
  });
  if (!row) {
    throw notFoundError("The requested banner was not found.");
  }
};

const detachBannerFromAllBrands = async (transaction: Prisma.TransactionClient, bannerId: string) => {
  await transaction.brand.updateMany({
    where: { bannerId },
    data: { bannerId: null }
  });
};

const releaseBannerFromOtherBrands = async (
  transaction: Prisma.TransactionClient,
  bannerId: string,
  keepBrandId: string
) => {
  await transaction.brand.updateMany({
    where: {
      bannerId,
      id: { not: keepBrandId }
    },
    data: { bannerId: null }
  });
};

export const listAdminBrands = async (input?: { status?: string }) => {
  const brands = await prisma.brand.findMany({
    where: input?.status
      ? {
          status: input.status
        }
      : undefined,
    orderBy: {
      name: "asc"
    },
    include: {
      _count: {
        select: {
          products: true
        }
      },
      linkedBanner: {
        select: {
          id: true,
          title: true,
          mediaUrl: true,
          placement: true,
          status: true
        }
      }
    }
  });

  return brands.map((brand) => ({
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    status: brand.status,
    productCount: brand._count.products,
    updatedAt: brand.updatedAt,
    bannerId: brand.bannerId,
    logoUrl: brand.logoUrl,
    galleryImageUrls: brand.galleryImageUrls,
    linkedBanner: brand.linkedBanner
  }));
};

export const getAdminBrandById = async (brandId: string) => {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      _count: {
        select: {
          products: true
        }
      },
      linkedBanner: {
        select: {
          id: true,
          title: true,
          mediaUrl: true,
          placement: true,
          status: true,
          linkUrl: true
        }
      }
    }
  });

  if (!brand) {
    throw notFoundError("The requested brand was not found.");
  }

  return {
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    status: brand.status,
    productCount: brand._count.products,
    updatedAt: brand.updatedAt,
    bannerId: brand.bannerId,
    logoUrl: brand.logoUrl,
    galleryImageUrls: brand.galleryImageUrls,
    linkedBanner: brand.linkedBanner
  };
};

export const createAdminBrand = async (input: {
  actorAdminUserId: string;
  slug: string;
  name: string;
  status?: "DRAFT" | "ACTIVE";
  bannerId?: string;
  logoUrl?: string;
  galleryImageUrls?: string[];
}) => {
  try {
    return await runInTransaction(async (transaction) => {
      const status = input.status ?? "DRAFT";
      if (input.bannerId) {
        await assertBannerExistsForCatalog(transaction, input.bannerId);
        await detachBannerFromAllBrands(transaction, input.bannerId);
      }
      const logo =
        input.logoUrl != null && input.logoUrl.trim().length > 0 ? input.logoUrl.trim() : null;
      const gallery = input.galleryImageUrls?.length ? input.galleryImageUrls : [];

      const brand = await transaction.brand.create({
        data: {
          slug: input.slug,
          name: input.name,
          status,
          ...(input.bannerId ? { bannerId: input.bannerId } : {}),
          logoUrl: logo,
          galleryImageUrls: gallery
        }
      });

      await recordCatalogMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "catalog.brands.create",
        entityType: "BRAND",
        entityId: brand.id,
        after: {
          slug: brand.slug,
          name: brand.name,
          status: brand.status,
          bannerId: brand.bannerId,
          logoUrl: brand.logoUrl,
          galleryImageUrls: brand.galleryImageUrls
        },
        eventType: "BRAND_CREATED"
      });

      return {
        id: brand.id
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "brand");
  }
};

export const updateAdminBrand = async (input: {
  actorAdminUserId: string;
  brandId: string;
  slug?: string;
  name?: string;
  bannerId?: string | null;
  logoUrl?: string | null;
  galleryImageUrls?: string[] | null;
}) => {
  try {
    return await runInTransaction(async (transaction) => {
      const existingBrand = await transaction.brand.findUnique({
        where: {
          id: input.brandId
        }
      });

      if (!existingBrand) {
        throw notFoundError("The requested brand was not found.");
      }

      if (existingBrand.status === "ARCHIVED") {
        throw invalidInputError("Archived brands cannot be edited. Restore them to active first.");
      }

      if (input.bannerId !== undefined && input.bannerId !== null) {
        await assertBannerExistsForCatalog(transaction, input.bannerId);
        await releaseBannerFromOtherBrands(transaction, input.bannerId, input.brandId);
      }

      const nextLogoUrl =
        input.logoUrl === undefined
          ? existingBrand.logoUrl
          : input.logoUrl === null || input.logoUrl.trim().length === 0
            ? null
            : input.logoUrl.trim();

      const data: Prisma.BrandUpdateInput = {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.bannerId !== undefined ? { bannerId: input.bannerId } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: nextLogoUrl } : {}),
        ...(input.galleryImageUrls !== undefined
          ? { galleryImageUrls: input.galleryImageUrls ?? [] }
          : {})
      };

      await transaction.brand.update({
        where: {
          id: input.brandId
        },
        data
      });

      await recordCatalogMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "catalog.brands.update",
        entityType: "BRAND",
        entityId: input.brandId,
        before: {
          slug: existingBrand.slug,
          name: existingBrand.name,
          status: existingBrand.status,
          bannerId: existingBrand.bannerId,
          logoUrl: existingBrand.logoUrl,
          galleryImageUrls: existingBrand.galleryImageUrls
        },
        after: {
          slug: input.slug ?? existingBrand.slug,
          name: input.name ?? existingBrand.name,
          status: existingBrand.status,
          bannerId: input.bannerId !== undefined ? input.bannerId : existingBrand.bannerId,
          logoUrl: input.logoUrl !== undefined ? nextLogoUrl : existingBrand.logoUrl,
          galleryImageUrls:
            input.galleryImageUrls !== undefined ? input.galleryImageUrls ?? [] : existingBrand.galleryImageUrls
        },
        eventType: "BRAND_UPDATED"
      });

      return {
        id: input.brandId
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "brand");
  }
};

export const archiveAdminCategory = async (input: {
  actorAdminUserId: string;
  categoryId: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const category = await transaction.category.findUnique({
      where: {
        id: input.categoryId
      }
    });

    if (!category) {
      throw notFoundError("The requested category was not found.");
    }

    if (category.status === "ARCHIVED") {
      throw invalidStateTransitionError("The requested category is already archived.");
    }

    await transaction.category.update({
      where: {
        id: category.id
      },
      data: {
        status: "ARCHIVED"
      }
    });

    await recordCatalogMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "catalog.categories.archive",
      entityType: "CATEGORY",
      entityId: category.id,
      note: input.note,
      before: {
        status: category.status
      },
      after: {
        status: "ARCHIVED",
        reason: input.reason
      },
      eventType: "CATEGORY_ARCHIVED"
    });

    return {
      id: category.id
    };
  });

export const archiveAdminBrand = async (input: {
  actorAdminUserId: string;
  brandId: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const brand = await transaction.brand.findUnique({
      where: {
        id: input.brandId
      }
    });

    if (!brand) {
      throw notFoundError("The requested brand was not found.");
    }

    if (brand.status === "ARCHIVED") {
      throw invalidStateTransitionError("The requested brand is already archived.");
    }

    await transaction.brand.update({
      where: {
        id: brand.id
      },
      data: {
        status: "ARCHIVED"
      }
    });

    await recordCatalogMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "catalog.brands.archive",
      entityType: "BRAND",
      entityId: brand.id,
      note: input.note,
      before: {
        status: brand.status
      },
      after: {
        status: "ARCHIVED",
        reason: input.reason
      },
      eventType: "BRAND_ARCHIVED"
    });

    return {
      id: brand.id
    };
  });

export const publishAdminCategory = async (input: {
  actorAdminUserId: string;
  categoryId: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const category = await transaction.category.findUnique({
      where: { id: input.categoryId },
      include: { _count: { select: { products: true } } }
    });

    if (!category) {
      throw notFoundError("The requested category was not found.");
    }

    if (category.status === "ACTIVE") {
      throw invalidStateTransitionError("The category is already active.");
    }

    if (category.status === "ARCHIVED") {
      throw invalidStateTransitionError("Archived categories must be restored before they can be published.");
    }

    await transaction.category.update({
      where: { id: category.id },
      data: { status: "ACTIVE" }
    });

    await recordCatalogMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "catalog.categories.publish",
      entityType: "CATEGORY",
      entityId: category.id,
      note: input.note,
      before: { status: category.status },
      after: { status: "ACTIVE", reason: input.reason },
      eventType: "CATEGORY_PUBLISHED"
    });

    return { id: category.id };
  });

export const unpublishAdminCategory = async (input: {
  actorAdminUserId: string;
  categoryId: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const category = await transaction.category.findUnique({
      where: { id: input.categoryId },
      include: { _count: { select: { products: true } } }
    });

    if (!category) {
      throw notFoundError("The requested category was not found.");
    }

    if (category.status !== "ACTIVE") {
      throw invalidStateTransitionError("Only active categories can be moved back to draft.");
    }

    if (category._count.products > 0) {
      throw invalidInputError(
        "Cannot unpublish a category that still has linked products. Remove or reassign products first."
      );
    }

    await transaction.category.update({
      where: { id: category.id },
      data: { status: "DRAFT" }
    });

    await recordCatalogMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "catalog.categories.unpublish",
      entityType: "CATEGORY",
      entityId: category.id,
      note: input.note,
      before: { status: category.status },
      after: { status: "DRAFT", reason: input.reason },
      eventType: "CATEGORY_UNPUBLISHED"
    });

    return { id: category.id };
  });

export const restoreAdminCategory = async (input: {
  actorAdminUserId: string;
  categoryId: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const category = await transaction.category.findUnique({
      where: { id: input.categoryId }
    });

    if (!category) {
      throw notFoundError("The requested category was not found.");
    }

    if (category.status !== "ARCHIVED") {
      throw invalidStateTransitionError("Only archived categories can be restored.");
    }

    await transaction.category.update({
      where: { id: category.id },
      data: { status: "ACTIVE" }
    });

    await recordCatalogMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "catalog.categories.restore",
      entityType: "CATEGORY",
      entityId: category.id,
      note: input.note,
      before: { status: category.status },
      after: { status: "ACTIVE", reason: input.reason },
      eventType: "CATEGORY_RESTORED"
    });

    return { id: category.id };
  });

export const publishAdminBrand = async (input: {
  actorAdminUserId: string;
  brandId: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const brand = await transaction.brand.findUnique({
      where: { id: input.brandId },
      include: { _count: { select: { products: true } } }
    });

    if (!brand) {
      throw notFoundError("The requested brand was not found.");
    }

    if (brand.status === "ACTIVE") {
      throw invalidStateTransitionError("The brand is already active.");
    }

    if (brand.status === "ARCHIVED") {
      throw invalidStateTransitionError("Archived brands must be restored before they can be published.");
    }

    await transaction.brand.update({
      where: { id: brand.id },
      data: { status: "ACTIVE" }
    });

    await recordCatalogMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "catalog.brands.publish",
      entityType: "BRAND",
      entityId: brand.id,
      note: input.note,
      before: { status: brand.status },
      after: { status: "ACTIVE", reason: input.reason },
      eventType: "BRAND_PUBLISHED"
    });

    return { id: brand.id };
  });

export const unpublishAdminBrand = async (input: {
  actorAdminUserId: string;
  brandId: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const brand = await transaction.brand.findUnique({
      where: { id: input.brandId },
      include: { _count: { select: { products: true } } }
    });

    if (!brand) {
      throw notFoundError("The requested brand was not found.");
    }

    if (brand.status !== "ACTIVE") {
      throw invalidStateTransitionError("Only active brands can be moved back to draft.");
    }

    if (brand._count.products > 0) {
      throw invalidInputError(
        "Cannot unpublish a brand that still has linked products. Clear or reassign the brand on those products first."
      );
    }

    await transaction.brand.update({
      where: { id: brand.id },
      data: { status: "DRAFT" }
    });

    await recordCatalogMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "catalog.brands.unpublish",
      entityType: "BRAND",
      entityId: brand.id,
      note: input.note,
      before: { status: brand.status },
      after: { status: "DRAFT", reason: input.reason },
      eventType: "BRAND_UNPUBLISHED"
    });

    return { id: brand.id };
  });

export const restoreAdminBrand = async (input: {
  actorAdminUserId: string;
  brandId: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const brand = await transaction.brand.findUnique({
      where: { id: input.brandId }
    });

    if (!brand) {
      throw notFoundError("The requested brand was not found.");
    }

    if (brand.status !== "ARCHIVED") {
      throw invalidStateTransitionError("Only archived brands can be restored.");
    }

    await transaction.brand.update({
      where: { id: brand.id },
      data: { status: "ACTIVE" }
    });

    await recordCatalogMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "catalog.brands.restore",
      entityType: "BRAND",
      entityId: brand.id,
      note: input.note,
      before: { status: brand.status },
      after: { status: "ACTIVE", reason: input.reason },
      eventType: "BRAND_RESTORED"
    });

    return { id: brand.id };
  });
