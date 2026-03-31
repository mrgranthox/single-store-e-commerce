import { Prisma, ReviewStatus, ShipmentStatus } from "@prisma/client";

import {
  conflictError,
  invalidInputError,
  invalidStateTransitionError,
  notFoundError,
  orderNotEligibleError
} from "../../common/errors/app-error";
import {
  buildPagination,
  buildPaginationPayload,
  type PaginationInput
} from "../../common/http/pagination";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { prisma } from "../../config/prisma";

const reviewInclude = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  },
  product: {
    select: {
      id: true,
      slug: true,
      title: true
    }
  },
  variant: {
    select: {
      id: true,
      sku: true
    }
  }
} satisfies Prisma.ReviewInclude;

type ReviewRecord = Prisma.ReviewGetPayload<{
  include: typeof reviewInclude;
}>;

const serializeReview = (review: ReviewRecord) => ({
  id: review.id,
  rating: review.rating,
  body: review.body,
  status: review.status,
  moderationNote: review.moderationNote,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  product: review.product,
  variant: review.variant,
  author: {
    id: review.user.id,
    email: review.user.email,
    name: [review.user.firstName, review.user.lastName].filter(Boolean).join(" ") || null
  }
});

const loadReviewForCustomerOrThrow = async (customerUserId: string, reviewId: string) => {
  const review = await prisma.review.findFirst({
    where: {
      id: reviewId,
      userId: customerUserId
    },
    include: reviewInclude
  });

  if (!review) {
    throw notFoundError("The requested review was not found.");
  }

  return review;
};

const loadReviewForAdminOrThrow = async (
  reviewId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
) => {
  const review = await db.review.findUnique({
    where: {
      id: reviewId
    },
    include: reviewInclude
  });

  if (!review) {
    throw notFoundError("The requested review was not found.");
  }

  return review;
};

const loadEligibleOrderItemForReview = async (
  customerUserId: string,
  orderItemId: string
) => {
  const order = await prisma.order.findFirst({
    where: {
      userId: customerUserId,
      OR: [
        {
          status: "COMPLETED"
        },
        {
          shipments: {
            some: {
              status: ShipmentStatus.DELIVERED
            }
          }
        }
      ],
      items: {
        some: {
          id: orderItemId
        }
      }
    },
    include: {
      items: {
        where: {
          id: orderItemId
        },
        include: {
          variant: {
            include: {
              product: true
            }
          }
        }
      }
    }
  });

  if (!order || order.items.length === 0) {
    throw orderNotEligibleError("This item is not eligible for review.", {
      reasonCode: "ORDER_ITEM_NOT_DELIVERED"
    });
  }

  return {
    order,
    orderItem: order.items[0]!
  };
};

export const listPublicProductReviews = async (
  productSlug: string,
  input: PaginationInput
) => {
  const where: Prisma.ReviewWhereInput = {
    status: ReviewStatus.PUBLISHED,
    product: {
      slug: productSlug
    }
  };

  const [items, totalItems, aggregates] = await Promise.all([
    prisma.review.findMany({
      where,
      include: reviewInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({
      where,
      _avg: {
        rating: true
      },
      _count: {
        _all: true
      }
    })
  ]);

  return {
    items: items.map((review) => ({
      id: review.id,
      rating: review.rating,
      body: review.body,
      createdAt: review.createdAt,
      authorName: [review.user.firstName, review.user.lastName].filter(Boolean).join(" ") || "Verified customer"
    })),
    summary: {
      averageRating: aggregates._avg.rating ? Number(aggregates._avg.rating.toFixed(2)) : null,
      totalReviews: aggregates._count._all
    },
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const listCustomerReviews = async (
  customerUserId: string,
  input: {
    page: number;
    page_size: number;
    status?: ReviewStatus;
  }
) => {
  const where: Prisma.ReviewWhereInput = {
    userId: customerUserId,
    ...(input.status ? { status: input.status } : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.review.findMany({
      where,
      include: reviewInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.review.count({ where })
  ]);

  return {
    items: items.map(serializeReview),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const listCustomerReviewEligibility = async (customerUserId: string) => {
  const [orders, existingReviews] = await Promise.all([
    prisma.order.findMany({
      where: {
        userId: customerUserId,
        OR: [
          {
            status: "COMPLETED"
          },
          {
            shipments: {
              some: {
                status: ShipmentStatus.DELIVERED
              }
            }
          }
        ]
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.review.findMany({
      where: {
        userId: customerUserId
      }
    })
  ]);

  const reviewByKey = new Map(
    existingReviews.map((review) => [`${review.productId}:${review.variantId ?? ""}`, review])
  );

  return {
    items: orders.flatMap((order) =>
      order.items.map((item) => {
        const existingReview =
          reviewByKey.get(`${item.variant.productId}:${item.variantId}`) ??
          reviewByKey.get(`${item.variant.productId}:`);

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderItemId: item.id,
          product: {
            id: item.variant.product.id,
            slug: item.variant.product.slug,
            title: item.variant.product.title
          },
          variant: {
            id: item.variant.id,
            sku: item.variant.sku
          },
          canReview: !existingReview,
          existingReviewId: existingReview?.id ?? null,
          existingReviewStatus: existingReview?.status ?? null
        };
      })
    )
  };
};

export const getCustomerOrderReviewEligibility = async (
  customerUserId: string,
  orderId: string
) => {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: customerUserId
    },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: true
            }
          }
        }
      },
      shipments: true
    }
  });

  if (!order) {
    throw notFoundError("The requested order was not found.");
  }

  const delivered =
    order.status === "COMPLETED" ||
    order.shipments.some((shipment) => shipment.status === ShipmentStatus.DELIVERED);
  const existingReviews = await prisma.review.findMany({
    where: {
      userId: customerUserId,
      OR: order.items.map((item) => ({
        productId: item.variant.productId,
        OR: [{ variantId: item.variantId }, { variantId: null }]
      }))
    }
  });
  const reviewByKey = new Map(
    existingReviews.map((review) => [`${review.productId}:${review.variantId ?? ""}`, review])
  );

  const items = order.items.map((item) => {
    const existingReview =
      reviewByKey.get(`${item.variant.productId}:${item.variantId}`) ??
      reviewByKey.get(`${item.variant.productId}:`);
    const canReview = delivered && !existingReview;

    return {
      orderItemId: item.id,
      product: {
        id: item.variant.product.id,
        slug: item.variant.product.slug,
        title: item.variant.product.title
      },
      variant: {
        id: item.variant.id,
        sku: item.variant.sku
      },
      canReview,
      existingReviewId: existingReview?.id ?? null,
      existingReviewStatus: existingReview?.status ?? null,
      reasonCode: canReview ? null : delivered ? "REVIEW_ALREADY_EXISTS" : "NOT_DELIVERED_YET",
      reasonMessage: canReview
        ? null
        : delivered
          ? "A review already exists for this item."
          : "You can review this item after delivery."
    };
  });

  return {
    entity: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      canReview: items.some((item) => item.canReview),
      reasonCode: delivered ? null : "NOT_DELIVERED_YET",
      reasonMessage: delivered ? null : "You can review this order after delivery.",
      items
    }
  };
};

export const createCustomerReview = async (
  customerUserId: string,
  input: {
    orderItemId: string;
    rating: number;
    body?: string;
  }
) =>
  runInTransaction(async (transaction) => {
    const { orderItem } = await loadEligibleOrderItemForReview(customerUserId, input.orderItemId);

    const existingReview = await transaction.review.findFirst({
      where: {
        userId: customerUserId,
        productId: orderItem.variant.productId,
        OR: [
          {
            variantId: orderItem.variantId
          },
          {
            variantId: null
          }
        ]
      }
    });

    if (existingReview) {
      throw conflictError("A review already exists for this purchased item.", {
        reviewId: existingReview.id
      });
    }

    const review = await transaction.review.create({
      data: {
        userId: customerUserId,
        productId: orderItem.variant.productId,
        variantId: orderItem.variantId,
        rating: input.rating,
        body: input.body
      },
      include: reviewInclude
    });

    await transaction.timelineEvent.create({
      data: {
        entityType: "PRODUCT",
        entityId: review.productId,
        eventType: "REVIEW_SUBMITTED",
        actorType: "CUSTOMER",
        payload: toPrismaJsonValue({
          reviewId: review.id,
          userId: customerUserId,
          rating: review.rating
        })
      }
    });

    return {
      entity: serializeReview(review)
    };
  });

export const updateCustomerReview = async (
  customerUserId: string,
  input: {
    reviewId: string;
    rating?: number;
    body?: string;
  }
) => {
  const existingReview = await loadReviewForCustomerOrThrow(customerUserId, input.reviewId);

  if (input.rating === undefined && input.body === undefined) {
    throw invalidInputError("At least one review field must be updated.");
  }

  const review = await prisma.review.update({
    where: {
      id: existingReview.id
    },
    data: {
      rating: input.rating ?? existingReview.rating,
      body: input.body ?? existingReview.body,
      status:
        existingReview.status === ReviewStatus.PUBLISHED ? ReviewStatus.PENDING : existingReview.status,
      moderationNote: existingReview.status === ReviewStatus.PUBLISHED ? null : existingReview.moderationNote
    },
    include: reviewInclude
  });

  return {
    entity: serializeReview(review)
  };
};

export const listAdminReviews = async (input: {
  page: number;
  page_size: number;
  status?: ReviewStatus;
  q?: string;
}) => {
  const where: Prisma.ReviewWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            {
              product: {
                title: {
                  contains: input.q,
                  mode: "insensitive"
                }
              }
            },
            {
              user: {
                email: {
                  contains: input.q,
                  mode: "insensitive"
                }
              }
            },
            {
              variant: {
                is: {
                  sku: {
                    contains: input.q,
                    mode: "insensitive"
                  }
                }
              }
            }
          ]
        }
      : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.review.findMany({
      where,
      include: reviewInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.review.count({ where })
  ]);

  return {
    items: items.map(serializeReview),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAdminReviewDetail = async (reviewId: string) => {
  const review = await loadReviewForAdminOrThrow(reviewId);

  return {
    entity: serializeReview(review)
  };
};

export const moderateAdminReview = async (input: {
  actorAdminUserId: string;
  reviewId: string;
  status: ReviewStatus;
  moderationNote?: string;
}) =>
  runInTransaction(async (transaction) => {
    const review = await loadReviewForAdminOrThrow(input.reviewId, transaction);

    if (review.status === input.status && review.moderationNote === input.moderationNote) {
      throw invalidStateTransitionError("The review is already in the requested moderation state.");
    }

    const updatedReview = await transaction.review.update({
      where: {
        id: review.id
      },
      data: {
        status: input.status,
        moderationNote: input.moderationNote
      },
      include: reviewInclude
    });

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "reviews.moderate",
          entityType: "REVIEW",
          entityId: review.id,
          note: input.moderationNote,
          metadata: toPrismaJsonValue({
            fromStatus: review.status,
            toStatus: input.status
          })
        }
      }),
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "catalog.reviews",
          actionCode: "reviews.moderate",
          note: input.moderationNote,
          entityType: "REVIEW",
          entityId: review.id,
          before: toPrismaJsonValue({
            status: review.status,
            moderationNote: review.moderationNote
          }),
          after: toPrismaJsonValue({
            status: input.status,
            moderationNote: input.moderationNote
          })
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "PRODUCT",
          entityId: review.product.id,
          eventType: "REVIEW_MODERATED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            reviewId: review.id,
            fromStatus: review.status,
            toStatus: input.status,
            moderationNote: input.moderationNote
          })
        }
      })
    ]);

    return {
      entity: serializeReview(updatedReview)
    };
  });
