import {
  InventoryMovementType,
  PaymentState,
  Prisma,
  RefundState,
  ReturnStatus,
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
import { enqueueNotification } from "../notifications/notifications.service";

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

const returnInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      addressSnapshot: true,
      userId: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
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
          }
        }
      }
    }
  },
  items: {
    include: {
      orderItem: true,
      variant: {
        include: {
          product: true
        }
      }
    }
  },
  refunds: {
    orderBy: {
      createdAt: "desc" as const
    },
    include: {
      items: true,
      payment: {
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true
            }
          }
        }
      }
    }
  }
} satisfies Prisma.ReturnInclude;

const refundInclude = {
  payment: {
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          userId: true,
          addressSnapshot: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  },
  return: {
    include: {
      items: {
        include: {
          orderItem: true,
          variant: {
            include: {
              product: true
            }
          }
        }
      }
    }
  },
  items: {
    include: {
      orderItem: true
    }
  }
} satisfies Prisma.RefundInclude;

type ReturnRecord = Prisma.ReturnGetPayload<{
  include: typeof returnInclude;
}>;

type RefundRecord = Prisma.RefundGetPayload<{
  include: typeof refundInclude;
}>;

const refundablePaymentStates = new Set<PaymentState>([
  PaymentState.PAID,
  PaymentState.PARTIALLY_REFUNDED,
  PaymentState.REFUND_PENDING
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readAddressSnapshot = (value: Prisma.JsonValue) => {
  const record = isRecord(value) ? value : {};

  return {
    fullName: typeof record.fullName === "string" ? record.fullName : null,
    email:
      typeof record.contactEmail === "string"
        ? record.contactEmail
        : typeof record.email === "string"
          ? record.email
          : null,
    currency:
      isRecord(record.normalizedTotals) && typeof record.normalizedTotals.currency === "string"
        ? record.normalizedTotals.currency
        : "GHS"
  };
};

const buildCustomerSummary = (order: ReturnRecord["order"] | RefundRecord["payment"]["order"]) => {
  const address = readAddressSnapshot(order.addressSnapshot);
  const nameParts = [order.user?.firstName, order.user?.lastName].filter(Boolean);

  return {
    id: order.user?.id ?? null,
    email: order.user?.email ?? address.email,
    guest: !order.userId,
    name: nameParts.length > 0 ? nameParts.join(" ") : address.fullName
  };
};

const serializeReturnItems = (items: ReturnRecord["items"]) =>
  items.map((item) => ({
    id: item.id,
    orderItemId: item.orderItemId,
    variantId: item.variantId,
    quantity: item.quantity,
    status: item.status,
    productTitle: item.variant.product.title,
    sku: item.variant.sku,
    unitPriceAmountCents: item.orderItem.unitPriceAmountCents,
    unitPriceCurrency: item.orderItem.unitPriceCurrency,
    requestedAmountCents: item.quantity * item.orderItem.unitPriceAmountCents
  }));

const serializeLinkedRefundSummary = (refund: ReturnRecord["refunds"][number]) => ({
  id: refund.id,
  state: refund.state,
  amountCents: refund.amountCents,
  approvedAmountCents: refund.approvedAmountCents,
  currency: refund.currency,
  providerRefundRef: refund.providerRefundRef,
  approvedAt: refund.approvedAt,
  createdAt: refund.createdAt,
  updatedAt: refund.updatedAt
});

const serializeReturnListItem = (record: ReturnRecord) => ({
  id: record.id,
  orderId: record.order.id,
  orderNumber: record.order.orderNumber,
  orderStatus: record.order.status,
  status: record.status,
  requestedAt: record.requestedAt,
  approvedAt: record.approvedAt,
  rejectedAt: record.rejectedAt,
  receivedAt: record.receivedAt,
  completedAt: record.completedAt,
  customerReason: record.customerReason,
  itemCount: record.items.reduce((sum, item) => sum + item.quantity, 0),
  customer: buildCustomerSummary(record.order),
  refunds: record.refunds.map(serializeLinkedRefundSummary)
});

const serializeReturnDetail = (record: ReturnRecord) => ({
  ...serializeReturnListItem(record),
  adminNote: record.adminNote,
  shipments: record.order.shipments.map((shipment) => ({
    id: shipment.id,
    status: shipment.status,
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    warehouse: shipment.warehouse,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt
  })),
  items: serializeReturnItems(record.items)
});

const serializeRefundDetail = (refund: RefundRecord) => ({
  id: refund.id,
  state: refund.state,
  amountCents: refund.amountCents,
  approvedAmountCents: refund.approvedAmountCents,
  currency: refund.currency,
  providerRefundRef: refund.providerRefundRef,
  providerPayload: refund.providerPayload,
  internalNote: refund.internalNote,
  approvedAt: refund.approvedAt,
  createdAt: refund.createdAt,
  updatedAt: refund.updatedAt,
  payment: {
    id: refund.payment.id,
    paymentState: refund.payment.paymentState,
    provider: refund.payment.provider,
    providerPaymentRef: refund.payment.providerPaymentRef
  },
  order: {
    id: refund.payment.order.id,
    orderNumber: refund.payment.order.orderNumber,
    status: refund.payment.order.status,
    customer: buildCustomerSummary(refund.payment.order)
  },
  return: refund.return
    ? {
        id: refund.return.id,
        status: refund.return.status,
        customerReason: refund.return.customerReason
      }
    : null,
  items: refund.items.map((item) => ({
    id: item.id,
    orderItemId: item.orderItemId,
    amountCents: item.amountCents
  }))
});

const loadReturnForCustomerOrThrow = async (customerUserId: string, returnId: string) => {
  const record = await prisma.return.findFirst({
    where: {
      id: returnId,
      order: {
        userId: customerUserId
      }
    },
    include: returnInclude
  });

  if (!record) {
    throw notFoundError("The requested return was not found.");
  }

  return record;
};

const loadReturnForAdminOrThrow = async (
  returnId: string,
  db: DatabaseClient = prisma
) => {
  const record = await db.return.findUnique({
    where: {
      id: returnId
    },
    include: returnInclude
  });

  if (!record) {
    throw notFoundError("The requested return was not found.");
  }

  return record;
};

const loadRefundForAdminOrThrow = async (
  refundId: string,
  db: DatabaseClient = prisma
) => {
  const record = await db.refund.findUnique({
    where: {
      id: refundId
    },
    include: refundInclude
  });

  if (!record) {
    throw notFoundError("The requested refund was not found.");
  }

  return record;
};

const assertOrderEligibleForReturnRequest = (
  order: Prisma.OrderGetPayload<{
    include: {
      items: true;
      returns: {
        include: {
          items: true;
        };
      };
      shipments: true;
      payments: true;
    };
  }>
) => {
  const delivered = order.shipments.some((shipment) => shipment.status === ShipmentStatus.DELIVERED);

  if (!delivered && order.status !== "COMPLETED") {
    throw orderNotEligibleError("This order is not yet eligible for a return request.", {
      reasonCode: "ORDER_NOT_DELIVERED"
    });
  }

  const latestPayment = order.payments[0] ?? null;

  if (!latestPayment || !refundablePaymentStates.has(latestPayment.paymentState)) {
    throw orderNotEligibleError("The order does not currently have a refundable payment.", {
      reasonCode: "PAYMENT_NOT_REFUNDABLE"
    });
  }
};

const buildReturnedQuantityMap = (
  order: Prisma.OrderGetPayload<{
    include: {
      returns: {
        include: {
          items: true;
        };
      };
    };
  }>
) => {
  const quantities = new Map<string, number>();

  for (const existingReturn of order.returns) {
    if (existingReturn.status === ReturnStatus.REJECTED) {
      continue;
    }

    for (const item of existingReturn.items) {
      quantities.set(item.orderItemId, (quantities.get(item.orderItemId) ?? 0) + item.quantity);
    }
  }

  return quantities;
};

const recordReturnAdminMutation = async (
  transaction: Prisma.TransactionClient,
  input: {
    actorAdminUserId: string;
    actionCode: string;
    entityType: "RETURN" | "REFUND";
    entityId: string;
    orderId: string;
    reason?: string;
    note?: string;
    before?: unknown;
    after?: unknown;
    eventType: string;
    payload: unknown;
  }
) => {
  await Promise.all([
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
          orderId: input.orderId,
          payload: input.payload
        })
      }
    }),
    transaction.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        screen: input.entityType === "RETURN" ? "orders.returns" : "finance.refunds",
        actionCode: input.actionCode,
        reason: input.reason,
        note: input.note,
        entityType: input.entityType,
        entityId: input.entityId,
        before: toPrismaJsonValue(input.before),
        after: toPrismaJsonValue(input.after)
      }
    }),
    transaction.timelineEvent.create({
      data: {
        entityType: "ORDER",
        entityId: input.orderId,
        eventType: input.eventType,
        actorAdminUserId: input.actorAdminUserId,
        actorType: "ADMIN",
        payload: toPrismaJsonValue(input.payload)
      }
    })
  ]);
};

const calculateReturnAmount = (items: ReturnRecord["items"]) =>
  items.reduce((sum, item) => sum + item.quantity * item.orderItem.unitPriceAmountCents, 0);

const getLatestPaymentState = (
  order: Prisma.OrderGetPayload<{
    include: {
      payments: true;
    };
  }>
) => order.payments[0] ?? null;

const updatePaymentRefundState = async (
  transaction: Prisma.TransactionClient,
  paymentId: string
) => {
  const payment = await transaction.payment.findUnique({
    where: {
      id: paymentId
    },
    include: {
      refunds: true
    }
  });

  if (!payment) {
    return null;
  }

  const completedRefundTotal = payment.refunds
    .filter((refund) => refund.state === RefundState.COMPLETED)
    .reduce((sum, refund) => sum + refund.amountCents, 0);

  const nextState =
    completedRefundTotal <= 0
      ? payment.paymentState
      : completedRefundTotal >= payment.amountCents
        ? PaymentState.REFUNDED
        : PaymentState.PARTIALLY_REFUNDED;

  if (nextState !== payment.paymentState) {
    await transaction.payment.update({
      where: {
        id: payment.id
      },
      data: {
        paymentState: nextState
      }
    });
  }

  return nextState;
};

export const listCustomerReturns = async (
  customerUserId: string,
  input: PaginationInput
) => {
  const where: Prisma.ReturnWhereInput = {
    order: {
      userId: customerUserId
    }
  };

  const [items, totalItems] = await Promise.all([
    prisma.return.findMany({
      where,
      include: returnInclude,
      orderBy: {
        requestedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.return.count({ where })
  ]);

  return {
    items: items.map(serializeReturnListItem),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getCustomerReturnDetail = async (customerUserId: string, returnId: string) => {
  const record = await loadReturnForCustomerOrThrow(customerUserId, returnId);
  return {
    entity: serializeReturnDetail(record)
  };
};

export const getCustomerOrderReturnEligibility = async (
  customerUserId: string,
  orderId: string
) => {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: customerUserId
    },
    include: {
      items: true,
      returns: {
        include: {
          items: true
        }
      },
      shipments: true,
      payments: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!order) {
    throw orderNotFoundError();
  }

  const delivered =
    order.status === "COMPLETED" ||
    order.shipments.some((shipment) => shipment.status === ShipmentStatus.DELIVERED);
  const latestPayment = getLatestPaymentState(order);
  const paymentRefundable = Boolean(
    latestPayment && refundablePaymentStates.has(latestPayment.paymentState)
  );
  const returnedQuantities = buildReturnedQuantityMap(order);
  const items = order.items.map((item) => {
    const alreadyReturned = returnedQuantities.get(item.id) ?? 0;
    const remainingQuantity = Math.max(item.quantity - alreadyReturned, 0);

    return {
      orderItemId: item.id,
      variantId: item.variantId,
      quantityPurchased: item.quantity,
      alreadyReturnedQuantity: alreadyReturned,
      remainingEligibleQuantity: remainingQuantity,
      canReturn: delivered && paymentRefundable && remainingQuantity > 0
    };
  });
  const canReturn =
    order.status !== "CANCELLED" &&
    delivered &&
    paymentRefundable &&
    items.some((item) => item.remainingEligibleQuantity > 0);

  return {
    entity: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      canReturn,
      reasonCode: canReturn
        ? null
        : !delivered
          ? "ORDER_NOT_DELIVERED"
          : !paymentRefundable
            ? "PAYMENT_NOT_REFUNDABLE"
            : "NO_RETURNABLE_ITEMS",
      reasonMessage: canReturn
        ? null
        : !delivered
          ? "This order is not yet eligible for a return request."
          : !paymentRefundable
            ? "The order does not currently have a refundable payment."
            : "There are no remaining items eligible for return on this order.",
      items
    }
  };
};

export const createCustomerReturnRequest = async (
  customerUserId: string,
  input: {
    orderId: string;
    customerReason: string;
    items: Array<{
      orderItemId: string;
      quantity: number;
    }>;
  }
) =>
  runInTransaction(async (transaction) => {
    const order = await transaction.order.findFirst({
      where: {
        id: input.orderId,
        userId: customerUserId
      },
      include: {
        items: true,
        returns: {
          include: {
            items: true
          }
        },
        shipments: true,
        payments: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!order) {
      throw orderNotFoundError();
    }

    assertOrderEligibleForReturnRequest(order);

    const duplicateOrderItemId = input.items
      .map((item) => item.orderItemId)
      .find((orderItemId, index, collection) => collection.indexOf(orderItemId) !== index);

    if (duplicateOrderItemId) {
      throw invalidInputError("Duplicate order items are not allowed in one return request.");
    }

    const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
    const returnedQuantities = buildReturnedQuantityMap(order);

    for (const requestedItem of input.items) {
      const orderItem = orderItemsById.get(requestedItem.orderItemId);

      if (!orderItem) {
        throw invalidInputError("One or more requested return items do not belong to the order.");
      }

      const alreadyReturned = returnedQuantities.get(requestedItem.orderItemId) ?? 0;
      const remainingQuantity = orderItem.quantity - alreadyReturned;

      if (remainingQuantity <= 0 || requestedItem.quantity > remainingQuantity) {
        throw invalidInputError("One or more return quantities exceed the remaining eligible quantity.", {
          orderItemId: requestedItem.orderItemId,
          remainingQuantity
        });
      }
    }

    const createdReturn = await transaction.return.create({
      data: {
        orderId: order.id,
        customerReason: input.customerReason,
        items: {
          create: input.items.map((requestedItem) => {
            const orderItem = orderItemsById.get(requestedItem.orderItemId)!;

            return {
              orderItemId: orderItem.id,
              variantId: orderItem.variantId,
              quantity: requestedItem.quantity
            };
          })
        }
      },
      include: returnInclude
    });

    await transaction.timelineEvent.create({
      data: {
        entityType: "ORDER",
        entityId: order.id,
        eventType: "RETURN_REQUESTED",
        actorType: "CUSTOMER",
        payload: toPrismaJsonValue({
          returnId: createdReturn.id,
          customerReason: input.customerReason,
          items: input.items
        })
      }
    });

    return {
      entity: serializeReturnDetail(createdReturn)
    };
  }).then(async (result) => {
    if (result.entity.customer.email) {
      await enqueueNotification({
        type: "RETURN_REQUESTED",
        recipientUserId: result.entity.customer.id ?? undefined,
        recipientEmail: result.entity.customer.email,
        recipientType: result.entity.customer.guest ? "GUEST" : "USER",
        payload: {
          returnId: result.entity.id,
          orderId: result.entity.orderId,
          orderNumber: result.entity.orderNumber
        }
      }).catch(() => null);
    }

    return result;
  });

export const getCustomerOrderRefundEligibility = async (
  customerUserId: string,
  orderId: string
) => {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: customerUserId
    },
    include: {
      payments: {
        orderBy: {
          createdAt: "desc"
        },
        include: {
          refunds: {
            orderBy: {
              createdAt: "desc"
            }
          }
        }
      }
    }
  });

  if (!order) {
    throw orderNotFoundError();
  }

  const latestPayment = getLatestPaymentState(order);
  const canRequestRefund = Boolean(
    latestPayment && refundablePaymentStates.has(latestPayment.paymentState)
  );
  const refunds = order.payments.flatMap((payment) => payment.refunds);

  return {
    entity: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      canRequestRefund,
      reasonCode: canRequestRefund ? null : "PAYMENT_NOT_REFUNDABLE",
      reasonMessage: canRequestRefund
        ? null
        : "A settled or partially refunded payment is required before refund actions are available.",
      latestPayment: latestPayment
        ? {
            id: latestPayment.id,
            paymentState: latestPayment.paymentState,
            provider: latestPayment.provider,
            providerPaymentRef: latestPayment.providerPaymentRef
          }
        : null,
      refunds: refunds.map((refund) => ({
        id: refund.id,
        state: refund.state,
        amountCents: refund.amountCents,
        approvedAmountCents: refund.approvedAmountCents,
        currency: refund.currency,
        createdAt: refund.createdAt
      }))
    }
  };
};

export const listCustomerRefunds = async (
  customerUserId: string,
  input: PaginationInput
) => {
  const where: Prisma.RefundWhereInput = {
    payment: {
      order: {
        userId: customerUserId
      }
    }
  };

  const [items, totalItems] = await Promise.all([
    prisma.refund.findMany({
      where,
      include: refundInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.refund.count({ where })
  ]);

  return {
    items: items.map(serializeRefundDetail),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const listAdminReturns = async (input: {
  page: number;
  page_size: number;
  status?: ReturnStatus;
  q?: string;
  reason_contains?: string;
}) => {
  const where: Prisma.ReturnWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.reason_contains
      ? {
          customerReason: {
            contains: input.reason_contains,
            mode: "insensitive"
          }
        }
      : {}),
    ...(input.q
      ? {
          OR: [
            {
              order: {
                is: {
                  orderNumber: {
                    contains: input.q,
                    mode: "insensitive"
                  }
                }
              }
            },
            {
              order: {
                is: {
                  user: {
                    is: {
                      email: {
                        contains: input.q,
                        mode: "insensitive"
                      }
                    }
                  }
                }
              }
            },
            {
              customerReason: {
                contains: input.q,
                mode: "insensitive"
              }
            }
          ]
        }
      : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.return.findMany({
      where,
      include: returnInclude,
      orderBy: {
        requestedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.return.count({ where })
  ]);

  return {
    items: items.map(serializeReturnListItem),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAdminReturnDetail = async (returnId: string) => {
  const record = await loadReturnForAdminOrThrow(returnId);
  return {
    entity: serializeReturnDetail(record)
  };
};

export const approveAdminReturn = async (input: {
  actorAdminUserId: string;
  returnId: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const record = await loadReturnForAdminOrThrow(input.returnId, transaction);

    if (record.status !== ReturnStatus.REQUESTED) {
      throw invalidStateTransitionError("Only requested returns can be approved.");
    }

    const amountCents = calculateReturnAmount(record.items);
    const latestPayment = await transaction.payment.findFirst({
      where: {
        orderId: record.order.id,
        paymentState: {
          in: [PaymentState.PAID, PaymentState.PARTIALLY_REFUNDED, PaymentState.REFUND_PENDING]
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    await transaction.return.update({
      where: {
        id: record.id
      },
      data: {
        status: ReturnStatus.APPROVED,
        approvedAt: new Date(),
        adminNote: input.note ?? record.adminNote
      }
    });

    let refundId: string | null = record.refunds[0]?.id ?? null;

    if (!refundId && latestPayment) {
      const createdRefund = await transaction.refund.create({
        data: {
          paymentId: latestPayment.id,
          returnId: record.id,
          amountCents,
          approvedAmountCents: amountCents,
          currency: latestPayment.currency,
          internalNote: input.note,
          items: {
            create: record.items.map((item) => ({
              orderItemId: item.orderItemId,
              amountCents: item.quantity * item.orderItem.unitPriceAmountCents
            }))
          }
        }
      });

      refundId = createdRefund.id;
    }

    await recordReturnAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "returns.approve",
      entityType: "RETURN",
      entityId: record.id,
      orderId: record.order.id,
      note: input.note,
      before: {
        status: record.status
      },
      after: {
        status: ReturnStatus.APPROVED
      },
      eventType: "RETURN_APPROVED",
      payload: {
        returnId: record.id,
        refundId,
        note: input.note
      }
    });

    const updated = await loadReturnForAdminOrThrow(record.id, transaction);

    return {
      entity: serializeReturnDetail(updated)
    };
  }).then(async (result) => {
    if (result.entity.customer.email) {
      await enqueueNotification({
        type: "RETURN_APPROVED",
        recipientUserId: result.entity.customer.id ?? undefined,
        recipientEmail: result.entity.customer.email,
        recipientType: result.entity.customer.guest ? "GUEST" : "USER",
        payload: {
          returnId: result.entity.id,
          orderId: result.entity.orderId,
          orderNumber: result.entity.orderNumber
        }
      }).catch(() => null);
    }

    return result;
  });

export const rejectAdminReturn = async (input: {
  actorAdminUserId: string;
  returnId: string;
  note: string;
}) =>
  runInTransaction(async (transaction) => {
    const record = await loadReturnForAdminOrThrow(input.returnId, transaction);

    if (record.status !== ReturnStatus.REQUESTED) {
      throw invalidStateTransitionError("Only requested returns can be rejected.");
    }

    await transaction.return.update({
      where: {
        id: record.id
      },
      data: {
        status: ReturnStatus.REJECTED,
        rejectedAt: new Date(),
        adminNote: input.note
      }
    });

    await recordReturnAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "returns.reject",
      entityType: "RETURN",
      entityId: record.id,
      orderId: record.order.id,
      note: input.note,
      before: {
        status: record.status
      },
      after: {
        status: ReturnStatus.REJECTED
      },
      eventType: "RETURN_REJECTED",
      payload: {
        returnId: record.id,
        note: input.note
      }
    });

    const updated = await loadReturnForAdminOrThrow(record.id, transaction);

    return {
      entity: serializeReturnDetail(updated)
    };
  });

export const markAdminReturnReceived = async (input: {
  actorAdminUserId: string;
  returnId: string;
  note?: string;
  restockItems: boolean;
}) =>
  runInTransaction(async (transaction) => {
    const record = await loadReturnForAdminOrThrow(input.returnId, transaction);

    if (record.status !== ReturnStatus.APPROVED) {
      throw invalidStateTransitionError("Only approved returns can be marked received.");
    }

    if (input.restockItems) {
      const preferredWarehouseId = record.order.shipments[0]?.warehouse.id ?? null;

      for (const item of record.items) {
        const inventoryStocks = await transaction.inventoryStock.findMany({
          where: {
            variantId: item.variantId
          },
          orderBy: [
            {
              warehouseId: preferredWarehouseId ? "asc" : undefined
            },
            {
              updatedAt: "asc"
            }
          ].filter(Boolean) as Prisma.InventoryStockOrderByWithRelationInput[]
        });

        const inventoryStock =
          (preferredWarehouseId
            ? inventoryStocks.find((stock) => stock.warehouseId === preferredWarehouseId)
            : null) ?? inventoryStocks[0];

        if (!inventoryStock) {
          continue;
        }

        const nextOnHand = inventoryStock.onHand + item.quantity;

        await transaction.inventoryStock.update({
          where: {
            id: inventoryStock.id
          },
          data: {
            onHand: nextOnHand
          }
        });

        await transaction.inventoryMovement.create({
          data: {
            inventoryStockId: inventoryStock.id,
            movementType: InventoryMovementType.RETURN_RESTOCK,
            deltaOnHand: item.quantity,
            deltaReserved: 0,
            resultingOnHand: nextOnHand,
            resultingReserved: inventoryStock.reserved,
            reason: input.note ?? "return_received",
            returnId: record.id,
            actorAdminUserId: input.actorAdminUserId
          }
        });
      }
    }

    await transaction.return.update({
      where: {
        id: record.id
      },
      data: {
        status: ReturnStatus.RECEIVED,
        receivedAt: new Date(),
        adminNote: input.note ?? record.adminNote
      }
    });

    await recordReturnAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "returns.mark_received",
      entityType: "RETURN",
      entityId: record.id,
      orderId: record.order.id,
      note: input.note,
      before: {
        status: record.status
      },
      after: {
        status: ReturnStatus.RECEIVED
      },
      eventType: "RETURN_RECEIVED",
      payload: {
        returnId: record.id,
        restockItems: input.restockItems,
        note: input.note
      }
    });

    const updated = await loadReturnForAdminOrThrow(record.id, transaction);

    return {
      entity: serializeReturnDetail(updated)
    };
  }).then(async (result) => {
    if (result.entity.customer.email) {
      await enqueueNotification({
        type: "RETURN_RECEIVED",
        recipientUserId: result.entity.customer.id ?? undefined,
        recipientEmail: result.entity.customer.email,
        recipientType: result.entity.customer.guest ? "GUEST" : "USER",
        payload: {
          returnId: result.entity.id,
          orderId: result.entity.orderId,
          orderNumber: result.entity.orderNumber
        }
      }).catch(() => null);
    }

    return result;
  });

export const completeAdminReturn = async (input: {
  actorAdminUserId: string;
  returnId: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const record = await loadReturnForAdminOrThrow(input.returnId, transaction);

    if (record.status !== ReturnStatus.RECEIVED && record.status !== ReturnStatus.APPROVED) {
      throw invalidStateTransitionError("Only received or approved returns can be completed.");
    }

    await transaction.return.update({
      where: {
        id: record.id
      },
      data: {
        status: ReturnStatus.COMPLETED,
        completedAt: new Date(),
        adminNote: input.note ?? record.adminNote
      }
    });

    await recordReturnAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "returns.complete",
      entityType: "RETURN",
      entityId: record.id,
      orderId: record.order.id,
      note: input.note,
      before: {
        status: record.status
      },
      after: {
        status: ReturnStatus.COMPLETED
      },
      eventType: "RETURN_COMPLETED",
      payload: {
        returnId: record.id,
        note: input.note
      }
    });

    const updated = await loadReturnForAdminOrThrow(record.id, transaction);

    return {
      entity: serializeReturnDetail(updated)
    };
  }).then(async (result) => {
    if (result.entity.customer.email) {
      await enqueueNotification({
        type: "RETURN_COMPLETED",
        recipientUserId: result.entity.customer.id ?? undefined,
        recipientEmail: result.entity.customer.email,
        recipientType: result.entity.customer.guest ? "GUEST" : "USER",
        payload: {
          returnId: result.entity.id,
          orderId: result.entity.orderId,
          orderNumber: result.entity.orderNumber
        }
      }).catch(() => null);
    }

    return result;
  });

export const listAdminRefunds = async (input: {
  page: number;
  page_size: number;
  state?: RefundState;
  q?: string;
}) => {
  const where: Prisma.RefundWhereInput = {
    ...(input.state ? { state: input.state } : {}),
    ...(input.q
      ? {
          OR: [
            {
              payment: {
                is: {
                  order: {
                    is: {
                      orderNumber: {
                        contains: input.q,
                        mode: "insensitive"
                      }
                    }
                  }
                }
              }
            },
            {
              payment: {
                is: {
                  providerPaymentRef: {
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
    prisma.refund.findMany({
      where,
      include: refundInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.refund.count({ where })
  ]);

  return {
    items: items.map(serializeRefundDetail),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAdminRefundDetail = async (refundId: string) => {
  const record = await loadRefundForAdminOrThrow(refundId);
  return {
    entity: serializeRefundDetail(record)
  };
};

export const approveAdminRefund = async (input: {
  actorAdminUserId: string;
  refundId: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const refund = await loadRefundForAdminOrThrow(input.refundId, transaction);

    if (refund.state !== RefundState.PENDING_APPROVAL) {
      throw invalidStateTransitionError("Only refunds pending approval can be approved.");
    }

    const existingCommittedRefunds = await transaction.refund.aggregate({
      _sum: {
        approvedAmountCents: true,
        amountCents: true
      },
      where: {
        paymentId: refund.paymentId,
        id: {
          not: refund.id
        },
        state: {
          in: [RefundState.APPROVED, RefundState.PENDING_PROVIDER, RefundState.COMPLETED]
        }
      }
    });
    const alreadyCommittedCents =
      existingCommittedRefunds._sum.approvedAmountCents ??
      existingCommittedRefunds._sum.amountCents ??
      0;
    const refundAmountCents = refund.approvedAmountCents ?? refund.amountCents;
    if (alreadyCommittedCents + refundAmountCents > refund.payment.amountCents) {
      throw invalidInputError("The refund exceeds the remaining refundable amount for this payment.", {
        paymentId: refund.paymentId,
        paymentAmountCents: refund.payment.amountCents,
        alreadyCommittedCents,
        attemptedRefundCents: refundAmountCents
      });
    }

    await transaction.refund.update({
      where: {
        id: refund.id
      },
      data: {
        state: RefundState.APPROVED,
        approvedAt: new Date(),
        adminApprovedByAdminUserId: input.actorAdminUserId,
        internalNote: input.note ?? refund.internalNote
      }
    });

    await transaction.payment.update({
      where: {
        id: refund.paymentId
      },
      data: {
        paymentState: PaymentState.REFUND_PENDING
      }
    });

    await recordReturnAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "refunds.approve",
      entityType: "REFUND",
      entityId: refund.id,
      orderId: refund.payment.order.id,
      note: input.note,
      before: {
        state: refund.state
      },
      after: {
        state: RefundState.APPROVED
      },
      eventType: "REFUND_APPROVED",
      payload: {
        refundId: refund.id,
        returnId: refund.returnId,
        note: input.note
      }
    });

    const updated = await loadRefundForAdminOrThrow(refund.id, transaction);

    return {
      entity: serializeRefundDetail(updated)
    };
  }).then(async (result) => {
    if (result.entity.order.customer.email) {
      await enqueueNotification({
        type: "REFUND_APPROVED",
        recipientUserId: result.entity.order.customer.id ?? undefined,
        recipientEmail: result.entity.order.customer.email,
        recipientType: result.entity.order.customer.guest ? "GUEST" : "USER",
        payload: {
          refundId: result.entity.id,
          orderId: result.entity.order.id,
          orderNumber: result.entity.order.orderNumber
        }
      }).catch(() => null);
    }

    return result;
  });

export const rejectAdminRefund = async (input: {
  actorAdminUserId: string;
  refundId: string;
  note: string;
}) =>
  runInTransaction(async (transaction) => {
    const refund = await loadRefundForAdminOrThrow(input.refundId, transaction);

    if (refund.state !== RefundState.PENDING_APPROVAL && refund.state !== RefundState.APPROVED) {
      throw invalidStateTransitionError("The refund can no longer be rejected.");
    }

    await transaction.refund.update({
      where: {
        id: refund.id
      },
      data: {
        state: RefundState.REJECTED,
        internalNote: input.note
      }
    });

    const remainingApprovedRefund = await transaction.refund.findFirst({
      where: {
        paymentId: refund.paymentId,
        state: {
          in: [RefundState.APPROVED, RefundState.PENDING_PROVIDER]
        }
      }
    });

    if (!remainingApprovedRefund && refund.payment.paymentState === PaymentState.REFUND_PENDING) {
      await transaction.payment.update({
        where: {
          id: refund.paymentId
        },
        data: {
          paymentState: PaymentState.PAID
        }
      });
    }

    await recordReturnAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "refunds.reject",
      entityType: "REFUND",
      entityId: refund.id,
      orderId: refund.payment.order.id,
      note: input.note,
      before: {
        state: refund.state
      },
      after: {
        state: RefundState.REJECTED
      },
      eventType: "REFUND_REJECTED",
      payload: {
        refundId: refund.id,
        returnId: refund.returnId,
        note: input.note
      }
    });

    const updated = await loadRefundForAdminOrThrow(refund.id, transaction);

    return {
      entity: serializeRefundDetail(updated)
    };
  });

export const completeAdminRefund = async (input: {
  actorAdminUserId: string;
  refundId: string;
  note?: string;
  providerRefundRef?: string;
}) =>
  runInTransaction(async (transaction) => {
    const refund = await loadRefundForAdminOrThrow(input.refundId, transaction);

    if (refund.state !== RefundState.APPROVED && refund.state !== RefundState.PENDING_PROVIDER) {
      throw invalidStateTransitionError("Only approved refunds can be marked completed.");
    }

    const existingCompletedRefunds = await transaction.refund.aggregate({
      _sum: {
        approvedAmountCents: true,
        amountCents: true
      },
      where: {
        paymentId: refund.paymentId,
        id: {
          not: refund.id
        },
        state: RefundState.COMPLETED
      }
    });
    const alreadyCompletedCents =
      existingCompletedRefunds._sum.approvedAmountCents ??
      existingCompletedRefunds._sum.amountCents ??
      0;
    const refundAmountCents = refund.approvedAmountCents ?? refund.amountCents;
    if (alreadyCompletedCents + refundAmountCents > refund.payment.amountCents) {
      throw invalidInputError("Completing this refund would exceed the paid amount.", {
        paymentId: refund.paymentId,
        paymentAmountCents: refund.payment.amountCents,
        alreadyCompletedCents,
        attemptedRefundCents: refundAmountCents
      });
    }

    await transaction.refund.update({
      where: {
        id: refund.id
      },
      data: {
        state: RefundState.COMPLETED,
        providerRefundRef: input.providerRefundRef ?? refund.providerRefundRef,
        providerPayload: toPrismaJsonValue({
          providerRefundRef: input.providerRefundRef,
          note: input.note
        }),
        internalNote: input.note ?? refund.internalNote
      }
    });

    await updatePaymentRefundState(transaction, refund.paymentId);

    if (refund.returnId) {
      const relatedReturn = await transaction.return.findUnique({
        where: {
          id: refund.returnId
        }
      });

      if (relatedReturn && relatedReturn.status === ReturnStatus.RECEIVED) {
        await transaction.return.update({
          where: {
            id: relatedReturn.id
          },
          data: {
            status: ReturnStatus.COMPLETED,
            completedAt: new Date(),
            adminNote: input.note ?? relatedReturn.adminNote
          }
        });
      }
    }

    await recordReturnAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "refunds.complete",
      entityType: "REFUND",
      entityId: refund.id,
      orderId: refund.payment.order.id,
      note: input.note,
      before: {
        state: refund.state
      },
      after: {
        state: RefundState.COMPLETED
      },
      eventType: "REFUND_COMPLETED",
      payload: {
        refundId: refund.id,
        returnId: refund.returnId,
        providerRefundRef: input.providerRefundRef,
        note: input.note
      }
    });

    const updated = await loadRefundForAdminOrThrow(refund.id, transaction);

    return {
      entity: serializeRefundDetail(updated)
    };
  });

export const listFinancialExceptions = async (input: PaginationInput) => {
  const [items, totalItems] = await Promise.all([
    prisma.financialException.findMany({
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.financialException.count()
  ]);

  return {
    items,
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const resolveFinancialException = async (input: {
  actorAdminUserId: string;
  exceptionId: string;
  note: string;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.financialException.findUnique({
      where: {
        id: input.exceptionId
      }
    });

    if (!existing) {
      throw notFoundError("The requested financial exception was not found.");
    }

    const updated = await transaction.financialException.update({
      where: {
        id: existing.id
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedByAdminUserId: input.actorAdminUserId,
        resolutionNote: input.note
      }
    });

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "finance.exceptions.resolve",
          entityType: "FINANCIAL_EXCEPTION",
          entityId: updated.id,
          note: input.note,
          metadata: toPrismaJsonValue({
            before: {
              status: existing.status,
              resolvedAt: existing.resolvedAt,
              resolutionNote: existing.resolutionNote
            },
            after: {
              status: updated.status,
              resolvedAt: updated.resolvedAt,
              resolutionNote: updated.resolutionNote
            }
          })
        }
      }),
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "finance.exceptions",
          actionCode: "finance.exceptions.resolve",
          entityType: "FINANCIAL_EXCEPTION",
          entityId: updated.id,
          note: input.note,
          before: toPrismaJsonValue({
            status: existing.status,
            resolvedAt: existing.resolvedAt
          }),
          after: toPrismaJsonValue({
            status: updated.status,
            resolvedAt: updated.resolvedAt
          })
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "FINANCIAL_EXCEPTION",
          entityId: updated.id,
          eventType: "FINANCIAL_EXCEPTION_RESOLVED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            note: input.note
          })
        }
      })
    ]);

    return {
      entity: updated
    };
  });
