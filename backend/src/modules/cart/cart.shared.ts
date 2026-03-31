import { randomUUID } from "node:crypto";

import {
  CouponStatus,
  Prisma,
  ProductStatus,
  VariantStatus
} from "@prisma/client";

import {
  cartEmptyError,
  couponInvalidError,
  forbiddenError,
  invalidInputError,
  itemOutOfStockError,
  priceChangedError
} from "../../common/errors/app-error";
import type { RequestActor } from "../../common/types/request-context";
import { prisma } from "../../config/prisma";
import { buildShippingMethodOptions } from "../shipping/shipping.methods";

const GUEST_CHECKOUT_SETTING_KEY = "checkout.guest_checkout_enabled";
const RESERVATION_WINDOW_MINUTES_SETTING_KEY = "checkout.reservation_window_minutes";
type DatabaseClient = Prisma.TransactionClient | typeof prisma;

export const cartInclude = {
  cartItems: {
    orderBy: {
      createdAt: "asc" as const
    },
    include: {
      variant: {
        include: {
          product: {
            include: {
              media: {
                orderBy: {
                  sortOrder: "asc" as const
                }
              }
            }
          },
          media: {
            orderBy: {
              sortOrder: "asc" as const
            }
          },
          inventoryStocks: true
        }
      }
    }
  }
} satisfies Prisma.CartInclude;

export type CartRecord = Prisma.CartGetPayload<{
  include: typeof cartInclude;
}>;

export type CartActorContext = {
  actor: RequestActor;
  sessionId: string | null;
};

export type CouponEvaluation = {
  appliedCode: string;
  valid: boolean;
  couponId: string | null;
  discountCents: number;
  reasonCode: string | null;
  message: string;
};

export type NormalizedTotals = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  grandTotalCents: number;
  currency: string | null;
};

export type CheckoutEvaluation = {
  cart: {
    id: string | null;
    userId: string | null;
    guestTrackingKey: string | null;
    appliedCouponCode: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };
  items: Array<{
    id: string;
    variantId: string;
    sku: string;
    quantity: number;
    product: {
      id: string;
      slug: string;
      title: string;
      status: ProductStatus;
    };
    mediaUrl: string | null;
    attributes: Prisma.JsonValue | null;
    availability: {
      inStock: boolean;
      availableQuantity: number;
    };
    pricing: {
      current: {
        amountCents: number;
        currency: string;
        compareAtAmountCents: number | null;
      } | null;
      snapshot: {
        amountCents: number;
        currency: string;
      } | null;
      lineSubtotalCents: number;
    };
    status: {
      productStatus: ProductStatus;
      variantStatus: VariantStatus;
      purchasable: boolean;
      priceChanged: boolean;
    };
    blockingReasons: Array<{
      code: string;
      message: string;
    }>;
  }>;
  couponOutcome: CouponEvaluation | null;
  normalizedTotals: NormalizedTotals;
  shippingOptions: Array<{
    code: string;
    label: string;
    amountCents: number;
    currency: string;
    estimatedDeliveryWindow: string;
    available: boolean;
  }>;
  warnings: string[];
  blockedItems: Array<{
    itemId: string;
    variantId: string;
    reasons: Array<{
      code: string;
      message: string;
    }>;
  }>;
  priceChanges: Array<{
    itemId: string;
    variantId: string;
    previousAmountCents: number;
    currentAmountCents: number;
    currency: string;
  }>;
  stockIssues: Array<{
    itemId: string;
    variantId: string;
    requestedQuantity: number;
    availableQuantity: number;
  }>;
  blockingIssues: Array<{
    code: string;
    message: string;
    itemId?: string;
    variantId?: string;
  }>;
  eligibilityFlags: {
    canCheckout: boolean;
    guestCheckoutAllowed: boolean;
    requiresGuestSession: boolean;
    requiresAuthenticatedCustomer: boolean;
    cartEmpty: boolean;
  };
};

const parseBooleanSetting = (value: Prisma.JsonValue, fallback: boolean) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const candidate = record.enabled ?? record.value;

    if (typeof candidate === "boolean") {
      return candidate;
    }
  }

  return fallback;
};

const parseNumericSetting = (value: Prisma.JsonValue, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value));
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const candidate = record.value;

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.max(1, Math.trunc(candidate));
    }
  }

  return fallback;
};

const ensureCustomerOrGuestActor = (actor: RequestActor) => {
  if (actor.kind === "admin" || actor.kind === "system") {
    throw forbiddenError("Customer or guest context is required for this route.");
  }
};

const getVariantPrice = (variant: CartRecord["cartItems"][number]["variant"]) =>
  variant.priceAmountCents != null && variant.priceCurrency
    ? {
        amountCents: variant.priceAmountCents,
        currency: variant.priceCurrency,
        compareAtAmountCents: variant.compareAtPriceAmountCents
      }
    : null;

const getSnapshotPrice = (item: CartRecord["cartItems"][number]) =>
  item.unitPriceAmountCentsSnapshot != null && item.unitPriceCurrencySnapshot
    ? {
        amountCents: item.unitPriceAmountCentsSnapshot,
        currency: item.unitPriceCurrencySnapshot
      }
    : null;

const getAvailableQuantity = (variant: CartRecord["cartItems"][number]["variant"]) =>
  variant.inventoryStocks.reduce((sum, stock) => sum + (stock.onHand - stock.reserved), 0);

const getPrimaryMediaUrl = (variant: CartRecord["cartItems"][number]["variant"]) =>
  variant.media[0]?.url ?? variant.product.media[0]?.url ?? null;

const generateGuestCartKey = () => randomUUID();

export const getGuestCheckoutEnabled = async (db: DatabaseClient = prisma) => {
  const setting = await db.systemSetting.findUnique({
    where: {
      key: GUEST_CHECKOUT_SETTING_KEY
    }
  });

  if (!setting) {
    return false;
  }

  return parseBooleanSetting(setting.value, false);
};

export const getReservationWindowMinutes = async (db: DatabaseClient = prisma) => {
  const setting = await db.systemSetting.findUnique({
    where: {
      key: RESERVATION_WINDOW_MINUTES_SETTING_KEY
    }
  });

  if (!setting) {
    return 15;
  }

  return parseNumericSetting(setting.value, 15);
};

const mergeGuestCartIntoUserCart = async (
  db: DatabaseClient,
  userCart: CartRecord,
  guestCart: CartRecord
) => {
  for (const guestItem of guestCart.cartItems) {
    const existingItem = await db.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: userCart.id,
          variantId: guestItem.variantId
        }
      }
    });

    if (existingItem) {
      await db.cartItem.update({
        where: {
          id: existingItem.id
        },
        data: {
          quantity: existingItem.quantity + guestItem.quantity,
          unitPriceAmountCentsSnapshot:
            guestItem.variant.priceAmountCents ?? existingItem.unitPriceAmountCentsSnapshot,
          unitPriceCurrencySnapshot:
            guestItem.variant.priceCurrency ?? existingItem.unitPriceCurrencySnapshot
        }
      });
    } else {
      await db.cartItem.create({
        data: {
          cartId: userCart.id,
          variantId: guestItem.variantId,
          quantity: guestItem.quantity,
          unitPriceAmountCentsSnapshot: guestItem.variant.priceAmountCents,
          unitPriceCurrencySnapshot: guestItem.variant.priceCurrency
        }
      });
    }
  }

  if (!userCart.appliedCouponCode && guestCart.appliedCouponCode) {
    await db.cart.update({
      where: {
        id: userCart.id
      },
      data: {
        appliedCouponCode: guestCart.appliedCouponCode
      }
    });
  }

  await db.cartItem.deleteMany({
    where: {
      cartId: guestCart.id
    }
  });

  await db.cart.update({
    where: {
      id: guestCart.id
    },
    data: {
      appliedCouponCode: null,
      guestTrackingKey: `merged_${generateGuestCartKey()}`
    }
  });
};

export const resolveCartForContext = async (
  db: DatabaseClient,
  context: CartActorContext,
  options?: {
    createIfMissing?: boolean;
    requireGuestSession?: boolean;
  }
) => {
  ensureCustomerOrGuestActor(context.actor);

  const createIfMissing = options?.createIfMissing ?? false;
  const requireGuestSession = options?.requireGuestSession ?? false;

  if (context.actor.kind === "customer" && context.actor.userId) {
    let userCart = await db.cart.findFirst({
      where: {
        userId: context.actor.userId
      },
      include: cartInclude
    });

    const guestCart =
      context.sessionId
        ? await db.cart.findFirst({
            where: {
              guestTrackingKey: context.sessionId,
              userId: null
            },
            include: cartInclude
          })
        : null;

    if (!userCart && createIfMissing) {
      userCart = await db.cart.create({
        data: {
          userId: context.actor.userId
        },
        include: cartInclude
      });
    }

    if (guestCart) {
      if (!userCart) {
        userCart = await db.cart.create({
          data: {
            userId: context.actor.userId
          },
          include: cartInclude
        });
      }

      await mergeGuestCartIntoUserCart(db, userCart, guestCart);

      userCart = await db.cart.findFirst({
        where: {
          id: userCart.id
        },
        include: cartInclude
      });
    }

    return userCart;
  }

  const guestTrackingKey = context.sessionId;

  if (!guestTrackingKey) {
    if (requireGuestSession) {
      throw invalidInputError("Guest cart operations require an x-session-id header.");
    }

    return null;
  }

  let guestCart = await db.cart.findFirst({
    where: {
      guestTrackingKey,
      userId: null
    },
    include: cartInclude
  });

  if (!guestCart && createIfMissing) {
    guestCart = await db.cart.create({
      data: {
        guestTrackingKey
      },
      include: cartInclude
    });
  }

  return guestCart;
};

const evaluateCoupon = async (
  db: DatabaseClient,
  code: string | null,
  subtotalCents: number,
  context: CartActorContext
): Promise<CouponEvaluation | null> => {
  if (!code) {
    return null;
  }

  const coupon = await db.coupon.findUnique({
    where: {
      code
    }
  });

  if (!coupon) {
    return {
      appliedCode: code,
      valid: false,
      couponId: null,
      discountCents: 0,
      reasonCode: "COUPON_INVALID",
      message: "The coupon does not exist."
    };
  }

  const now = new Date();

  if (coupon.status !== CouponStatus.ACTIVE) {
    return {
      appliedCode: code,
      valid: false,
      couponId: coupon.id,
      discountCents: 0,
      reasonCode: "COUPON_INVALID",
      message: "The coupon is not active."
    };
  }

  if ((coupon.activeFrom && coupon.activeFrom > now) || (coupon.activeTo && coupon.activeTo < now)) {
    return {
      appliedCode: code,
      valid: false,
      couponId: coupon.id,
      discountCents: 0,
      reasonCode: "COUPON_INVALID",
      message: "The coupon is outside its active window."
    };
  }

  if (coupon.maxRedemptions != null) {
    const totalRedemptions = await db.couponRedemption.count({
      where: {
        couponId: coupon.id
      }
    });

    if (totalRedemptions >= coupon.maxRedemptions) {
      return {
        appliedCode: code,
        valid: false,
        couponId: coupon.id,
        discountCents: 0,
        reasonCode: "COUPON_INVALID",
        message: "The coupon has reached its redemption limit."
      };
    }
  }

  if (coupon.perCustomerLimit != null) {
    const redemptionCount = await db.couponRedemption.count({
      where: {
        couponId: coupon.id,
        ...(context.actor.kind === "customer" && context.actor.userId
          ? { userId: context.actor.userId }
          : { guestTrackingKey: context.sessionId ?? generateGuestCartKey() })
      }
    });

    if (redemptionCount >= coupon.perCustomerLimit) {
      return {
        appliedCode: code,
        valid: false,
        couponId: coupon.id,
        discountCents: 0,
        reasonCode: "COUPON_INVALID",
        message: "The coupon has already been used by this customer."
      };
    }
  }

  if (coupon.minOrderAmountCents != null && subtotalCents < coupon.minOrderAmountCents) {
    return {
      appliedCode: code,
      valid: false,
      couponId: coupon.id,
      discountCents: 0,
      reasonCode: "COUPON_INVALID",
      message: "The cart does not meet the minimum order value for this coupon."
    };
  }

  if (coupon.discountType !== "PERCENTAGE" && coupon.discountType !== "FIXED_AMOUNT") {
    return {
      appliedCode: code,
      valid: false,
      couponId: coupon.id,
      discountCents: 0,
      reasonCode: "COUPON_INVALID",
      message: "The coupon discount type is not supported."
    };
  }

  const discountCents =
    coupon.discountType === "PERCENTAGE"
      ? Math.floor(subtotalCents * ((coupon.discountValue ?? 0) / 100))
      : Math.min(subtotalCents, coupon.discountValue ?? 0);

  return {
    appliedCode: code,
    valid: true,
    couponId: coupon.id,
    discountCents,
    reasonCode: null,
    message: "Coupon applied."
  };
};

const buildShippingOptions = (currency: string | null) => buildShippingMethodOptions(currency);

export const evaluateCart = async (
  db: DatabaseClient,
  cart: CartRecord | null,
  context: CartActorContext
): Promise<CheckoutEvaluation> => {
  ensureCustomerOrGuestActor(context.actor);

  const guestCheckoutAllowed = await getGuestCheckoutEnabled(db);
  const items = (cart?.cartItems ?? []).map((item) => {
    const currentPrice = getVariantPrice(item.variant);
    const snapshotPrice = getSnapshotPrice(item);
    const availableQuantity = getAvailableQuantity(item.variant);
    const blockingReasons: Array<{ code: string; message: string }> = [];

    if (item.variant.product.status !== ProductStatus.PUBLISHED) {
      blockingReasons.push({
        code: "PRODUCT_UNAVAILABLE",
        message: "This product is no longer published."
      });
    }

    if (item.variant.status !== VariantStatus.ACTIVE) {
      blockingReasons.push({
        code: "VARIANT_UNAVAILABLE",
        message: "This product variant is no longer active."
      });
    }

    if (!currentPrice) {
      blockingReasons.push({
        code: "PRICE_UNAVAILABLE",
        message: "This product variant does not currently have pricing."
      });
    }

    if (availableQuantity < item.quantity) {
      blockingReasons.push({
        code: "ITEM_OUT_OF_STOCK",
        message: "The requested quantity is no longer available."
      });
    }

    const priceChanged =
      currentPrice != null &&
      snapshotPrice != null &&
      (snapshotPrice.amountCents !== currentPrice.amountCents ||
        snapshotPrice.currency !== currentPrice.currency);

    if (priceChanged) {
      blockingReasons.push({
        code: "PRICE_CHANGED",
        message: "The item price changed since it was added to the cart."
      });
    }

    return {
      id: item.id,
      variantId: item.variantId,
      sku: item.variant.sku,
      quantity: item.quantity,
      product: {
        id: item.variant.product.id,
        slug: item.variant.product.slug,
        title: item.variant.product.title,
        status: item.variant.product.status
      },
      mediaUrl: getPrimaryMediaUrl(item.variant),
      attributes: item.variant.attributes,
      availability: {
        inStock: availableQuantity > 0,
        availableQuantity
      },
      pricing: {
        current: currentPrice,
        snapshot: snapshotPrice,
        lineSubtotalCents: currentPrice ? currentPrice.amountCents * item.quantity : 0
      },
      status: {
        productStatus: item.variant.product.status,
        variantStatus: item.variant.status,
        purchasable:
          item.variant.product.status === ProductStatus.PUBLISHED &&
          item.variant.status === VariantStatus.ACTIVE &&
          currentPrice != null &&
          availableQuantity >= item.quantity,
        priceChanged
      },
      blockingReasons
    };
  });

  const pricedCurrencies = [...new Set(items.map((item) => item.pricing.current?.currency).filter(Boolean))];
  const subtotalCents = items.reduce((sum, item) => sum + item.pricing.lineSubtotalCents, 0);
  const couponOutcome = await evaluateCoupon(db, cart?.appliedCouponCode ?? null, subtotalCents, context);

  const blockingIssues: CheckoutEvaluation["blockingIssues"] = [];
  const priceChanges: CheckoutEvaluation["priceChanges"] = [];
  const stockIssues: CheckoutEvaluation["stockIssues"] = [];
  const blockedItems: CheckoutEvaluation["blockedItems"] = [];
  const warnings: string[] = [];

  for (const item of items) {
    if (item.status.priceChanged && item.pricing.current && item.pricing.snapshot) {
      priceChanges.push({
        itemId: item.id,
        variantId: item.variantId,
        previousAmountCents: item.pricing.snapshot.amountCents,
        currentAmountCents: item.pricing.current.amountCents,
        currency: item.pricing.current.currency
      });
    }

    if (item.availability.availableQuantity < item.quantity) {
      stockIssues.push({
        itemId: item.id,
        variantId: item.variantId,
        requestedQuantity: item.quantity,
        availableQuantity: item.availability.availableQuantity
      });
    }

    if (item.blockingReasons.length > 0) {
      blockedItems.push({
        itemId: item.id,
        variantId: item.variantId,
        reasons: item.blockingReasons
      });

      for (const reason of item.blockingReasons) {
        blockingIssues.push({
          code: reason.code,
          message: reason.message,
          itemId: item.id,
          variantId: item.variantId
        });
      }
    }
  }

  if (pricedCurrencies.length > 1) {
    blockingIssues.push({
      code: "INVALID_CURRENCY_MIX",
      message: "The cart contains items priced in multiple currencies."
    });
  }

  if (couponOutcome && !couponOutcome.valid) {
    blockingIssues.push({
      code: couponOutcome.reasonCode ?? "COUPON_INVALID",
      message: couponOutcome.message
    });
    warnings.push(couponOutcome.message);
  }

  if (priceChanges.length > 0) {
    warnings.push("One or more cart item prices changed and must be acknowledged before checkout.");
  }

  if (stockIssues.length > 0) {
    warnings.push("One or more cart items are no longer available in the requested quantity.");
  }

  const currency = pricedCurrencies[0] ?? null;
  const normalizedTotals: NormalizedTotals = {
    subtotalCents,
    discountCents: couponOutcome?.valid ? couponOutcome.discountCents : 0,
    shippingCents: 0,
    taxCents: 0,
    grandTotalCents: Math.max(0, subtotalCents - (couponOutcome?.valid ? couponOutcome.discountCents : 0)),
    currency
  };

  return {
    cart: {
      id: cart?.id ?? null,
      userId: cart?.userId ?? null,
      guestTrackingKey: cart?.guestTrackingKey ?? context.sessionId,
      appliedCouponCode: cart?.appliedCouponCode ?? null,
      createdAt: cart?.createdAt ?? null,
      updatedAt: cart?.updatedAt ?? null
    },
    items,
    couponOutcome,
    normalizedTotals,
    shippingOptions: buildShippingOptions(currency),
    warnings,
    blockedItems,
    priceChanges,
    stockIssues,
    blockingIssues,
    eligibilityFlags: {
      canCheckout:
        items.length > 0 &&
        blockingIssues.length === 0 &&
        !(context.actor.kind === "anonymous" && !context.sessionId) &&
        !(context.actor.kind === "anonymous" && !guestCheckoutAllowed),
      guestCheckoutAllowed,
      requiresGuestSession: context.actor.kind === "anonymous" && !context.sessionId,
      requiresAuthenticatedCustomer: context.actor.kind === "anonymous" && !guestCheckoutAllowed,
      cartEmpty: items.length === 0
    }
  };
};

export const getCartState = async (
  db: DatabaseClient,
  context: CartActorContext,
  options?: {
    createIfMissing?: boolean;
    requireGuestSession?: boolean;
  }
) => {
  const cart = await resolveCartForContext(db, context, options);
  const evaluation = await evaluateCart(db, cart, context);

  return {
    cart,
    evaluation
  };
};

export const assertCartCanCheckout = (evaluation: CheckoutEvaluation) => {
  if (evaluation.eligibilityFlags.cartEmpty) {
    throw cartEmptyError();
  }

  if (!evaluation.eligibilityFlags.canCheckout) {
    if (evaluation.priceChanges.length > 0) {
      throw priceChangedError(undefined, { priceChanges: evaluation.priceChanges });
    }

    if (evaluation.stockIssues.length > 0) {
      throw itemOutOfStockError(undefined, { stockIssues: evaluation.stockIssues });
    }

    if (evaluation.couponOutcome && !evaluation.couponOutcome.valid) {
      throw couponInvalidError(evaluation.couponOutcome.message, {
        couponOutcome: evaluation.couponOutcome
      });
    }

    throw invalidInputError("The cart is not eligible for checkout.", {
      blockingIssues: evaluation.blockingIssues
    });
  }
};

export const assertCouponCanBeApplied = (couponOutcome: CouponEvaluation | null) => {
  if (!couponOutcome) {
    throw couponInvalidError();
  }

  if (!couponOutcome.valid) {
    throw couponInvalidError(couponOutcome.message, {
      couponOutcome
    });
  }
};

export const assertVariantCanBeAddedToCart = (variant: {
  id: string;
  status: VariantStatus;
  priceAmountCents: number | null;
  priceCurrency: string | null;
  product: {
    status: ProductStatus;
  };
  inventoryStocks: Array<{
    onHand: number;
    reserved: number;
  }>;
}, quantity: number) => {
  if (variant.product.status !== ProductStatus.PUBLISHED || variant.status !== VariantStatus.ACTIVE) {
    throw invalidInputError("The requested product variant is not currently purchasable.");
  }

  if (variant.priceAmountCents == null || !variant.priceCurrency) {
    throw invalidInputError("The requested product variant does not currently have pricing configured.");
  }

  const availableQuantity = variant.inventoryStocks.reduce(
    (sum, stock) => sum + (stock.onHand - stock.reserved),
    0
  );

  if (availableQuantity < quantity) {
    throw itemOutOfStockError(undefined, {
      variantId: variant.id,
      availableQuantity
    });
  }
};
