import { randomInt } from "node:crypto";

import { CheckoutPaymentIntentStatus, Prisma } from "@prisma/client";

import { invalidInputError, notFoundError } from "../../common/errors/app-error";
import { toPrismaJsonValue } from "../../common/database/prisma-json";

type MaterializationPayloadV1 = {
  v: 1;
  address: {
    fullName: string;
    email?: string;
    phone: string;
    country: string;
    region: string;
    city: string;
    line1: string;
    line2?: string;
    postalCode: string;
  };
  shippingMethodCode: string;
  campaignId?: string | null;
  normalizedTotals: {
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    taxCents: number;
    grandTotalCents: number;
    currency: string | null;
  };
  couponOutcome: {
    valid: boolean;
    couponId: string | null;
    appliedCode?: string | null;
    discountCents?: number;
    message?: string | null;
  } | null;
  lineItems: Array<{
    variantId: string;
    productTitle: string;
    unitPriceAmountCents: number;
    unitPriceCurrency: string;
    quantity: number;
  }>;
  identity: {
    userId: string | null;
    guestTrackingKey: string | null;
    contactEmail: string | null;
  };
  checkoutSessionId: string;
  cartId: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseDeferredMaterializationPayload = (value: Prisma.JsonValue): MaterializationPayloadV1 => {
  if (!isRecord(value) || value.v !== 1) {
    throw invalidInputError("The deferred checkout snapshot is missing or unsupported.");
  }

  const identity = isRecord(value.identity) ? value.identity : null;
  if (!identity) {
    throw invalidInputError("The deferred checkout snapshot is missing identity.");
  }

  const address = isRecord(value.address) ? value.address : null;
  if (
    !address ||
    typeof address.fullName !== "string" ||
    typeof address.phone !== "string" ||
    typeof address.country !== "string" ||
    typeof address.region !== "string" ||
    typeof address.city !== "string" ||
    typeof address.line1 !== "string" ||
    typeof address.postalCode !== "string"
  ) {
    throw invalidInputError("The deferred checkout snapshot is missing address fields.");
  }

  const lineItemsRaw = value.lineItems;
  if (!Array.isArray(lineItemsRaw) || lineItemsRaw.length === 0) {
    throw invalidInputError("The deferred checkout snapshot is missing line items.");
  }

  const lineItems: MaterializationPayloadV1["lineItems"] = [];
  for (const row of lineItemsRaw) {
    if (!isRecord(row)) {
      continue;
    }
    if (
      typeof row.variantId !== "string" ||
      typeof row.productTitle !== "string" ||
      typeof row.unitPriceAmountCents !== "number" ||
      typeof row.unitPriceCurrency !== "string" ||
      typeof row.quantity !== "number"
    ) {
      throw invalidInputError("The deferred checkout snapshot has invalid line items.");
    }
    lineItems.push({
      variantId: row.variantId,
      productTitle: row.productTitle,
      unitPriceAmountCents: Math.trunc(row.unitPriceAmountCents),
      unitPriceCurrency: row.unitPriceCurrency,
      quantity: Math.trunc(row.quantity)
    });
  }

  if (lineItems.length === 0) {
    throw invalidInputError("The deferred checkout snapshot has no valid line items.");
  }

  const nt = isRecord(value.normalizedTotals) ? value.normalizedTotals : null;
  if (
    !nt ||
    typeof nt.grandTotalCents !== "number" ||
    !Number.isFinite(nt.grandTotalCents) ||
    (nt.currency !== null && typeof nt.currency !== "string")
  ) {
    throw invalidInputError("The deferred checkout snapshot is missing totals.");
  }

  const couponOutcomeRaw = value.couponOutcome;
  let couponOutcome: MaterializationPayloadV1["couponOutcome"] = null;
  if (couponOutcomeRaw === null || couponOutcomeRaw === undefined) {
    couponOutcome = null;
  } else if (isRecord(couponOutcomeRaw) && typeof couponOutcomeRaw.valid === "boolean") {
    couponOutcome = {
      valid: couponOutcomeRaw.valid,
      couponId: typeof couponOutcomeRaw.couponId === "string" ? couponOutcomeRaw.couponId : null,
      appliedCode: typeof couponOutcomeRaw.appliedCode === "string" ? couponOutcomeRaw.appliedCode : null,
      discountCents: typeof couponOutcomeRaw.discountCents === "number" ? couponOutcomeRaw.discountCents : undefined,
      message: typeof couponOutcomeRaw.message === "string" ? couponOutcomeRaw.message : null
    };
  }

  return {
    v: 1,
    address: {
      fullName: address.fullName,
      ...(typeof address.email === "string" ? { email: address.email } : {}),
      phone: address.phone,
      country: address.country,
      region: address.region,
      city: address.city,
      line1: address.line1,
      ...(typeof address.line2 === "string" ? { line2: address.line2 } : {}),
      postalCode: address.postalCode
    },
    shippingMethodCode: typeof value.shippingMethodCode === "string" ? value.shippingMethodCode : "STANDARD",
    campaignId: typeof value.campaignId === "string" ? value.campaignId : null,
    normalizedTotals: {
      subtotalCents: typeof nt.subtotalCents === "number" ? Math.trunc(nt.subtotalCents) : 0,
      discountCents: typeof nt.discountCents === "number" ? Math.trunc(nt.discountCents) : 0,
      shippingCents: typeof nt.shippingCents === "number" ? Math.trunc(nt.shippingCents) : 0,
      taxCents: typeof nt.taxCents === "number" ? Math.trunc(nt.taxCents) : 0,
      grandTotalCents: Math.trunc(nt.grandTotalCents),
      currency: typeof nt.currency === "string" ? nt.currency : null
    },
    couponOutcome,
    lineItems,
    identity: {
      userId: typeof identity.userId === "string" ? identity.userId : null,
      guestTrackingKey: typeof identity.guestTrackingKey === "string" ? identity.guestTrackingKey : null,
      contactEmail: typeof identity.contactEmail === "string" ? identity.contactEmail : null
    },
    checkoutSessionId: typeof value.checkoutSessionId === "string" ? value.checkoutSessionId : "",
    cartId: typeof value.cartId === "string" ? value.cartId : ""
  };
};

export const buildDeferredMaterializationPayload = (input: MaterializationPayloadV1): Prisma.JsonValue =>
  input as unknown as Prisma.JsonValue;

const buildOrderNumber = () => {
  const now = new Date();
  const dateSegment = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  const randomSegment = String(randomInt(100000, 999999));
  return `ORD-${dateSegment}-${randomSegment}`;
};

/**
 * Creates the Order (CONFIRMED) and links Payment after PSP success. Idempotent per paymentId.
 */
export const materializeDeferredCheckoutPaymentInTransaction = async (
  transaction: Prisma.TransactionClient,
  paymentId: string
) => {
  const payment = await transaction.payment.findUnique({
    where: {
      id: paymentId
    },
    include: {
      order: true,
      checkoutPaymentIntent: true
    }
  });

  if (!payment) {
    throw notFoundError("The referenced payment was not found.");
  }

  if (payment.orderId && payment.order) {
    return {
      orderId: payment.order.id,
      orderNumber: payment.order.orderNumber,
      alreadyMaterialized: true as const
    };
  }

  const intent = payment.checkoutPaymentIntent;
  if (!intent) {
    throw invalidInputError("This payment is not linked to a deferred checkout intent.");
  }

  if (intent.status === CheckoutPaymentIntentStatus.FULFILLED && intent.orderId) {
    await transaction.payment.updateMany({
      where: {
        id: payment.id,
        orderId: null
      },
      data: {
        orderId: intent.orderId
      }
    });

    const order = await transaction.order.findUnique({
      where: {
        id: intent.orderId
      },
      select: {
        id: true,
        orderNumber: true
      }
    });

    if (!order) {
      throw invalidInputError("The fulfilled checkout intent references a missing order.");
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      alreadyMaterialized: true as const
    };
  }

  const payload = parseDeferredMaterializationPayload(intent.materializationPayload);

  const order = await transaction.order.create({
    data: {
      orderNumber: buildOrderNumber(),
      userId: payload.identity.userId,
      guestTrackingKey: payload.identity.guestTrackingKey,
      status: "CONFIRMED",
      campaignId: payload.campaignId ?? null,
      addressSnapshot: toPrismaJsonValue({
        ...payload.address,
        contactEmail: payload.identity.contactEmail,
        shippingMethodCode: payload.shippingMethodCode,
        normalizedTotals: payload.normalizedTotals,
        couponOutcome: payload.couponOutcome
      })!
    }
  });

  await transaction.orderItem.createMany({
    data: payload.lineItems.map((item) => ({
      orderId: order.id,
      variantId: item.variantId,
      productTitleSnapshot: item.productTitle,
      unitPriceAmountCents: item.unitPriceAmountCents,
      unitPriceCurrency: item.unitPriceCurrency,
      quantity: item.quantity
    }))
  });

  await transaction.orderStatusHistory.create({
    data: {
      orderId: order.id,
      fromStatus: null,
      toStatus: "CONFIRMED",
      reason: "materialized_after_psp_success",
      metadata: toPrismaJsonValue({
        paymentId: payment.id,
        checkoutPaymentIntentId: intent.id
      })
    }
  });

  await transaction.timelineEvent.create({
    data: {
      entityType: "ORDER",
      entityId: order.id,
      eventType: "ORDER_CREATED",
      actorType: "SYSTEM",
      payload: toPrismaJsonValue({
        checkoutSessionId: payload.checkoutSessionId,
        deferredCheckout: true,
        paymentId: payment.id,
        totals: payload.normalizedTotals
      })
    }
  });

  if (payload.couponOutcome?.valid && payload.couponOutcome.couponId) {
    await transaction.couponRedemption.create({
      data: {
        couponId: payload.couponOutcome.couponId,
        orderId: order.id,
        userId: payload.identity.userId,
        guestTrackingKey: payload.identity.guestTrackingKey
      }
    });
  }

  await transaction.checkoutSession.update({
    where: {
      id: payload.checkoutSessionId
    },
    data: {
      orderId: order.id
    }
  });

  await transaction.stockReservation.updateMany({
    where: {
      paymentId: payment.id,
      releasedAt: null
    },
    data: {
      orderId: order.id
    }
  });

  await transaction.payment.update({
    where: {
      id: payment.id
    },
    data: {
      orderId: order.id
    }
  });

  await transaction.checkoutPaymentIntent.update({
    where: {
      id: intent.id
    },
    data: {
      status: CheckoutPaymentIntentStatus.FULFILLED,
      orderId: order.id
    }
  });

  await transaction.cart.update({
    where: {
      id: payload.cartId
    },
    data: {
      appliedCouponCode: null
    }
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    alreadyMaterialized: false as const
  };
};
