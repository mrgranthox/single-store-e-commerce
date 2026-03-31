import { Prisma, ProductStatus, VariantStatus } from "@prisma/client";

import { buildPagination, buildPaginationPayload, type PaginationInput } from "../../common/http/pagination";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { conflictError, notFoundError } from "../../common/errors/app-error";
import { prisma } from "../../config/prisma";

type InventoryStockShape = {
  onHand: number;
  reserved: number;
  reorderLevel: number;
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
  priceCurrency: string | null;
  status: VariantStatus;
  inventoryStocks: InventoryStockShape[];
  media: MediaShape[];
};

type WishlistItemRecord = {
  id: string;
  productId: string;
  variantId: string | null;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    slug: string;
    title: string;
    status: ProductStatus;
    brand: {
      id: string;
      slug: string;
      name: string;
    } | null;
    media: MediaShape[];
    variants: VariantShape[];
  };
  variant: VariantShape | null;
};

const wishlistItemInclude = {
  product: {
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      brand: {
        select: {
          id: true,
          slug: true,
          name: true
        }
      },
      media: {
        orderBy: {
          sortOrder: "asc" as const
        },
        select: {
          id: true,
          url: true,
          storageProvider: true,
          publicId: true,
          resourceType: true,
          deliveryType: true,
          mimeType: true,
          fileSizeBytes: true,
          width: true,
          height: true,
          durationSeconds: true,
          originalFilename: true,
          kind: true,
          sortOrder: true,
          variantId: true
        }
      },
      variants: {
        where: {
          status: VariantStatus.ACTIVE
        },
        select: {
          id: true,
          sku: true,
          attributes: true,
          priceAmountCents: true,
          compareAtPriceAmountCents: true,
          priceCurrency: true,
          status: true,
          inventoryStocks: {
            select: {
              onHand: true,
              reserved: true,
              reorderLevel: true
            }
          },
          media: {
            orderBy: {
              sortOrder: "asc" as const
            },
            select: {
              id: true,
              url: true,
              storageProvider: true,
              publicId: true,
              resourceType: true,
              deliveryType: true,
              mimeType: true,
              fileSizeBytes: true,
              width: true,
              height: true,
              durationSeconds: true,
              originalFilename: true,
              kind: true,
              sortOrder: true,
              variantId: true
            }
          }
        }
      }
    }
  },
  variant: {
    select: {
      id: true,
      sku: true,
      attributes: true,
      priceAmountCents: true,
      compareAtPriceAmountCents: true,
      priceCurrency: true,
      status: true,
      inventoryStocks: {
        select: {
          onHand: true,
          reserved: true,
          reorderLevel: true
        }
      },
      media: {
        orderBy: {
          sortOrder: "asc" as const
        },
        select: {
          id: true,
          url: true,
          storageProvider: true,
          publicId: true,
          resourceType: true,
          deliveryType: true,
          mimeType: true,
          fileSizeBytes: true,
          width: true,
          height: true,
          durationSeconds: true,
          originalFilename: true,
          kind: true,
          sortOrder: true,
          variantId: true
        }
      }
    }
  }
} satisfies Prisma.WishlistItemInclude;

const buildWishlistSelectionKey = (productId: string, variantId?: string | null) =>
  `${productId}:${variantId ?? "base"}`;

const deriveInventorySummary = (variants: Pick<VariantShape, "inventoryStocks">[]) => {
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

const serializePrimaryMedia = (media: MediaShape[]) => {
  const primary = media[0];

  if (!primary) {
    return null;
  }

  return {
    id: primary.id,
    url: primary.url,
    kind: primary.kind,
    mimeType: primary.mimeType,
    width: primary.width,
    height: primary.height,
    durationSeconds: primary.durationSeconds
  };
};

const serializePricing = (variant: Pick<VariantShape, "priceAmountCents" | "compareAtPriceAmountCents" | "priceCurrency">) =>
  variant.priceAmountCents != null && variant.priceCurrency
    ? {
        amountCents: variant.priceAmountCents,
        compareAtAmountCents: variant.compareAtPriceAmountCents,
        currency: variant.priceCurrency
      }
    : null;

const deriveProductPricing = (variants: VariantShape[]) => {
  const pricedVariants = variants.filter(
    (variant) => variant.priceAmountCents != null && variant.priceCurrency
  );

  if (pricedVariants.length === 0) {
    return null;
  }

  const amountValues = pricedVariants
    .map((variant) => variant.priceAmountCents)
    .filter((value): value is number => value != null);
  const primary = pricedVariants[0]!;

  return {
    amountCents: primary.priceAmountCents,
    compareAtAmountCents: primary.compareAtPriceAmountCents,
    currency: primary.priceCurrency,
    minAmountCents: Math.min(...amountValues),
    maxAmountCents: Math.max(...amountValues)
  };
};

const serializeVariant = (variant: VariantShape | null) => {
  if (!variant) {
    return null;
  }

  const inventory = deriveInventorySummary([variant]);

  return {
    id: variant.id,
    sku: variant.sku,
    attributes: variant.attributes,
    status: variant.status,
    pricing: serializePricing(variant),
    inventory,
    primaryMedia: serializePrimaryMedia(variant.media)
  };
};

const serializeWishlistItem = (item: WishlistItemRecord) => {
  const productInventory = deriveInventorySummary(item.product.variants);
  const selectedVariantInventory = item.variant ? deriveInventorySummary([item.variant]) : null;
  const effectiveInventory = selectedVariantInventory ?? productInventory;
  const canPurchase =
    item.product.status === ProductStatus.PUBLISHED &&
    (!item.variant || item.variant.status === VariantStatus.ACTIVE) &&
    effectiveInventory.available > 0;

  return {
    id: item.id,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    product: {
      id: item.product.id,
      slug: item.product.slug,
      title: item.product.title,
      status: item.product.status,
      brand: item.product.brand,
      pricing: deriveProductPricing(item.product.variants),
      inventory: productInventory,
      primaryMedia: serializePrimaryMedia(item.product.media)
    },
    variant: serializeVariant(item.variant),
    availability: {
      isPublished: item.product.status === ProductStatus.PUBLISHED,
      isVariantActive: item.variant ? item.variant.status === VariantStatus.ACTIVE : null,
      availableQuantity: effectiveInventory.available,
      lowStock: effectiveInventory.lowStock,
      canPurchase
    }
  };
};

const recordWishlistMutation = async (input: {
  userId: string;
  actionCode: string;
  entityId: string;
  eventType: string;
  metadata?: unknown;
}) => {
  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        actorType: "CUSTOMER",
        actorUserId: input.userId,
        actionCode: input.actionCode,
        entityType: "WISHLIST_ITEM",
        entityId: input.entityId,
        metadata: toPrismaJsonValue(input.metadata ?? {})
      }
    }),
    prisma.timelineEvent.create({
      data: {
        entityType: "WISHLIST_ITEM",
        entityId: input.entityId,
        eventType: input.eventType,
        actorType: "CUSTOMER",
        actorUserId: input.userId,
        payload: toPrismaJsonValue(input.metadata ?? {})
      }
    })
  ]);
};

const loadWishlistItemForUserOrThrow = async (userId: string, itemId: string) => {
  const item = await prisma.wishlistItem.findFirst({
    where: {
      id: itemId,
      userId
    },
    include: wishlistItemInclude
  });

  if (!item) {
    throw notFoundError("The requested wishlist item was not found.");
  }

  return item;
};

export const listWishlistItems = async (userId: string, input: PaginationInput) => {
  const where = {
    userId
  };

  const [items, totalItems] = await Promise.all([
    prisma.wishlistItem.findMany({
      where,
      include: wishlistItemInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.wishlistItem.count({ where })
  ]);

  return {
    items: items.map(serializeWishlistItem),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const createWishlistItem = async (input: {
  userId: string;
  productId: string;
  variantId?: string | null;
}) => {
  const product = await prisma.product.findUnique({
    where: {
      id: input.productId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!product || product.status !== ProductStatus.PUBLISHED) {
    throw notFoundError("The requested product was not found.");
  }

  if (input.variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: input.variantId,
        productId: input.productId,
        status: VariantStatus.ACTIVE
      },
      select: {
        id: true
      }
    });

    if (!variant) {
      throw notFoundError("The requested product variant was not found.");
    }
  }

  const selectionKey = buildWishlistSelectionKey(input.productId, input.variantId);
  const existing = await prisma.wishlistItem.findUnique({
    where: {
      userId_selectionKey: {
        userId: input.userId,
        selectionKey
      }
    }
  });

  if (existing) {
    throw conflictError("This item is already in the wishlist.", {
      reasonCode: "WISHLIST_ITEM_EXISTS",
      wishlistItemId: existing.id
    });
  }

  const created = await prisma.wishlistItem.create({
    data: {
      userId: input.userId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      selectionKey
    },
    include: wishlistItemInclude
  });

  await recordWishlistMutation({
    userId: input.userId,
    actionCode: "wishlist.items.create",
    entityId: created.id,
    eventType: "WISHLIST_ITEM_CREATED",
    metadata: {
      productId: created.productId,
      variantId: created.variantId
    }
  });

  return {
    entity: serializeWishlistItem(created)
  };
};

export const deleteWishlistItem = async (input: {
  userId: string;
  itemId: string;
}) => {
  const item = await loadWishlistItemForUserOrThrow(input.userId, input.itemId);

  await prisma.wishlistItem.delete({
    where: {
      id: item.id
    }
  });

  await recordWishlistMutation({
    userId: input.userId,
    actionCode: "wishlist.items.delete",
    entityId: item.id,
    eventType: "WISHLIST_ITEM_DELETED",
    metadata: {
      productId: item.productId,
      variantId: item.variantId
    }
  });

  return {
    deleted: true,
    entity: {
      id: item.id
    }
  };
};
