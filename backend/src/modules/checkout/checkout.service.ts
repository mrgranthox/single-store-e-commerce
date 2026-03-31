import { randomInt } from "node:crypto";

import {
  InventoryMovementType,
  PaymentState,
  Prisma
} from "@prisma/client";

import {
  invalidInputError,
  invalidStateTransitionError,
  notFoundError,
  orderNotEligibleError
} from "../../common/errors/app-error";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { getPaymentProvider } from "../payments/payment-provider.registry";
import { enqueueNotification } from "../notifications/notifications.service";
import {
  assertCartCanCheckout,
  getCartState,
  getReservationWindowMinutes,
  type CartActorContext,
  type CheckoutEvaluation
} from "../cart/cart.shared";

const buildOrderNumber = () => {
  const now = new Date();
  const dateSegment = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  const randomSegment = String(randomInt(100000, 999999));
  return `ORD-${dateSegment}-${randomSegment}`;
};

const buildCheckoutIdentity = (context: CartActorContext, address: { email?: string }) => {
  if (context.actor.kind === "customer") {
    return {
      userId: context.actor.userId ?? null,
      guestTrackingKey: null,
      contactEmail: context.actor.email ?? address.email ?? null
    };
  }

  return {
    userId: null,
    guestTrackingKey: context.sessionId,
    contactEmail: address.email ?? null
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertCheckoutIdentity = (
  context: CartActorContext,
  evaluation: CheckoutEvaluation,
  address: { email?: string }
) => {
  if (!evaluation.eligibilityFlags.guestCheckoutAllowed && context.actor.kind === "anonymous") {
    throw orderNotEligibleError("Guest checkout is disabled for this store.");
  }

  if (context.actor.kind === "anonymous" && !context.sessionId) {
    throw orderNotEligibleError("Guest checkout requires an x-session-id header.");
  }

  if (context.actor.kind === "anonymous" && !address.email) {
    throw invalidInputError("Guest checkout requires an email address in the checkout address.");
  }
};

const serializeOrderEntity = (order: {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}, evaluation: CheckoutEvaluation, checkoutSessionId: string) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  status: order.status,
  checkoutSessionId,
  totals: evaluation.normalizedTotals,
  paymentState: PaymentState.PENDING_INITIALIZATION,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt
});

const readGrandTotalFromSnapshot = (value: Prisma.JsonValue) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidInputError("The checkout validation snapshot is malformed.");
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.grandTotalCents !== "number" ||
    !Number.isFinite(record.grandTotalCents) ||
    (record.currency !== null && typeof record.currency !== "string")
  ) {
    throw invalidInputError("The checkout validation snapshot is missing totals.");
  }

  return {
    grandTotalCents: Math.trunc(record.grandTotalCents),
    currency: typeof record.currency === "string" ? record.currency : "GHS"
  };
};

const readContactEmailFromAddressSnapshot = (value: Prisma.JsonValue) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.contactEmail === "string" && record.contactEmail.trim()) {
    return record.contactEmail;
  }

  if (typeof record.email === "string" && record.email.trim()) {
    return record.email;
  }

  return null;
};

const buildPaymentReference = (paymentId: string) => `pay_${paymentId.replaceAll("-", "")}`;

const buildPaymentCallbackUrl = (orderId: string, paymentId: string) => {
  const baseUrl = env.PAYSTACK_CALLBACK_URL || `${env.CUSTOMER_APP_URL}/checkout/payment/result`;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(paymentId)}`;
};

const readInitializationDetails = async (
  transaction: Prisma.TransactionClient,
  paymentId: string
) => {
  const initialization = await transaction.paymentTransaction.findFirst({
    where: {
      paymentId,
      providerEventType: "INITIALIZE"
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const payload = isRecord(initialization?.payload) ? initialization.payload : null;

  return {
    providerPayload: payload?.providerPayload,
    requiresRedirect: Boolean(payload?.requiresRedirect),
    redirectUrl: typeof payload?.redirectUrl === "string" ? payload.redirectUrl : null
  };
};

export const getCheckoutEligibility = async (context: CartActorContext) => {
  const { evaluation } = await getCartState(prisma, context);

  return {
    canCheckout: evaluation.eligibilityFlags.canCheckout,
    guestCheckoutAllowed: evaluation.eligibilityFlags.guestCheckoutAllowed,
    requiresGuestSession: evaluation.eligibilityFlags.requiresGuestSession,
    requiresAuthenticatedCustomer: evaluation.eligibilityFlags.requiresAuthenticatedCustomer,
    cartEmpty: evaluation.eligibilityFlags.cartEmpty,
    blockingIssues: evaluation.blockingIssues
  };
};

export const validateCheckout = async (
  context: CartActorContext,
  input: {
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
  }
) => {
  const { evaluation } = await getCartState(prisma, context);

  return {
    normalizedTotals: evaluation.normalizedTotals,
    shippingOptions: evaluation.shippingOptions.map((option) => ({
      ...option,
      selected: option.code === input.shippingMethodCode
    })),
    couponOutcome: evaluation.couponOutcome,
    warnings: evaluation.warnings,
    blockedItems: evaluation.blockedItems,
    eligibilityFlags: evaluation.eligibilityFlags,
    priceChanges: evaluation.priceChanges,
    stockIssues: evaluation.stockIssues,
    blockingIssues: evaluation.blockingIssues
  };
};

export const createOrderFromCheckout = async (
  context: CartActorContext,
  input: {
    checkoutIdempotencyKey: string;
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
    campaignId?: string;
  }
) =>
  runInTransaction(async (transaction) => {
    const { cart, evaluation } = await getCartState(transaction, context, {
      requireGuestSession: false
    });

    if (!cart) {
      throw orderNotEligibleError("The current cart could not be found.");
    }

    assertCheckoutIdentity(context, evaluation, input.address);
    assertCartCanCheckout(evaluation);

    const existingSession = await transaction.checkoutSession.findUnique({
      where: {
        checkoutIdempotencyKey: input.checkoutIdempotencyKey
      },
      include: {
        order: true
      }
    });

    if (existingSession?.order) {
      return serializeOrderEntity(existingSession.order, evaluation, existingSession.id);
    }

    if (existingSession && existingSession.cartId !== cart.id) {
      throw invalidInputError("This checkout idempotency key is already bound to a different cart.");
    }

    if (input.campaignId) {
      const campaign = await transaction.campaign.findUnique({
        where: { id: input.campaignId },
        select: {
          id: true,
          status: true,
          promotion: {
            select: {
              status: true,
              activeFrom: true,
              activeTo: true
            }
          }
        }
      });
      if (!campaign) {
        throw invalidInputError("The referenced marketing campaign was not found.");
      }

      if (campaign.status !== "ACTIVE") {
        throw orderNotEligibleError("The selected campaign is not currently active.");
      }

      const promotion = campaign.promotion;
      const now = new Date();
      if (
        promotion &&
        (promotion.status !== "ACTIVE" ||
          (promotion.activeFrom && promotion.activeFrom > now) ||
          (promotion.activeTo && promotion.activeTo < now))
      ) {
        throw orderNotEligibleError("The selected campaign is not currently eligible for checkout.");
      }
    }

    const identity = buildCheckoutIdentity(context, input.address);

    const checkoutSession =
      existingSession ??
      (await transaction.checkoutSession.create({
        data: {
          cartId: cart.id,
          userId: identity.userId,
          guestTrackingKey: identity.guestTrackingKey,
          checkoutIdempotencyKey: input.checkoutIdempotencyKey
        }
      }));

    await transaction.checkoutValidationSnapshot.create({
      data: {
        checkoutSessionId: checkoutSession.id,
        normalizedTotals: toPrismaJsonValue(evaluation.normalizedTotals)!,
        shippingOptions: toPrismaJsonValue(
          evaluation.shippingOptions.map((option) => ({
            ...option,
            selected: option.code === input.shippingMethodCode
          }))
        )!,
        couponOutcome: toPrismaJsonValue(evaluation.couponOutcome),
        warnings: toPrismaJsonValue(evaluation.warnings),
        blockedItems: toPrismaJsonValue(evaluation.blockedItems),
        eligibilityFlags: toPrismaJsonValue(evaluation.eligibilityFlags)
      }
    });

    const order = await transaction.order.create({
      data: {
        orderNumber: buildOrderNumber(),
        userId: identity.userId,
        guestTrackingKey: identity.guestTrackingKey,
        status: "PENDING_PAYMENT",
        campaignId: input.campaignId ?? null,
        addressSnapshot: toPrismaJsonValue({
          ...input.address,
          contactEmail: identity.contactEmail,
          shippingMethodCode: input.shippingMethodCode,
          normalizedTotals: evaluation.normalizedTotals,
          couponOutcome: evaluation.couponOutcome
        })!
      }
    });

    await transaction.orderItem.createMany({
      data: evaluation.items.map((item) => ({
        orderId: order.id,
        variantId: item.variantId,
        productTitleSnapshot: item.product.title,
        unitPriceAmountCents: item.pricing.current!.amountCents,
        unitPriceCurrency: item.pricing.current!.currency,
        quantity: item.quantity
      }))
    });

    await transaction.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: "PENDING_PAYMENT",
        metadata: toPrismaJsonValue({
          checkoutSessionId: checkoutSession.id
        })
      }
    });

    await transaction.timelineEvent.create({
      data: {
        entityType: "ORDER",
        entityId: order.id,
        eventType: "ORDER_CREATED",
        actorType: context.actor.kind === "customer" ? "CUSTOMER" : "SYSTEM",
        payload: toPrismaJsonValue({
          checkoutSessionId: checkoutSession.id,
          totals: evaluation.normalizedTotals
        })
      }
    });

    if (evaluation.couponOutcome?.valid && evaluation.couponOutcome.couponId) {
      await transaction.couponRedemption.create({
        data: {
          couponId: evaluation.couponOutcome.couponId,
          orderId: order.id,
          userId: identity.userId,
          guestTrackingKey: identity.guestTrackingKey
        }
      });
    }

    await transaction.checkoutSession.update({
      where: {
        id: checkoutSession.id
      },
      data: {
        orderId: order.id
      }
    });

    return serializeOrderEntity(order, evaluation, checkoutSession.id);
  });

export const initializeCheckoutPayment = async (
  context: CartActorContext,
  input: {
    orderId: string;
    paymentIdempotencyKey: string;
    provider?: string;
    channel: "card" | "mobile_money";
    mobileMoney?: {
      phone: string;
      provider: string;
    };
  }
) =>
  runInTransaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: {
        id: input.orderId
      },
      include: {
        items: true,
        checkoutSession: true
      }
    });

    if (!order) {
      throw notFoundError("The requested order was not found.");
    }

    if (
      (context.actor.kind === "customer" && order.userId !== context.actor.userId) ||
      (context.actor.kind === "anonymous" && order.guestTrackingKey !== context.sessionId) ||
      context.actor.kind === "admin" ||
      context.actor.kind === "system"
    ) {
      throw notFoundError("The requested order was not found.");
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw invalidStateTransitionError("Payment can only be initialized for orders pending payment.");
    }

    if (!order.checkoutSession) {
      throw invalidInputError("The order does not have a checkout session for payment initialization.");
    }

    const existingPayment = await transaction.payment.findUnique({
      where: {
        orderId_idempotencyKey: {
          orderId: order.id,
          idempotencyKey: input.paymentIdempotencyKey
        }
      }
    });

    if (existingPayment) {
      const initialization = await readInitializationDetails(transaction, existingPayment.id);

      return {
        response: {
          id: existingPayment.id,
          orderId: order.id,
          paymentState: existingPayment.paymentState,
          provider: existingPayment.provider,
          amountCents: existingPayment.amountCents,
          currency: existingPayment.currency,
          checkoutSessionId: order.checkoutSession.id,
          requiresRedirect: initialization.requiresRedirect,
          redirectUrl: initialization.redirectUrl,
          providerPayload: initialization.providerPayload ?? null
        },
        notificationContext: null
      };
    }

    const activePayment = await transaction.payment.findFirst({
      where: {
        orderId: order.id,
        paymentState: {
          in: [PaymentState.PENDING_INITIALIZATION, PaymentState.INITIALIZED, PaymentState.AWAITING_CUSTOMER_ACTION]
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (activePayment) {
      const initialization = await readInitializationDetails(transaction, activePayment.id);

      return {
        response: {
          id: activePayment.id,
          orderId: order.id,
          paymentState: activePayment.paymentState,
          provider: activePayment.provider,
          amountCents: activePayment.amountCents,
          currency: activePayment.currency,
          checkoutSessionId: order.checkoutSession.id,
          requiresRedirect: initialization.requiresRedirect,
          redirectUrl: initialization.redirectUrl,
          providerPayload: initialization.providerPayload ?? null
        },
        notificationContext: null
      };
    }

    const latestValidationSnapshot = await transaction.checkoutValidationSnapshot.findFirst({
      where: {
        checkoutSessionId: order.checkoutSession.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!latestValidationSnapshot) {
      throw invalidInputError("The order does not have a validation snapshot for payment initialization.");
    }

    const totals = readGrandTotalFromSnapshot(latestValidationSnapshot.normalizedTotals);
    const provider = getPaymentProvider(input.provider ?? env.PAYMENT_PROVIDER);
    const customerEmail = readContactEmailFromAddressSnapshot(order.addressSnapshot);

    if (!customerEmail) {
      throw invalidInputError("A contact email is required before a Paystack payment can be initialized.");
    }

    const payment = await transaction.payment.create({
      data: {
        orderId: order.id,
        checkoutSessionId: order.checkoutSession.id,
        provider: provider.name,
        providerPaymentRef: null,
        paymentState: PaymentState.PENDING_INITIALIZATION,
        amountCents: totals.grandTotalCents,
        currency: totals.currency,
        idempotencyKey: input.paymentIdempotencyKey
      }
    });

    const paymentAttempt = await transaction.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNo: 1,
        provider: payment.provider
      }
    });

    await transaction.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        paymentAttemptId: paymentAttempt.id,
        providerEventType: "INITIALIZE",
        providerRef: payment.providerPaymentRef,
        amountCents: payment.amountCents,
        currency: payment.currency,
        status: "INITIALIZED",
        payload: toPrismaJsonValue({
          channel: input.channel,
          mobileMoneyProvider: input.mobileMoney?.provider ?? null,
          mobileMoneyPhone: input.mobileMoney?.phone ?? null,
          checkoutSessionId: order.checkoutSession.id,
          paymentIdempotencyKey: input.paymentIdempotencyKey,
          orderNumber: order.orderNumber
        })
      }
    });

    const reservationWindowMinutes = await getReservationWindowMinutes(transaction);
    const expiresAt = new Date(Date.now() + reservationWindowMinutes * 60_000);

    for (const item of order.items) {
      const stocks = await transaction.inventoryStock.findMany({
        where: {
          variantId: item.variantId
        },
        orderBy: [
          {
            onHand: "desc"
          },
          {
            updatedAt: "asc"
          }
        ]
      });

      const totalAvailable = stocks.reduce((sum, stock) => sum + (stock.onHand - stock.reserved), 0);

      if (totalAvailable < item.quantity) {
        throw orderNotEligibleError("The order is no longer fully in stock for payment initialization.", {
          variantId: item.variantId,
          requestedQuantity: item.quantity,
          availableQuantity: totalAvailable
        });
      }

      let remainingQuantity = item.quantity;

      for (const stock of stocks) {
        if (remainingQuantity === 0) {
          break;
        }

        const availableQuantity = stock.onHand - stock.reserved;
        if (availableQuantity <= 0) {
          continue;
        }

        const reservedQuantity = Math.min(availableQuantity, remainingQuantity);
        const nextReserved = stock.reserved + reservedQuantity;

        await transaction.inventoryStock.update({
          where: {
            id: stock.id
          },
          data: {
            reserved: nextReserved
          }
        });

        const reservation = await transaction.stockReservation.create({
          data: {
            inventoryStockId: stock.id,
            reservedQuantity,
            expiresAt,
            paymentId: payment.id,
            orderId: order.id,
            reason: "checkout_payment_initialization"
          }
        });

        await transaction.inventoryMovement.create({
          data: {
            inventoryStockId: stock.id,
            reservationId: reservation.id,
            movementType: InventoryMovementType.RESERVATION,
            deltaOnHand: 0,
            deltaReserved: reservedQuantity,
            resultingOnHand: stock.onHand,
            resultingReserved: nextReserved,
            reason: "checkout_payment_initialization"
          }
        });

        remainingQuantity -= reservedQuantity;
      }
    }

    const initialization = await provider.initializePayment({
      orderId: order.id,
        paymentId: payment.id,
        reference: buildPaymentReference(payment.id),
        amountCents: payment.amountCents,
        currency: payment.currency,
        customerEmail,
        callbackUrl: buildPaymentCallbackUrl(order.id, payment.id),
        channel: input.channel,
        mobileMoney: input.mobileMoney ?? null,
        metadata: {
          checkoutSessionId: order.checkoutSession.id
        }
      });

    const updatedPayment = await transaction.payment.update({
      where: {
        id: payment.id
      },
      data: {
        providerPaymentRef: initialization.providerPaymentRef,
        paymentState: initialization.paymentState
      }
    });

    await transaction.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        paymentAttemptId: paymentAttempt.id,
        providerEventType: "INITIALIZE_RESULT",
        providerRef: initialization.providerPaymentRef,
        amountCents: payment.amountCents,
        currency: payment.currency,
        status: initialization.paymentState,
        payload: toPrismaJsonValue(initialization.providerPayload)
      }
    });

    await transaction.paymentTransaction.updateMany({
      where: {
        paymentId: payment.id,
        paymentAttemptId: paymentAttempt.id,
        providerEventType: "INITIALIZE"
      },
      data: {
        providerRef: initialization.providerPaymentRef,
        status: "INITIALIZED",
        payload: toPrismaJsonValue({
          channel: input.channel,
          requiresRedirect: initialization.requiresRedirect,
          redirectUrl: initialization.redirectUrl,
          providerPayload: initialization.providerPayload
        })
      }
    });

    await transaction.timelineEvent.create({
      data: {
        entityType: "ORDER",
        entityId: order.id,
        eventType: "PAYMENT_INITIALIZED",
        actorType: "SYSTEM",
        payload: toPrismaJsonValue({
          paymentId: payment.id,
          amountCents: payment.amountCents,
          currency: payment.currency,
          provider: provider.name,
          requiresRedirect: initialization.requiresRedirect
        })
      }
    });

    return {
      response: {
        id: updatedPayment.id,
        orderId: order.id,
        paymentState: updatedPayment.paymentState,
        provider: updatedPayment.provider,
        amountCents: updatedPayment.amountCents,
        currency: updatedPayment.currency,
        checkoutSessionId: order.checkoutSession.id,
        requiresRedirect: initialization.requiresRedirect,
        redirectUrl: initialization.redirectUrl,
        providerPayload: initialization.providerPayload ?? null
      },
      notificationContext: {
        paymentId: updatedPayment.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail,
        amountCents: updatedPayment.amountCents,
        currency: updatedPayment.currency,
        channel: input.channel,
        providerPayload: initialization.providerPayload
      }
    };
  }).then(async (result) => {
    if (result.notificationContext) {
      await enqueueNotification({
        type: "ORDER_PAYMENT_ACTION_REQUIRED",
        recipientEmail: result.notificationContext.customerEmail,
        recipientType: "EMAIL",
        payload: {
          paymentId: result.notificationContext.paymentId,
          orderId: result.notificationContext.orderId,
          orderNumber: result.notificationContext.orderNumber,
          amountCents: result.notificationContext.amountCents,
          currency: result.notificationContext.currency,
          paymentChannel: result.notificationContext.channel,
          providerPayload: result.notificationContext.providerPayload
        }
      }).catch(() => {
        return null;
      });
    }

    return result.response;
  });
