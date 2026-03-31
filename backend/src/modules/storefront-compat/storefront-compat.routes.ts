import { TicketPriority } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import type { RouteModule } from "../../app/route.types";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import { rateLimit } from "../../common/middleware/rate-limit.middleware";
import type { CartActorContext } from "../cart/cart.shared";
import { validateRequest } from "../../common/validation/validate-request";
import { verifyPublicSupportCaptcha } from "../security/captcha.service";
import {
  getPublicProductDetail,
  listCatalogCategories,
  listPublicProductReviews
} from "../catalog/catalog.service";
import { applyCouponBodySchema, updateCartItemBodySchema, addCartItemBodySchema } from "../cart/cart.schemas";
import {
  addCartItem,
  applyCoupon,
  getCartView,
  removeCartItem,
  removeCoupon,
  updateCartItemQuantity
} from "../cart/cart.service";
import {
  createOrderFromCheckout,
  initializeCheckoutPayment,
  validateCheckout
} from "../checkout/checkout.service";
import { getPublicContentPage, listPublicBanners } from "../content/content.service";
import {
  createPublicSupportAttachmentUploadIntent
} from "../support/support.service";
import { ticketAttachmentUploadIntentBodySchema } from "../support/support.schemas";
import {
  buildCheckoutAddress,
  buildCheckoutIdempotencyKey,
  buildNormalizedStorefrontQuery,
  normalizeShippingMethodCode
} from "./storefront-compat.helpers";
import {
  createStorefrontContactRequest,
  createStorefrontProductInquiry,
  getMobileCheckoutBootstrap,
  getMobileCheckoutSuccess,
  getStorefrontCampaign,
  getStorefrontHome,
  getStorefrontProductQuestions,
  getStorefrontSupportConfiguration,
  getStorefrontBrandProducts,
  getStorefrontCategoryProducts,
  listStorefrontProducts
} from "./storefront-compat.service";

const router = Router();

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const productSlugParamsSchema = z.object({
  slug: slugSchema
});

const categorySlugParamsSchema = z.object({
  slug: slugSchema
});

const brandSlugParamsSchema = z.object({
  slug: slugSchema
});

const campaignSlugParamsSchema = z.object({
  slug: slugSchema
});

const pageSlugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(160)
});

const orderNumberParamsSchema = z.object({
  orderNumber: z.string().trim().min(1).max(64)
});

const cartItemCompatParamsSchema = z.object({
  cartItemId: z.string().uuid()
});

const reviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const storefrontQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  query: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  availability: z.enum(["in_stock", "low_stock", "out_of_stock", "available", "unavailable"]).optional(),
  sortBy: z.enum(["updatedAt", "createdAt", "title"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  sort: z.enum(["newest", "oldest", "title_asc", "title_desc"]).optional()
});

const publicBannersQuerySchema = z.object({
  placement: z.string().trim().min(1).max(80).optional()
});

const publicSupportAttachmentBodySchema = z.object({
  url: z.string().trim().url(),
  storageProvider: z.string().trim().min(1).max(40).default("cloudinary"),
  publicId: z.string().trim().min(1).max(255).optional(),
  resourceType: z.enum(["image", "video", "raw"]).optional(),
  deliveryType: z.enum(["upload", "private"]).optional(),
  originalFilename: z.string().trim().max(255).optional(),
  mimeType: z.string().trim().max(120).optional(),
  fileSizeBytes: z.coerce.number().int().min(0).optional(),
  width: z.coerce.number().int().min(1).optional(),
  height: z.coerce.number().int().min(1).optional(),
  durationSeconds: z.coerce.number().min(0).optional()
}).superRefine((value, context) => {
  if (value.storageProvider === "cloudinary" && !value.publicId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publicId"],
      message: "publicId is required when storageProvider is cloudinary."
    });
  }
});

const publicCaptchaTokenSchema = z.string().trim().min(1).max(4096).optional();

const publicContactBodySchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  email: z.string().trim().email().optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  message: z.string().trim().min(1).max(5_000),
  priority: z.nativeEnum(TicketPriority).optional(),
  attachments: z.array(publicSupportAttachmentBodySchema).max(4).optional(),
  captchaToken: publicCaptchaTokenSchema
});

const publicProductInquiryBodySchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  email: z.string().trim().email().optional(),
  message: z.string().trim().min(1).max(5_000),
  attachments: z.array(publicSupportAttachmentBodySchema).max(4).optional(),
  captchaToken: publicCaptchaTokenSchema
});

const publicTicketAttachmentUploadIntentBodySchema =
  ticketAttachmentUploadIntentBodySchema.extend({
    captchaToken: publicCaptchaTokenSchema
  });

const mobileContactSchema = z.object({
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(4).max(40).optional()
});

const mobileCheckoutAddressSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().min(4).max(40).optional().nullable(),
  country: z.string().trim().min(2).max(120),
  region: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  addressLine1: z.string().trim().min(1).max(255),
  addressLine2: z.string().trim().max(255).optional().nullable(),
  postalCode: z.string().trim().min(1).max(40).optional().nullable()
});

const mobileCheckoutShippingBodySchema = z.object({
  contact: mobileContactSchema.optional(),
  shippingAddress: mobileCheckoutAddressSchema,
  billingAddress: mobileCheckoutAddressSchema.nullable().optional(),
  shippingMethodId: z.string().trim().min(1).max(80).optional()
});

const mobileCheckoutPaymentBodySchema = mobileCheckoutShippingBodySchema.extend({
  paymentMethod: z.string().trim().min(1).max(60),
  paymentChannel: z.enum(["card", "mobile_money"]).default("card"),
  mobileMoney: z
    .object({
      phone: z.string().trim().min(8).max(20),
      provider: z.string().trim().min(2).max(20).transform((value) => value.toLowerCase())
    })
    .optional()
}).superRefine((value, context) => {
  if (value.paymentChannel === "mobile_money" && !value.mobileMoney) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mobileMoney"],
      message: "mobileMoney is required when paymentChannel is mobile_money."
    });
  }
});

const mobileCheckoutOrderBodySchema = mobileCheckoutPaymentBodySchema.extend({
  checkoutIdempotencyKey: z.string().trim().min(8).max(200).optional(),
  paymentIdempotencyKey: z.string().trim().min(8).max(200).optional()
});

const buildCommerceContext = (request: {
  context: {
    actor: CartActorContext["actor"];
    sessionId: string | null;
  };
}): CartActorContext => ({
  actor: request.context.actor,
  sessionId: request.context.sessionId
});

const resolveRequestIp = (request: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}) => {
  const cfConnectingIp = request.headers["cf-connecting-ip"];
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof cfConnectingIp === "string" && cfConnectingIp.trim()) {
    return cfConnectingIp;
  }

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor;
  }

  return request.ip ?? null;
};

const normalizeStorefrontQuery = (query: unknown) => {
  const parsed = storefrontQuerySchema.parse(query);

  return buildNormalizedStorefrontQuery(parsed);
};

const normalizeReviewsQuery = (query: unknown) => {
  const parsed = reviewsQuerySchema.parse(query);

  return {
    page: parsed.page,
    page_size: parsed.limit ?? parsed.page_size
  };
};

router.get(
  "/products",
  asyncHandler(async (request, response) => {
    const query = normalizeStorefrontQuery(request.query);
    const data = await listStorefrontProducts(query);

    return sendSuccess(response, {
      data: {
        items: data.items
      },
      meta: data.pagination
    });
  })
);

router.get(
  "/products/:slug",
  validateRequest({ params: productSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof productSlugParamsSchema>;
    const data = await getPublicProductDetail(params.slug);
    return sendSuccess(response, { data });
  })
);

router.get(
  "/products/:slug/reviews",
  validateRequest({ params: productSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof productSlugParamsSchema>;
    const query = normalizeReviewsQuery(request.query);
    const data = await listPublicProductReviews(params.slug, query);

    return sendSuccess(response, {
      data: {
        items: data.items
      },
      meta: data.pagination
    });
  })
);

router.get(
  "/products/:slug/questions",
  validateRequest({ params: productSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof productSlugParamsSchema>;
    const data = await getStorefrontProductQuestions(params.slug);
    return sendSuccess(response, { data });
  })
);

router.post(
  "/products/:slug/inquiry/attachments/upload-intents",
  rateLimit({
    keyPrefix: "public-product-inquiry-upload-intent",
    maxRequests: 12,
    windowSeconds: 600
  }),
  validateRequest({ params: productSlugParamsSchema, body: publicTicketAttachmentUploadIntentBodySchema }),
  asyncHandler(async (request, response) => {
    const body = request.body as z.infer<typeof publicTicketAttachmentUploadIntentBodySchema>;
    await verifyPublicSupportCaptcha({
      token: body.captchaToken,
      expectedAction: "public_product_inquiry_upload",
      remoteIp: resolveRequestIp(request),
      requestId: request.context.requestId
    });
    const data = await createPublicSupportAttachmentUploadIntent({
      actorId: request.context.actor.userId ?? request.context.sessionId,
      fileName: body.fileName,
      contentType: body.contentType,
      fileSizeBytes: body.fileSizeBytes,
      resourceType: body.resourceType
    });

    return sendSuccess(response, {
      statusCode: 201,
      data
    });
  })
);

router.post(
  "/products/:slug/inquiry",
  rateLimit({
    keyPrefix: "public-product-inquiry",
    maxRequests: 8,
    windowSeconds: 600
  }),
  validateRequest({ params: productSlugParamsSchema, body: publicProductInquiryBodySchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof productSlugParamsSchema>;
    const body = request.body as z.infer<typeof publicProductInquiryBodySchema>;
    await verifyPublicSupportCaptcha({
      token: body.captchaToken,
      expectedAction: "public_product_inquiry",
      remoteIp: resolveRequestIp(request),
      requestId: request.context.requestId
    });
    const data = await createStorefrontProductInquiry({
      actorUserId: request.context.actor.userId,
      guestName: body.name,
      guestEmail: body.email ?? request.context.actor.email,
      productSlug: params.slug,
      message: body.message,
      attachments: body.attachments
    });

    return sendSuccess(response, {
      statusCode: 201,
      data
    });
  })
);

router.get(
  "/support/public-config",
  asyncHandler(async (_request, response) => {
    const data = await getStorefrontSupportConfiguration();
    return sendSuccess(response, { data });
  })
);

router.get(
  "/categories",
  asyncHandler(async (_request, response) => {
    const items = await listCatalogCategories();

    return sendSuccess(response, {
      data: {
        items
      }
    });
  })
);

router.get(
  "/categories/:slug/products",
  validateRequest({ params: categorySlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof categorySlugParamsSchema>;
    const query = normalizeStorefrontQuery(request.query);
    const data = await getStorefrontCategoryProducts(params.slug, query);

    return sendSuccess(response, {
      data: {
        category: data.category,
        items: data.items
      },
      meta: data.pagination
    });
  })
);

router.get(
  "/brands/:slug/products",
  validateRequest({ params: brandSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof brandSlugParamsSchema>;
    const query = normalizeStorefrontQuery(request.query);
    const data = await getStorefrontBrandProducts(params.slug, query);

    return sendSuccess(response, {
      data: {
        brand: data.brand,
        items: data.items
      },
      meta: data.pagination
    });
  })
);

router.get(
  "/search",
  asyncHandler(async (request, response) => {
    const query = normalizeStorefrontQuery(request.query);
    const data = await listStorefrontProducts(query);

    return sendSuccess(response, {
      data: {
        query: query.q ?? null,
        items: data.items
      },
      meta: data.pagination
    });
  })
);

router.get(
  "/banners",
  validateRequest({ query: publicBannersQuerySchema }),
  asyncHandler(async (request, response) => {
    const query = request.query as z.infer<typeof publicBannersQuerySchema>;
    const data = await listPublicBanners(query.placement);
    return sendSuccess(response, { data });
  })
);

router.get(
  "/pages/:slug",
  validateRequest({ params: pageSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof pageSlugParamsSchema>;
    const data = await getPublicContentPage(params.slug);
    return sendSuccess(response, { data });
  })
);

router.get(
  "/help",
  asyncHandler(async (_request, response) => {
    const data = await getPublicContentPage("help");
    return sendSuccess(response, { data });
  })
);

router.get(
  "/contact",
  asyncHandler(async (_request, response) => {
    const data = await getPublicContentPage("contact");
    return sendSuccess(response, { data });
  })
);

router.post(
  "/support/contact/upload-intents",
  rateLimit({
    keyPrefix: "public-support-contact-upload-intent",
    maxRequests: 12,
    windowSeconds: 600
  }),
  validateRequest({ body: publicTicketAttachmentUploadIntentBodySchema }),
  asyncHandler(async (request, response) => {
    const body = request.body as z.infer<typeof publicTicketAttachmentUploadIntentBodySchema>;
    await verifyPublicSupportCaptcha({
      token: body.captchaToken,
      expectedAction: "public_support_contact_upload",
      remoteIp: resolveRequestIp(request),
      requestId: request.context.requestId
    });
    const data = await createPublicSupportAttachmentUploadIntent({
      actorId: request.context.actor.userId ?? request.context.sessionId,
      fileName: body.fileName,
      contentType: body.contentType,
      fileSizeBytes: body.fileSizeBytes,
      resourceType: body.resourceType
    });

    return sendSuccess(response, {
      statusCode: 201,
      data
    });
  })
);

router.post(
  "/support/contact",
  rateLimit({
    keyPrefix: "public-support-contact",
    maxRequests: 5,
    windowSeconds: 600
  }),
  validateRequest({ body: publicContactBodySchema }),
  asyncHandler(async (request, response) => {
    const body = request.body as z.infer<typeof publicContactBodySchema>;
    await verifyPublicSupportCaptcha({
      token: body.captchaToken,
      expectedAction: "public_support_contact",
      remoteIp: resolveRequestIp(request),
      requestId: request.context.requestId
    });
    const data = await createStorefrontContactRequest({
      actorUserId: request.context.actor.userId,
      guestName: body.name,
      guestEmail: body.email ?? request.context.actor.email,
      subject: body.subject,
      message: body.message,
      priority: body.priority,
      attachments: body.attachments
    });

    return sendSuccess(response, {
      statusCode: 201,
      data
    });
  })
);

router.get(
  "/catalog/campaigns/:slug",
  validateRequest({ params: campaignSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof campaignSlugParamsSchema>;
    const data = await getStorefrontCampaign(params.slug);
    return sendSuccess(response, { data });
  })
);

router.get(
  "/mobile/home",
  asyncHandler(async (_request, response) => {
    const data = await getStorefrontHome();
    return sendSuccess(response, { data });
  })
);

router.get(
  "/mobile/support/config",
  asyncHandler(async (_request, response) => {
    const data = await getStorefrontSupportConfiguration();
    return sendSuccess(response, { data });
  })
);

router.get(
  "/mobile/pages/:slug",
  validateRequest({ params: pageSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof pageSlugParamsSchema>;
    const data = await getPublicContentPage(params.slug);
    return sendSuccess(response, { data });
  })
);

router.get(
  "/mobile/campaigns/:slug",
  validateRequest({ params: campaignSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof campaignSlugParamsSchema>;
    const data = await getStorefrontCampaign(params.slug);
    return sendSuccess(response, { data });
  })
);

router.get(
  "/mobile/help",
  asyncHandler(async (_request, response) => {
    const data = await getPublicContentPage("help");
    return sendSuccess(response, { data });
  })
);

router.get(
  "/mobile/contact",
  asyncHandler(async (_request, response) => {
    const data = await getPublicContentPage("contact");
    return sendSuccess(response, { data });
  })
);

router.get(
  "/mobile/products",
  asyncHandler(async (request, response) => {
    const query = normalizeStorefrontQuery(request.query);
    const data = await listStorefrontProducts(query);

    return sendSuccess(response, {
      data: {
        items: data.items
      },
      meta: data.pagination
    });
  })
);

router.get(
  "/mobile/products/:slug",
  validateRequest({ params: productSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof productSlugParamsSchema>;
    const data = await getPublicProductDetail(params.slug);
    return sendSuccess(response, { data });
  })
);

router.get(
  "/mobile/products/:slug/reviews",
  validateRequest({ params: productSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof productSlugParamsSchema>;
    const query = normalizeReviewsQuery(request.query);
    const data = await listPublicProductReviews(params.slug, query);

    return sendSuccess(response, {
      data: {
        items: data.items
      },
      meta: data.pagination
    });
  })
);

router.get(
  "/mobile/products/:slug/questions",
  validateRequest({ params: productSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof productSlugParamsSchema>;
    const data = await getStorefrontProductQuestions(params.slug);
    return sendSuccess(response, { data });
  })
);

router.get(
  "/mobile/categories",
  asyncHandler(async (_request, response) => {
    const items = await listCatalogCategories();

    return sendSuccess(response, {
      data: {
        items
      }
    });
  })
);

router.get(
  "/mobile/categories/:slug",
  validateRequest({ params: categorySlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof categorySlugParamsSchema>;
    const query = normalizeStorefrontQuery(request.query);
    const data = await getStorefrontCategoryProducts(params.slug, query);

    return sendSuccess(response, {
      data: {
        category: data.category,
        items: data.items
      },
      meta: data.pagination
    });
  })
);

router.get(
  "/mobile/brands/:slug",
  validateRequest({ params: brandSlugParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof brandSlugParamsSchema>;
    const query = normalizeStorefrontQuery(request.query);
    const data = await getStorefrontBrandProducts(params.slug, query);

    return sendSuccess(response, {
      data: {
        brand: data.brand,
        items: data.items
      },
      meta: data.pagination
    });
  })
);

router.get(
  "/mobile/search",
  asyncHandler(async (request, response) => {
    const query = normalizeStorefrontQuery(request.query);
    const data = await listStorefrontProducts(query);

    return sendSuccess(response, {
      data: {
        query: query.q ?? null,
        items: data.items
      },
      meta: data.pagination
    });
  })
);

router.get(
  "/mobile/cart",
  asyncHandler(async (request, response) => {
    const data = await getCartView(buildCommerceContext(request));
    return sendSuccess(response, { data });
  })
);

router.post(
  "/mobile/cart/items",
  validateRequest({ body: addCartItemBodySchema }),
  asyncHandler(async (request, response) => {
    const body = request.body as z.infer<typeof addCartItemBodySchema>;
    const data = await addCartItem(buildCommerceContext(request), body);
    return sendSuccess(response, { statusCode: 201, data });
  })
);

router.patch(
  "/mobile/cart/items/:cartItemId",
  validateRequest({ params: cartItemCompatParamsSchema, body: updateCartItemBodySchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof cartItemCompatParamsSchema>;
    const body = request.body as z.infer<typeof updateCartItemBodySchema>;
    const data = await updateCartItemQuantity(buildCommerceContext(request), {
      itemId: params.cartItemId,
      quantity: body.quantity
    });
    return sendSuccess(response, { data });
  })
);

router.delete(
  "/mobile/cart/items/:cartItemId",
  validateRequest({ params: cartItemCompatParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof cartItemCompatParamsSchema>;
    const data = await removeCartItem(buildCommerceContext(request), {
      itemId: params.cartItemId
    });
    return sendSuccess(response, { data });
  })
);

router.post(
  "/mobile/cart/coupon",
  validateRequest({ body: applyCouponBodySchema }),
  asyncHandler(async (request, response) => {
    const body = request.body as z.infer<typeof applyCouponBodySchema>;
    const data = await applyCoupon(buildCommerceContext(request), body);
    return sendSuccess(response, { data });
  })
);

router.delete(
  "/mobile/cart/coupon",
  asyncHandler(async (request, response) => {
    const data = await removeCoupon(buildCommerceContext(request));
    return sendSuccess(response, { data });
  })
);

router.post(
  "/mobile/cart/validate",
  asyncHandler(async (request, response) => {
    const data = await getCartView(buildCommerceContext(request));
    return sendSuccess(response, { data });
  })
);

router.get(
  "/mobile/checkout",
  asyncHandler(async (request, response) => {
    const data = await getMobileCheckoutBootstrap(buildCommerceContext(request));
    return sendSuccess(response, { data });
  })
);

router.post(
  "/mobile/checkout/shipping",
  validateRequest({ body: mobileCheckoutShippingBodySchema }),
  asyncHandler(async (request, response) => {
    const body = request.body as z.infer<typeof mobileCheckoutShippingBodySchema>;
    const address = buildCheckoutAddress(body);
    const shippingMethodCode = normalizeShippingMethodCode(body.shippingMethodId);
    const data = await validateCheckout(buildCommerceContext(request), {
      address,
      shippingMethodCode
    });
    return sendSuccess(response, { data });
  })
);

router.post(
  "/mobile/checkout/payment",
  validateRequest({ body: mobileCheckoutPaymentBodySchema }),
  asyncHandler(async (request, response) => {
    const body = request.body as z.infer<typeof mobileCheckoutPaymentBodySchema>;
    const address = buildCheckoutAddress(body);
    const shippingMethodCode = normalizeShippingMethodCode(body.shippingMethodId);
    const validation = await validateCheckout(buildCommerceContext(request), {
      address,
      shippingMethodCode
    });

    const data = {
      paymentMethod: body.paymentMethod,
      paymentChannel: body.paymentChannel,
      mobileMoney: body.mobileMoney ?? null,
      checkoutReady: validation.eligibilityFlags.canCheckout,
      blockingIssues: validation.blockingIssues,
      totals: validation.normalizedTotals
    };

    return sendSuccess(response, {
      data
    });
  })
);

router.post(
  "/mobile/checkout/review",
  validateRequest({ body: mobileCheckoutPaymentBodySchema }),
  asyncHandler(async (request, response) => {
    const body = request.body as z.infer<typeof mobileCheckoutPaymentBodySchema>;
    const address = buildCheckoutAddress(body);
    const shippingMethodCode = normalizeShippingMethodCode(body.shippingMethodId);
    const validation = await validateCheckout(buildCommerceContext(request), {
      address,
      shippingMethodCode
    });

    const data = {
      contact: body.contact ?? null,
      shippingAddress: body.shippingAddress,
      billingAddress: body.billingAddress ?? null,
      shippingMethodId: shippingMethodCode,
      paymentMethod: body.paymentMethod,
      paymentChannel: body.paymentChannel,
      mobileMoney: body.mobileMoney ?? null,
      summary: {
        totals: validation.normalizedTotals,
        shippingOptions: validation.shippingOptions,
        couponOutcome: validation.couponOutcome,
        warnings: validation.warnings,
        blockingIssues: validation.blockingIssues
      }
    };

    return sendSuccess(response, { data });
  })
);

router.post(
  "/mobile/checkout/orders",
  validateRequest({ body: mobileCheckoutOrderBodySchema }),
  asyncHandler(async (request, response) => {
    const body = request.body as z.infer<typeof mobileCheckoutOrderBodySchema>;
    const context = buildCommerceContext(request);
    const address = buildCheckoutAddress(body);
    const shippingMethodCode = normalizeShippingMethodCode(body.shippingMethodId);
    const order = await createOrderFromCheckout(context, {
      checkoutIdempotencyKey:
        body.checkoutIdempotencyKey ?? buildCheckoutIdempotencyKey("mobile_checkout"),
      address,
      shippingMethodCode
    });
    const payment = await initializeCheckoutPayment(context, {
      orderId: order.id,
      paymentIdempotencyKey:
        body.paymentIdempotencyKey ?? buildCheckoutIdempotencyKey("mobile_payment"),
      provider: body.paymentMethod,
      channel: body.paymentChannel,
      mobileMoney: body.mobileMoney
    });
    const data = {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status
      },
      payment: {
        provider: payment.provider,
        reference:
          typeof payment.providerPayload === "object" &&
          payment.providerPayload !== null &&
          "reference" in payment.providerPayload &&
          typeof payment.providerPayload.reference === "string"
            ? payment.providerPayload.reference
            : payment.id,
        checkoutUrl: payment.redirectUrl
      }
    };
    return sendSuccess(response, {
      statusCode: 201,
      data
    });
  })
);

router.get(
  "/mobile/checkout/success/:orderNumber",
  validateRequest({ params: orderNumberParamsSchema }),
  asyncHandler(async (request, response) => {
    const params = request.params as z.infer<typeof orderNumberParamsSchema>;
    const data = await getMobileCheckoutSuccess(buildCommerceContext(request), params.orderNumber);
    return sendSuccess(response, { data });
  })
);

export const storefrontCompatRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/products", summary: "List published storefront products via the customer web contract.", tags: ["storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/products/:slug", summary: "Fetch a storefront product detail payload.", tags: ["storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/products/:slug/reviews", summary: "List published storefront product reviews.", tags: ["storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/products/:slug/questions", summary: "Return persisted public product questions and inquiry metadata.", tags: ["storefront"], auth: "public" },
    { method: "POST", path: "/api/v1/products/:slug/inquiry/attachments/upload-intents", summary: "Create a signed upload intent for public product inquiry attachments.", tags: ["storefront", "support"], auth: "public" },
    { method: "POST", path: "/api/v1/products/:slug/inquiry", summary: "Create a public pre-purchase product inquiry ticket.", tags: ["storefront", "support"], auth: "public" },
    { method: "GET", path: "/api/v1/support/public-config", summary: "Return public support abuse-challenge and endpoint configuration for web clients.", tags: ["storefront", "support"], auth: "public" },
    { method: "GET", path: "/api/v1/categories", summary: "List storefront categories.", tags: ["storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/categories/:slug/products", summary: "List storefront products for a category.", tags: ["storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/brands/:slug/products", summary: "List storefront products for a brand.", tags: ["storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/search", summary: "Search storefront products.", tags: ["storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/banners", summary: "List storefront banners.", tags: ["storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/pages/:slug", summary: "Fetch a storefront CMS page.", tags: ["storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/help", summary: "Fetch the storefront help page.", tags: ["storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/contact", summary: "Fetch the storefront contact page.", tags: ["storefront"], auth: "public" },
    { method: "POST", path: "/api/v1/support/contact/upload-intents", summary: "Create a signed upload intent for public support contact attachments.", tags: ["storefront", "support"], auth: "public" },
    { method: "POST", path: "/api/v1/support/contact", summary: "Create a public contact support ticket.", tags: ["storefront", "support"], auth: "public" },
    { method: "GET", path: "/api/v1/catalog/campaigns/:slug", summary: "Fetch a public campaign landing payload.", tags: ["storefront", "marketing"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/home", summary: "Return the mobile home screen composition payload.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/support/config", summary: "Return support abuse-challenge and endpoint configuration for mobile clients.", tags: ["mobile", "support"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/pages/:slug", summary: "Fetch a mobile CMS page payload.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/campaigns/:slug", summary: "Fetch a mobile campaign landing payload.", tags: ["mobile", "marketing"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/help", summary: "Fetch the mobile help page payload.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/contact", summary: "Fetch the mobile contact page payload.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/products", summary: "List products via the mobile contract.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/products/:slug", summary: "Fetch a mobile product detail payload.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/products/:slug/reviews", summary: "List mobile product reviews.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/products/:slug/questions", summary: "Return mobile product questions and inquiry metadata for a product.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/categories", summary: "List mobile categories.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/categories/:slug", summary: "Fetch a mobile category landing payload.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/brands/:slug", summary: "Fetch a mobile brand landing payload.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/search", summary: "Search products via the mobile contract.", tags: ["mobile", "storefront"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/cart", summary: "Fetch the current mobile cart.", tags: ["mobile", "cart"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/cart/items", summary: "Add an item to the mobile cart.", tags: ["mobile", "cart"], auth: "public" },
    { method: "PATCH", path: "/api/v1/mobile/cart/items/:cartItemId", summary: "Update a mobile cart item.", tags: ["mobile", "cart"], auth: "public" },
    { method: "DELETE", path: "/api/v1/mobile/cart/items/:cartItemId", summary: "Remove a mobile cart item.", tags: ["mobile", "cart"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/cart/coupon", summary: "Apply a coupon to the mobile cart.", tags: ["mobile", "cart"], auth: "public" },
    { method: "DELETE", path: "/api/v1/mobile/cart/coupon", summary: "Remove the coupon from the mobile cart.", tags: ["mobile", "cart"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/cart/validate", summary: "Validate the mobile cart before checkout.", tags: ["mobile", "cart"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/checkout", summary: "Return the mobile checkout bootstrap payload.", tags: ["mobile", "checkout"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/checkout/shipping", summary: "Validate the mobile checkout shipping step.", tags: ["mobile", "checkout"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/checkout/payment", summary: "Validate the mobile checkout payment step and chosen payment method.", tags: ["mobile", "checkout"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/checkout/review", summary: "Build the exact mobile checkout review payload.", tags: ["mobile", "checkout"], auth: "public" },
    { method: "POST", path: "/api/v1/mobile/checkout/orders", summary: "Create an order and initialize payment via the mobile checkout contract.", tags: ["mobile", "checkout"], auth: "public" },
    { method: "GET", path: "/api/v1/mobile/checkout/success/:orderNumber", summary: "Fetch the mobile checkout success summary payload.", tags: ["mobile", "checkout"], auth: "public" }
  ]
};
