import { RefundState, ShipmentStatus, UserStatus } from "@prisma/client";

import { clerkClient } from "../../config/clerk";
import { prisma } from "../../config/prisma";
import { enqueueNotification } from "../notifications/notifications.service";
import {
  revokeCustomerApiSessionBySessionId,
  revokeCustomerApiSessionsForUser
} from "../auth/api-session.service";
import { runInTransaction, type DbClient } from "../../common/database/prisma-transaction";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import {
  invalidInputError,
  notFoundError,
  providerFailureError
} from "../../common/errors/app-error";

const serializePreferences = (
  preferences:
    | {
        orderUpdatesEmailEnabled: boolean;
        shipmentUpdatesEmailEnabled: boolean;
        supportUpdatesEmailEnabled: boolean;
        reviewRemindersEnabled: boolean;
        securityAlertsEmailEnabled: boolean;
        marketingEmailEnabled: boolean;
        marketingSmsEnabled: boolean;
      }
    | null
) => ({
  orderUpdatesEmailEnabled: preferences?.orderUpdatesEmailEnabled ?? true,
  shipmentUpdatesEmailEnabled: preferences?.shipmentUpdatesEmailEnabled ?? true,
  supportUpdatesEmailEnabled: preferences?.supportUpdatesEmailEnabled ?? true,
  reviewRemindersEnabled: preferences?.reviewRemindersEnabled ?? true,
  securityAlertsEmailEnabled: preferences?.securityAlertsEmailEnabled ?? true,
  marketingEmailEnabled: preferences?.marketingEmailEnabled ?? false,
  marketingSmsEnabled: preferences?.marketingSmsEnabled ?? false
});

const serializeAddress = (address: {
  id: string;
  label: string | null;
  fullName: string;
  phoneNumber: string | null;
  country: string;
  region: string;
  city: string;
  postalCode: string | null;
  addressLine1: string;
  addressLine2: string | null;
  deliveryInstructions: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
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
  deliveryInstructions: address.deliveryInstructions,
  isDefaultShipping: address.isDefaultShipping,
  isDefaultBilling: address.isDefaultBilling,
  createdAt: address.createdAt,
  updatedAt: address.updatedAt
});

const buildAnonymizedEmail = (userId: string) => `deleted+${userId}@example.invalid`;

const redactAddressSnapshot = (value: unknown) =>
  toPrismaJsonValue({
    anonymized: true,
    retainedForCompliance: true,
    originalShapeType: Array.isArray(value) ? "array" : typeof value
  });

const loadAccountUserOrThrow = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      addresses: {
        orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "asc" }]
      },
      notificationPreference: true,
      securityEvents: {
        orderBy: {
          createdAt: "desc"
        },
        take: 5
      }
    }
  });

  if (!user) {
    throw notFoundError("The authenticated customer account could not be found.");
  }

  return user;
};

const ensurePreferenceRecord = async (userId: string) =>
  prisma.userNotificationPreference.upsert({
    where: {
      userId
    },
    update: {},
    create: {
      userId
    }
  });

const recordCustomerAccountMutation = async (input: {
  userId: string;
  actionCode: string;
  entityType: string;
  entityId: string;
  eventType: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}) => {
  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        actorType: "CUSTOMER",
        actorUserId: input.userId,
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: toPrismaJsonValue({
          before: input.before,
          after: input.after,
          context: input.metadata
        })
      }
    }),
    prisma.timelineEvent.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.eventType,
        actorType: "CUSTOMER",
        actorUserId: input.userId,
        payload: toPrismaJsonValue(input.metadata ?? input.after ?? {})
      }
    })
  ]);
};

const rebalanceDefaultFlags = async (
  input: {
    userId: string;
    addressId: string;
    scope: "shipping" | "billing" | "both";
  },
  db: DbClient = prisma
) => {
  if (input.scope === "shipping" || input.scope === "both") {
    await db.userAddress.updateMany({
      where: {
        userId: input.userId
      },
      data: {
        isDefaultShipping: false
      }
    });

    await db.userAddress.update({
      where: {
        id: input.addressId
      },
      data: {
        isDefaultShipping: true
      }
    });
  }

  if (input.scope === "billing" || input.scope === "both") {
    await db.userAddress.updateMany({
      where: {
        userId: input.userId
      },
      data: {
        isDefaultBilling: false
      }
    });

    await db.userAddress.update({
      where: {
        id: input.addressId
      },
      data: {
        isDefaultBilling: true
      }
    });
  }
};

export const getAccountDashboard = async (userId: string) => {
  const user = await loadAccountUserOrThrow(userId);
  const [
    orders,
    openTickets,
    reviews,
    returns,
    refunds,
    wishlistItems,
    recentOrders,
    deliveredOrders,
    existingReviews,
    returnStatusGroups,
    refundStateGroups
  ] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.supportTicket.count({
      where: {
        userId,
        status: {
          not: "CLOSED"
        }
      }
    }),
    prisma.review.count({ where: { userId } }),
    prisma.return.count({ where: { order: { userId } } }),
    prisma.refund.count({ where: { payment: { order: { userId } } } }),
    prisma.wishlistItem.count({ where: { userId } }),
    prisma.order.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true
      }
    }),
    prisma.order.findMany({
      where: {
        userId,
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
      select: {
        id: true,
        items: {
          select: {
            id: true,
            variantId: true,
            variant: {
              select: {
                productId: true
              }
            }
          }
        }
      }
    }),
    prisma.review.findMany({
      where: {
        userId
      },
      select: {
        productId: true,
        variantId: true
      }
    }),
    prisma.return.groupBy({
      by: ["status"],
      where: {
        order: {
          userId
        }
      },
      _count: {
        _all: true
      }
    }),
    prisma.refund.groupBy({
      by: ["state"],
      where: {
        payment: {
          order: {
            userId
          }
        }
      },
      _count: {
        _all: true
      }
    })
  ]);

  const existingReviewKeys = new Set(
    existingReviews.flatMap((review) => [`${review.productId}:${review.variantId ?? ""}`, `${review.productId}:`])
  );
  const pendingReviews = deliveredOrders.reduce((count, order) => {
    return (
      count +
      order.items.filter((item) => {
        return !existingReviewKeys.has(`${item.variant.productId}:${item.variantId}`) &&
          !existingReviewKeys.has(`${item.variant.productId}:`);
      }).length
    );
  }, 0);

  const returnStatusCounts = new Map(returnStatusGroups.map((entry) => [entry.status, entry._count._all]));
  const refundStateCounts = new Map(refundStateGroups.map((entry) => [entry.state, entry._count._all]));

  return {
    entity: {
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        status: user.status
      },
      preferences: serializePreferences(user.notificationPreference),
      counts: {
        orders,
        openTickets,
        reviews,
        pendingReviews,
        returns,
        refunds,
        wishlistItems,
        addresses: user.addresses.length
      },
      serviceSnapshot: {
        returns: {
          total: returns,
          open:
            (returnStatusCounts.get("REQUESTED") ?? 0) +
            (returnStatusCounts.get("APPROVED") ?? 0) +
            (returnStatusCounts.get("RECEIVED") ?? 0),
          byStatus: {
            requested: returnStatusCounts.get("REQUESTED") ?? 0,
            approved: returnStatusCounts.get("APPROVED") ?? 0,
            received: returnStatusCounts.get("RECEIVED") ?? 0,
            completed: returnStatusCounts.get("COMPLETED") ?? 0,
            rejected: returnStatusCounts.get("REJECTED") ?? 0
          }
        },
        refunds: {
          total: refunds,
          open:
            (refundStateCounts.get(RefundState.PENDING_APPROVAL) ?? 0) +
            (refundStateCounts.get(RefundState.APPROVED) ?? 0) +
            (refundStateCounts.get(RefundState.PENDING_PROVIDER) ?? 0),
          byState: {
            pendingApproval: refundStateCounts.get(RefundState.PENDING_APPROVAL) ?? 0,
            approved: refundStateCounts.get(RefundState.APPROVED) ?? 0,
            pendingProvider: refundStateCounts.get(RefundState.PENDING_PROVIDER) ?? 0,
            completed: refundStateCounts.get(RefundState.COMPLETED) ?? 0,
            rejected: refundStateCounts.get(RefundState.REJECTED) ?? 0,
            failed: refundStateCounts.get(RefundState.FAILED) ?? 0
          }
        }
      },
      recentOrders
    }
  };
};

export const getAccountProfile = async (userId: string) => {
  const user = await loadAccountUserOrThrow(userId);

  return {
    entity: {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  };
};

export const updateAccountProfile = async (input: {
  userId: string;
  clerkUserId?: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
}) => {
  const current = await loadAccountUserOrThrow(input.userId);

  if (!current.clerkUserId) {
    throw notFoundError("The customer is not linked to a Clerk user.");
  }

  try {
    await clerkClient.users.updateUser(current.clerkUserId, {
      ...(input.firstName !== undefined ? { firstName: input.firstName ?? undefined } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName ?? undefined } : {})
    });
  } catch (error) {
    throw providerFailureError("The customer profile could not be synchronized to Clerk.", {
      cause: error
    });
  }

  const updated = await prisma.user.update({
    where: {
      id: input.userId
    },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {})
    }
  });

  await recordCustomerAccountMutation({
    userId: input.userId,
    actionCode: "account.profile.update",
    entityType: "USER",
    entityId: input.userId,
    eventType: "ACCOUNT_PROFILE_UPDATED",
    before: {
      firstName: current.firstName,
      lastName: current.lastName,
      phoneNumber: current.phoneNumber
    },
    after: {
      firstName: updated.firstName,
      lastName: updated.lastName,
      phoneNumber: updated.phoneNumber
    }
  });

  return {
    entity: {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phoneNumber: updated.phoneNumber,
      status: updated.status,
      updatedAt: updated.updatedAt
    }
  };
};

export const getAccountPreferences = async (userId: string) => {
  const preferences = await ensurePreferenceRecord(userId);

  return {
    entity: serializePreferences(preferences)
  };
};

export const updateAccountPreferences = async (input: {
  userId: string;
  data: Record<string, boolean | undefined>;
}) => {
  const current = await ensurePreferenceRecord(input.userId);
  const updated = await prisma.userNotificationPreference.update({
    where: {
      userId: input.userId
    },
    data: input.data
  });

  await recordCustomerAccountMutation({
    userId: input.userId,
    actionCode: "account.preferences.update",
    entityType: "USER_NOTIFICATION_PREFERENCE",
    entityId: updated.id,
    eventType: "ACCOUNT_PREFERENCES_UPDATED",
    before: serializePreferences(current),
    after: serializePreferences(updated)
  });

  return {
    entity: serializePreferences(updated)
  };
};

export const listAccountAddresses = async (userId: string) => {
  const addresses = await prisma.userAddress.findMany({
    where: {
      userId
    },
    orderBy: [{ isDefaultShipping: "desc" }, { isDefaultBilling: "desc" }, { createdAt: "asc" }]
  });

  return {
    items: addresses.map(serializeAddress)
  };
};

export const createAccountAddress = async (input: {
  userId: string;
  data: {
    label?: string | null;
    fullName: string;
    phoneNumber?: string | null;
    country: string;
    region: string;
    city: string;
    postalCode?: string | null;
    addressLine1: string;
    addressLine2?: string | null;
    deliveryInstructions?: string | null;
    isDefaultShipping?: boolean;
    isDefaultBilling?: boolean;
  };
}) => {
  const refreshed = await runInTransaction(async (transaction) => {
    const currentCount = await transaction.userAddress.count({
      where: {
        userId: input.userId
      }
    });

    const created = await transaction.userAddress.create({
      data: {
        userId: input.userId,
        ...input.data,
        isDefaultShipping: currentCount === 0 ? true : Boolean(input.data.isDefaultShipping),
        isDefaultBilling: currentCount === 0 ? true : Boolean(input.data.isDefaultBilling)
      }
    });

    if (created.isDefaultShipping) {
      await rebalanceDefaultFlags(
        {
          userId: input.userId,
          addressId: created.id,
          scope: created.isDefaultBilling ? "both" : "shipping"
        },
        transaction
      );
    } else if (created.isDefaultBilling) {
      await rebalanceDefaultFlags(
        {
          userId: input.userId,
          addressId: created.id,
          scope: "billing"
        },
        transaction
      );
    }

    return transaction.userAddress.findUniqueOrThrow({
      where: {
        id: created.id
      }
    });
  });

  await recordCustomerAccountMutation({
    userId: input.userId,
    actionCode: "account.addresses.create",
    entityType: "USER_ADDRESS",
    entityId: refreshed.id,
    eventType: "ACCOUNT_ADDRESS_CREATED",
    after: serializeAddress(refreshed)
  });

  return {
    entity: serializeAddress(refreshed)
  };
};

export const updateAccountAddress = async (input: {
  userId: string;
  addressId: string;
  data: Record<string, unknown>;
}) => {
  const current = await prisma.userAddress.findFirst({
    where: {
      id: input.addressId,
      userId: input.userId
    }
  });

  if (!current) {
    throw notFoundError("The requested address was not found.");
  }

  if (input.data.isDefaultShipping === false && current.isDefaultShipping) {
    throw invalidInputError("Use the default-address endpoint to move the default shipping flag.");
  }

  if (input.data.isDefaultBilling === false && current.isDefaultBilling) {
    throw invalidInputError("Use the default-address endpoint to move the default billing flag.");
  }

  const refreshed = await runInTransaction(async (transaction) => {
    const updated = await transaction.userAddress.update({
      where: {
        id: input.addressId
      },
      data: input.data
    });

    if (input.data.isDefaultShipping === true) {
      await rebalanceDefaultFlags(
        {
          userId: input.userId,
          addressId: updated.id,
          scope: input.data.isDefaultBilling === true ? "both" : "shipping"
        },
        transaction
      );
    } else if (input.data.isDefaultBilling === true) {
      await rebalanceDefaultFlags(
        {
          userId: input.userId,
          addressId: updated.id,
          scope: "billing"
        },
        transaction
      );
    }

    return transaction.userAddress.findUniqueOrThrow({
      where: {
        id: updated.id
      }
    });
  });

  await recordCustomerAccountMutation({
    userId: input.userId,
    actionCode: "account.addresses.update",
    entityType: "USER_ADDRESS",
    entityId: refreshed.id,
    eventType: "ACCOUNT_ADDRESS_UPDATED",
    before: serializeAddress(current),
    after: serializeAddress(refreshed)
  });

  return {
    entity: serializeAddress(refreshed)
  };
};

export const deleteAccountAddress = async (input: { userId: string; addressId: string }) => {
  const current = await prisma.userAddress.findFirst({
    where: {
      id: input.addressId,
      userId: input.userId
    }
  });

  if (!current) {
    throw notFoundError("The requested address was not found.");
  }

  await runInTransaction(async (transaction) => {
    await transaction.userAddress.delete({
      where: {
        id: input.addressId
      }
    });

    const remaining = await transaction.userAddress.findMany({
      where: {
        userId: input.userId
      },
      orderBy: {
        createdAt: "asc"
      }
    });
    const fallbackAddress = remaining[0];

    if (current.isDefaultShipping && fallbackAddress) {
      await transaction.userAddress.update({
        where: {
          id: fallbackAddress.id
        },
        data: {
          isDefaultShipping: true
        }
      });
    }

    if (current.isDefaultBilling && fallbackAddress) {
      await transaction.userAddress.update({
        where: {
          id: fallbackAddress.id
        },
        data: {
          isDefaultBilling: true
        }
      });
    }
  });

  await recordCustomerAccountMutation({
    userId: input.userId,
    actionCode: "account.addresses.delete",
    entityType: "USER_ADDRESS",
    entityId: input.addressId,
    eventType: "ACCOUNT_ADDRESS_DELETED",
    before: serializeAddress(current)
  });

  return {
    deleted: true
  };
};

export const setDefaultAccountAddress = async (input: {
  userId: string;
  addressId: string;
  scope: "shipping" | "billing" | "both";
}) => {
  const address = await prisma.userAddress.findFirst({
    where: {
      id: input.addressId,
      userId: input.userId
    }
  });

  if (!address) {
    throw notFoundError("The requested address was not found.");
  }

  const refreshed = await runInTransaction(async (transaction) => {
    await rebalanceDefaultFlags(input, transaction);

    return transaction.userAddress.findUniqueOrThrow({
      where: {
        id: input.addressId
      }
    });
  });

  await recordCustomerAccountMutation({
    userId: input.userId,
    actionCode: "account.addresses.set_default",
    entityType: "USER_ADDRESS",
    entityId: refreshed.id,
    eventType: "ACCOUNT_ADDRESS_DEFAULT_UPDATED",
    metadata: {
      scope: input.scope
    },
    after: serializeAddress(refreshed)
  });

  return {
    entity: serializeAddress(refreshed)
  };
};

export const getAccountSecurity = async (userId: string, currentSessionId: string | null) => {
  const user = await loadAccountUserOrThrow(userId);
  const sessions = await prisma.sessionMetadata.findMany({
    where: {
      userId,
      sessionType: "customer"
    },
    orderBy: {
      lastActiveAt: "desc"
    }
  });

  return {
    entity: {
      status: user.status,
      passwordManagedBy: "clerk",
      sessions: {
        active: sessions.filter((session) => !session.revokedAt).length,
        revoked: sessions.filter((session) => Boolean(session.revokedAt)).length,
        currentSessionId
      },
      recentSecurityEvents: user.securityEvents.map((event) => ({
        id: event.id,
        type: event.type,
        status: event.status,
        severity: event.severity,
        createdAt: event.createdAt,
        resolvedAt: event.resolvedAt,
        metadata: event.metadata
      }))
    }
  };
};

export const listAccountSecuritySessions = async (userId: string, currentSessionId: string | null) => {
  const sessions = await prisma.sessionMetadata.findMany({
    where: {
      userId,
      sessionType: "customer"
    },
    orderBy: {
      lastActiveAt: "desc"
    }
  });

  return {
    items: sessions.map((session) => ({
      id: session.id,
      sessionId: session.sessionId,
      deviceLabel: session.deviceLabel,
      ipAddress: session.ipAddress,
      ipCountry: session.ipCountry,
      ipRegion: session.ipRegion,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      revokedAt: session.revokedAt,
      isCurrent: currentSessionId === session.sessionId
    }))
  };
};

export const revokeAccountSecuritySession = async (input: {
  userId: string;
  sessionId: string;
}) => {
  const session = await prisma.sessionMetadata.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
      sessionType: "customer"
    }
  });

  if (!session) {
    throw notFoundError("The requested customer session was not found.");
  }

  const updated = await prisma.sessionMetadata.update({
    where: {
      id: session.id
    },
    data: {
      revokedAt: session.revokedAt ?? new Date()
    }
  });

  await revokeCustomerApiSessionBySessionId(updated.sessionId);

  await recordCustomerAccountMutation({
    userId: input.userId,
    actionCode: "account.security.sessions.revoke",
    entityType: "SESSION",
    entityId: updated.id,
    eventType: "ACCOUNT_SESSION_REVOKED",
    after: {
      sessionId: updated.sessionId,
      revokedAt: updated.revokedAt
    }
  });

  return {
    entity: {
      id: updated.id,
      sessionId: updated.sessionId,
      revokedAt: updated.revokedAt
    }
  };
};

export const changeAccountPassword = async (input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  signOutOtherSessions: boolean;
  currentSessionId: string | null;
}) => {
  const user = await prisma.user.findUnique({
    where: {
      id: input.userId
    }
  });

  if (!user) {
    throw notFoundError("The authenticated customer account could not be found.");
  }

  try {
    await clerkClient.users.verifyPassword({
      userId: user.clerkUserId,
      password: input.currentPassword
    });
  } catch {
    throw invalidInputError("The current password is incorrect.");
  }

  try {
    await clerkClient.users.updateUser(user.clerkUserId, {
      password: input.newPassword,
      signOutOfOtherSessions: input.signOutOtherSessions
    });
  } catch (error) {
    throw providerFailureError("The account password could not be updated in Clerk.", {
      cause: error
    });
  }

  if (input.signOutOtherSessions) {
    await prisma.sessionMetadata.updateMany({
      where: {
        userId: input.userId,
        sessionType: "customer",
        ...(input.currentSessionId
          ? {
              sessionId: {
                not: input.currentSessionId
              }
            }
          : {})
      },
      data: {
        revokedAt: new Date()
      }
    });

    await revokeCustomerApiSessionsForUser({
      userId: input.userId,
      exceptSessionId: input.currentSessionId
    });
  }

  await recordCustomerAccountMutation({
    userId: input.userId,
    actionCode: "account.security.password.change",
    entityType: "USER",
    entityId: input.userId,
    eventType: "ACCOUNT_PASSWORD_CHANGED",
    metadata: {
      signOutOtherSessions: input.signOutOtherSessions
    }
  });

  if (user.email) {
    await enqueueNotification({
      type: "PASSWORD_CHANGED",
      recipientUserId: user.id,
      recipientEmail: user.email,
      payload: {
        changedAt: new Date().toISOString()
      }
    });
  }

  return {
    entity: {
      passwordUpdated: true,
      otherSessionsRevoked: input.signOutOtherSessions
    }
  };
};

export const exportAccountPrivacyData = async (userId: string) => {
  const user = await loadAccountUserOrThrow(userId);
  const [orders, tickets, reviews] = await Promise.all([
    prisma.order.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        addressSnapshot: true,
        payments: {
          select: {
            id: true,
            paymentState: true,
            amountCents: true,
            currency: true,
            refunds: {
              select: {
                id: true,
                state: true,
                amountCents: true,
                currency: true
              }
            }
          }
        }
      }
    }),
    prisma.supportTicket.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.review.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        productId: true,
        variantId: true,
        rating: true,
        body: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })
  ]);

  await recordCustomerAccountMutation({
    userId,
    actionCode: "account.privacy.export",
    entityType: "USER",
    entityId: userId,
    eventType: "ACCOUNT_PRIVACY_EXPORT_CREATED",
    metadata: {
      orderCount: orders.length,
      ticketCount: tickets.length,
      reviewCount: reviews.length
    }
  });

  return {
    entity: {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      preferences: serializePreferences(user.notificationPreference),
      addresses: user.addresses.map(serializeAddress),
      recentSecurityEvents: user.securityEvents.map((event) => ({
        id: event.id,
        type: event.type,
        severity: event.severity,
        status: event.status,
        createdAt: event.createdAt,
        resolvedAt: event.resolvedAt,
        metadata: event.metadata
      })),
      orders,
      tickets,
      reviews
    }
  };
};

export const anonymizeAccountPrivacyData = async (input: {
  userId: string;
  currentSessionId: string | null;
}) => {
  const user = await loadAccountUserOrThrow(input.userId);
  const anonymizedEmail = buildAnonymizedEmail(user.id);

  await runInTransaction(async (transaction) => {
    await transaction.user.update({
      where: {
        id: user.id
      },
      data: {
        email: anonymizedEmail,
        firstName: null,
        lastName: null,
        phoneNumber: null,
        status: UserStatus.DEACTIVATED
      }
    });

    await transaction.userAddress.updateMany({
      where: {
        userId: user.id
      },
      data: {
        fullName: "Deleted User",
        phoneNumber: null,
        postalCode: null,
        addressLine1: "[redacted]",
        addressLine2: null,
        deliveryInstructions: null
      }
    });

    await transaction.order.updateMany({
      where: {
        userId: user.id
      },
      data: {
        addressSnapshot: redactAddressSnapshot(null)
      }
    });

    await transaction.review.updateMany({
      where: {
        userId: user.id
      },
      data: {
        body: null
      }
    });

    await transaction.userNotificationPreference.updateMany({
      where: {
        userId: user.id
      },
      data: {
        orderUpdatesEmailEnabled: false,
        shipmentUpdatesEmailEnabled: false,
        supportUpdatesEmailEnabled: false,
        reviewRemindersEnabled: false,
        securityAlertsEmailEnabled: false,
        marketingEmailEnabled: false,
        marketingSmsEnabled: false
      }
    });

    await transaction.sessionMetadata.updateMany({
      where: {
        userId: user.id,
        sessionType: "customer"
      },
      data: {
        revokedAt: new Date()
      }
    });
  });

  await revokeCustomerApiSessionsForUser({
    userId: user.id,
    exceptSessionId: null
  });

  await recordCustomerAccountMutation({
    userId: user.id,
    actionCode: "account.privacy.anonymize",
    entityType: "USER",
    entityId: user.id,
    eventType: "ACCOUNT_PRIVACY_ANONYMIZED",
    before: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      status: user.status
    },
    after: {
      email: anonymizedEmail,
      firstName: null,
      lastName: null,
      phoneNumber: null,
      status: UserStatus.DEACTIVATED
    }
  });

  return {
    entity: {
      anonymized: true,
      status: UserStatus.DEACTIVATED,
      currentSessionRevoked: Boolean(input.currentSessionId),
      anonymizedEmail
    }
  };
};
