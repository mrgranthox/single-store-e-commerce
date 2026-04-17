import { Prisma, ShipmentStatus } from "@prisma/client";

import {
  invalidInputError,
  invalidStateTransitionError,
  notFoundError
} from "../../common/errors/app-error";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { logger } from "../../config/logger";
import { prisma } from "../../config/prisma";
import { enqueueNotification } from "../notifications/notifications.service";
import { finalizeOrderInventoryForFulfillment } from "../orders/orders.service";
import { buildShippingMethodOptions } from "./shipping.methods";

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

const shipmentInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      addressSnapshot: true
    }
  },
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
} satisfies Prisma.ShipmentInclude;

type ShipmentRecord = Prisma.ShipmentGetPayload<{
  include: typeof shipmentInclude;
}>;

const fulfillableOrderStatuses = new Set(["CONFIRMED", "PROCESSING"]);
const inventoryFinalizationShipmentStates = new Set<ShipmentStatus>([
  ShipmentStatus.DISPATCHED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERED
]);

const shipmentStatusTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.CREATED]: [ShipmentStatus.PACKING, ShipmentStatus.DISPATCHED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.PACKING]: [ShipmentStatus.DISPATCHED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.DISPATCHED]: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.CANCELLED]: []
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readRecipient = (value: Prisma.JsonValue) => {
  const record = isRecord(value) ? value : {};

  return {
    fullName: typeof record.fullName === "string" ? record.fullName : null,
    email:
      typeof record.contactEmail === "string"
        ? record.contactEmail
        : typeof record.email === "string"
          ? record.email
          : null,
    city: typeof record.city === "string" ? record.city : null,
    region: typeof record.region === "string" ? record.region : null,
    country: typeof record.country === "string" ? record.country : null
  };
};

const serializeTrackingEvent = (event: ShipmentRecord["trackingEvents"][number]) => ({
  id: event.id,
  eventType: event.eventType,
  statusLabel: event.statusLabel,
  occurredAt: event.occurredAt,
  location: event.location,
  payload: event.payload
});

const serializeShipmentDetail = (shipment: ShipmentRecord) => ({
  id: shipment.id,
  order: {
    id: shipment.order.id,
    orderNumber: shipment.order.orderNumber,
    status: shipment.order.status
  },
  warehouse: shipment.warehouse,
  status: shipment.status,
  trackingNumber: shipment.trackingNumber,
  carrier: shipment.carrier,
  createdAt: shipment.createdAt,
  updatedAt: shipment.updatedAt,
  recipient: readRecipient(shipment.order.addressSnapshot),
  trackingEvents: shipment.trackingEvents.map(serializeTrackingEvent)
});

const loadOrderOrThrow = async (orderId: string, db: DatabaseClient = prisma) => {
  const order = await db.order.findUnique({
    where: {
      id: orderId
    },
    include: {
      shipments: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!order) {
    throw notFoundError("The requested order was not found.");
  }

  return order;
};

const loadShipmentOrThrow = async (shipmentId: string, db: DatabaseClient = prisma) => {
  const shipment = await db.shipment.findUnique({
    where: {
      id: shipmentId
    },
    include: shipmentInclude
  });

  if (!shipment) {
    throw notFoundError("The requested shipment was not found.");
  }

  return shipment;
};

const updateOrderStatusRecord = async (
  db: DatabaseClient,
  input: {
    orderId: string;
    fromStatus: string;
    toStatus: string;
    actorAdminUserId: string | null;
    reason: string;
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
      actorAdminUserId: input.actorAdminUserId,
      reason: input.reason,
      metadata: toPrismaJsonValue(input.metadata)
    }
  });
};

type ShipmentMutationActor = { kind: "admin"; adminUserId: string } | { kind: "system" };

const recordShipmentMutation = async (
  db: Prisma.TransactionClient,
  input: {
    actor: ShipmentMutationActor;
    actionCode: string;
    shipmentId: string;
    orderId: string;
    reason?: string;
    note?: string;
    before?: unknown;
    after?: unknown;
    orderEventType: string;
    orderPayload: unknown;
  }
) => {
  const actorType = input.actor.kind === "admin" ? "ADMIN" : "SYSTEM";
  const actorAdminUserId = input.actor.kind === "admin" ? input.actor.adminUserId : null;

  const logs: Promise<unknown>[] = [
    db.auditLog.create({
      data: {
        actorType,
        actorAdminUserId,
        actionCode: input.actionCode,
        entityType: "SHIPMENT",
        entityId: input.shipmentId,
        reason: input.reason,
        note: input.note,
        metadata: toPrismaJsonValue({
          orderId: input.orderId,
          payload: input.orderPayload
        })
      }
    }),
    db.timelineEvent.create({
      data: {
        entityType: "ORDER",
        entityId: input.orderId,
        eventType: input.orderEventType,
        actorAdminUserId,
        actorType,
        payload: toPrismaJsonValue(input.orderPayload)
      }
    })
  ];

  if (input.actor.kind === "admin") {
    logs.push(
      db.adminActionLog.create({
        data: {
          adminUserId: input.actor.adminUserId,
          screen: "orders.fulfillment",
          actionCode: input.actionCode,
          reason: input.reason,
          note: input.note,
          entityType: "SHIPMENT",
          entityId: input.shipmentId,
          before: toPrismaJsonValue(input.before),
          after: toPrismaJsonValue(input.after)
        }
      })
    );
  }

  await Promise.all(logs);
};

const progressOrderForFulfillment = async (
  db: Prisma.TransactionClient,
  input: {
    orderId: string;
    currentStatus: string;
    actorAdminUserId: string | null;
    shipmentStatuses: ShipmentStatus[];
    metadata?: unknown;
  }
) => {
  let nextOrderStatus = input.currentStatus;

  if (nextOrderStatus === "CONFIRMED" && input.shipmentStatuses.length > 0) {
    await updateOrderStatusRecord(db, {
      orderId: input.orderId,
      fromStatus: nextOrderStatus,
      toStatus: "PROCESSING",
      actorAdminUserId: input.actorAdminUserId,
      reason: "fulfillment_started",
      metadata: input.metadata
    });
    nextOrderStatus = "PROCESSING";
  }

  if (
    nextOrderStatus === "PROCESSING" &&
    input.shipmentStatuses.length > 0 &&
    input.shipmentStatuses.every((status) => status === ShipmentStatus.DELIVERED)
  ) {
    await updateOrderStatusRecord(db, {
      orderId: input.orderId,
      fromStatus: nextOrderStatus,
      toStatus: "COMPLETED",
      actorAdminUserId: input.actorAdminUserId,
      reason: "fulfillment_delivered",
      metadata: input.metadata
    });
    nextOrderStatus = "COMPLETED";
  }

  return nextOrderStatus;
};

export const listPublicShippingMethods = () => ({
  items: buildShippingMethodOptions()
});

export const getAdminShipmentDetail = async (shipmentId: string) => {
  const shipment = await loadShipmentOrThrow(shipmentId);

  return {
    entity: serializeShipmentDetail(shipment)
  };
};

export const getAdminShipmentTracking = async (shipmentId: string) => {
  const shipment = await loadShipmentOrThrow(shipmentId);

  return {
    entity: {
      id: shipment.id,
      status: shipment.status,
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier
    },
    items: shipment.trackingEvents.map(serializeTrackingEvent)
  };
};

const createInitialShipmentInTransaction = async (
  transaction: Prisma.TransactionClient,
  input: {
    order: Awaited<ReturnType<typeof loadOrderOrThrow>>;
    warehouse: { id: string; code: string; name: string };
    carrier?: string | null;
    trackingNumber?: string | null;
    note?: string | null;
    progressOrderActorAdminId: string | null;
    shipmentRecordActor: ShipmentMutationActor;
  }
) => {
  const { order, warehouse } = input;

  if (
    input.trackingNumber &&
    order.shipments.some((shipment) => shipment.trackingNumber === input.trackingNumber)
  ) {
    throw invalidInputError("This tracking number is already attached to the order.");
  }

  const shipment = await transaction.shipment.create({
    data: {
      orderId: order.id,
      warehouseId: warehouse.id,
      status: ShipmentStatus.CREATED,
      carrier: input.carrier ?? undefined,
      trackingNumber: input.trackingNumber ?? undefined
    }
  });

  await transaction.shipmentTrackingEvent.create({
    data: {
      shipmentId: shipment.id,
      eventType: "SHIPMENT_CREATED",
      statusLabel: "Shipment created",
      occurredAt: new Date(),
      location: warehouse.name,
      payload: toPrismaJsonValue({
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        note: input.note
      })
    }
  });

  await progressOrderForFulfillment(transaction, {
    orderId: order.id,
    currentStatus: order.status,
    actorAdminUserId: input.progressOrderActorAdminId,
    shipmentStatuses: [...order.shipments.map((entry) => entry.status), ShipmentStatus.CREATED],
    metadata: {
      shipmentId: shipment.id
    }
  });

  await recordShipmentMutation(transaction, {
    actor: input.shipmentRecordActor,
    actionCode: "orders.shipments.create",
    shipmentId: shipment.id,
    orderId: order.id,
    note: input.note ?? undefined,
    after: {
      warehouseId: warehouse.id,
      status: ShipmentStatus.CREATED,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber
    },
    orderEventType: "SHIPMENT_CREATED",
    orderPayload: {
      shipmentId: shipment.id,
      warehouse: {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name
      },
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      note: input.note
    }
  });

  const createdShipment = await loadShipmentOrThrow(shipment.id, transaction);

  return {
    entity: serializeShipmentDetail(createdShipment)
  };
};

/**
 * When a warehouse is first assigned, create a single CREATED shipment (no carrier / tracking yet).
 * Idempotent if a non-cancelled shipment already exists. Does not throw — safe inside payment transactions.
 */
export const autoCreateInitialShipmentIfEligibleInTransaction = async (
  transaction: Prisma.TransactionClient,
  input: { orderId: string; warehouseId: string }
): Promise<{ created: boolean; shipmentId?: string; skipReason?: string }> => {
  try {
    const order = await loadOrderOrThrow(input.orderId, transaction);

    if (!fulfillableOrderStatuses.has(order.status)) {
      return {
        created: false,
        skipReason: "order_status"
      };
    }

    const hasActiveShipment = order.shipments.some(
      (shipment) => shipment.status !== ShipmentStatus.CANCELLED
    );

    if (hasActiveShipment) {
      return {
        created: false,
        skipReason: "shipment_exists"
      };
    }

    const warehouse = await transaction.warehouse.findUnique({
      where: {
        id: input.warehouseId
      }
    });

    if (!warehouse) {
      return {
        created: false,
        skipReason: "warehouse_missing"
      };
    }

    const result = await createInitialShipmentInTransaction(transaction, {
      order,
      warehouse,
      note: "auto_create_after_warehouse_assign",
      progressOrderActorAdminId: null,
      shipmentRecordActor: {
        kind: "system"
      }
    });

    logger.info(
      {
        orderId: input.orderId,
        shipmentId: result.entity.id
      },
      "Auto-created initial shipment after warehouse assignment."
    );

    return {
      created: true,
      shipmentId: result.entity.id
    };
  } catch (error) {
    logger.error(
      {
        orderId: input.orderId,
        error
      },
      "Auto shipment creation failed; order flow continues."
    );
    return {
      created: false,
      skipReason: "error"
    };
  }
};

export const createAdminShipment = async (input: {
  actorAdminUserId: string;
  orderId: string;
  warehouseId: string;
  carrier?: string;
  trackingNumber?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const [order, warehouse] = await Promise.all([
      loadOrderOrThrow(input.orderId, transaction),
      transaction.warehouse.findUnique({
        where: {
          id: input.warehouseId
        }
      })
    ]);

    if (!warehouse) {
      throw notFoundError("The requested warehouse was not found.");
    }

    if (!fulfillableOrderStatuses.has(order.status)) {
      throw invalidStateTransitionError(
        "Shipments can only be created for confirmed or processing orders.",
        {
          orderStatus: order.status
        }
      );
    }

    return createInitialShipmentInTransaction(transaction, {
      order,
      warehouse,
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      note: input.note,
      progressOrderActorAdminId: input.actorAdminUserId,
      shipmentRecordActor: {
        kind: "admin",
        adminUserId: input.actorAdminUserId
      }
    });
  });

export const createAdminShipmentTrackingEvent = async (input: {
  actorAdminUserId: string;
  shipmentId: string;
  eventType?: string;
  statusLabel: string;
  shipmentStatus?: ShipmentStatus;
  occurredAt?: string;
  location?: string;
  trackingNumber?: string;
  carrier?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const shipment = await loadShipmentOrThrow(input.shipmentId, transaction);
    const nextShipmentStatus = input.shipmentStatus ?? shipment.status;

    if (nextShipmentStatus !== shipment.status) {
      const allowedStatuses = shipmentStatusTransitions[shipment.status] ?? [];

      if (!allowedStatuses.includes(nextShipmentStatus)) {
        throw invalidStateTransitionError("The requested shipment status transition is not allowed.", {
          fromStatus: shipment.status,
          toStatus: nextShipmentStatus
        });
      }
    }

    await transaction.shipment.update({
      where: {
        id: shipment.id
      },
      data: {
        status: nextShipmentStatus,
        trackingNumber: input.trackingNumber ?? shipment.trackingNumber,
        carrier: input.carrier ?? shipment.carrier
      }
    });

    const trackingEvent = await transaction.shipmentTrackingEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: input.eventType,
        statusLabel: input.statusLabel,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        location: input.location,
        payload: toPrismaJsonValue({
          note: input.note,
          shipmentStatus: nextShipmentStatus,
          trackingNumber: input.trackingNumber ?? shipment.trackingNumber,
          carrier: input.carrier ?? shipment.carrier
        })
      }
    });

    const siblingShipments = await transaction.shipment.findMany({
      where: {
        orderId: shipment.order.id
      }
    });

    const nextShipmentStatuses = siblingShipments.map((entry) =>
      entry.id === shipment.id ? nextShipmentStatus : entry.status
    );

    await progressOrderForFulfillment(transaction, {
      orderId: shipment.order.id,
      currentStatus: shipment.order.status,
      actorAdminUserId: input.actorAdminUserId,
      shipmentStatuses: nextShipmentStatuses,
      metadata: {
        shipmentId: shipment.id,
        shipmentStatus: nextShipmentStatus,
        trackingEventId: trackingEvent.id
      }
    });

    if (inventoryFinalizationShipmentStates.has(nextShipmentStatus)) {
      await finalizeOrderInventoryForFulfillment(transaction, {
        orderId: shipment.order.id,
        reason: "shipment_progressed_to_fulfillment",
        actorAdminUserId: input.actorAdminUserId
      });
    }

    await recordShipmentMutation(transaction, {
      actor: {
        kind: "admin",
        adminUserId: input.actorAdminUserId
      },
      actionCode: "orders.shipments.track",
      shipmentId: shipment.id,
      orderId: shipment.order.id,
      note: input.note,
      before: {
        status: shipment.status,
        trackingNumber: shipment.trackingNumber,
        carrier: shipment.carrier
      },
      after: {
        status: nextShipmentStatus,
        trackingNumber: input.trackingNumber ?? shipment.trackingNumber,
        carrier: input.carrier ?? shipment.carrier
      },
      orderEventType: "SHIPMENT_TRACKING_UPDATED",
      orderPayload: {
        shipmentId: shipment.id,
        trackingEventId: trackingEvent.id,
        eventType: input.eventType,
        statusLabel: input.statusLabel,
        shipmentStatus: nextShipmentStatus,
        trackingNumber: input.trackingNumber ?? shipment.trackingNumber,
        carrier: input.carrier ?? shipment.carrier,
        location: input.location,
        occurredAt: trackingEvent.occurredAt
      }
    });

    const updatedShipment = await loadShipmentOrThrow(shipment.id, transaction);
    const latestTrackingEvent =
      updatedShipment.trackingEvents[updatedShipment.trackingEvents.length - 1] ?? null;

    return {
      entity: serializeShipmentDetail(updatedShipment),
      trackingEvent: latestTrackingEvent ? serializeTrackingEvent(latestTrackingEvent) : null
    };
  }).then(async (result) => {
    if (
      result.entity.status === ShipmentStatus.DISPATCHED ||
      result.entity.status === ShipmentStatus.DELIVERED
    ) {
      const recipientEmail = result.entity.recipient.email;

      if (recipientEmail) {
        try {
          await enqueueNotification({
            type:
              result.entity.status === ShipmentStatus.DELIVERED
                ? "SHIPMENT_DELIVERED"
                : "SHIPMENT_UPDATED",
            recipientEmail,
            recipientType: "EMAIL",
            payload: {
              orderId: result.entity.order.id,
              orderNumber: result.entity.order.orderNumber,
              shipmentId: result.entity.id,
              trackingNumber: result.entity.trackingNumber,
              carrier: result.entity.carrier,
              shipmentStatus: result.entity.status
            }
          });
        } catch (error) {
          logger.warn(
            {
              shipmentId: result.entity.id,
              error
            },
            "Failed to enqueue shipment notification."
          );
        }
      }
    }

    return result;
  });

export const updateAdminShipment = async (input: {
  actorAdminUserId: string;
  shipmentId: string;
  warehouseId?: string;
  shipmentStatus?: ShipmentStatus;
  trackingNumber?: string;
  carrier?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const shipment = await loadShipmentOrThrow(input.shipmentId, transaction);
    const nextShipmentStatus = input.shipmentStatus ?? shipment.status;

    if (nextShipmentStatus !== shipment.status) {
      const allowedStatuses = shipmentStatusTransitions[shipment.status] ?? [];

      if (!allowedStatuses.includes(nextShipmentStatus)) {
        throw invalidStateTransitionError("The requested shipment status transition is not allowed.", {
          fromStatus: shipment.status,
          toStatus: nextShipmentStatus
        });
      }
    }

    let nextWarehouse = shipment.warehouse;

    if (input.warehouseId && input.warehouseId !== shipment.warehouse.id) {
      const warehouse = await transaction.warehouse.findUnique({
        where: {
          id: input.warehouseId
        },
        select: {
          id: true,
          code: true,
          name: true
        }
      });

      if (!warehouse) {
        throw notFoundError("The requested warehouse was not found.");
      }

      nextWarehouse = warehouse;
    }

    if (
      input.trackingNumber &&
      input.trackingNumber !== shipment.trackingNumber &&
      (await transaction.shipment.count({
        where: {
          orderId: shipment.order.id,
          trackingNumber: input.trackingNumber
        }
      })) > 0
    ) {
      throw invalidInputError("This tracking number is already attached to the order.");
    }

    await transaction.shipment.update({
      where: {
        id: shipment.id
      },
      data: {
        warehouseId: nextWarehouse.id,
        status: nextShipmentStatus,
        trackingNumber: input.trackingNumber ?? shipment.trackingNumber,
        carrier: input.carrier ?? shipment.carrier
      }
    });

    const siblingShipments = await transaction.shipment.findMany({
      where: {
        orderId: shipment.order.id
      }
    });

    const nextShipmentStatuses = siblingShipments.map((entry) =>
      entry.id === shipment.id ? nextShipmentStatus : entry.status
    );

    await progressOrderForFulfillment(transaction, {
      orderId: shipment.order.id,
      currentStatus: shipment.order.status,
      actorAdminUserId: input.actorAdminUserId,
      shipmentStatuses: nextShipmentStatuses,
      metadata: {
        shipmentId: shipment.id,
        shipmentStatus: nextShipmentStatus
      }
    });

    if (inventoryFinalizationShipmentStates.has(nextShipmentStatus)) {
      await finalizeOrderInventoryForFulfillment(transaction, {
        orderId: shipment.order.id,
        reason: "shipment_updated_to_fulfillment",
        actorAdminUserId: input.actorAdminUserId
      });
    }

    await recordShipmentMutation(transaction, {
      actor: {
        kind: "admin",
        adminUserId: input.actorAdminUserId
      },
      actionCode: "orders.shipments.update",
      shipmentId: shipment.id,
      orderId: shipment.order.id,
      note: input.note,
      before: {
        warehouse: shipment.warehouse,
        status: shipment.status,
        trackingNumber: shipment.trackingNumber,
        carrier: shipment.carrier
      },
      after: {
        warehouse: nextWarehouse,
        status: nextShipmentStatus,
        trackingNumber: input.trackingNumber ?? shipment.trackingNumber,
        carrier: input.carrier ?? shipment.carrier
      },
      orderEventType: "SHIPMENT_UPDATED",
      orderPayload: {
        shipmentId: shipment.id,
        warehouse: nextWarehouse,
        shipmentStatus: nextShipmentStatus,
        trackingNumber: input.trackingNumber ?? shipment.trackingNumber,
        carrier: input.carrier ?? shipment.carrier,
        note: input.note
      }
    });

    const updatedShipment = await loadShipmentOrThrow(shipment.id, transaction);

    return {
      entity: serializeShipmentDetail(updatedShipment)
    };
  }).then(async (result) => {
    if (
      result.entity.status === ShipmentStatus.DISPATCHED ||
      result.entity.status === ShipmentStatus.DELIVERED
    ) {
      const recipientEmail = result.entity.recipient.email;

      if (recipientEmail) {
        try {
          await enqueueNotification({
            type:
              result.entity.status === ShipmentStatus.DELIVERED
                ? "SHIPMENT_DELIVERED"
                : "SHIPMENT_UPDATED",
            recipientEmail,
            recipientType: "EMAIL",
            payload: {
              orderId: result.entity.order.id,
              orderNumber: result.entity.order.orderNumber,
              shipmentId: result.entity.id,
              trackingNumber: result.entity.trackingNumber,
              carrier: result.entity.carrier,
              shipmentStatus: result.entity.status
            }
          });
        } catch (error) {
          logger.warn(
            {
              shipmentId: result.entity.id,
              error
            },
            "Failed to enqueue shipment notification."
          );
        }
      }
    }

    return result;
  });
