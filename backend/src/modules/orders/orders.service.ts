import {
  InventoryMovementType,
  PaymentState,
  Prisma,
  ShipmentStatus
} from "@prisma/client";

import {
  invalidInputError,
  invalidStateTransitionError,
  notFoundError,
  orderNotEligibleError,
  orderNotFoundError
} from "../../common/errors/app-error";
import {
  buildPagination,
  buildPaginationPayload,
  type PaginationInput
} from "../../common/http/pagination";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { prisma } from "../../config/prisma";

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

const orderInclude = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  },
  items: {
    orderBy: {
      createdAt: "asc" as const
    }
  },
  payments: {
    orderBy: {
      createdAt: "desc" as const
    }
  },
  shipments: {
    orderBy: {
      createdAt: "desc" as const
    },
    include: {
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      trackingEvents: {
        orderBy: {
          occurredAt: "asc" as const
        }
      }
    }
  },
  cancellationRequests: {
    orderBy: {
      createdAt: "desc" as const
    }
  },
  campaign: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  }
} satisfies Prisma.OrderInclude;

type OrderRecord = {
  id: string;
  userId: string | null;
  guestTrackingKey: string | null;
  campaignId: string | null;
  campaign: {
    id: string;
    name: string;
    slug: string;
  } | null;
  orderNumber: string;
  status: string;
  addressSnapshot: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  items: Array<{
    id: string;
    variantId: string;
    productTitleSnapshot: string;
    unitPriceAmountCents: number;
    unitPriceCurrency: string;
    quantity: number;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    providerPaymentRef: string | null;
    paymentState: PaymentState;
    amountCents: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  shipments: Array<{
    id: string;
    status: ShipmentStatus;
    trackingNumber: string | null;
    carrier: string | null;
    createdAt: Date;
    updatedAt: Date;
    warehouse: {
      id: string;
      code: string;
      name: string;
    };
    trackingEvents: Array<{
      id: string;
      eventType: string | null;
      statusLabel: string;
      occurredAt: Date;
      location: string | null;
      payload: Prisma.JsonValue | null;
    }>;
  }>;
  cancellationRequests: Array<{
    id: string;
    status: string;
    reason: string | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedByAdminUserId: string | null;
    resolvedAt: Date | null;
    resolvedNote: string | null;
  }>;
};

const orderStatusTransitions: Record<string, string[]> = {
  DRAFT: ["PENDING_PAYMENT"],
  PENDING_PAYMENT: ["CONFIRMED", "CLOSED"],
  CONFIRMED: ["PROCESSING", "COMPLETED", "CLOSED"],
  PROCESSING: ["COMPLETED", "CLOSED"],
  COMPLETED: ["CLOSED"],
  CANCELLED: ["CLOSED"],
  CLOSED: []
};

const finalPaymentStates = new Set<PaymentState>([
  PaymentState.PAID,
  PaymentState.FAILED,
  PaymentState.CANCELLED,
  PaymentState.REFUNDED
]);

const refundablePaymentStates = new Set<PaymentState>([
  PaymentState.PAID,
  PaymentState.PARTIALLY_REFUNDED,
  PaymentState.REFUND_PENDING
]);

const shippableShipmentStates = new Set<ShipmentStatus>([
  ShipmentStatus.DISPATCHED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERED
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readAddressSnapshot = (value: Prisma.JsonValue) => {
  const record = isRecord(value) ? value : {};
  const fulfillmentAssignment = isRecord(record.fulfillmentAssignment)
    ? record.fulfillmentAssignment
    : null;

  return {
    fullName: typeof record.fullName === "string" ? record.fullName : null,
    email:
      typeof record.contactEmail === "string"
        ? record.contactEmail
        : typeof record.email === "string"
          ? record.email
          : null,
    phone: typeof record.phone === "string" ? record.phone : null,
    country: typeof record.country === "string" ? record.country : null,
    region: typeof record.region === "string" ? record.region : null,
    city: typeof record.city === "string" ? record.city : null,
    line1: typeof record.line1 === "string" ? record.line1 : null,
    line2: typeof record.line2 === "string" ? record.line2 : null,
    postalCode: typeof record.postalCode === "string" ? record.postalCode : null,
    shippingMethodCode:
      typeof record.shippingMethodCode === "string" ? record.shippingMethodCode : null,
    normalizedTotals: isRecord(record.normalizedTotals) ? record.normalizedTotals : null,
    couponOutcome: isRecord(record.couponOutcome) ? record.couponOutcome : null,
    fulfillmentAssignment: fulfillmentAssignment
      ? {
          warehouse:
            isRecord(fulfillmentAssignment.warehouse) &&
            typeof fulfillmentAssignment.warehouse.id === "string" &&
            typeof fulfillmentAssignment.warehouse.code === "string" &&
            typeof fulfillmentAssignment.warehouse.name === "string"
              ? {
                  id: fulfillmentAssignment.warehouse.id,
                  code: fulfillmentAssignment.warehouse.code,
                  name: fulfillmentAssignment.warehouse.name
                }
              : null,
          assignedAt:
            typeof fulfillmentAssignment.assignedAt === "string"
              ? fulfillmentAssignment.assignedAt
              : null,
          assignedByAdminUserId:
            typeof fulfillmentAssignment.assignedByAdminUserId === "string"
              ? fulfillmentAssignment.assignedByAdminUserId
              : null,
          reason:
            typeof fulfillmentAssignment.reason === "string"
              ? fulfillmentAssignment.reason
              : null,
          note: typeof fulfillmentAssignment.note === "string" ? fulfillmentAssignment.note : null
        }
      : null
  };
};

const latestPaymentForOrder = (order: Pick<OrderRecord, "payments">) => order.payments[0] ?? null;

const serializePaymentSummary = (order: Pick<OrderRecord, "payments" | "addressSnapshot">) => {
  const latestPayment = latestPaymentForOrder(order);
  const addressSnapshot = readAddressSnapshot(order.addressSnapshot);

  if (!latestPayment) {
    return {
      id: null,
      provider: null,
      providerPaymentRef: null,
      paymentState: PaymentState.PENDING_INITIALIZATION,
      amountCents:
        typeof addressSnapshot.normalizedTotals?.grandTotalCents === "number"
          ? addressSnapshot.normalizedTotals.grandTotalCents
          : null,
      currency:
        typeof addressSnapshot.normalizedTotals?.currency === "string"
          ? addressSnapshot.normalizedTotals.currency
          : "GHS",
      createdAt: null,
      updatedAt: null
    };
  }

  return {
    id: latestPayment.id,
    provider: latestPayment.provider,
    providerPaymentRef: latestPayment.providerPaymentRef,
    paymentState: latestPayment.paymentState,
    amountCents: latestPayment.amountCents,
    currency: latestPayment.currency,
    createdAt: latestPayment.createdAt,
    updatedAt: latestPayment.updatedAt
  };
};

const serializeOrderItems = (order: Pick<OrderRecord, "items">) =>
  order.items.map((item) => ({
    id: item.id,
    variantId: item.variantId,
    productTitle: item.productTitleSnapshot,
    unitPriceAmountCents: item.unitPriceAmountCents,
    unitPriceCurrency: item.unitPriceCurrency,
    quantity: item.quantity,
    lineTotalCents: item.quantity * item.unitPriceAmountCents
  }));

const serializeShipments = (order: Pick<OrderRecord, "shipments">) =>
  order.shipments.map((shipment) => ({
    id: shipment.id,
    status: shipment.status,
    warehouse: shipment.warehouse,
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
    trackingEvents: shipment.trackingEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      statusLabel: event.statusLabel,
      occurredAt: event.occurredAt,
      location: event.location,
      payload: event.payload
    }))
  }));

const buildFulfillmentSummary = (order: Pick<OrderRecord, "shipments">) => {
  const latestShipment = order.shipments[0] ?? null;

  return {
    status: latestShipment?.status ?? "UNFULFILLED",
    shipmentCount: order.shipments.length,
    trackingAvailable: order.shipments.some(
      (shipment) => shipment.trackingEvents.length > 0 || Boolean(shipment.trackingNumber)
    ),
    latestTrackingNumber: latestShipment?.trackingNumber ?? null
  };
};

const buildCustomerSummary = (order: Pick<OrderRecord, "user" | "userId" | "addressSnapshot">) => {
  const addressSnapshot = readAddressSnapshot(order.addressSnapshot);
  const nameParts = [order.user?.firstName, order.user?.lastName].filter(Boolean);

  return {
    id: order.user?.id ?? null,
    email: order.user?.email ?? addressSnapshot.email,
    guest: !order.userId,
    name: nameParts.length > 0 ? nameParts.join(" ") : addressSnapshot.fullName
  };
};

const latestCancellationRequest = (order: Pick<OrderRecord, "cancellationRequests">) =>
  order.cancellationRequests[0] ?? null;

const buildEligibility = (order: Pick<OrderRecord, "status" | "shipments" | "payments" | "cancellationRequests">) => {
  const latestPayment = latestPaymentForOrder(order);
  const pendingCancellation = order.cancellationRequests.find(
    (request) => request.status === "PENDING_APPROVAL"
  );
  const hasShipped = order.shipments.some((shipment) => shippableShipmentStates.has(shipment.status));
  const delivered = order.shipments.some((shipment) => shipment.status === ShipmentStatus.DELIVERED);

  let canCancel = true;
  let cancelReasonCode: string | null = null;
  let cancelReasonMessage: string | null = null;

  if (order.status === "CANCELLED") {
    canCancel = false;
    cancelReasonCode = "ORDER_ALREADY_CANCELLED";
    cancelReasonMessage = "This order has already been cancelled.";
  } else if (order.status === "COMPLETED" || order.status === "CLOSED") {
    canCancel = false;
    cancelReasonCode = "ORDER_ALREADY_COMPLETED";
    cancelReasonMessage = "This order can no longer be cancelled.";
  } else if (pendingCancellation) {
    canCancel = false;
    cancelReasonCode = "CANCELLATION_ALREADY_REQUESTED";
    cancelReasonMessage = "A cancellation request is already pending for this order.";
  } else if (hasShipped) {
    canCancel = false;
    cancelReasonCode = "ORDER_ALREADY_SHIPPED";
    cancelReasonMessage = "This order has already been shipped and can no longer be cancelled.";
  }

  const canReturn = delivered && order.status !== "CANCELLED";
  const canReview = delivered && order.status !== "CANCELLED";
  const canRefundRequest =
    latestPayment !== null && refundablePaymentStates.has(latestPayment.paymentState);
  const canOpenSupportTicket = true;

  return {
    canCancel,
    cancelReasonCode,
    cancelReasonMessage,
    canReturn,
    returnReasonCode: canReturn ? null : "ORDER_NOT_DELIVERED",
    returnReasonMessage: canReturn ? null : "This order must be delivered before a return can start.",
    canRefundRequest,
    canRequestRefund: canRefundRequest,
    refundReasonCode: canRefundRequest ? null : "PAYMENT_NOT_SETTLED",
    refundReasonMessage: canRefundRequest ? null : "A settled payment is required before refund actions are available.",
    canReview,
    canReviewItems: canReview,
    reviewReasonCode: canReview ? null : "NOT_DELIVERED_YET",
    reviewReasonMessage: canReview ? null : "You can review this order after delivery.",
    canOpenSupportTicket
  };
};

const serializeOrderListItem = (order: OrderRecord) => {
  const addressSnapshot = readAddressSnapshot(order.addressSnapshot);
  const totals = addressSnapshot.normalizedTotals;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    totals,
    paymentState: serializePaymentSummary(order).paymentState,
    fulfillment: buildFulfillmentSummary(order),
    eligibility: buildEligibility(order),
    customer: buildCustomerSummary(order),
    assignedWarehouse: addressSnapshot.fulfillmentAssignment?.warehouse ?? null
  };
};

const serializeOrderDetail = (order: OrderRecord) => {
  const addressSnapshot = readAddressSnapshot(order.addressSnapshot);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    campaignId: order.campaignId,
    campaign: order.campaign,
    customer: buildCustomerSummary(order),
    payment: serializePaymentSummary(order),
    fulfillment: buildFulfillmentSummary(order),
    shipments: serializeShipments(order),
    items: serializeOrderItems(order),
    addressSnapshot,
    totals: addressSnapshot.normalizedTotals,
    couponOutcome: addressSnapshot.couponOutcome,
    assignedWarehouse: addressSnapshot.fulfillmentAssignment?.warehouse ?? null,
    latestCancellationRequest: latestCancellationRequest(order),
    eligibility: buildEligibility(order)
  };
};

const assertOrderCanCancel = (order: OrderRecord) => {
  const eligibility = buildEligibility(order);

  if (!eligibility.canCancel) {
    throw orderNotEligibleError(
      eligibility.cancelReasonMessage ?? "This order can no longer be cancelled.",
      {
        reasonCode: eligibility.cancelReasonCode
      }
    );
  }
};

const accountOrderWhere = (customerUserId: string, orderId?: string) => ({
  userId: customerUserId,
  ...(orderId ? { id: orderId } : {})
});

const loadAccountOrderOrThrow = async (customerUserId: string, orderId: string) => {
  const order = await prisma.order.findFirst({
    where: accountOrderWhere(customerUserId, orderId),
    include: orderInclude
  });

  if (!order) {
    throw orderNotFoundError();
  }

  return order;
};

const loadAdminOrderOrThrow = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId
    },
    include: orderInclude
  });

  if (!order) {
    throw orderNotFoundError();
  }

  return order;
};

export const releaseOrderReservations = async (
  db: DatabaseClient,
  input: {
    orderId: string;
    releaseReason: string;
  }
) => {
  const reservations = await db.stockReservation.findMany({
    where: {
      releasedAt: null,
      OR: [{ orderId: input.orderId }, { payment: { is: { orderId: input.orderId } } }]
    }
  });

  for (const reservation of reservations) {
    const inventoryStock = await db.inventoryStock.findUnique({
      where: {
        id: reservation.inventoryStockId
      }
    });

    if (!inventoryStock) {
      continue;
    }

    const nextReserved = Math.max(0, inventoryStock.reserved - reservation.reservedQuantity);

    await db.inventoryStock.update({
      where: {
        id: inventoryStock.id
      },
      data: {
        reserved: nextReserved
      }
    });

    await db.stockReservation.update({
      where: {
        id: reservation.id
      },
      data: {
        releasedAt: new Date(),
        releasedReason: input.releaseReason
      }
    });

    await db.inventoryMovement.create({
      data: {
        inventoryStockId: inventoryStock.id,
        reservationId: reservation.id,
        movementType: InventoryMovementType.RESERVATION_RELEASE,
        deltaOnHand: 0,
        deltaReserved: -reservation.reservedQuantity,
        resultingOnHand: inventoryStock.onHand,
        resultingReserved: nextReserved,
        reason: input.releaseReason
      }
    });
  }

  return reservations.length;
};

export const finalizeOrderInventoryForFulfillment = async (
  db: DatabaseClient,
  input: {
    orderId: string;
    reason: string;
    actorAdminUserId?: string;
  }
) => {
  const existingDeductions = await db.inventoryMovement.count({
    where: {
      orderId: input.orderId,
      movementType: InventoryMovementType.DEDUCTION
    }
  });

  if (existingDeductions > 0) {
    return {
      alreadyFinalized: true,
      processedReservations: 0
    };
  }

  const reservations = await db.stockReservation.findMany({
    where: {
      releasedAt: null,
      OR: [{ orderId: input.orderId }, { payment: { is: { orderId: input.orderId } } }]
    }
  });

  for (const reservation of reservations) {
    const inventoryStock = await db.inventoryStock.findUnique({
      where: {
        id: reservation.inventoryStockId
      }
    });

    if (!inventoryStock) {
      continue;
    }

    if (inventoryStock.onHand < reservation.reservedQuantity) {
      throw invalidStateTransitionError(
        "Fulfillment cannot deduct more on-hand stock than is currently available.",
        {
          orderId: input.orderId,
          inventoryStockId: inventoryStock.id,
          reservedQuantity: reservation.reservedQuantity,
          onHand: inventoryStock.onHand
        }
      );
    }

    const nextOnHand = inventoryStock.onHand - reservation.reservedQuantity;
    const nextReserved = Math.max(0, inventoryStock.reserved - reservation.reservedQuantity);

    await db.inventoryStock.update({
      where: {
        id: inventoryStock.id
      },
      data: {
        onHand: nextOnHand,
        reserved: nextReserved
      }
    });

    await db.stockReservation.update({
      where: {
        id: reservation.id
      },
      data: {
        releasedAt: new Date(),
        releasedReason: input.reason
      }
    });

    await db.inventoryMovement.create({
      data: {
        inventoryStockId: inventoryStock.id,
        reservationId: reservation.id,
        movementType: InventoryMovementType.DEDUCTION,
        deltaOnHand: -reservation.reservedQuantity,
        deltaReserved: -reservation.reservedQuantity,
        resultingOnHand: nextOnHand,
        resultingReserved: nextReserved,
        reason: input.reason,
        actorAdminUserId: input.actorAdminUserId,
        orderId: input.orderId,
        paymentId: reservation.paymentId
      }
    });
  }

  if (reservations.length > 0) {
    await db.timelineEvent.create({
      data: {
        entityType: "ORDER",
        entityId: input.orderId,
        eventType: "ORDER_INVENTORY_FINALIZED",
        actorAdminUserId: input.actorAdminUserId,
        actorType: input.actorAdminUserId ? "ADMIN" : "SYSTEM",
        payload: toPrismaJsonValue({
          processedReservations: reservations.length,
          reason: input.reason
        })
      }
    });
  }

  return {
    alreadyFinalized: false,
    processedReservations: reservations.length
  };
};

const updateOrderStatusRecord = async (
  db: DatabaseClient,
  input: {
    orderId: string;
    fromStatus: string;
    toStatus: string;
    actorAdminUserId?: string;
    reason?: string;
    metadata?: unknown;
  }
) => {
  await db.order.update({
    where: {
      id: input.orderId
    },
    data: {
      status: input.toStatus
    }
  });

  await db.orderStatusHistory.create({
    data: {
      orderId: input.orderId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reason: input.reason,
      actorAdminUserId: input.actorAdminUserId,
      metadata: toPrismaJsonValue(input.metadata)
    }
  });
};

export const listAccountOrders = async (
  customerUserId: string,
  input: {
    page: number;
    page_size: number;
    status?: string;
  }
) => {
  const where: Prisma.OrderWhereInput = {
    userId: customerUserId,
    ...(input.status ? { status: input.status } : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.order.count({ where })
  ]);

  return {
    items: items.map(serializeOrderListItem),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAccountOrderDetail = async (customerUserId: string, orderId: string) => {
  const order = await loadAccountOrderOrThrow(customerUserId, orderId);
  return {
    entity: serializeOrderDetail(order)
  };
};

export const getAccountOrderTracking = async (customerUserId: string, orderId: string) => {
  const order = await loadAccountOrderOrThrow(customerUserId, orderId);

  return {
    entity: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      fulfillment: buildFulfillmentSummary(order),
      shipments: serializeShipments(order)
    }
  };
};

export const getAccountOrderEligibility = async (customerUserId: string, orderId: string) => {
  const order = await loadAccountOrderOrThrow(customerUserId, orderId);

  return {
    entity: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      ...buildEligibility(order)
    }
  };
};

export const requestAccountOrderCancellation = async (
  customerUserId: string,
  input: {
    orderId: string;
    reason: string;
    note?: string;
  }
) =>
  runInTransaction(async (transaction) => {
    const order = await transaction.order.findFirst({
      where: accountOrderWhere(customerUserId, input.orderId),
      include: orderInclude
    });

    if (!order) {
      throw orderNotFoundError();
    }

    assertOrderCanCancel(order);

    const existingRequest = order.cancellationRequests.find(
      (request) => request.status === "PENDING_APPROVAL"
    );

    if (existingRequest) {
      return {
        entity: existingRequest
      };
    }

    const cancellationRequest = await transaction.cancellationRequest.create({
      data: {
        orderId: order.id,
        status: "PENDING_APPROVAL",
        reason: input.reason,
        resolvedNote: input.note
      }
    });

    await transaction.timelineEvent.create({
      data: {
        entityType: "ORDER",
        entityId: order.id,
        eventType: "ORDER_CANCELLATION_REQUESTED",
        actorType: "CUSTOMER",
        payload: toPrismaJsonValue({
          cancellationRequestId: cancellationRequest.id,
          reason: input.reason,
          note: input.note
        })
      }
    });

    return {
      entity: cancellationRequest
    };
  });

export const trackGuestOrder = async (input: { orderNumber: string; email: string }) => {
  const order = await prisma.order.findFirst({
    where: {
      orderNumber: input.orderNumber
    },
    include: orderInclude
  });

  if (!order) {
    throw orderNotFoundError();
  }

  const addressSnapshot = readAddressSnapshot(order.addressSnapshot);
  const emailMatches =
    typeof addressSnapshot.email === "string" &&
    addressSnapshot.email.toLowerCase() === input.email.toLowerCase();

  if (!order.guestTrackingKey || !emailMatches) {
    throw orderNotFoundError();
  }

  return {
    entity: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      canTrackAsGuest: true,
      payment: serializePaymentSummary(order),
      fulfillment: buildFulfillmentSummary(order),
      shipments: serializeShipments(order),
      addressSnapshot
    }
  };
};

export const listAdminOrders = async (input: {
  page: number;
  page_size: number;
  q?: string;
  status?: string;
  paymentState?: PaymentState;
}) => {
  const where: Prisma.OrderWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.paymentState ? { payments: { some: { paymentState: input.paymentState } } } : {}),
    ...(input.q
      ? {
          OR: [
            {
              orderNumber: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              guestTrackingKey: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              user: {
                is: {
                  email: {
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
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.order.count({ where })
  ]);

  return {
    items: items.map(serializeOrderListItem),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAdminOrderDetail = async (orderId: string) => {
  const order = await loadAdminOrderOrThrow(orderId);
  return {
    entity: serializeOrderDetail(order)
  };
};

export const getAdminOrderTimeline = async (orderId: string) => {
  const [order, statusHistory, timelineEvents] = await Promise.all([
    loadAdminOrderOrThrow(orderId),
    prisma.orderStatusHistory.findMany({
      where: {
        orderId
      },
      orderBy: {
        changedAt: "asc"
      }
    }),
    prisma.timelineEvent.findMany({
      where: {
        entityType: "ORDER",
        entityId: orderId
      },
      orderBy: {
        occurredAt: "asc"
      }
    })
  ]);

  const items = [
    ...statusHistory.map((entry) => ({
      id: entry.id,
      kind: "STATUS_CHANGE",
      eventType: "ORDER_STATUS_CHANGED",
      label: entry.toStatus,
      occurredAt: entry.changedAt,
      actorType: entry.actorAdminUserId ? "ADMIN" : "SYSTEM",
      payload: {
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        reason: entry.reason,
        metadata: entry.metadata
      }
    })),
    ...timelineEvents.map((entry) => ({
      id: entry.id,
      kind: "TIMELINE_EVENT",
      eventType: entry.eventType,
      label: entry.eventType,
      occurredAt: entry.occurredAt,
      actorType: entry.actorType,
      payload: entry.payload
    })),
    ...order.cancellationRequests.map((entry) => ({
      id: entry.id,
      kind: "CANCELLATION_REQUEST",
      eventType: "ORDER_CANCELLATION_REQUEST",
      label: entry.status,
      occurredAt: entry.updatedAt,
      actorType: entry.resolvedByAdminUserId ? "ADMIN" : "CUSTOMER",
      payload: {
        status: entry.status,
        reason: entry.reason,
        resolvedAt: entry.resolvedAt,
        resolvedNote: entry.resolvedNote
      }
    }))
  ].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());

  return {
    entity: {
      id: order.id,
      orderNumber: order.orderNumber
    },
    timeline: items
  };
};

export const updateAdminOrderStatus = async (input: {
  actorAdminUserId: string;
  orderId: string;
  status: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: {
        id: input.orderId
      },
      include: orderInclude
    });

    if (!order) {
      throw orderNotFoundError();
    }

    if (input.status === "CANCELLED") {
      throw invalidInputError("Use the dedicated order cancellation route for cancelled orders.");
    }

    if (order.status === input.status) {
      throw invalidInputError("The order is already in the requested status.");
    }

    const allowedStatuses = orderStatusTransitions[order.status] ?? [];

    if (!allowedStatuses.includes(input.status)) {
      throw invalidStateTransitionError("The requested order status transition is not allowed.", {
        fromStatus: order.status,
        toStatus: input.status
      });
    }

    if (
      input.status === "COMPLETED" &&
      !order.shipments.some((shipment) => shipment.status === ShipmentStatus.DELIVERED)
    ) {
      throw invalidStateTransitionError(
        "An order can only be marked completed after at least one shipment is delivered."
      );
    }

    await updateOrderStatusRecord(transaction, {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: input.status,
      actorAdminUserId: input.actorAdminUserId,
      reason: input.reason,
      metadata: {
        note: input.note
      }
    });

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "orders.status.update",
          entityType: "ORDER",
          entityId: order.id,
          reason: input.reason,
          note: input.note,
          metadata: toPrismaJsonValue({
            fromStatus: order.status,
            toStatus: input.status
          })
        }
      }),
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "orders.detail",
          actionCode: "orders.status.update",
          reason: input.reason,
          note: input.note,
          entityType: "ORDER",
          entityId: order.id,
          before: toPrismaJsonValue({ status: order.status }),
          after: toPrismaJsonValue({ status: input.status })
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "ORDER",
          entityId: order.id,
          eventType: "ORDER_STATUS_UPDATED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            fromStatus: order.status,
            toStatus: input.status,
            reason: input.reason,
            note: input.note
          })
        }
      })
    ]);

    const updatedOrder = await transaction.order.findUnique({
      where: {
        id: order.id
      },
      include: orderInclude
    });

    return {
      entity: serializeOrderDetail(updatedOrder!)
    };
  });

export const assignAdminOrderWarehouse = async (input: {
  actorAdminUserId: string;
  orderId: string;
  warehouseId: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const [order, warehouse] = await Promise.all([
      transaction.order.findUnique({
        where: {
          id: input.orderId
        },
        include: orderInclude
      }),
      transaction.warehouse.findUnique({
        where: {
          id: input.warehouseId
        }
      })
    ]);

    if (!order) {
      throw orderNotFoundError();
    }

    if (!warehouse) {
      throw notFoundError("The requested warehouse was not found.");
    }

    const activeShipment = order.shipments.find(
      (shipment) => shipment.status !== ShipmentStatus.CANCELLED
    );

    if (activeShipment) {
      throw invalidStateTransitionError(
        "Warehouse assignment can only be changed before active shipment creation.",
        {
          orderId: order.id,
          shipmentId: activeShipment.id
        }
      );
    }

    const existingAddressSnapshot = isRecord(order.addressSnapshot) ? order.addressSnapshot : {};
    const beforeAssignment = readAddressSnapshot(order.addressSnapshot).fulfillmentAssignment;
    const fulfillmentAssignment = {
      warehouse: {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name
      },
      assignedAt: new Date().toISOString(),
      assignedByAdminUserId: input.actorAdminUserId,
      reason: input.reason ?? null,
      note: input.note ?? null
    };

    await transaction.order.update({
      where: {
        id: order.id
      },
      data: {
        addressSnapshot: toPrismaJsonValue({
          ...existingAddressSnapshot,
          fulfillmentAssignment
        })!
      }
    });

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "orders.warehouse.assign",
          entityType: "ORDER",
          entityId: order.id,
          reason: input.reason,
          note: input.note,
          metadata: toPrismaJsonValue({
            before: beforeAssignment,
            after: fulfillmentAssignment
          })
        }
      }),
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "orders.fulfillment",
          actionCode: "orders.warehouse.assign",
          entityType: "ORDER",
          entityId: order.id,
          reason: input.reason,
          note: input.note,
          before: toPrismaJsonValue(beforeAssignment),
          after: toPrismaJsonValue(fulfillmentAssignment)
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "ORDER",
          entityId: order.id,
          eventType: "ORDER_WAREHOUSE_ASSIGNED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            warehouse: fulfillmentAssignment.warehouse,
            reason: input.reason,
            note: input.note
          })
        }
      })
    ]);

    const updatedOrder = await transaction.order.findUnique({
      where: {
        id: order.id
      },
      include: orderInclude
    });

    return {
      entity: serializeOrderDetail(updatedOrder!)
    };
  });

export const patchAdminOrderCampaignAttribution = async (input: {
  actorAdminUserId: string;
  orderId: string;
  campaignId: string | null;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: {
        id: input.orderId
      },
      include: orderInclude
    });

    if (!order) {
      throw orderNotFoundError();
    }

    if (input.campaignId) {
      const campaign = await transaction.campaign.findUnique({
        where: {
          id: input.campaignId
        },
        select: {
          id: true
        }
      });
      if (!campaign) {
        throw notFoundError("The requested marketing campaign was not found.");
      }
    }

    const beforeCampaignId = order.campaignId;
    if (beforeCampaignId === input.campaignId) {
      return {
        entity: serializeOrderDetail(order)
      };
    }

    await transaction.order.update({
      where: {
        id: order.id
      },
      data: {
        campaignId: input.campaignId
      }
    });

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "orders.campaign.attribution",
          entityType: "ORDER",
          entityId: order.id,
          note: input.note,
          metadata: toPrismaJsonValue({
            beforeCampaignId,
            afterCampaignId: input.campaignId
          })
        }
      }),
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "orders.detail",
          actionCode: "orders.campaign.attribution",
          entityType: "ORDER",
          entityId: order.id,
          note: input.note,
          before: toPrismaJsonValue({ campaignId: beforeCampaignId }),
          after: toPrismaJsonValue({ campaignId: input.campaignId })
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "ORDER",
          entityId: order.id,
          eventType: "ORDER_CAMPAIGN_ATTRIBUTION_UPDATED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            beforeCampaignId,
            afterCampaignId: input.campaignId,
            note: input.note
          })
        }
      })
    ]);

    const updatedOrder = await transaction.order.findUnique({
      where: {
        id: order.id
      },
      include: orderInclude
    });

    return {
      entity: serializeOrderDetail(updatedOrder!)
    };
  });

export const cancelAdminOrder = async (input: {
  actorAdminUserId: string;
  orderId: string;
  reason: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: {
        id: input.orderId
      },
      include: orderInclude
    });

    if (!order) {
      throw orderNotFoundError();
    }

    assertOrderCanCancel(order);

    const releasedReservationCount = await releaseOrderReservations(transaction, {
      orderId: order.id,
      releaseReason: "order_cancelled"
    });

    await updateOrderStatusRecord(transaction, {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: "CANCELLED",
      actorAdminUserId: input.actorAdminUserId,
      reason: input.reason,
      metadata: {
        note: input.note,
        releasedReservationCount
      }
    });

    await transaction.payment.updateMany({
      where: {
        orderId: order.id,
        paymentState: {
          in: [
            PaymentState.PENDING_INITIALIZATION,
            PaymentState.INITIALIZED,
            PaymentState.AWAITING_CUSTOMER_ACTION
          ]
        }
      },
      data: {
        paymentState: PaymentState.CANCELLED
      }
    });

    const pendingRequestIds = order.cancellationRequests
      .filter((request) => request.status === "PENDING_APPROVAL")
      .map((request) => request.id);

    if (pendingRequestIds.length > 0) {
      await transaction.cancellationRequest.updateMany({
        where: {
          id: {
            in: pendingRequestIds
          }
        },
        data: {
          status: "COMPLETED",
          resolvedByAdminUserId: input.actorAdminUserId,
          resolvedAt: new Date(),
          resolvedNote: input.note ?? input.reason
        }
      });
    } else {
      await transaction.cancellationRequest.create({
        data: {
          orderId: order.id,
          status: "COMPLETED",
          reason: input.reason,
          resolvedByAdminUserId: input.actorAdminUserId,
          resolvedAt: new Date(),
          resolvedNote: input.note
        }
      });
    }

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "orders.cancel",
          entityType: "ORDER",
          entityId: order.id,
          reason: input.reason,
          note: input.note,
          metadata: toPrismaJsonValue({
            releasedReservationCount
          })
        }
      }),
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "orders.detail",
          actionCode: "orders.cancel",
          reason: input.reason,
          note: input.note,
          entityType: "ORDER",
          entityId: order.id,
          before: toPrismaJsonValue({ status: order.status }),
          after: toPrismaJsonValue({ status: "CANCELLED" })
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "ORDER",
          entityId: order.id,
          eventType: "ORDER_CANCELLED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            reason: input.reason,
            note: input.note,
            releasedReservationCount
          })
        }
      })
    ]);

    const updatedOrder = await transaction.order.findUnique({
      where: {
        id: order.id
      },
      include: orderInclude
    });

    return {
      entity: serializeOrderDetail(updatedOrder!)
    };
  });

const adminOrderSearchWhere = (q: string): Prisma.OrderWhereInput => ({
  OR: [
    {
      orderNumber: {
        contains: q,
        mode: "insensitive"
      }
    },
    {
      guestTrackingKey: {
        contains: q,
        mode: "insensitive"
      }
    },
    {
      user: {
        is: {
          email: {
            contains: q,
            mode: "insensitive"
          }
        }
      }
    }
  ]
});

export const listAdminFulfillmentQueue = async (input: PaginationInput & { q?: string }) => {
  const where: Prisma.OrderWhereInput = {
    status: {
      in: ["CONFIRMED", "PROCESSING"]
    },
    ...(input.q?.trim() ? adminOrderSearchWhere(input.q.trim()) : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: {
        createdAt: "asc"
      },
      ...buildPagination(input)
    }),
    prisma.order.count({ where })
  ]);

  return {
    items: items.map(serializeOrderListItem),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const listAdminDispatchQueue = async (input: PaginationInput & { q?: string }) => {
  const where: Prisma.OrderWhereInput = {
    shipments: {
      some: {
        status: {
          in: [ShipmentStatus.CREATED, ShipmentStatus.PACKING]
        }
      }
    },
    ...(input.q?.trim() ? adminOrderSearchWhere(input.q.trim()) : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: {
        createdAt: "asc"
      },
      ...buildPagination(input)
    }),
    prisma.order.count({ where })
  ]);

  return {
    items: items.map(serializeOrderListItem),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

const loadCancellationQueueStats = async () => {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [pendingTotal, fulfillmentLockedPending, todayRows, avgSample] = await Promise.all([
    prisma.cancellationRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.cancellationRequest.count({
      where: {
        status: "PENDING_APPROVAL",
        order: {
          shipments: {
            some: {
              status: {
                in: [ShipmentStatus.PACKING, ShipmentStatus.DISPATCHED, ShipmentStatus.IN_TRANSIT]
              }
            }
          }
        }
      }
    }),
    prisma.cancellationRequest.findMany({
      where: {
        resolvedAt: { gte: dayStart },
        status: { in: ["COMPLETED", "REJECTED"] }
      },
      select: { status: true }
    }),
    prisma.cancellationRequest.findMany({
      where: { resolvedAt: { not: null } },
      orderBy: { resolvedAt: "desc" },
      take: 200,
      select: { createdAt: true, resolvedAt: true }
    })
  ]);

  const resolvedToday = todayRows.length;
  const approvedToday = todayRows.filter((row) => row.status === "COMPLETED").length;
  const successRatePercent =
    todayRows.length === 0 ? null : Math.round((approvedToday / todayRows.length) * 100);

  const avgResponseMinutes =
    avgSample.length === 0
      ? null
      : avgSample.reduce((sum, row) => sum + (row.resolvedAt!.getTime() - row.createdAt.getTime()), 0) /
        avgSample.length /
        60000;

  return {
    pendingTotal,
    fulfillmentLockedPending,
    resolvedToday,
    successRatePercent,
    avgResponseMinutes
  };
};

export const listAdminCancellationRequests = async (input: {
  page: number;
  page_size: number;
  status?: string;
}) => {
  const where: Prisma.CancellationRequestWhereInput = {
    ...(input.status ? { status: input.status } : {})
  };

  const [[items, totalItems], queueStats] = await Promise.all([
    Promise.all([
      prisma.cancellationRequest.findMany({
        where,
        include: {
          order: {
            include: orderInclude
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        ...buildPagination(input)
      }),
      prisma.cancellationRequest.count({ where })
    ]),
    loadCancellationQueueStats()
  ]);

  return {
    items: items.map((request) => ({
      id: request.id,
      status: request.status,
      reason: request.reason,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      resolvedAt: request.resolvedAt,
      resolvedNote: request.resolvedNote,
      customer: buildCustomerSummary(request.order),
      order: {
        id: request.order.id,
        orderNumber: request.order.orderNumber,
        status: request.order.status,
        payment: serializePaymentSummary(request.order),
        fulfillment: buildFulfillmentSummary(request.order)
      }
    })),
    pagination: buildPaginationPayload(input, totalItems),
    queueStats
  };
};

export const rejectAdminCancellationRequest = async (input: {
  actorAdminUserId: string;
  cancellationId: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const cancellationRequest = await transaction.cancellationRequest.findUnique({
      where: {
        id: input.cancellationId
      }
    });

    if (!cancellationRequest) {
      throw notFoundError("The requested cancellation request was not found.");
    }

    if (cancellationRequest.status !== "PENDING_APPROVAL") {
      throw invalidStateTransitionError("The cancellation request has already been resolved.");
    }

    const updated = await transaction.cancellationRequest.update({
      where: {
        id: cancellationRequest.id
      },
      data: {
        status: "REJECTED",
        resolvedByAdminUserId: input.actorAdminUserId,
        resolvedAt: new Date(),
        resolvedNote: input.note ?? null
      }
    });

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "orders.cancellation.reject",
          entityType: "CANCELLATION_REQUEST",
          entityId: updated.id,
          note: input.note,
          metadata: toPrismaJsonValue({
            orderId: updated.orderId
          })
        }
      }),
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "orders.cancellation_requests",
          actionCode: "orders.cancellation.reject",
          note: input.note,
          entityType: "CANCELLATION_REQUEST",
          entityId: updated.id,
          before: toPrismaJsonValue({
            status: cancellationRequest.status
          }),
          after: toPrismaJsonValue({
            status: updated.status
          })
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "ORDER",
          entityId: updated.orderId,
          eventType: "ORDER_CANCELLATION_REJECTED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            cancellationRequestId: updated.id,
            note: input.note
          })
        }
      })
    ]);

    return {
      entity: updated
    };
  });

export const approveAdminCancellationRequest = async (input: {
  actorAdminUserId: string;
  cancellationId: string;
  note?: string;
}) => {
  const cancellationRequest = await prisma.cancellationRequest.findUnique({
    where: {
      id: input.cancellationId
    }
  });

  if (!cancellationRequest) {
    throw notFoundError("The requested cancellation request was not found.");
  }

  if (cancellationRequest.status !== "PENDING_APPROVAL") {
    throw invalidStateTransitionError("The cancellation request has already been resolved.");
  }

  await cancelAdminOrder({
    actorAdminUserId: input.actorAdminUserId,
    orderId: cancellationRequest.orderId,
    reason: cancellationRequest.reason ?? "Approved cancellation request",
    note: input.note
  });

  return {
    entity: await prisma.cancellationRequest.findUnique({
      where: {
        id: input.cancellationId
      }
    })
  };
};

export const findOrderForPaymentByProviderReference = async (providerPaymentRef: string) => {
  const payment = await prisma.payment.findFirst({
    where: {
      providerPaymentRef
    },
    include: {
      order: {
        include: orderInclude
      }
    }
  });

  if (!payment) {
    throw orderNotFoundError("The payment could not be matched to an order.");
  }

  return payment;
};

export const createFinancialExceptionForPaymentMismatch = async (input: {
  orderId: string;
  paymentId: string;
  mismatchSummary: Record<string, unknown>;
}) => {
  return prisma.financialException.create({
    data: {
      exceptionType: "PAYMENT_STATE_MISMATCH",
      orderId: input.orderId,
      paymentId: input.paymentId,
      mismatchSummary: toPrismaJsonValue(input.mismatchSummary)!
    }
  });
};

export const isPaymentStateFinal = (paymentState: PaymentState) => finalPaymentStates.has(paymentState);
