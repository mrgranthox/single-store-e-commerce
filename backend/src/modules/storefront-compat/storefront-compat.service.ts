import { TicketPriority } from "@prisma/client";

import { notFoundError } from "../../common/errors/app-error";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { getPublicSupportCaptchaConfiguration } from "../security/captcha.service";
import {
  getPublicProductDetail,
  listCatalogCategories,
  listPublicProducts
} from "../catalog/catalog.service";
import { getCheckoutEligibility } from "../checkout/checkout.service";
import { getCartView } from "../cart/cart.service";
import { listAccountAddresses } from "../account/account.service";
import { createPublicSupportTicket } from "../support/support.service";
import type { CartActorContext } from "../cart/cart.shared";
import type { StorefrontAvailabilityFilter } from "./storefront-compat.helpers";

type StorefrontSort = {
  sortBy: "updatedAt" | "createdAt" | "title";
  sortOrder: "asc" | "desc";
};

type StorefrontQuery = {
  page: number;
  page_size: number;
  q?: string;
  categoryId?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  availability?: StorefrontAvailabilityFilter;
} & StorefrontSort;

const serializeCampaignBanner = (banner: {
  id: string;
  placement: string;
  title: string | null;
  mediaUrl: string | null;
  mediaStorageProvider: string | null;
  mediaPublicId: string | null;
  mediaResourceType: string | null;
  mediaDeliveryType: string;
  mediaMimeType: string | null;
  mediaFileSizeBytes: number | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  mediaDurationSeconds: number | null;
  mediaOriginalFilename: string | null;
  linkUrl: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: banner.id,
  placement: banner.placement,
  title: banner.title,
  mediaUrl: banner.mediaUrl,
  mediaStorageProvider: banner.mediaStorageProvider,
  mediaPublicId: banner.mediaPublicId,
  mediaResourceType: banner.mediaResourceType,
  mediaDeliveryType: banner.mediaDeliveryType,
  mediaMimeType: banner.mediaMimeType,
  mediaFileSizeBytes: banner.mediaFileSizeBytes,
  mediaWidth: banner.mediaWidth,
  mediaHeight: banner.mediaHeight,
  mediaDurationSeconds: banner.mediaDurationSeconds,
  mediaOriginalFilename: banner.mediaOriginalFilename,
  linkUrl: banner.linkUrl,
  sortOrder: banner.sortOrder,
  createdAt: banner.createdAt,
  updatedAt: banner.updatedAt
});

const buildTrustHighlights = () => [
  {
    code: "secure_payments",
    label: "Secure payments",
    description: "Protected checkout with Paystack cards and mobile money."
  },
  {
    code: "delivery_support",
    label: "Delivery support",
    description: "Track shipments and get support from the post-purchase account area."
  },
  {
    code: "returns_policy",
    label: "Clear returns",
    description: "Returns, refunds, and eligibility are handled from backend-owned workflows."
  }
];

const readAddressSnapshot = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const getStorefrontCampaign = async (slug: string) => {
  const campaign = await prisma.campaign.findUnique({
    where: {
      slug
    },
    include: {
      promotion: {
        select: {
          id: true,
          name: true,
          status: true,
          activeFrom: true,
          activeTo: true
        }
      },
      banners: {
        where: {
          status: "PUBLISHED"
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
      }
    }
  });

  if (!campaign || campaign.status !== "ACTIVE") {
    throw notFoundError("The requested campaign was not found.");
  }

  return {
    entity: {
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      status: campaign.status,
      promotion: campaign.promotion,
      banners: campaign.banners.map(serializeCampaignBanner),
      heroBanner: campaign.banners[0] ? serializeCampaignBanner(campaign.banners[0]) : null,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt
    }
  };
};

export const getStorefrontHome = async () => {
  const [heroBanners, categories, featuredProducts, trendingProducts, campaigns] =
    await Promise.all([
      prisma.banner.findMany({
        where: {
          status: "PUBLISHED",
          placement: {
            in: ["HOME_HERO", "HERO", "HOME"]
          }
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 6
      }),
      listCatalogCategories(),
      listPublicProducts({
        page: 1,
        page_size: 8,
        sortBy: "updatedAt",
        sortOrder: "desc"
      }),
      listPublicProducts({
        page: 1,
        page_size: 8,
        sortBy: "createdAt",
        sortOrder: "desc"
      }),
      prisma.campaign.findMany({
        where: {
          status: "ACTIVE"
        },
        include: {
          banners: {
            where: {
              status: "PUBLISHED"
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            take: 1
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 4
      })
    ]);

  return {
    heroBanners: heroBanners.map(serializeCampaignBanner),
    featuredCategories: categories.slice(0, 6),
    featuredProducts: featuredProducts.items,
    trendingProducts: trendingProducts.items,
    campaignBlocks: campaigns.map((campaign) => ({
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      status: campaign.status,
      heroBanner: campaign.banners[0] ? serializeCampaignBanner(campaign.banners[0]) : null
    })),
    trustHighlights: buildTrustHighlights(),
    support: {
      contactEndpoint: "/api/support/contact",
      productInquiryPattern: "/api/products/:slug/inquiry",
      abuseChallenge: getPublicSupportCaptchaConfiguration()
    }
  };
};

export const getStorefrontProductQuestions = async (productSlug: string) => {
  const product = await getPublicProductDetail(productSlug);
  const questionTickets = await prisma.supportTicket.findMany({
    where: {
      supportType: "PRODUCT_INQUIRY",
      productId: product.id,
      messages: {
        some: {
          authorType: "ADMIN"
        }
      }
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc"
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 12
  });

  const questions = questionTickets
    .map((ticket) => {
      const customerMessage = ticket.messages.find((message) => message.authorType === "CUSTOMER");
      const adminMessage = ticket.messages.find((message) => message.authorType === "ADMIN");

      if (!customerMessage || !adminMessage) {
        return null;
      }

      return {
        id: ticket.id,
        question: customerMessage.body,
        answer: adminMessage.body,
        answeredAt: adminMessage.createdAt,
        createdAt: customerMessage.createdAt
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    entity: {
      product: product.supportInquiryContext,
      questions,
      inquiry: {
        enabled: true,
        endpoint: `/api/products/${product.supportInquiryContext.productSlug}/inquiry`,
        contactEndpoint: "/api/support/contact",
        abuseChallenge: getPublicSupportCaptchaConfiguration(),
        expectedResponseTime: "1-2 business days",
        recommendedTopics: [
          "Availability and restock timeline",
          "Variant and sizing guidance",
          "Delivery and returns policy",
          "Bulk or pre-purchase questions"
        ]
      }
    }
  };
};

export const listStorefrontProducts = async (input: StorefrontQuery) => listPublicProducts(input);

export const getStorefrontCategoryProducts = async (
  categorySlug: string,
  input: StorefrontQuery
) => {
  const category = await prisma.category.findUnique({
    where: {
      slug: categorySlug
    }
  });

  if (!category) {
    throw notFoundError("The requested category was not found.");
  }

  if (category.status !== "ACTIVE") {
    throw notFoundError("The requested category was not found.");
  }

  const result = await listPublicProducts({
    ...input,
    categoryId: category.id
  });

  return {
    category,
    ...result
  };
};

export const getStorefrontBrandProducts = async (brandSlug: string, input: StorefrontQuery) => {
  const brand = await prisma.brand.findUnique({
    where: {
      slug: brandSlug
    }
  });

  if (!brand) {
    throw notFoundError("The requested brand was not found.");
  }

  if (brand.status !== "ACTIVE") {
    throw notFoundError("The requested brand was not found.");
  }

  const result = await listPublicProducts({
    ...input,
    brandId: brand.id
  });

  return {
    brand,
    ...result
  };
};

export const createStorefrontContactRequest = async (input: {
  actorUserId?: string | null;
  guestName?: string;
  guestEmail?: string;
  subject?: string;
  message: string;
  priority?: TicketPriority;
  attachments?: Array<{
    url: string;
    storageProvider: string;
    publicId?: string;
    resourceType?: "image" | "video" | "raw";
    deliveryType?: "upload" | "private";
    originalFilename?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    width?: number;
    height?: number;
    durationSeconds?: number;
  }>;
}) =>
  createPublicSupportTicket({
    userId: input.actorUserId,
    guestName: input.guestName,
    guestEmail: input.guestEmail,
    subject: input.subject ?? "Contact request",
    message: input.message,
    priority: input.priority ?? TicketPriority.MEDIUM,
    attachments: input.attachments
  });

export const createStorefrontProductInquiry = async (input: {
  actorUserId?: string | null;
  guestName?: string;
  guestEmail?: string;
  productSlug: string;
  message: string;
  attachments?: Array<{
    url: string;
    storageProvider: string;
    publicId?: string;
    resourceType?: "image" | "video" | "raw";
    deliveryType?: "upload" | "private";
    originalFilename?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    width?: number;
    height?: number;
    durationSeconds?: number;
  }>;
}) => {
  const product = await getPublicProductDetail(input.productSlug);

  const ticket = await createPublicSupportTicket({
    userId: input.actorUserId,
    guestName: input.guestName,
    guestEmail: input.guestEmail,
    subject: `Product inquiry: ${product.title}`,
    message: input.message,
    priority: TicketPriority.LOW,
    attachments: input.attachments,
    productContext: {
      productId: product.id,
      productSlug: product.slug,
      productTitle: product.title
    }
  });

  return {
    ...ticket,
    product: product.supportInquiryContext
  };
};

export const getMobileCheckoutBootstrap = async (context: CartActorContext) => {
  const [cart, eligibility, user, addresses] = await Promise.all([
    getCartView(context),
    getCheckoutEligibility(context),
    context.actor.userId
      ? prisma.user.findUnique({
          where: {
            id: context.actor.userId
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            status: true
          }
        })
      : Promise.resolve(null),
    context.actor.userId ? listAccountAddresses(context.actor.userId) : Promise.resolve({ items: [] })
  ]);

  return {
    user,
    savedAddresses: addresses.items,
    availableShippingMethods: cart.shippingOptions,
    checkoutConfiguration: {
      paymentProvider: env.PAYMENT_PROVIDER,
      currency: cart.normalizedTotals.currency,
      guestCheckoutAllowed: eligibility.guestCheckoutAllowed,
      requiresAuthenticatedCustomer: eligibility.requiresAuthenticatedCustomer
    },
    supportConfiguration: {
      contactEndpoint: "/api/mobile/support/contact",
      abuseChallenge: getPublicSupportCaptchaConfiguration()
    },
    guestCheckoutAllowed: eligibility.guestCheckoutAllowed,
    cartSummary: {
      items: cart.items,
      totals: cart.normalizedTotals,
      warnings: cart.warnings,
      checkoutReadiness: cart.eligibilityFlags
    }
  };
};

export const getStorefrontSupportConfiguration = async () => ({
  support: {
    contactEndpoint: "/api/support/contact",
    uploadIntentEndpoint: "/api/support/contact/upload-intents",
    productInquiryPattern: "/api/products/:slug/inquiry",
    productInquiryUploadPattern: "/api/products/:slug/inquiry/attachments/upload-intents",
    abuseChallenge: getPublicSupportCaptchaConfiguration()
  }
});

export const getMobileCheckoutSuccess = async (
  context: CartActorContext,
  orderNumber: string
) => {
  const order = await prisma.order.findUnique({
    where: {
      orderNumber
    },
    include: {
      items: {
        orderBy: {
          createdAt: "asc"
        }
      },
      payments: {
        orderBy: {
          createdAt: "desc"
        }
      },
      shipments: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!order) {
    throw notFoundError("The requested order was not found.");
  }

  if (context.actor.userId) {
    if (order.userId !== context.actor.userId) {
      throw notFoundError("The requested order was not found.");
    }
  } else if (!context.sessionId || order.guestTrackingKey !== context.sessionId) {
    throw notFoundError("The requested order was not found.");
  }

  const latestPayment = order.payments[0] ?? null;
  const latestShipment = order.shipments[0] ?? null;
  const address = readAddressSnapshot(order.addressSnapshot);

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      shippingAddress: address,
      items: order.items.map((item) => ({
        id: item.id,
        variantId: item.variantId,
        productTitle: item.productTitleSnapshot,
        quantity: item.quantity,
        unitPriceAmountCents: item.unitPriceAmountCents,
        currency: item.unitPriceCurrency
      }))
    },
    payment: latestPayment
      ? {
          id: latestPayment.id,
          state: latestPayment.paymentState,
          provider: latestPayment.provider,
          providerReference: latestPayment.providerPaymentRef
        }
      : null,
    shipment: latestShipment
      ? {
          id: latestShipment.id,
          status: latestShipment.status,
          carrier: latestShipment.carrier,
          trackingNumber: latestShipment.trackingNumber
        }
      : null
  };
};
