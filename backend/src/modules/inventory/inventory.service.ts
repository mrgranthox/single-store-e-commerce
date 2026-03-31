import {
  InventoryMovementType,
  Prisma,
  ShipmentStatus
} from "@prisma/client";

import {
  conflictError,
  invalidInputError,
  invalidStateTransitionError,
  notFoundError
} from "../../common/errors/app-error";
import {
  buildPaginationPayload,
  paginateItems,
  type PaginationInput
} from "../../common/http/pagination";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { prisma } from "../../config/prisma";

type InventoryQueueInput = PaginationInput & {
  q?: string;
  warehouseId?: string;
  sortBy: "updatedAt" | "available" | "sku" | "productTitle";
  sortOrder: "asc" | "desc";
};

type InventoryStockQueryInput = InventoryQueueInput & {
  minAvailable?: number;
  maxAvailable?: number;
};

type InventoryStocksListInput = InventoryStockQueryInput & {
  healthFilter: "all" | "healthy" | "low_stock" | "out_of_stock";
};

type InventoryMovementListInput = PaginationInput & {
  sku?: string;
  warehouseId?: string;
  productId?: string;
  actorAdminUserId?: string;
  movementType?: InventoryMovementType;
  dateFrom?: string;
  dateTo?: string;
  sortOrder: "asc" | "desc";
};

const DEFAULT_LOW_STOCK_SETTING_KEY = "inventory.low_stock.default_reorder_level";

const inventoryStockInclude = {
  warehouse: true,
  variant: {
    include: {
      product: {
        include: {
          media: {
            where: {
              kind: "IMAGE"
            },
            orderBy: {
              sortOrder: "asc" as const
            },
            take: 1
          }
        }
      }
    }
  },
  movements: {
    orderBy: {
      createdAt: "desc" as const
    },
    take: 1
  }
} satisfies Prisma.InventoryStockInclude;

const inventoryMovementInclude = {
  inventoryStock: {
    include: {
      warehouse: true,
      variant: {
        include: {
          product: true
        }
      }
    }
  }
} satisfies Prisma.InventoryMovementInclude;

type InventoryStockRecord = Prisma.InventoryStockGetPayload<{
  include: typeof inventoryStockInclude;
}>;

type InventoryMovementRecord = Prisma.InventoryMovementGetPayload<{
  include: typeof inventoryMovementInclude;
}>;

const buildDateRangeFilter = (dateFrom?: string, dateTo?: string) => {
  if (!dateFrom && !dateTo) {
    return undefined;
  }

  return {
    gte: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined,
    lte: dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined
  };
};

const extractNumericSetting = (value: Prisma.JsonValue) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const candidate = record.defaultReorderLevel ?? record.value;

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.max(0, Math.trunc(candidate));
    }
  }

  return 0;
};

const getDefaultLowStockThreshold = async (
  transaction: Prisma.TransactionClient | typeof prisma = prisma
) => {
  const setting = await transaction.systemSetting.findUnique({
    where: {
      key: DEFAULT_LOW_STOCK_SETTING_KEY
    }
  });

  if (!setting) {
    return 0;
  }

  return extractNumericSetting(setting.value);
};

const formatWarehouseLocationLine = (metadata: Prisma.JsonValue | null | undefined): string | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const root = metadata as Record<string, unknown>;
  const addr = root.address;

  if (addr && typeof addr === "object" && !Array.isArray(addr)) {
    const a = addr as Record<string, unknown>;
    const city = typeof a.city === "string" ? a.city.trim() : "";
    const country = typeof a.country === "string" ? a.country.trim() : "";
    const line1 =
      typeof a.line1 === "string"
        ? a.line1.trim()
        : typeof a.line === "string"
          ? a.line.trim()
          : "";

    if (line1 && city) {
      return `${line1}, ${city}${country ? `, ${country}` : ""}`;
    }

    if (city && country) {
      return `${city}, ${country}`;
    }

    if (city) {
      return city;
    }

    if (country) {
      return country;
    }

    if (line1) {
      return line1;
    }
  }

  return null;
};

const deriveStockMetrics = (stock: Pick<InventoryStockRecord, "onHand" | "reserved" | "reorderLevel">, defaultThreshold: number) => {
  const available = stock.onHand - stock.reserved;
  const effectiveReorderLevel = stock.reorderLevel > 0 ? stock.reorderLevel : defaultThreshold;

  return {
    available,
    effectiveReorderLevel,
    lowStock: available > 0 && available <= effectiveReorderLevel,
    outOfStock: available <= 0
  };
};

const serializeMovementSummary = (movement: InventoryStockRecord["movements"][number] | null | undefined) =>
  movement
    ? {
        id: movement.id,
        movementType: movement.movementType,
        deltaOnHand: movement.deltaOnHand,
        deltaReserved: movement.deltaReserved,
        createdAt: movement.createdAt,
        reason: movement.reason
      }
    : null;

const serializeInventoryStock = (stock: InventoryStockRecord, defaultThreshold: number) => {
  const metrics = deriveStockMetrics(stock, defaultThreshold);
  const thumb = stock.variant.product.media?.[0]?.url ?? null;

  return {
    id: stock.id,
    status: stock.status,
    variant: {
      id: stock.variant.id,
      sku: stock.variant.sku,
      status: stock.variant.status,
      costAmountCents: stock.variant.costAmountCents,
      priceAmountCents: stock.variant.priceAmountCents,
      product: {
        id: stock.variant.product.id,
        slug: stock.variant.product.slug,
        title: stock.variant.product.title,
        status: stock.variant.product.status,
        thumbnailUrl: thumb
      }
    },
    warehouse: {
      id: stock.warehouse.id,
      code: stock.warehouse.code,
      name: stock.warehouse.name
    },
    stock: {
      onHand: stock.onHand,
      reserved: stock.reserved,
      available: metrics.available,
      configuredReorderLevel: stock.reorderLevel,
      effectiveReorderLevel: metrics.effectiveReorderLevel
    },
    health: {
      lowStock: metrics.lowStock,
      outOfStock: metrics.outOfStock
    },
    lastMovement: serializeMovementSummary(stock.movements[0]),
    updatedAt: stock.updatedAt
  };
};

const serializeInventoryMovement = (movement: InventoryMovementRecord) => ({
  id: movement.id,
  movementType: movement.movementType,
  deltaOnHand: movement.deltaOnHand,
  deltaReserved: movement.deltaReserved,
  resultingOnHand: movement.resultingOnHand,
  resultingReserved: movement.resultingReserved,
  reason: movement.reason,
  actorAdminUserId: movement.actorAdminUserId,
  reservationId: movement.reservationId,
  orderId: movement.orderId,
  paymentId: movement.paymentId,
  returnId: movement.returnId,
  createdAt: movement.createdAt,
  warehouse: {
    id: movement.inventoryStock.warehouse.id,
    code: movement.inventoryStock.warehouse.code,
    name: movement.inventoryStock.warehouse.name
  },
  variant: {
    id: movement.inventoryStock.variant.id,
    sku: movement.inventoryStock.variant.sku,
    product: {
      id: movement.inventoryStock.variant.product.id,
      slug: movement.inventoryStock.variant.product.slug,
      title: movement.inventoryStock.variant.product.title
    }
  }
});

const compareValues = (
  left: string | number | Date,
  right: string | number | Date,
  sortOrder: "asc" | "desc"
) => {
  const leftValue = left instanceof Date ? left.getTime() : typeof left === "string" ? left.toLowerCase() : left;
  const rightValue =
    right instanceof Date ? right.getTime() : typeof right === "string" ? right.toLowerCase() : right;

  if (leftValue < rightValue) {
    return sortOrder === "asc" ? -1 : 1;
  }

  if (leftValue > rightValue) {
    return sortOrder === "asc" ? 1 : -1;
  }

  return 0;
};

const recordInventoryMutation = async (
  transaction: Prisma.TransactionClient,
  input: {
    actorAdminUserId: string;
    actionCode: string;
    entityType: string;
    entityId: string;
    reason?: string;
    note?: string;
    before?: unknown;
    after?: unknown;
    eventType: string;
    metadata?: unknown;
  }
) => {
  await Promise.all([
    transaction.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason,
        note: input.note,
        before: toPrismaJsonValue(input.before),
        after: toPrismaJsonValue(input.after)
      }
    }),
    transaction.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorAdminUserId: input.actorAdminUserId,
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason,
        note: input.note,
        metadata: toPrismaJsonValue(input.metadata ?? { eventType: input.eventType })
      }
    }),
    transaction.timelineEvent.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.eventType,
        actorAdminUserId: input.actorAdminUserId,
        actorType: "ADMIN",
        payload: toPrismaJsonValue({
          reason: input.reason,
          note: input.note,
          metadata: input.metadata
        })
      }
    })
  ]);
};

const SNAPSHOT_MIN_INTERVAL_MS = 60 * 60 * 1000;

const pctDelta = (current: number, prior: number): number | null => {
  if (prior === 0) {
    return current === 0 ? 0 : null;
  }

  return Math.round(((current - prior) / prior) * 1000) / 10;
};

const computeInTransitMerchandiseValueCents = async (warehouseId?: string): Promise<number> => {
  const inFlightStatuses: ShipmentStatus[] = [ShipmentStatus.IN_TRANSIT, ShipmentStatus.DISPATCHED];
  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: ["CONFIRMED", "PROCESSING"]
      },
      shipments: {
        some: {
          status: {
            in: inFlightStatuses
          },
          ...(warehouseId
            ? {
                warehouseId
              }
            : {})
        }
      }
    },
    select: {
      items: {
        select: {
          quantity: true,
          unitPriceAmountCents: true
        }
      }
    }
  });

  let total = 0;

  for (const order of orders) {
    for (const item of order.items) {
      total += item.quantity * item.unitPriceAmountCents;
    }
  }

  return total;
};

const countOpenOrdersTouchingOosVariants = async (warehouseId?: string): Promise<number> => {
  if (warehouseId) {
    const rows = await prisma.$queryRaw<[{ count: bigint }]>`
      WITH oos AS (
        SELECT DISTINCT s."variantId"
        FROM "InventoryStock" s
        WHERE (s."onHand" - s."reserved") <= 0
        AND s."warehouseId" = ${warehouseId}::uuid
      )
      SELECT COUNT(DISTINCT oi."orderId")::bigint AS count
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o.id = oi."orderId"
      WHERE o.status IN ('CONFIRMED','PROCESSING')
      AND oi."variantId" IN (SELECT "variantId" FROM oos)
    `;
    return Number(rows[0]?.count ?? 0);
  }

  const rows = await prisma.$queryRaw<[{ count: bigint }]>`
    WITH oos AS (
      SELECT DISTINCT s."variantId"
      FROM "InventoryStock" s
      WHERE (s."onHand" - s."reserved") <= 0
    )
    SELECT COUNT(DISTINCT oi."orderId")::bigint AS count
    FROM "OrderItem" oi
    INNER JOIN "Order" o ON o.id = oi."orderId"
    WHERE o.status IN ('CONFIRMED','PROCESSING')
    AND oi."variantId" IN (SELECT "variantId" FROM oos)
  `;
  return Number(rows[0]?.count ?? 0);
};

const countDistinctOpenOrdersByVariantIds = async (variantIds: string[]): Promise<Map<string, number>> => {
  const map = new Map<string, number>();

  if (variantIds.length === 0) {
    return map;
  }

  const rows = await prisma.$queryRaw<Array<{ variantId: string; cnt: bigint }>>(
    Prisma.sql`
      SELECT oi."variantId", COUNT(DISTINCT oi."orderId")::bigint AS cnt
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON oi."orderId" = o.id
      WHERE o.status IN ('CONFIRMED','PROCESSING')
      AND oi."variantId" IN (${Prisma.join(variantIds)})
      GROUP BY oi."variantId"
    `
  );

  for (const row of rows) {
    map.set(row.variantId, Number(row.cnt));
  }

  return map;
};

const enrichStockRowsWithOpenOrderCounts = async (
  rows: ReturnType<typeof serializeInventoryStock>[]
): Promise<Array<ReturnType<typeof serializeInventoryStock> & { ordersAffectedCount: number }>> => {
  const variantIds = [...new Set(rows.map((row) => row.variant.id))];

  if (variantIds.length === 0) {
    return rows.map((row) => ({ ...row, ordersAffectedCount: 0 }));
  }

  const counts = await countDistinctOpenOrdersByVariantIds(variantIds);

  return rows.map((row) => ({
    ...row,
    ordersAffectedCount: counts.get(row.variant.id) ?? 0
  }));
};

type OverviewCore = {
  totals: {
    onHand: number;
    reserved: number;
    available: number;
  };
  lowStockCount: number;
  outOfStockCount: number;
  healthyStockCount: number;
  trackedLineCount: number;
};

const maybeRecordOverviewSnapshot = async (
  core: OverviewCore,
  inTransitMerchandiseValueCents: number
): Promise<void> => {
  const latest = await prisma.inventoryOverviewSnapshot.findFirst({
    orderBy: {
      capturedAt: "desc"
    }
  });
  const now = Date.now();

  if (latest && now - latest.capturedAt.getTime() < SNAPSHOT_MIN_INTERVAL_MS) {
    return;
  }

  await prisma.inventoryOverviewSnapshot.create({
    data: {
      trackedLineCount: core.trackedLineCount,
      healthyStockCount: core.healthyStockCount,
      lowStockCount: core.lowStockCount,
      outOfStockCount: core.outOfStockCount,
      inTransitValueCents: inTransitMerchandiseValueCents
    }
  });
};

const resolveKpiDeltaSincePriorSnapshot = async (
  live: OverviewCore & { inTransitMerchandiseValueCents: number }
) => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const prior = await prisma.inventoryOverviewSnapshot.findFirst({
    where: {
      capturedAt: {
        lte: cutoff
      }
    },
    orderBy: {
      capturedAt: "desc"
    }
  });

  if (!prior) {
    return null;
  }

  return {
    baselineCapturedAt: prior.capturedAt.toISOString(),
    trackedLineCountPct: pctDelta(live.trackedLineCount, prior.trackedLineCount),
    healthyStockCountPct: pctDelta(live.healthyStockCount, prior.healthyStockCount),
    lowStockCountPct: pctDelta(live.lowStockCount, prior.lowStockCount),
    outOfStockCountPct: pctDelta(live.outOfStockCount, prior.outOfStockCount),
    inTransitMerchandiseValueCentsPct: pctDelta(live.inTransitMerchandiseValueCents, prior.inTransitValueCents)
  };
};

const mapPrismaWriteError = (error: unknown, entityName: string) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw conflictError(`A ${entityName} with the same unique field already exists.`, error.meta);
    }

    if (error.code === "P2025") {
      throw notFoundError(`The requested ${entityName} was not found.`);
    }
  }

  throw error;
};

export const getInventoryOverview = async () => {
  const defaultThreshold = await getDefaultLowStockThreshold();
  const stocks = await prisma.inventoryStock.findMany({
    select: {
      onHand: true,
      reserved: true,
      reorderLevel: true
    }
  });

  const overview = stocks.reduce(
    (summary, stock) => {
      const metrics = deriveStockMetrics(stock, defaultThreshold);
      const healthy = !metrics.lowStock && !metrics.outOfStock;

      return {
        totals: {
          onHand: summary.totals.onHand + stock.onHand,
          reserved: summary.totals.reserved + stock.reserved,
          available: summary.totals.available + metrics.available
        },
        lowStockCount: summary.lowStockCount + (metrics.lowStock ? 1 : 0),
        outOfStockCount: summary.outOfStockCount + (metrics.outOfStock ? 1 : 0),
        healthyStockCount: summary.healthyStockCount + (healthy ? 1 : 0)
      };
    },
    {
      totals: {
        onHand: 0,
        reserved: 0,
        available: 0
      },
      lowStockCount: 0,
      outOfStockCount: 0,
      healthyStockCount: 0
    }
  );

  const core: OverviewCore = {
    ...overview,
    trackedLineCount: stocks.length
  };
  const inTransitMerchandiseValueCents = await computeInTransitMerchandiseValueCents();
  const kpiDeltaSincePrior = await resolveKpiDeltaSincePriorSnapshot({
    ...core,
    inTransitMerchandiseValueCents
  });

  await maybeRecordOverviewSnapshot(core, inTransitMerchandiseValueCents);

  return {
    ...core,
    inTransitMerchandiseValueCents,
    kpiDeltaSincePrior
  };
};

const matchesHealthFilter = (
  item: ReturnType<typeof serializeInventoryStock>,
  filter: InventoryStocksListInput["healthFilter"]
) => {
  if (filter === "all") {
    return true;
  }

  if (filter === "healthy") {
    return !item.health.lowStock && !item.health.outOfStock;
  }

  if (filter === "low_stock") {
    return item.health.lowStock;
  }

  return item.health.outOfStock;
};

const listInventoryStocksByHealth = async (
  input: InventoryStockQueryInput,
  predicate: (item: ReturnType<typeof serializeInventoryStock>) => boolean
) => {
  const defaultThreshold = await getDefaultLowStockThreshold();
  const stocks = await prisma.inventoryStock.findMany({
    include: inventoryStockInclude
  });

  const items = stocks
    .map((stock) => serializeInventoryStock(stock, defaultThreshold))
    .filter((item) => {
      if (input.warehouseId && item.warehouse.id !== input.warehouseId) {
        return false;
      }

      if (input.minAvailable !== undefined && item.stock.available < input.minAvailable) {
        return false;
      }

      if (input.maxAvailable !== undefined && item.stock.available > input.maxAvailable) {
        return false;
      }

      if (!input.q) {
        return true;
      }

      const normalizedQuery = input.q.toLowerCase();
      return (
        item.variant.sku.toLowerCase().includes(normalizedQuery) ||
        item.variant.product.title.toLowerCase().includes(normalizedQuery) ||
        item.warehouse.code.toLowerCase().includes(normalizedQuery) ||
        item.warehouse.name.toLowerCase().includes(normalizedQuery)
      );
    })
    .filter(predicate)
    .sort((left, right) => {
      if (input.sortBy === "available") {
        return compareValues(left.stock.available, right.stock.available, input.sortOrder);
      }

      if (input.sortBy === "sku") {
        return compareValues(left.variant.sku, right.variant.sku, input.sortOrder);
      }

      if (input.sortBy === "productTitle") {
        return compareValues(left.variant.product.title, right.variant.product.title, input.sortOrder);
      }

      return compareValues(left.updatedAt, right.updatedAt, input.sortOrder);
    });

  return {
    items: paginateItems(items, input),
    pagination: buildPaginationPayload(input, items.length)
  };
};

export const listInventoryStocks = async (input: InventoryStocksListInput) => {
  const data = await listInventoryStocksByHealth(input, (item) => matchesHealthFilter(item, input.healthFilter));
  const items = await enrichStockRowsWithOpenOrderCounts(data.items);

  return {
    items,
    pagination: data.pagination
  };
};

export const listLowStockInventory = async (input: InventoryQueueInput) => {
  const data = await listInventoryStocksByHealth(input, (item) => item.health.lowStock);
  const items = await enrichStockRowsWithOpenOrderCounts(data.items);
  const inTransitMerchandiseValueCents = await computeInTransitMerchandiseValueCents(input.warehouseId);

  return {
    items,
    pagination: data.pagination,
    queueMeta: {
      inTransitMerchandiseValueCents
    }
  };
};

export const listOutOfStockInventory = async (input: InventoryQueueInput) => {
  const data = await listInventoryStocksByHealth(input, (item) => item.health.outOfStock);
  const items = await enrichStockRowsWithOpenOrderCounts(data.items);
  const [inTransitMerchandiseValueCents, openOrdersDistinctForOosVariants] = await Promise.all([
    computeInTransitMerchandiseValueCents(input.warehouseId),
    countOpenOrdersTouchingOosVariants(input.warehouseId)
  ]);

  return {
    items,
    pagination: data.pagination,
    queueMeta: {
      inTransitMerchandiseValueCents,
      openOrdersDistinctForOosVariants
    }
  };
};

export const listInventoryMovements = async (input: InventoryMovementListInput) => {
  const where: Prisma.InventoryMovementWhereInput = {
    ...(input.actorAdminUserId ? { actorAdminUserId: input.actorAdminUserId } : {}),
    ...(input.movementType ? { movementType: input.movementType } : {}),
    ...(input.productId
      ? {
          inventoryStock: {
            variant: {
              productId: input.productId
            }
          }
        }
      : {}),
    ...(buildDateRangeFilter(input.dateFrom, input.dateTo)
      ? {
          createdAt: buildDateRangeFilter(input.dateFrom, input.dateTo)
        }
      : {})
  };

  const movements = await prisma.inventoryMovement.findMany({
    where,
    include: inventoryMovementInclude,
    orderBy: {
      createdAt: input.sortOrder
    }
  });

  const items = movements
    .filter((movement) => {
      if (input.warehouseId && movement.inventoryStock.warehouse.id !== input.warehouseId) {
        return false;
      }

      if (input.sku) {
        return movement.inventoryStock.variant.sku.toLowerCase().includes(input.sku.toLowerCase());
      }

      return true;
    })
    .map(serializeInventoryMovement);

  return {
    items: paginateItems(items, input),
    pagination: buildPaginationPayload(input, items.length)
  };
};

export const createInventoryAdjustments = async (input: {
  actorAdminUserId: string;
  reason: string;
  note?: string;
  confirmationReason?: string;
  items: Array<{
    variantId: string;
    warehouseId: string;
    deltaOnHand: number;
  }>;
}) => {
  const duplicateKey = input.items
    .map((item) => `${item.variantId}:${item.warehouseId}`)
    .find((compositeKey, index, collection) => collection.indexOf(compositeKey) !== index);

  if (duplicateKey) {
    throw invalidInputError("Duplicate variantId and warehouseId pairs are not allowed in one adjustment request.");
  }

  try {
    return await runInTransaction(async (transaction) => {
      const defaultThreshold = await getDefaultLowStockThreshold(transaction);
      const results: Array<{
        inventoryStockId: string;
        movementId: string;
        warehouseId: string;
        variantId: string;
        deltaOnHand: number;
        onHand: number;
        reserved: number;
        available: number;
        lowStock: boolean;
        outOfStock: boolean;
      }> = [];

      for (const item of input.items) {
        const existingStock = await transaction.inventoryStock.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: item.warehouseId
            }
          }
        });

        if (!existingStock) {
          const [variant, warehouse] = await Promise.all([
            transaction.productVariant.findUnique({
              where: {
                id: item.variantId
              }
            }),
            transaction.warehouse.findUnique({
              where: {
                id: item.warehouseId
              }
            })
          ]);

          if (!variant) {
            throw invalidInputError("One or more variant ids are invalid.");
          }

          if (!warehouse) {
            throw invalidInputError("One or more warehouse ids are invalid.");
          }

          if (item.deltaOnHand < 0) {
            throw invalidStateTransitionError(
              "Cannot reduce inventory for a variant and warehouse pair that has no stock row yet."
            );
          }
        }

        const previousOnHand = existingStock?.onHand ?? 0;
        const previousReserved = existingStock?.reserved ?? 0;
        const previousReorderLevel = existingStock?.reorderLevel ?? 0;
        const resultingOnHand = previousOnHand + item.deltaOnHand;

        if (resultingOnHand < 0) {
          throw invalidStateTransitionError("Inventory adjustments cannot reduce on-hand stock below zero.");
        }

        if (resultingOnHand < previousReserved) {
          throw invalidStateTransitionError(
            "Inventory adjustments cannot reduce on-hand stock below the currently reserved quantity."
          );
        }

        const stock = existingStock
          ? await transaction.inventoryStock.update({
              where: {
                id: existingStock.id
              },
              data: {
                onHand: resultingOnHand
              }
            })
          : await transaction.inventoryStock.create({
              data: {
                variantId: item.variantId,
                warehouseId: item.warehouseId,
                onHand: resultingOnHand,
                reorderLevel: defaultThreshold
              }
            });

        const movement = await transaction.inventoryMovement.create({
          data: {
            inventoryStockId: stock.id,
            movementType:
              item.deltaOnHand > 0
                ? InventoryMovementType.MANUAL_ADJUSTMENT_INCREASE
                : InventoryMovementType.MANUAL_ADJUSTMENT_DECREASE,
            deltaOnHand: item.deltaOnHand,
            deltaReserved: 0,
            resultingOnHand,
            resultingReserved: previousReserved,
            reason: input.reason,
            actorAdminUserId: input.actorAdminUserId
          }
        });

        await recordInventoryMutation(transaction, {
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "inventory.adjust",
          entityType: "INVENTORY_STOCK",
          entityId: stock.id,
          reason: input.reason,
          note: input.note,
          before: {
            variantId: item.variantId,
            warehouseId: item.warehouseId,
            onHand: previousOnHand,
            reserved: previousReserved,
            reorderLevel: previousReorderLevel
          },
          after: {
            variantId: item.variantId,
            warehouseId: item.warehouseId,
            onHand: resultingOnHand,
            reserved: previousReserved,
            reorderLevel: stock.reorderLevel
          },
          eventType: "INVENTORY_ADJUSTED",
          metadata: {
            movementId: movement.id,
            confirmationReason: input.confirmationReason
          }
        });

        const metrics = deriveStockMetrics(stock, defaultThreshold);

        results.push({
          inventoryStockId: stock.id,
          movementId: movement.id,
          warehouseId: item.warehouseId,
          variantId: item.variantId,
          deltaOnHand: item.deltaOnHand,
          onHand: resultingOnHand,
          reserved: previousReserved,
          available: metrics.available,
          lowStock: metrics.lowStock,
          outOfStock: metrics.outOfStock
        });
      }

      return results;
    });
  } catch (error) {
    mapPrismaWriteError(error, "inventory stock");
  }
};

export const listWarehouses = async () => {
  const defaultThreshold = await getDefaultLowStockThreshold();
  const warehouses = await prisma.warehouse.findMany({
    include: {
      inventoryStocks: true,
      _count: {
        select: {
          inventoryStocks: true,
          shipments: true
        }
      }
    },
    orderBy: {
      name: "asc"
    }
  });

  return warehouses.map((warehouse) => {
    const totals = warehouse.inventoryStocks.reduce(
      (summary, stock) => ({
        onHand: summary.onHand + stock.onHand,
        reserved: summary.reserved + stock.reserved,
        available: summary.available + (stock.onHand - stock.reserved)
      }),
      {
        onHand: 0,
        reserved: 0,
        available: 0
      }
    );

    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const stock of warehouse.inventoryStocks) {
      const metrics = deriveStockMetrics(stock, defaultThreshold);
      if (metrics.outOfStock) {
        outOfStockCount += 1;
      } else if (metrics.lowStock) {
        lowStockCount += 1;
      }
    }

    return {
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      operationalStatus: warehouse.operationalStatus,
      metadata: warehouse.metadata,
      locationLabel: formatWarehouseLocationLine(warehouse.metadata) ?? null,
      inventoryItemCount: warehouse._count.inventoryStocks,
      shipmentCount: warehouse._count.shipments,
      lowStockCount,
      outOfStockCount,
      totals,
      updatedAt: warehouse.updatedAt
    };
  });
};

export const getWarehouseDetail = async (warehouseId: string) => {
  const defaultThreshold = await getDefaultLowStockThreshold();
  const warehouse = await prisma.warehouse.findUnique({
    where: {
      id: warehouseId
    },
    include: {
      inventoryStocks: {
        include: inventoryStockInclude
      },
      shipments: {
        orderBy: {
          updatedAt: "desc"
        },
        take: 10
      },
      _count: {
        select: {
          inventoryStocks: true,
          shipments: true
        }
      }
    }
  });

  if (!warehouse) {
    throw notFoundError("The requested warehouse was not found.");
  }

  const stockItems = warehouse.inventoryStocks.map((stock) => serializeInventoryStock(stock, defaultThreshold));
  const summary = stockItems.reduce(
    (accumulator, item) => ({
      inventoryItemCount: accumulator.inventoryItemCount + 1,
      shipmentCount: warehouse._count.shipments,
      totals: {
        onHand: accumulator.totals.onHand + item.stock.onHand,
        reserved: accumulator.totals.reserved + item.stock.reserved,
        available: accumulator.totals.available + item.stock.available
      },
      lowStockCount: accumulator.lowStockCount + (item.health.lowStock ? 1 : 0),
      outOfStockCount: accumulator.outOfStockCount + (item.health.outOfStock ? 1 : 0)
    }),
    {
      inventoryItemCount: 0,
      shipmentCount: warehouse._count.shipments,
      totals: {
        onHand: 0,
        reserved: 0,
        available: 0
      },
      lowStockCount: 0,
      outOfStockCount: 0
    }
  );

  const stockHealthItems = await enrichStockRowsWithOpenOrderCounts(
    stockItems.sort((left, right) => compareValues(left.stock.available, right.stock.available, "asc"))
  );

  const recentMovements = await prisma.inventoryMovement.findMany({
    include: inventoryMovementInclude,
    orderBy: {
      createdAt: "desc"
    }
  });

  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    operationalStatus: warehouse.operationalStatus,
    metadata: warehouse.metadata,
    locationLabel: formatWarehouseLocationLine(warehouse.metadata),
    createdAt: warehouse.createdAt,
    updatedAt: warehouse.updatedAt,
    summary,
    stockHealth: {
      items: stockHealthItems
    },
    recentMovements: recentMovements
      .filter((movement) => movement.inventoryStock.warehouse.id === warehouse.id)
      .slice(0, 20)
      .map(serializeInventoryMovement),
    linkedShipments: warehouse.shipments.map((shipment) => ({
      id: shipment.id,
      orderId: shipment.orderId,
      status: shipment.status,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt
    }))
  };
};

export const createWarehouse = async (input: {
  actorAdminUserId: string;
  code: string;
  name: string;
  metadata?: Prisma.InputJsonValue;
  operationalStatus?: string;
}) => {
  try {
    return await runInTransaction(async (transaction) => {
      const warehouse = await transaction.warehouse.create({
        data: {
          code: input.code,
          name: input.name,
          ...(input.metadata !== undefined ? { metadata: toPrismaJsonValue(input.metadata) } : {}),
          ...(input.operationalStatus ? { operationalStatus: input.operationalStatus } : {})
        }
      });

      await recordInventoryMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "inventory.warehouses.create",
        entityType: "WAREHOUSE",
        entityId: warehouse.id,
        after: {
          code: warehouse.code,
          name: warehouse.name
        },
        eventType: "WAREHOUSE_CREATED"
      });

      return {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "warehouse");
  }
};

export const updateWarehouse = async (input: {
  actorAdminUserId: string;
  warehouseId: string;
  code?: string;
  name?: string;
  metadata?: Prisma.InputJsonValue | null;
  operationalStatus?: string;
}) => {
  try {
    return await runInTransaction(async (transaction) => {
      const existingWarehouse = await transaction.warehouse.findUnique({
        where: {
          id: input.warehouseId
        }
      });

      if (!existingWarehouse) {
        throw notFoundError("The requested warehouse was not found.");
      }

      const warehouse = await transaction.warehouse.update({
        where: {
          id: input.warehouseId
        },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.metadata !== undefined
            ? {
                metadata:
                  input.metadata === null
                    ? Prisma.JsonNull
                    : (toPrismaJsonValue(input.metadata) as Prisma.InputJsonValue)
              }
            : {}),
          ...(input.operationalStatus !== undefined ? { operationalStatus: input.operationalStatus } : {})
        }
      });

      await recordInventoryMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "inventory.warehouses.update",
        entityType: "WAREHOUSE",
        entityId: input.warehouseId,
        before: {
          code: existingWarehouse.code,
          name: existingWarehouse.name
        },
        after: {
          code: input.code ?? existingWarehouse.code,
          name: input.name ?? existingWarehouse.name
        },
        eventType: "WAREHOUSE_UPDATED"
      });

      return {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name
      };
    });
  } catch (error) {
    mapPrismaWriteError(error, "warehouse");
  }
};
