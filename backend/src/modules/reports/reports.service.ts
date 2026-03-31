import {
  InventoryMovementType,
  PaymentState,
  Prisma,
  RefundState,
  ReviewStatus,
  ReturnStatus,
  ShipmentStatus,
  TicketPriority,
  TicketStatus
} from "@prisma/client";

import { prisma } from "../../config/prisma";

const buildDateRangeWhere = (input: { from?: Date; to?: Date }) =>
  input.from || input.to
    ? {
        gte: input.from,
        lte: input.to
      }
    : undefined;

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const readCheckoutTotalsFromSnapshot = (
  json: Prisma.JsonValue | null | undefined
): { discountCents: number; subtotalCents: number } | null => {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return null;
  }
  const record = json as Record<string, unknown>;
  if (typeof record.discountCents !== "number" || typeof record.subtotalCents !== "number") {
    return null;
  }
  return {
    discountCents: Math.max(0, Math.trunc(record.discountCents)),
    subtotalCents: Math.max(0, Math.trunc(record.subtotalCents))
  };
};

const isRevenuePaymentState = (paymentState: PaymentState) =>
  paymentState === PaymentState.PAID ||
  paymentState === PaymentState.PARTIALLY_REFUNDED ||
  paymentState === PaymentState.REFUNDED;

export const getDashboardReport = async (input: { from?: Date; to?: Date }) => {
  const createdAt = buildDateRangeWhere(input);

  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);

  const [
    orderCount,
    ordersTodayCount,
    paidPaymentsByState,
    refundsCompletedAggregate,
    openSupportCount,
    pendingReviews,
    activeReturns,
    lowStockItems,
    openAlerts,
    totalCustomers
  ] = await Promise.all([
    prisma.order.count({
      where: createdAt ? { createdAt } : undefined
    }),
    prisma.order.count({
      where: { createdAt: { gte: startOfUtcDay } }
    }),
    prisma.payment.groupBy({
      by: ["paymentState"],
      where: {
        paymentState: {
          in: [PaymentState.PAID, PaymentState.PARTIALLY_REFUNDED, PaymentState.REFUNDED]
        },
        ...(createdAt ? { createdAt } : {})
      },
      _count: {
        _all: true
      },
      _sum: {
        amountCents: true
      }
    }),
    prisma.refund.aggregate({
      where: {
        state: RefundState.COMPLETED,
        ...(createdAt ? { updatedAt: createdAt } : {})
      },
      _sum: {
        amountCents: true
      }
    }),
    prisma.supportTicket.count({
      where: {
        status: {
          in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_CUSTOMER]
        },
        ...(createdAt ? { createdAt } : {})
      }
    }),
    prisma.review.count({
      where: {
        status: ReviewStatus.PENDING,
        ...(createdAt ? { createdAt } : {})
      }
    }),
    prisma.return.count({
      where: {
        status: {
          in: [ReturnStatus.REQUESTED, ReturnStatus.APPROVED, ReturnStatus.RECEIVED]
        },
        ...(createdAt ? { requestedAt: createdAt } : {})
      }
    }),
    prisma.inventoryStock.findMany({
      where: {
        reorderLevel: {
          gt: 0
        }
      },
      select: {
        onHand: true,
        reorderLevel: true
      }
    }),
    prisma.alert.count({
      where: {
        status: {
          in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED"]
        },
        ...(createdAt ? { createdAt } : {})
      }
    }),
    prisma.user.count({
      where: createdAt ? { createdAt } : undefined
    })
  ]);

  const grossRevenueCents = sum(paidPaymentsByState.map((item) => Number(item._sum.amountCents ?? 0)));
  const completedRefundsCents = Number(refundsCompletedAggregate._sum.amountCents ?? 0);
  const netRevenueCents = grossRevenueCents - completedRefundsCents;
  const lowStockCount = lowStockItems.filter((item) => item.onHand <= item.reorderLevel).length;
  const paymentCountByState = new Map(
    paidPaymentsByState.map((item) => [item.paymentState, item._count._all])
  );

  return {
    range: {
      from: input.from ?? null,
      to: input.to ?? null
    },
    kpis: {
      orderCount,
      ordersTodayCount,
      grossRevenueCents,
      completedRefundsCents,
      netRevenueCents,
      totalCustomers,
      openSupportCount,
      pendingReviews,
      activeReturns,
      lowStockCount,
      openAlerts
    },
    payments: {
      paidCount: paymentCountByState.get(PaymentState.PAID) ?? 0,
      refundedCount: paymentCountByState.get(PaymentState.REFUNDED) ?? 0,
      partiallyRefundedCount: paymentCountByState.get(PaymentState.PARTIALLY_REFUNDED) ?? 0
    }
  };
};

const expandSeriesToDateRange = (
  from: Date,
  to: Date,
  paymentByDay: Map<string, { orderCount: number; revenueCents: number }>,
  refundCentsByDay: Map<string, number>
) => {
  const out: Array<{
    date: string;
    orderCount: number;
    revenueCents: number;
    refundsCents: number;
    netRevenueCents: number;
  }> = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() <= end.getTime()) {
    const key = toIsoDate(cursor);
    const row = paymentByDay.get(key) ?? { orderCount: 0, revenueCents: 0 };
    const refundsCents = refundCentsByDay.get(key) ?? 0;
    out.push({
      date: key,
      orderCount: row.orderCount,
      revenueCents: row.revenueCents,
      refundsCents,
      netRevenueCents: row.revenueCents - refundsCents
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
};

export const getSalesReport = async (input: { from?: Date; to?: Date }) => {
  const createdAt = buildDateRangeWhere(input);

  const [
    orderCountPeriod,
    revenuePayments,
    completedRefundsInRange,
    orderItemsDetailed,
    ordersForDiscountSnapshots
  ] = await Promise.all([
    prisma.order.count({
      where: createdAt ? { createdAt } : undefined
    }),
    prisma.payment.findMany({
      where: {
        paymentState: {
          in: [PaymentState.PAID, PaymentState.PARTIALLY_REFUNDED, PaymentState.REFUNDED]
        },
        ...(createdAt ? { createdAt } : {})
      },
      select: {
        createdAt: true,
        amountCents: true,
        orderId: true,
        provider: true
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    prisma.refund.findMany({
      where: {
        state: RefundState.COMPLETED,
        ...(createdAt ? { updatedAt: createdAt } : {})
      },
      select: {
        amountCents: true,
        updatedAt: true
      }
    }),
    prisma.orderItem.findMany({
      where: createdAt ? { order: { createdAt } } : undefined,
      include: {
        order: { select: { id: true } },
        variant: {
          include: {
            product: {
              include: {
                categories: { include: { category: true } }
              }
            }
          }
        }
      }
    }),
    prisma.order.findMany({
      where: createdAt ? { createdAt } : undefined,
      select: {
        checkoutSession: {
          select: {
            checkoutValidationSnapshots: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { normalizedTotals: true }
            }
          }
        }
      }
    })
  ]);

  const refundCentsByDay = new Map<string, number>();
  for (const refund of completedRefundsInRange) {
    const key = toIsoDate(refund.updatedAt);
    refundCentsByDay.set(key, (refundCentsByDay.get(key) ?? 0) + refund.amountCents);
  }
  const completedRefundsCents = sum(completedRefundsInRange.map((r) => r.amountCents));

  const seriesMap = new Map<string, { orderCount: number; revenueCents: number; orderIds: Set<string> }>();

  for (const payment of revenuePayments) {
    const key = toIsoDate(payment.createdAt);
    const entry = seriesMap.get(key) ?? { orderCount: 0, revenueCents: 0, orderIds: new Set<string>() };
    entry.revenueCents += payment.amountCents;
    entry.orderIds.add(payment.orderId);
    seriesMap.set(key, entry);
  }

  for (const [key, entry] of seriesMap) {
    entry.orderCount = entry.orderIds.size;
    seriesMap.set(key, entry);
  }

  const revenueCentsTotal = sum(revenuePayments.map((p) => p.amountCents));
  const netRevenueCents = revenueCentsTotal - completedRefundsCents;

  const paymentSparse = [...seriesMap.entries()]
    .map(([date, value]) => ({
      date,
      orderCount: value.orderCount,
      revenueCents: value.revenueCents
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const paymentByDayMap = new Map(
    paymentSparse.map((row) => [row.date, { orderCount: row.orderCount, revenueCents: row.revenueCents }])
  );

  const allSparseDates = new Set<string>([...paymentByDayMap.keys(), ...refundCentsByDay.keys()]);
  const sparseSeries = [...allSparseDates]
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const row = paymentByDayMap.get(date) ?? { orderCount: 0, revenueCents: 0 };
      const refundsCents = refundCentsByDay.get(date) ?? 0;
      return {
        date,
        orderCount: row.orderCount,
        revenueCents: row.revenueCents,
        refundsCents,
        netRevenueCents: row.revenueCents - refundsCents
      };
    });

  const series =
    input.from && input.to
      ? expandSeriesToDateRange(input.from, input.to, paymentByDayMap, refundCentsByDay)
      : sparseSeries;

  let discountCentsFromCheckout = 0;
  let subtotalCentsFromCheckout = 0;
  for (const order of ordersForDiscountSnapshots) {
    const snap = order.checkoutSession?.checkoutValidationSnapshots[0]?.normalizedTotals;
    const totals = readCheckoutTotalsFromSnapshot(snap);
    if (totals) {
      discountCentsFromCheckout += totals.discountCents;
      subtotalCentsFromCheckout += totals.subtotalCents;
    }
  }

  const discountImpactPctOfSubtotal =
    subtotalCentsFromCheckout > 0
      ? Math.round((discountCentsFromCheckout / subtotalCentsFromCheckout) * 1000) / 10
      : null;
  const discountImpactPctOfGross =
    revenueCentsTotal > 0
      ? Math.round((discountCentsFromCheckout / revenueCentsTotal) * 1000) / 10
      : null;

  const categoryRollup = new Map<string, { revenueCents: number; orderIds: Set<string> }>();
  const productRollup = new Map<
    string,
    { productId: string; slug: string; title: string; quantitySold: number; revenueCents: number }
  >();

  for (const item of orderItemsDetailed) {
    const lineCents = item.quantity * item.unitPriceAmountCents;
    const categoryName = item.variant.product.categories[0]?.category.name ?? "Uncategorized";
    const cat = categoryRollup.get(categoryName) ?? { revenueCents: 0, orderIds: new Set<string>() };
    cat.revenueCents += lineCents;
    cat.orderIds.add(item.order.id);
    categoryRollup.set(categoryName, cat);

    const key = item.variant.productId;
    const row =
      productRollup.get(key) ?? {
        productId: item.variant.productId,
        slug: item.variant.product.slug,
        title: item.variant.product.title,
        quantitySold: 0,
        revenueCents: 0
      };
    row.quantitySold += item.quantity;
    row.revenueCents += lineCents;
    productRollup.set(key, row);
  }

  const totalCategoryRevenue = sum([...categoryRollup.values()].map((v) => v.revenueCents));
  const revenueByCategory = [...categoryRollup.entries()]
    .map(([categoryName, v]) => ({
      categoryName,
      revenueCents: v.revenueCents,
      orderCount: v.orderIds.size,
      pctOfTotal:
        totalCategoryRevenue > 0
          ? Math.round((v.revenueCents / totalCategoryRevenue) * 1000) / 10
          : 0,
      averageOrderValueCents:
        v.orderIds.size > 0 ? Math.round(v.revenueCents / v.orderIds.size) : 0
    }))
    .sort((left, right) => right.revenueCents - left.revenueCents);

  const paymentRollup = new Map<string, { revenueCents: number; paymentCount: number }>();
  for (const payment of revenuePayments) {
    const label = payment.provider?.trim() ? payment.provider.trim() : "Other";
    const row = paymentRollup.get(label) ?? { revenueCents: 0, paymentCount: 0 };
    row.revenueCents += payment.amountCents;
    row.paymentCount += 1;
    paymentRollup.set(label, row);
  }
  const paymentMethodMix = [...paymentRollup.entries()]
    .map(([provider, v]) => ({
      provider,
      revenueCents: v.revenueCents,
      paymentCount: v.paymentCount,
      pctOfTotal:
        revenueCentsTotal > 0
          ? Math.round((v.revenueCents / revenueCentsTotal) * 1000) / 10
          : 0
    }))
    .sort((left, right) => right.revenueCents - left.revenueCents);

  const topProductsByRevenue = [...productRollup.values()]
    .sort((left, right) => right.revenueCents - left.revenueCents)
    .slice(0, 10)
    .map((row, index) => ({
      rank: index + 1,
      productId: row.productId,
      slug: row.slug,
      title: row.title,
      quantitySold: row.quantitySold,
      revenueCents: row.revenueCents,
      pctOfTotal:
        revenueCentsTotal > 0
          ? Math.round((row.revenueCents / revenueCentsTotal) * 1000) / 10
          : 0
    }));

  return {
    summary: {
      orderCount: orderCountPeriod,
      revenueCents: revenueCentsTotal,
      completedRefundsCents,
      netRevenueCents,
      averageOrderValueCents:
        orderCountPeriod > 0 ? Math.round(revenueCentsTotal / orderCountPeriod) : 0,
      averageNetOrderValueCents:
        orderCountPeriod > 0 ? Math.round(netRevenueCents / orderCountPeriod) : 0,
      discountCentsFromCheckout,
      subtotalCentsFromCheckout,
      discountImpactPctOfSubtotal,
      discountImpactPctOfGross
    },
    series,
    revenueByCategory,
    paymentMethodMix,
    topProductsByRevenue
  };
};

export const getProductPerformanceReport = async (input: { from?: Date; to?: Date }) => {
  const createdAt = buildDateRangeWhere(input);
  const orderItems = await prisma.orderItem.findMany({
    where: createdAt
      ? {
          order: {
            createdAt
          }
        }
      : undefined,
    include: {
      variant: {
        include: {
          product: {
            include: {
              categories: { include: { category: true } }
            }
          }
        }
      }
    }
  });

  const performance = new Map<
    string,
    {
      productId: string;
      slug: string;
      title: string;
      quantitySold: number;
      revenueCents: number;
    }
  >();

  const categoryRevenue = new Map<string, number>();
  const variantSalesInPeriod = new Map<string, { quantitySold: number; revenueCents: number }>();
  for (const item of orderItems) {
    const vKey = item.variantId;
    const vRow = variantSalesInPeriod.get(vKey) ?? { quantitySold: 0, revenueCents: 0 };
    vRow.quantitySold += item.quantity;
    vRow.revenueCents += item.quantity * item.unitPriceAmountCents;
    variantSalesInPeriod.set(vKey, vRow);

    const key = item.variant.productId;
    const entry = performance.get(key) ?? {
      productId: item.variant.productId,
      slug: item.variant.product.slug,
      title: item.variant.product.title,
      quantitySold: 0,
      revenueCents: 0
    };
    entry.quantitySold += item.quantity;
    entry.revenueCents += item.quantity * item.unitPriceAmountCents;
    performance.set(key, entry);

    const lineCents = item.quantity * item.unitPriceAmountCents;
    const catName = item.variant.product.categories[0]?.category.name ?? "Uncategorized";
    categoryRevenue.set(catName, (categoryRevenue.get(catName) ?? 0) + lineCents);
  }

  const totalCategoryRevenue = sum([...categoryRevenue.values()]);
  const categoryPerformance = [...categoryRevenue.entries()]
    .map(([categoryName, revenueCents]) => ({
      categoryName,
      revenueCents,
      pctOfTotal:
        totalCategoryRevenue > 0
          ? Math.round((revenueCents / totalCategoryRevenue) * 1000) / 10
          : 0
    }))
    .sort((left, right) => right.revenueCents - left.revenueCents);

  const [
    returnItemsInRange,
    refundItemsInRange,
    inventorySnapshots,
    inventoryMovements,
    manualAdjustments
  ] = await Promise.all([
    prisma.returnItem.findMany({
      where: { return: createdAt ? { requestedAt: createdAt } : undefined },
      include: { variant: { include: { product: true } } }
    }),
    prisma.refundItem.findMany({
      where: {
        refund: {
          state: RefundState.COMPLETED,
          ...(createdAt ? { updatedAt: createdAt } : {})
        }
      },
      include: {
        orderItem: { include: { variant: { include: { product: true } } } }
      }
    }),
    prisma.inventoryOverviewSnapshot.findMany({
      where: input.from || input.to ? { capturedAt: buildDateRangeWhere(input) } : undefined,
      orderBy: { capturedAt: "asc" },
      take: 120
    }),
    prisma.inventoryMovement.findMany({
      where: createdAt ? { createdAt } : undefined,
      select: { movementType: true, deltaOnHand: true }
    }),
    prisma.inventoryMovement.findMany({
      where: {
        movementType: {
          in: [
            InventoryMovementType.MANUAL_ADJUSTMENT_INCREASE,
            InventoryMovementType.MANUAL_ADJUSTMENT_DECREASE
          ]
        },
        ...(createdAt ? { createdAt } : {})
      },
      include: {
        inventoryStock: {
          include: {
            variant: { include: { product: true } },
            warehouse: { select: { id: true, name: true } }
          }
        }
      },
      take: 5000
    })
  ]);

  const returnQtyByProduct = new Map<string, number>();
  for (const ri of returnItemsInRange) {
    const pid = ri.variant.productId;
    returnQtyByProduct.set(pid, (returnQtyByProduct.get(pid) ?? 0) + ri.quantity);
  }
  const refundCentsByProduct = new Map<string, number>();
  for (const fi of refundItemsInRange) {
    const pid = fi.orderItem.variant.productId;
    refundCentsByProduct.set(pid, (refundCentsByProduct.get(pid) ?? 0) + fi.amountCents);
  }

  const movementBreakdown = (Object.values(InventoryMovementType) as InventoryMovementType[]).map(
    (movementType) => {
      const rows = inventoryMovements.filter((m) => m.movementType === movementType);
      return {
        movementType,
        eventCount: rows.length,
        unitsDeltaAbs: sum(rows.map((m) => Math.abs(m.deltaOnHand)))
      };
    }
  );

  const inventoryInStockTrend = inventorySnapshots.map((snap) => ({
    date: snap.capturedAt.toISOString().slice(0, 10),
    trackedLineCount: snap.trackedLineCount,
    outOfStockCount: snap.outOfStockCount,
    inStockPct:
      snap.trackedLineCount > 0
        ? Math.round(((snap.trackedLineCount - snap.outOfStockCount) / snap.trackedLineCount) * 1000) /
          10
        : 0
  }));

  const adjustAgg = new Map<
    string,
    { sku: string; productTitle: string; warehouseName: string; adjustmentCount: number }
  >();
  for (const mov of manualAdjustments) {
    const sku = mov.inventoryStock.variant.sku;
    const row =
      adjustAgg.get(sku) ?? {
        sku,
        productTitle: mov.inventoryStock.variant.product.title,
        warehouseName: mov.inventoryStock.warehouse?.name ?? "—",
        adjustmentCount: 0
      };
    row.adjustmentCount += 1;
    adjustAgg.set(sku, row);
  }
  const mostAdjustedSkus = [...adjustAgg.values()]
    .sort((left, right) => right.adjustmentCount - left.adjustmentCount)
    .slice(0, 10);

  const lowStock = await prisma.inventoryStock.findMany({
    where: {
      reorderLevel: {
        gt: 0
      }
    },
    include: {
      variant: {
        include: {
          product: true
        }
      },
      warehouse: true
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  const [allWarehouseStocks, deliveredShipments] = await Promise.all([
    prisma.inventoryStock.findMany({
      include: {
        warehouse: { select: { id: true, name: true } }
      }
    }),
    prisma.shipment.findMany({
      where: { status: ShipmentStatus.DELIVERED },
      take: 500,
      orderBy: { updatedAt: "desc" },
      select: {
        updatedAt: true,
        order: { select: { createdAt: true } }
      }
    })
  ]);

  const whRoll = new Map<
    string,
    { warehouseName: string; totalSkus: number; skusInStock: number; lowStockCount: number }
  >();
  for (const row of allWarehouseStocks) {
    const name = row.warehouse?.name ?? "All locations";
    const acc = whRoll.get(name) ?? {
      warehouseName: name,
      totalSkus: 0,
      skusInStock: 0,
      lowStockCount: 0
    };
    acc.totalSkus += 1;
    if (row.onHand > 0) acc.skusInStock += 1;
    if (row.reorderLevel != null && row.reorderLevel > 0 && row.onHand <= row.reorderLevel) {
      acc.lowStockCount += 1;
    }
    whRoll.set(name, acc);
  }

  const warehouseHealth = [...whRoll.values()].map((w) => ({
    warehouseName: w.warehouseName,
    totalSkus: w.totalSkus,
    inStockPct: w.totalSkus ? Math.round((w.skusInStock / w.totalSkus) * 100) : 0,
    lowStockCount: w.lowStockCount
  }));

  const fulfillHours = deliveredShipments
    .map((s) => (s.updatedAt.getTime() - s.order.createdAt.getTime()) / 3_600_000)
    .filter((h) => h >= 0 && h < 24 * 45);
  const avgFulfillmentHours =
    fulfillHours.length > 0
      ? Number((fulfillHours.reduce((a, b) => a + b, 0) / fulfillHours.length).toFixed(1))
      : null;

  const totalUnitsSold = sum([...performance.values()].map((p) => p.quantitySold));
  const totalCatalogRevenue = sum([...performance.values()].map((p) => p.revenueCents));
  const outOfStockLineCount = allWarehouseStocks.filter((row) => row.onHand === 0).length;
  const estimatedStockoutRevenueRiskCents =
    totalUnitsSold > 0 && totalCatalogRevenue > 0
      ? Math.round(outOfStockLineCount * (totalCatalogRevenue / totalUnitsSold))
      : 0;

  const rangeDayCount =
    input.from && input.to
      ? Math.max(1, Math.round((input.to.getTime() - input.from.getTime()) / 86_400_000) + 1)
      : 1;
  const oosVariantIds = new Set(
    allWarehouseStocks.filter((row) => row.onHand === 0).map((row) => row.variantId)
  );
  let revenueFromCurrentlyOosVariantsCents = 0;
  let oosSkuDailyRunRateRevenueCents = 0;
  for (const variantId of oosVariantIds) {
    const v = variantSalesInPeriod.get(variantId);
    if (v) {
      revenueFromCurrentlyOosVariantsCents += v.revenueCents;
      oosSkuDailyRunRateRevenueCents += Math.round(v.revenueCents / rangeDayCount);
    }
  }

  const topProducts = [...performance.values()]
    .sort((left, right) => right.revenueCents - left.revenueCents)
    .slice(0, 10)
    .map((p) => {
      const returned = returnQtyByProduct.get(p.productId) ?? 0;
      const refunded = refundCentsByProduct.get(p.productId) ?? 0;
      return {
        ...p,
        returnRatePct:
          p.quantitySold > 0 ? Math.round((returned / p.quantitySold) * 1000) / 10 : 0,
        refundRatePct:
          p.revenueCents > 0 ? Math.round((refunded / p.revenueCents) * 1000) / 10 : 0
      };
    });

  const highReturnProducts = [...performance.values()]
    .map((p) => {
      const returned = returnQtyByProduct.get(p.productId) ?? 0;
      return {
        productId: p.productId,
        title: p.title,
        quantitySold: p.quantitySold,
        returnedQuantity: returned,
        returnRatePct:
          p.quantitySold > 0 ? Math.round((returned / p.quantitySold) * 1000) / 10 : 0
      };
    })
    .filter((p) => p.returnedQuantity > 0)
    .sort((left, right) => right.returnRatePct - left.returnRatePct)
    .slice(0, 10);

  return {
    topProducts,
    categoryPerformance,
    highReturnProducts,
    inventoryInStockTrend,
    movementBreakdown,
    mostAdjustedSkus,
    stockoutMetrics: {
      outOfStockLineCount,
      estimatedStockoutRevenueRiskCents,
      revenueFromCurrentlyOosVariantsCents,
      oosSkuDailyRunRateRevenueCents
    },
    lowStock: lowStock
      .filter((item) => item.reorderLevel != null && item.onHand <= item.reorderLevel)
      .slice(0, 10)
      .map((item) => ({
        inventoryStockId: item.id,
        productId: item.variant.product.id,
        productTitle: item.variant.product.title,
        variantId: item.variant.id,
        sku: item.variant.sku,
        warehouse: item.warehouse,
        onHand: item.onHand,
        reserved: item.reserved,
        reorderLevel: item.reorderLevel
      })),
    warehouseHealth,
    fulfillment: {
      avgHoursToDeliver: avgFulfillmentHours
    }
  };
};

export const getCustomerReport = async (input: { from?: Date; to?: Date }) => {
  const createdAt = buildDateRangeWhere(input);

  const ordersInRange = await prisma.order.findMany({
    where: createdAt ? { createdAt } : undefined,
    include: {
      user: true,
      payments: true
    }
  });

  const spendByUser = new Map<
    string,
    {
      user: NonNullable<(typeof ordersInRange)[number]["user"]>;
      orderCount: number;
      spendCents: number;
    }
  >();

  for (const order of ordersInRange) {
    if (!order.userId || !order.user) {
      continue;
    }
    const pay = sum(
      order.payments
        .filter((payment) => isRevenuePaymentState(payment.paymentState))
        .map((payment) => payment.amountCents)
    );
    const row = spendByUser.get(order.userId) ?? {
      user: order.user,
      orderCount: 0,
      spendCents: 0
    };
    row.orderCount += 1;
    row.spendCents += pay;
    spendByUser.set(order.userId, row);
  }

  const buyerIds = [...spendByUser.keys()];

  const [ticketCounts, reviewCounts, newSignupsInRange, signupDays, orderDays, cohortUsers, geoRows] =
    await Promise.all([
      buyerIds.length
        ? prisma.supportTicket.groupBy({
            by: ["userId"],
            where: { userId: { in: buyerIds } },
            _count: { id: true }
          })
        : Promise.resolve([]),
      buyerIds.length
        ? prisma.review.groupBy({
            by: ["userId"],
            where: { userId: { in: buyerIds } },
            _count: { id: true }
          })
        : Promise.resolve([]),
      prisma.user.count({
        where: createdAt ? { createdAt } : undefined
      }),
      prisma.user.findMany({
        where: createdAt ? { createdAt } : undefined,
        select: { createdAt: true }
      }),
      prisma.order.findMany({
        where: createdAt ? { createdAt } : undefined,
        select: { createdAt: true }
      }),
      prisma.user.findMany({
        where: {
          createdAt: createdAt ?? {
            gte: new Date(Date.now() - 120 * 86_400_000)
          }
        },
        select: {
          id: true,
          createdAt: true,
          orders: {
            select: { createdAt: true },
            orderBy: { createdAt: "asc" },
            take: 3
          }
        },
        take: 2500,
        orderBy: { createdAt: "desc" }
      }),
      buyerIds.length
        ? prisma.userAddress.findMany({
            where: { userId: { in: buyerIds }, isDefaultShipping: true },
            select: { country: true }
          })
        : Promise.resolve([])
    ]);

  const ticketMap = new Map(
    ticketCounts.map((row) => [row.userId as string, row._count.id])
  );
  const reviewMap = new Map(reviewCounts.map((row) => [row.userId, row._count.id]));

  const topCustomers = [...spendByUser.values()]
    .sort((left, right) => right.spendCents - left.spendCents)
    .slice(0, 10)
    .map((row) => ({
      id: row.user.id,
      email: row.user.email,
      name: [row.user.firstName, row.user.lastName].filter(Boolean).join(" ") || null,
      orderCount: row.orderCount,
      spendCents: row.spendCents,
      supportTicketCount: ticketMap.get(row.user.id) ?? 0,
      reviewCount: reviewMap.get(row.user.id) ?? 0
    }));

  const fromMs = input.from?.getTime() ?? null;
  const returningBuyersInRange =
    fromMs != null
      ? [...spendByUser.values()].filter((row) => row.user.createdAt.getTime() < fromMs).length
      : null;

  const signupByDay = new Map<string, number>();
  for (const row of signupDays) {
    const key = toIsoDate(row.createdAt);
    signupByDay.set(key, (signupByDay.get(key) ?? 0) + 1);
  }
  const ordersByDay = new Map<string, number>();
  for (const row of orderDays) {
    const key = toIsoDate(row.createdAt);
    ordersByDay.set(key, (ordersByDay.get(key) ?? 0) + 1);
  }
  const growthDays = new Set<string>([...signupByDay.keys(), ...ordersByDay.keys()]);
  const growthSeries = [...growthDays]
    .sort((left, right) => left.localeCompare(right))
    .map((date) => ({
      date,
      newSignups: signupByDay.get(date) ?? 0,
      ordersPlaced: ordersByDay.get(date) ?? 0
    }));

  const cohortBuckets = new Map<string, { joined: number; repeat30: number }>();
  const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 86_400_000);
  for (const u of cohortUsers) {
    const monthKey = `${u.createdAt.getUTCFullYear()}-${String(u.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = cohortBuckets.get(monthKey) ?? { joined: 0, repeat30: 0 };
    bucket.joined += 1;
    const windowEnd = addDays(u.createdAt, 30);
    const repeat = u.orders.some((o) => o.createdAt.getTime() <= windowEnd.getTime());
    if (repeat) {
      bucket.repeat30 += 1;
    }
    cohortBuckets.set(monthKey, bucket);
  }
  const cohortRepeatPurchase = [...cohortBuckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([cohortMonth, v]) => ({
      cohortMonth,
      customersJoined: v.joined,
      orderedAgainWithin30dPct: v.joined > 0 ? Math.round((v.repeat30 / v.joined) * 1000) / 10 : 0
    }));

  const spendValues = [...spendByUser.values()].map((v) => v.spendCents);
  const ltvBuckets = [
    { label: "$0 – $49.99", min: 0, max: 5000 },
    { label: "$50 – $149.99", min: 5000, max: 15000 },
    { label: "$150 – $499.99", min: 15000, max: 50000 },
    { label: "$500+", min: 50000, max: Number.MAX_SAFE_INTEGER }
  ].map((bucket) => ({
    label: bucket.label,
    customerCount: spendValues.filter((cents) => cents >= bucket.min && cents < bucket.max).length
  }));

  const geoMap = new Map<string, number>();
  for (const row of geoRows) {
    const c = row.country?.trim() || "Unknown";
    geoMap.set(c, (geoMap.get(c) ?? 0) + 1);
  }
  const geographicDistribution = [...geoMap.entries()]
    .map(([country, customerCount]) => ({ country, customerCount }))
    .sort((left, right) => right.customerCount - left.customerCount)
    .slice(0, 12);

  const avgLtvCents =
    spendValues.length > 0 ? Math.round(sum(spendValues) / spendValues.length) : 0;

  return {
    summary: {
      totalBuyersInRange: spendByUser.size,
      newSignupsInRange,
      returningBuyersInRange,
      totalOrdersInRange: ordersInRange.length,
      suspendedAmongBuyers: [...spendByUser.values()].filter((row) => row.user.status === "SUSPENDED")
        .length,
      avgLtvCentsAmongBuyers: avgLtvCents
    },
    topCustomers,
    growthSeries,
    cohortRepeatPurchase,
    ltvBuckets,
    geographicDistribution
  };
};

const SLA_RESPONSE_HOURS: Record<TicketPriority, number> = {
  URGENT: 1,
  HIGH: 4,
  MEDIUM: 24,
  LOW: 72
};

const classifyComplaintCategory = (subject: string | null) => {
  const t = (subject ?? "").toLowerCase();
  if (/(damag|broken|defect|cracked)/.test(t)) return "Damaged Item" as const;
  if (/(late|delay|slow ship|not arrive|missing package|lost package)/.test(t)) return "Late Delivery" as const;
  if (/(wrong item|incorrect|not what|different item)/.test(t)) return "Wrong Item" as const;
  if (/(refund|chargeback|money back)/.test(t)) return "Refund Issue" as const;
  return null;
};

export const getSupportReport = async (input: { from?: Date; to?: Date }) => {
  const createdAt = buildDateRangeWhere(input);
  const csatRangeWhere = buildDateRangeWhere(input);
  const [tickets, csatTickets] = await Promise.all([
    prisma.supportTicket.findMany({
      where: createdAt ? { createdAt } : undefined,
      include: {
        messages: true
      }
    }),
    prisma.supportTicket.findMany({
      where: {
        csatScore: {
          not: null
        },
        ...(csatRangeWhere
          ? {
              OR: [
                {
                  csatSubmittedAt: csatRangeWhere
                },
                {
                  AND: [{ csatSubmittedAt: null }, { updatedAt: csatRangeWhere }]
                }
              ]
            }
          : {})
      },
      select: {
        csatScore: true
      }
    })
  ]);

  const complaintTemplate = ["Damaged Item", "Late Delivery", "Wrong Item", "Refund Issue", "Other"] as const;
  const complaintCounts: Record<(typeof complaintTemplate)[number], number> = {
    "Damaged Item": 0,
    "Late Delivery": 0,
    "Wrong Item": 0,
    "Refund Issue": 0,
    Other: 0
  };
  for (const ticket of tickets) {
    const cat = classifyComplaintCategory(ticket.subject);
    if (cat && cat in complaintCounts) {
      complaintCounts[cat] += 1;
    } else {
      complaintCounts.Other += 1;
    }
  }

  const hasAdminReply = (ticket: (typeof tickets)[number]) =>
    ticket.messages.some((message) => message.authorType === "ADMIN");

  let stitchNew = 0;
  let stitchOpen = 0;
  let stitchPending = 0;
  let stitchOnHold = 0;
  let stitchResolved = 0;
  for (const ticket of tickets) {
    if (ticket.status === TicketStatus.CLOSED) {
      stitchResolved += 1;
      continue;
    }
    if (ticket.status === TicketStatus.PENDING_CUSTOMER) {
      stitchPending += 1;
      continue;
    }
    if (ticket.status === TicketStatus.IN_PROGRESS) {
      stitchOpen += 1;
      continue;
    }
    if (ticket.status === TicketStatus.OPEN) {
      if (hasAdminReply(ticket)) {
        stitchOpen += 1;
      } else {
        stitchNew += 1;
      }
    }
  }

  const firstResponseMinutesSamples: number[] = [];
  for (const ticket of tickets) {
    const adminFirst = ticket.messages
      .filter((message) => message.authorType === "ADMIN")
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0];
    if (adminFirst) {
      firstResponseMinutesSamples.push(
        (adminFirst.createdAt.getTime() - ticket.createdAt.getTime()) / 60_000
      );
    }
  }
  const avgFirstResponseMinutes =
    firstResponseMinutesSamples.length > 0
      ? Math.round(
          firstResponseMinutesSamples.reduce((total, value) => total + value, 0) /
            firstResponseMinutesSamples.length
        )
      : null;

  const slaAtRiskTickets = tickets
    .filter((ticket) => ticket.status !== TicketStatus.CLOSED)
    .map((ticket) => {
      const hours = SLA_RESPONSE_HOURS[ticket.priority];
      const deadline = new Date(ticket.createdAt.getTime() + hours * 3_600_000);
      return {
        id: ticket.id,
        subject: ticket.subject ?? "(No subject)",
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
        slaDeadlineIso: deadline.toISOString()
      };
    })
    .sort((left, right) => new Date(left.slaDeadlineIso).getTime() - new Date(right.slaDeadlineIso).getTime())
    .slice(0, 8);

  const closedCount = tickets.filter((ticket) => ticket.status === TicketStatus.CLOSED).length;

  const csatResponseCount = csatTickets.length;
  const csatScorePercent =
    csatResponseCount > 0
      ? Math.round(
          (sum(csatTickets.map((row) => row.csatScore ?? 0)) / csatResponseCount / 5) * 100
        )
      : null;

  const slaByPriority = (Object.values(TicketPriority) as TicketPriority[]).map((priority) => {
    const subset = tickets.filter((ticket) => ticket.priority === priority);
    let responded = 0;
    let onTime = 0;
    let totalMinutes = 0;
    for (const ticket of subset) {
      const adminFirst = ticket.messages
        .filter((message) => message.authorType === "ADMIN")
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0];
      if (!adminFirst) {
        continue;
      }
      responded += 1;
      totalMinutes += (adminFirst.createdAt.getTime() - ticket.createdAt.getTime()) / 60_000;
      const deadlineMs = ticket.createdAt.getTime() + SLA_RESPONSE_HOURS[priority] * 3_600_000;
      if (adminFirst.createdAt.getTime() <= deadlineMs) {
        onTime += 1;
      }
    }
    return {
      priority,
      ticketsInPriority: subset.length,
      firstResponseSamples: responded,
      onTimePct: responded > 0 ? Math.round((onTime / responded) * 1000) / 10 : null,
      avgFirstResponseMinutes: responded > 0 ? Math.round(totalMinutes / responded) : null,
      breachCount: responded - onTime
    };
  });

  return {
    summary: {
      totalTickets: tickets.length,
      openTickets: tickets.filter((ticket) =>
        ticket.status === TicketStatus.OPEN || ticket.status === TicketStatus.IN_PROGRESS
      ).length,
      pendingCustomerTickets: tickets.filter((ticket) => ticket.status === TicketStatus.PENDING_CUSTOMER)
        .length,
      averageMessageCount: tickets.length
        ? Number((sum(tickets.map((ticket) => ticket.messages.length)) / tickets.length).toFixed(2))
        : 0,
      avgFirstResponseMinutes,
      resolutionRatePct: tickets.length > 0 ? Math.round((closedCount / tickets.length) * 100) : 0,
      csatScorePercent,
      csatResponseCount,
      csatProxyResolutionRatePct:
        tickets.length > 0 ? Math.round((closedCount / tickets.length) * 100) : 0
    },
    byStatus: Object.values(TicketStatus).map((status) => ({
      status,
      count: tickets.filter((ticket) => ticket.status === status).length
    })),
    byPriority: Object.values(TicketPriority).map((priority) => ({
      priority,
      count: tickets.filter((ticket) => ticket.priority === priority).length
    })),
    stitchBacklog: {
      new: stitchNew,
      open: stitchOpen,
      pending: stitchPending,
      onHold: stitchOnHold,
      resolved: stitchResolved
    },
    complaintCategories: complaintTemplate.map((category) => ({
      category,
      count: complaintCounts[category]
    })),
    slaAtRiskTickets,
    slaByPriority
  };
};

export const getPostPurchaseReport = async (input: { from?: Date; to?: Date }) => {
  const createdAt = buildDateRangeWhere(input);
  const [returns, refunds, reviews] = await Promise.all([
    prisma.return.findMany({
      where: createdAt ? { requestedAt: createdAt } : undefined,
      include: {
        items: {
          include: {
            variant: { include: { product: true } }
          }
        }
      }
    }),
    prisma.refund.findMany({
      where: createdAt ? { createdAt } : undefined,
      include: {
        items: true
      }
    }),
    prisma.review.findMany({
      where: createdAt ? { createdAt } : undefined
    })
  ]);

  const completedRefunds = refunds.filter((refund) => refund.state === RefundState.COMPLETED);
  const refundCentsByDay = new Map<string, number>();
  for (const refund of completedRefunds) {
    const key = toIsoDate(refund.updatedAt);
    refundCentsByDay.set(key, (refundCentsByDay.get(key) ?? 0) + refund.amountCents);
  }
  const refundTrend = [...refundCentsByDay.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, refundCents]) => ({ date, refundCents }));

  const reasonMap = new Map<string, number>();
  for (const record of returns) {
    const label = (record.customerReason?.trim() || "Unspecified").slice(0, 120);
    reasonMap.set(label, (reasonMap.get(label) ?? 0) + 1);
  }
  const returnReasons = [...reasonMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 15);

  const returnQtyByProduct = new Map<string, { productTitle: string; returnedQty: number }>();
  for (const record of returns) {
    for (const line of record.items) {
      const title = line.variant.product.title;
      const key = line.variant.productId;
      const row = returnQtyByProduct.get(key) ?? { productTitle: title, returnedQty: 0 };
      row.returnedQty += line.quantity;
      returnQtyByProduct.set(key, row);
    }
  }
  const topReturnedProducts = [...returnQtyByProduct.entries()]
    .map(([productId, v]) => ({ productId, productTitle: v.productTitle, returnedQty: v.returnedQty }))
    .sort((left, right) => right.returnedQty - left.returnedQty)
    .slice(0, 10);

  const refundProcHours = completedRefunds
    .map((refund) => (refund.updatedAt.getTime() - refund.createdAt.getTime()) / 3_600_000)
    .filter((hours) => hours >= 0 && hours < 720);
  const avgRefundProcessingHours =
    refundProcHours.length > 0
      ? Number((refundProcHours.reduce((a, b) => a + b, 0) / refundProcHours.length).toFixed(1))
      : null;

  const completedReturns = returns.filter(
    (record) => record.status === ReturnStatus.COMPLETED && record.completedAt
  );
  const returnProcHours = completedReturns
    .map((record) => (record.completedAt!.getTime() - record.requestedAt.getTime()) / 3_600_000)
    .filter((hours) => hours >= 0 && hours < 720 * 8);
  const avgReturnCompletionHours =
    returnProcHours.length > 0
      ? Number((returnProcHours.reduce((a, b) => a + b, 0) / returnProcHours.length).toFixed(1))
      : null;

  return {
    returns: {
      total: returns.length,
      byStatus: Object.values(ReturnStatus).map((status) => ({
        status,
        count: returns.filter((record) => record.status === status).length
      })),
      quantityRequested: sum(returns.flatMap((record) => record.items.map((item) => item.quantity)))
    },
    refunds: {
      total: refunds.length,
      completedCents: sum(completedRefunds.map((refund) => refund.amountCents))
    },
    reviews: {
      total: reviews.length,
      published: reviews.filter((review) => review.status === ReviewStatus.PUBLISHED).length,
      pending: reviews.filter((review) => review.status === ReviewStatus.PENDING).length
    },
    refundTrend,
    returnReasons,
    topReturnedProducts,
    processing: {
      avgRefundProcessingHours,
      avgReturnCompletionHours
    }
  };
};

export const getMarketingReport = async (input: { from?: Date; to?: Date }) => {
  const createdAt = buildDateRangeWhere(input);
  const [coupons, promotions, campaigns, redemptions, ordersInRange] = await Promise.all([
    prisma.coupon.findMany({
      where: createdAt ? { createdAt } : undefined
    }),
    prisma.promotion.findMany({
      where: createdAt ? { createdAt } : undefined,
      include: {
        rules: true
      }
    }),
    prisma.campaign.findMany({
      where: createdAt ? { createdAt } : undefined,
      include: {
        banners: true
      }
    }),
    prisma.couponRedemption.findMany({
      where: createdAt ? { redeemedAt: createdAt } : undefined,
      include: {
        coupon: true
      }
    }),
    prisma.order.findMany({
      where: createdAt ? { createdAt } : undefined,
      select: {
        id: true,
        campaignId: true,
        couponRedemptions: { select: { id: true } },
        items: { select: { quantity: true, unitPriceAmountCents: true } },
        checkoutSession: {
          select: {
            checkoutValidationSnapshots: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { normalizedTotals: true }
            }
          }
        }
      }
    })
  ]);

  const couponRedemptionCounts = new Map<string, { code: string; redemptions: number }>();
  for (const row of redemptions) {
    const code = row.coupon.code;
    const bucket = couponRedemptionCounts.get(code) ?? { code, redemptions: 0 };
    bucket.redemptions += 1;
    couponRedemptionCounts.set(code, bucket);
  }
  const topCouponsByRedemption = [...couponRedemptionCounts.values()]
    .sort((left, right) => right.redemptions - left.redemptions)
    .slice(0, 10)
    .map((row, index) => ({ rank: index + 1, code: row.code, redemptions: row.redemptions }));

  let orderRevenueCents = 0;
  let couponAttributedRevenueCents = 0;
  let couponOrderCount = 0;
  let totalDiscountCentsFromCheckout = 0;
  let ordersWithCheckoutDiscountSnapshot = 0;
  const revenueByCampaignId = new Map<string, number>();
  for (const order of ordersInRange) {
    const rev = sum(order.items.map((item) => item.quantity * item.unitPriceAmountCents));
    orderRevenueCents += rev;
    if (order.couponRedemptions.length > 0) {
      couponAttributedRevenueCents += rev;
      couponOrderCount += 1;
    }
    const snap = order.checkoutSession?.checkoutValidationSnapshots[0]?.normalizedTotals;
    const totals = readCheckoutTotalsFromSnapshot(snap);
    if (totals && totals.discountCents > 0) {
      ordersWithCheckoutDiscountSnapshot += 1;
    }
    if (totals) {
      totalDiscountCentsFromCheckout += totals.discountCents;
    }
    if (order.campaignId) {
      revenueByCampaignId.set(
        order.campaignId,
        (revenueByCampaignId.get(order.campaignId) ?? 0) + rev
      );
    }
  }
  const organicRevenueCents = Math.max(0, orderRevenueCents - couponAttributedRevenueCents);
  const channelAttribution = [
    {
      channel: "Coupons",
      revenueCents: couponAttributedRevenueCents,
      orderCount: couponOrderCount,
      pctOfRevenue:
        orderRevenueCents > 0
          ? Math.round((couponAttributedRevenueCents / orderRevenueCents) * 1000) / 10
          : 0
    },
    {
      channel: "Organic & other",
      revenueCents: organicRevenueCents,
      orderCount: ordersInRange.length - couponOrderCount,
      pctOfRevenue:
        orderRevenueCents > 0
          ? Math.round((organicRevenueCents / orderRevenueCents) * 1000) / 10
          : 0
    }
  ];

  const campaignRoi = campaigns.map((campaign) => {
    const attributedRevenueCents = revenueByCampaignId.get(campaign.id) ?? 0;
    const costCents = campaign.costCents;
    const roiPct =
      costCents != null && costCents > 0
        ? Math.round(((attributedRevenueCents - costCents) / costCents) * 1000) / 10
        : null;
    return {
      campaignId: campaign.id,
      name: campaign.name,
      status: campaign.status,
      bannerCount: campaign.banners.length,
      attributedRevenueCents,
      costCents,
      roiPct
    };
  });

  return {
    discounts: {
      totalCentsFromCheckout: totalDiscountCentsFromCheckout,
      ordersWithDiscountSnapshotCount: ordersWithCheckoutDiscountSnapshot
    },
    coupons: {
      total: coupons.length,
      active: coupons.filter((coupon) => coupon.status === "ACTIVE").length,
      disabled: coupons.filter((coupon) => coupon.status === "DISABLED").length,
      redemptions: redemptions.length
    },
    promotions: {
      total: promotions.length,
      active: promotions.filter((promotion) => promotion.status === "ACTIVE").length,
      ruleCount: sum(promotions.map((promotion) => promotion.rules.length))
    },
    campaigns: {
      total: campaigns.length,
      active: campaigns.filter((campaign) => campaign.status === "ACTIVE").length,
      bannerCount: sum(campaigns.map((campaign) => campaign.banners.length))
    },
    topCouponsByRedemption,
    channelAttribution,
    campaignRoi
  };
};
