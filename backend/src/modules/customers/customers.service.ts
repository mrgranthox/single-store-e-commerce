import { PaymentState, Prisma, RefundState, SecuritySeverity, UserStatus } from "@prisma/client";

import {
  accountSuspendedError,
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
import { prisma } from "../../config/prisma";
import { enqueueNotification } from "../notifications/notifications.service";

const userInclude = {
  customerNotes: {
    orderBy: {
      createdAt: "desc" as const
    },
    include: {
      actorAdmin: {
        select: {
          id: true,
          email: true
        }
      }
    }
  },
  riskSignals: {
    orderBy: {
      createdAt: "desc" as const
    }
  },
  securityEvents: {
    orderBy: {
      createdAt: "desc" as const
    }
  }
} satisfies Prisma.UserInclude;

type UserRecord = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

const serializeCustomerSummary = (user: UserRecord, aggregates: {
  orders: number;
  openSupportTickets: number;
  reviews: number;
  returns: number;
  refunds: number;
}) => ({
  id: user.id,
  clerkUserId: user.clerkUserId,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  phoneNumber: user.phoneNumber,
  dateOfBirth: user.dateOfBirth,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  counts: aggregates,
  latestRiskSignal: user.riskSignals[0] ?? null,
  latestSecurityEvent: user.securityEvents[0] ?? null
});

const loadCustomerOrThrow = async (
  customerId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
) => {
  const user = await db.user.findUnique({
    where: {
      id: customerId
    },
    include: userInclude
  });

  if (!user) {
    throw notFoundError("The requested customer was not found.");
  }

  return user;
};

const loadCustomerAggregates = async (customerId: string, db: Prisma.TransactionClient | typeof prisma = prisma) => {
  const [orders, openSupportTickets, reviews, returns, refunds] = await Promise.all([
    db.order.count({
      where: {
        userId: customerId
      }
    }),
    db.supportTicket.count({
      where: {
        userId: customerId,
        status: {
          not: "CLOSED"
        }
      }
    }),
    db.review.count({
      where: {
        userId: customerId
      }
    }),
    db.return.count({
      where: {
        order: {
          userId: customerId
        }
      }
    }),
    db.refund.count({
      where: {
        payment: {
          order: {
            userId: customerId
          }
        }
      }
    })
  ]);

  return {
    orders,
    openSupportTickets,
    reviews,
    returns,
    refunds
  };
};

const recordCustomerAdminMutation = async (
  transaction: Prisma.TransactionClient,
  input: {
    actorAdminUserId: string;
    actionCode: string;
    customerId: string;
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
        entityType: "USER",
        entityId: input.customerId,
        reason: input.reason,
        note: input.note,
        metadata: toPrismaJsonValue(input.payload)
      }
    }),
    transaction.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        screen: "customers.detail",
        actionCode: input.actionCode,
        reason: input.reason,
        note: input.note,
        entityType: "USER",
        entityId: input.customerId,
        before: toPrismaJsonValue(input.before),
        after: toPrismaJsonValue(input.after)
      }
    }),
    transaction.timelineEvent.create({
      data: {
        entityType: "USER",
        entityId: input.customerId,
        eventType: input.eventType,
        actorAdminUserId: input.actorAdminUserId,
        actorType: "ADMIN",
        payload: toPrismaJsonValue(input.payload)
      }
    })
  ]);
};

const resolveLtvFilteredUserIds = async (
  minCents: number | undefined,
  maxCents: number | undefined
): Promise<string[] | undefined> => {
  if (minCents === undefined && maxCents === undefined) {
    return undefined;
  }

  const min = minCents ?? 0;
  const max = maxCents ?? Number.MAX_SAFE_INTEGER;

  const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT u.id AS "userId"
    FROM "User" u
    LEFT JOIN "Order" o ON o."userId" = u.id
    LEFT JOIN "Payment" p ON p."orderId" = o.id
      AND p."paymentState" IN ('PAID'::"PaymentState", 'PARTIALLY_REFUNDED'::"PaymentState")
    GROUP BY u.id
    HAVING COALESCE(SUM(p."amountCents"), 0) >= ${min}
      AND COALESCE(SUM(p."amountCents"), 0) <= ${max}
  `;

  return rows.map((row) => row.userId);
};

const resolveOrderCountFilteredUserIds = async (
  minOrders: number | undefined,
  maxOrders: number | undefined
): Promise<string[] | undefined> => {
  if (minOrders === undefined && maxOrders === undefined) {
    return undefined;
  }

  const min = minOrders ?? 0;
  const max = maxOrders ?? 999_999_999;

  const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT u.id AS "userId"
    FROM "User" u
    LEFT JOIN "Order" o ON o."userId" = u.id
    GROUP BY u.id
    HAVING COUNT(o.id)::int >= ${min}
      AND COUNT(o.id)::int <= ${max}
  `;

  return rows.map((row) => row.userId);
};

const intersectUserIds = (first: string[], second: string[]) => {
  const secondSet = new Set(second);
  return first.filter((id) => secondSet.has(id));
};

const buildCustomerMatchingSummary = async (where: Prisma.UserWhereInput) => {
  const rows = await prisma.user.groupBy({
    by: ["status"],
    where,
    _count: {
      _all: true
    }
  });

  const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const totalMatching = rows.reduce((sum, row) => sum + row._count._all, 0);

  return {
    totalMatching,
    byStatus
  };
};

export const listAdminCustomers = async (input: {
  page: number;
  page_size: number;
  status?: UserStatus;
  q?: string;
  joined_after?: Date;
  joined_before?: Date;
  min_orders?: number;
  max_orders?: number;
  min_ltv_cents?: number;
  max_ltv_cents?: number;
}) => {
  const [orderUserIds, ltvUserIds] = await Promise.all([
    resolveOrderCountFilteredUserIds(input.min_orders, input.max_orders),
    resolveLtvFilteredUserIds(input.min_ltv_cents, input.max_ltv_cents)
  ]);

  let idAllowList: string[] | undefined;
  if (orderUserIds !== undefined && ltvUserIds !== undefined) {
    idAllowList = intersectUserIds(orderUserIds, ltvUserIds);
  } else if (orderUserIds !== undefined) {
    idAllowList = orderUserIds;
  } else if (ltvUserIds !== undefined) {
    idAllowList = ltvUserIds;
  }

  if (idAllowList !== undefined && idAllowList.length === 0) {
    return {
      items: [],
      pagination: buildPaginationPayload(input, 0),
      matchingSummary: {
        totalMatching: 0,
        byStatus: {}
      }
    };
  }

  const where: Prisma.UserWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.joined_after || input.joined_before
      ? {
          createdAt: {
            ...(input.joined_after ? { gte: input.joined_after } : {}),
            ...(input.joined_before ? { lte: input.joined_before } : {})
          }
        }
      : {}),
    ...(idAllowList !== undefined
      ? {
          id: {
            in: idAllowList
          }
        }
      : {}),
    ...(input.q
      ? {
          OR: [
            {
              email: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              firstName: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              lastName: {
                contains: input.q,
                mode: "insensitive"
              }
            }
          ]
        }
      : {})
  };

  const [users, totalItems, matchingSummary] = await Promise.all([
    prisma.user.findMany({
      where,
      include: userInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.user.count({ where }),
    buildCustomerMatchingSummary(where)
  ]);

  const items = await Promise.all(
    users.map(async (user) => serializeCustomerSummary(user, await loadCustomerAggregates(user.id)))
  );

  return {
    items,
    pagination: buildPaginationPayload(input, totalItems),
    matchingSummary
  };
};

export const getAdminCustomerDetail = async (customerId: string) => {
  const user = await loadCustomerOrThrow(customerId);
  const aggregates = await loadCustomerAggregates(customerId);

  const [addresses, lastOrder, ltvPaymentAgg, lastRefund] = await Promise.all([
    prisma.userAddress.findMany({
      where: {
        userId: customerId
      },
      orderBy: [
        {
          isDefaultShipping: "desc"
        },
        {
          createdAt: "asc"
        }
      ]
    }),
    prisma.order.findFirst({
      where: {
        userId: customerId
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true
      }
    }),
    prisma.payment.aggregate({
      where: {
        order: {
          userId: customerId
        },
        paymentState: {
          in: [PaymentState.PAID, PaymentState.PARTIALLY_REFUNDED]
        }
      },
      _sum: {
        amountCents: true
      }
    }),
    prisma.refund.findFirst({
      where: {
        state: RefundState.COMPLETED,
        payment: {
          order: {
            userId: customerId
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        createdAt: true,
        amountCents: true
      }
    })
  ]);

  const lifetimeValueCents = ltvPaymentAgg._sum.amountCents ?? 0;
  const averageOrderValueCents =
    aggregates.orders > 0 ? Math.round(lifetimeValueCents / aggregates.orders) : null;

  return {
    entity: {
      ...serializeCustomerSummary(user, aggregates),
      notes: user.customerNotes.map((note) => ({
        id: note.id,
        note: note.note,
        createdAt: note.createdAt,
        actorAdmin: note.actorAdmin
      })),
      addresses: addresses.map((address) => ({
        id: address.id,
        label: address.label,
        fullName: address.fullName,
        phoneNumber: address.phoneNumber,
        country: address.country,
        region: address.region,
        city: address.city,
        postalCode: address.postalCode,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        isDefaultShipping: address.isDefaultShipping,
        isDefaultBilling: address.isDefaultBilling
      })),
      lastOrder,
      lifetimeValueCents,
      averageOrderValueCents,
      lastRefundAt: lastRefund?.createdAt ?? null
    }
  };
};

export const getAdminCustomerActivity = async (customerId: string) => {
  const [user, orders, reviews, tickets, statusHistory, loginEvents] = await Promise.all([
    loadCustomerOrThrow(customerId),
    prisma.order.findMany({
      where: {
        userId: customerId
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.review.findMany({
      where: {
        userId: customerId
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.supportTicket.findMany({
      where: {
        userId: customerId
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.userStatusHistory.findMany({
      where: {
        userId: customerId
      },
      orderBy: {
        changedAt: "desc"
      }
    }),
    prisma.loginEvent.findMany({
      where: {
        userId: customerId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 500
    })
  ]);

  const items = [
    ...loginEvents.map((entry) => ({
      id: `login:${entry.id}`,
      kind: "LOGIN_EVENT",
      occurredAt: entry.createdAt,
      payload: {
        success: entry.success,
        failureReason: entry.failureReason,
        ipCountry: entry.ipCountry,
        ipRegion: entry.ipRegion,
        userAgent: entry.userAgent
      }
    })),
    ...orders.map((order) => ({
      id: `order:${order.id}`,
      kind: "ORDER",
      occurredAt: order.createdAt,
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status
      }
    })),
    ...reviews.map((review) => ({
      id: `review:${review.id}`,
      kind: "REVIEW",
      occurredAt: review.createdAt,
      payload: {
        reviewId: review.id,
        productId: review.productId,
        rating: review.rating,
        status: review.status
      }
    })),
    ...tickets.map((ticket) => ({
      id: `ticket:${ticket.id}`,
      kind: "SUPPORT_TICKET",
      occurredAt: ticket.createdAt,
      payload: {
        ticketId: ticket.id,
        status: ticket.status,
        priority: ticket.priority
      }
    })),
    ...statusHistory.map((entry) => ({
      id: `status:${entry.id}`,
      kind: "STATUS_CHANGE",
      occurredAt: entry.changedAt,
      payload: {
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        reason: entry.reason
      }
    })),
    ...user.securityEvents.map((entry) => ({
      id: `security:${entry.id}`,
      kind: "SECURITY_EVENT",
      occurredAt: entry.createdAt,
      payload: {
        type: entry.type,
        severity: entry.severity,
        status: entry.status,
        metadata: entry.metadata
      }
    })),
    ...user.customerNotes.map((entry) => ({
      id: `note:${entry.id}`,
      kind: "CUSTOMER_NOTE",
      occurredAt: entry.createdAt,
      payload: {
        note: entry.note,
        actorAdmin: entry.actorAdmin
      }
    }))
  ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());

  return {
    entity: {
      id: user.id,
      email: user.email
    },
    items
  };
};

const summarizeOrderPayments = (
  payments: Array<{ paymentState: PaymentState; amountCents: number; currency: string }>
) => {
  if (payments.length === 0) {
    return "No payment";
  }

  const states = payments.map((payment) => payment.paymentState);
  if (states.includes(PaymentState.PAID) || states.includes(PaymentState.PARTIALLY_REFUNDED)) {
    return "Paid";
  }
  if (states.every((state) => state === PaymentState.FAILED)) {
    return "Failed";
  }
  if (states.includes(PaymentState.CANCELLED)) {
    return "Cancelled";
  }
  if (states.includes(PaymentState.PENDING_INITIALIZATION) || states.includes(PaymentState.INITIALIZED)) {
    return "Pending";
  }

  return states[0]?.replace(/_/g, " ") ?? "Payment";
};

const summarizeOrderFulfillment = (shipments: Array<{ status: string }>) => {
  if (shipments.length === 0) {
    return "Unfulfilled";
  }
  if (shipments.length === 1) {
    const first = shipments[0];
    return first ? first.status.replace(/_/g, " ") : "Unfulfilled";
  }
  return `${shipments.length} shipments`;
};

const serializeAdminCustomerOrderRow = (
  order: Prisma.OrderGetPayload<{
    include: {
      items: {
        select: {
          quantity: true;
          productTitleSnapshot: true;
          unitPriceAmountCents: true;
          unitPriceCurrency: true;
        };
      };
      payments: {
        select: {
          paymentState: true;
          amountCents: true;
          currency: true;
        };
      };
      shipments: {
        select: {
          status: true;
        };
      };
    };
  }>
) => {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmountCents = order.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceAmountCents,
    0
  );
  const currency = order.items[0]?.unitPriceCurrency ?? "USD";
  const preview = order.items.slice(0, 3).map((item) => `${item.quantity}× ${item.productTitleSnapshot}`);
  let lineSummary = "—";
  if (preview.length > 0) {
    lineSummary = preview.join("; ");
    if (order.items.length > 3) {
      lineSummary += "; …";
    }
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    itemCount,
    lineSummary,
    totalAmountCents,
    currency,
    paymentSummary: summarizeOrderPayments(order.payments),
    fulfillmentSummary: summarizeOrderFulfillment(order.shipments)
  };
};

export const listAdminCustomerOrders = async (
  customerId: string,
  input: PaginationInput
) => {
  const where: Prisma.OrderWhereInput = {
    userId: customerId
  };

  const orderInclude = {
    items: {
      select: {
        quantity: true,
        productTitleSnapshot: true,
        unitPriceAmountCents: true,
        unitPriceCurrency: true
      }
    },
    payments: {
      select: {
        paymentState: true,
        amountCents: true,
        currency: true
      },
      orderBy: {
        createdAt: "desc" as const
      }
    },
    shipments: {
      select: {
        status: true
      },
      orderBy: {
        updatedAt: "desc" as const
      }
    }
  } satisfies Prisma.OrderInclude;

  const [rows, totalItems] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      },
      include: orderInclude,
      ...buildPagination(input)
    }),
    prisma.order.count({ where })
  ]);

  const items = rows.map((row) => serializeAdminCustomerOrderRow(row));

  return {
    items,
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const listAdminCustomerSupport = async (
  customerId: string,
  input: PaginationInput
) => {
  const where: Prisma.SupportTicketWhereInput = {
    userId: customerId
  };

  const [items, totalItems] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.supportTicket.count({ where })
  ]);

  return {
    items,
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const listAdminCustomerReviews = async (
  customerId: string,
  input: PaginationInput
) => {
  const where: Prisma.ReviewWhereInput = {
    userId: customerId
  };

  const [items, totalItems] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
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
      },
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.review.count({ where })
  ]);

  return {
    items,
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAdminCustomerRisk = async (customerId: string) => {
  const user = await loadCustomerOrThrow(customerId);

  const [loginPatterns, refundSummary] = await Promise.all([
    prisma.loginEvent.findMany({
      where: {
        userId: customerId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 25,
      select: {
        id: true,
        success: true,
        failureReason: true,
        ipCountry: true,
        ipRegion: true,
        userAgent: true,
        createdAt: true
      }
    }),
    (async () => {
      const [aggregate, lastCompleted] = await Promise.all([
        prisma.refund.aggregate({
          where: {
            state: RefundState.COMPLETED,
            payment: {
              order: {
                userId: customerId
              }
            }
          },
          _count: {
            _all: true
          },
          _sum: {
            amountCents: true
          }
        }),
        prisma.refund.findFirst({
          where: {
            state: RefundState.COMPLETED,
            payment: {
              order: {
                userId: customerId
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          select: {
            createdAt: true,
            amountCents: true,
            currency: true
          }
        })
      ]);

      return {
        completedCount: aggregate._count._all,
        totalAmountCents: aggregate._sum.amountCents ?? 0,
        lastCompletedAt: lastCompleted?.createdAt ?? null,
        lastAmountCents: lastCompleted?.amountCents ?? null,
        lastCurrency: lastCompleted?.currency ?? null
      };
    })()
  ]);

  return {
    entity: {
      id: user.id,
      email: user.email,
      status: user.status
    },
    riskSignals: user.riskSignals,
    securityEvents: user.securityEvents,
    loginPatterns,
    refundSummary
  };
};

export const suspendAdminCustomer = async (input: {
  actorAdminUserId: string;
  customerId: string;
  reason: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const user = await loadCustomerOrThrow(input.customerId, transaction);

    if (user.status === UserStatus.SUSPENDED) {
      throw invalidStateTransitionError("The customer is already suspended.");
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw accountSuspendedError("The customer account is deactivated.");
    }

    await transaction.user.update({
      where: {
        id: user.id
      },
      data: {
        status: UserStatus.SUSPENDED
      }
    });

    await Promise.all([
      transaction.userStatusHistory.create({
        data: {
          userId: user.id,
          fromStatus: user.status,
          toStatus: UserStatus.SUSPENDED,
          reason: input.reason,
          actorAdminUserId: input.actorAdminUserId,
          metadata: toPrismaJsonValue({
            note: input.note
          })
        }
      }),
      transaction.securityEvent.create({
        data: {
          userId: user.id,
          adminUserId: input.actorAdminUserId,
          type: "CUSTOMER_SUSPENDED",
          metadata: toPrismaJsonValue({
            reason: input.reason,
            note: input.note
          })
        }
      })
    ]);

    await recordCustomerAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "customers.suspend",
      customerId: user.id,
      reason: input.reason,
      note: input.note,
      before: {
        status: user.status
      },
      after: {
        status: UserStatus.SUSPENDED
      },
      eventType: "CUSTOMER_SUSPENDED",
      payload: {
        reason: input.reason,
        note: input.note
      }
    });

    return getAdminCustomerDetail(user.id);
  }).then(async (result) => {
    if (result.entity.email) {
      await enqueueNotification({
        type: "CUSTOMER_SUSPENDED",
        recipientUserId: result.entity.id,
        recipientEmail: result.entity.email,
        recipientType: "USER",
        payload: {
          customerId: result.entity.id,
          reason: input.reason,
          note: input.note
        }
      }).catch(() => null);
    }

    return result;
  });

export const restoreAdminCustomer = async (input: {
  actorAdminUserId: string;
  customerId: string;
  reason: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const user = await loadCustomerOrThrow(input.customerId, transaction);

    if (user.status === UserStatus.ACTIVE) {
      throw invalidStateTransitionError("The customer is already active.");
    }

    await transaction.user.update({
      where: {
        id: user.id
      },
      data: {
        status: UserStatus.ACTIVE
      }
    });

    await Promise.all([
      transaction.userStatusHistory.create({
        data: {
          userId: user.id,
          fromStatus: user.status,
          toStatus: UserStatus.ACTIVE,
          reason: input.reason,
          actorAdminUserId: input.actorAdminUserId,
          metadata: toPrismaJsonValue({
            note: input.note
          })
        }
      }),
      transaction.securityEvent.create({
        data: {
          userId: user.id,
          adminUserId: input.actorAdminUserId,
          type: "CUSTOMER_RESTORED",
          metadata: toPrismaJsonValue({
            reason: input.reason,
            note: input.note
          })
        }
      })
    ]);

    await recordCustomerAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "customers.restore",
      customerId: user.id,
      reason: input.reason,
      note: input.note,
      before: {
        status: user.status
      },
      after: {
        status: UserStatus.ACTIVE
      },
      eventType: "CUSTOMER_RESTORED",
      payload: {
        reason: input.reason,
        note: input.note
      }
    });

    return getAdminCustomerDetail(user.id);
  }).then(async (result) => {
    if (result.entity.email) {
      await enqueueNotification({
        type: "CUSTOMER_RESTORED",
        recipientUserId: result.entity.id,
        recipientEmail: result.entity.email,
        recipientType: "USER",
        payload: {
          customerId: result.entity.id,
          reason: input.reason,
          note: input.note
        }
      }).catch(() => null);
    }

    return result;
  });

export const createAdminCustomerNote = async (input: {
  actorAdminUserId: string;
  customerId: string;
  note: string;
}) =>
  runInTransaction(async (transaction) => {
    await loadCustomerOrThrow(input.customerId, transaction);

    const createdNote = await transaction.customerNote.create({
      data: {
        userId: input.customerId,
        actorAdminUserId: input.actorAdminUserId,
        note: input.note
      }
    });

    await recordCustomerAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "customers.note.create",
      customerId: input.customerId,
      note: input.note,
      after: {
        noteId: createdNote.id
      },
      eventType: "CUSTOMER_NOTE_CREATED",
      payload: {
        noteId: createdNote.id,
        note: input.note
      }
    });

    return {
      entity: createdNote
    };
  });

export const escalateAdminCustomer = async (input: {
  actorAdminUserId: string;
  customerId: string;
  category: string;
  observation: string;
}) =>
  runInTransaction(async (transaction) => {
    const user = await loadCustomerOrThrow(input.customerId, transaction);

    await transaction.securityEvent.create({
      data: {
        userId: user.id,
        adminUserId: input.actorAdminUserId,
        type: "CUSTOMER_ESCALATION",
        severity: SecuritySeverity.HIGH,
        status: "OPEN",
        metadata: toPrismaJsonValue({
          category: input.category,
          observation: input.observation
        })
      }
    });

    await recordCustomerAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "customers.escalate",
      customerId: user.id,
      reason: input.category,
      note: input.observation,
      eventType: "CUSTOMER_ESCALATION",
      payload: {
        category: input.category,
        observation: input.observation
      }
    });

    return {
      ok: true
    };
  });

export const performAdminCustomerInternalAction = async (
  input:
    | {
        actorAdminUserId: string;
        customerId: string;
        kind: "NOTE";
        note: string;
      }
    | {
        actorAdminUserId: string;
        customerId: string;
        kind: "ESCALATE";
        category: string;
        observation: string;
      }
) => {
  if (input.kind === "NOTE") {
    return createAdminCustomerNote({
      actorAdminUserId: input.actorAdminUserId,
      customerId: input.customerId,
      note: input.note
    });
  }

  return escalateAdminCustomer({
    actorAdminUserId: input.actorAdminUserId,
    customerId: input.customerId,
    category: input.category,
    observation: input.observation
  });
};
