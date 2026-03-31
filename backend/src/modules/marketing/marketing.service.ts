import { Prisma } from "@prisma/client";

import { conflictError, notFoundError } from "../../common/errors/app-error";

/** System promotion that holds storewide (global) targeting rules — hidden from normal promotion lists. */
export const GLOBAL_RULES_PROMOTION_NAME = "__GLOBAL_RULES__";
import {
  buildPagination,
  buildPaginationPayload,
  type PaginationInput
} from "../../common/http/pagination";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { prisma } from "../../config/prisma";

const bannerLinkSelect = {
  select: {
    id: true,
    title: true,
    mediaUrl: true,
    placement: true,
    status: true
  }
} as const;

const couponInclude = {
  _count: {
    select: {
      redemptions: true
    }
  },
  linkedBanner: bannerLinkSelect
} satisfies Prisma.CouponInclude;

const promotionInclude = {
  rules: {
    orderBy: {
      createdAt: "asc" as const
    }
  },
  campaigns: {
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      createdAt: true
    },
    orderBy: {
      createdAt: "desc" as const
    }
  },
  linkedBanner: bannerLinkSelect
} satisfies Prisma.PromotionInclude;

const campaignInclude = {
  promotion: {
    select: {
      id: true,
      name: true,
      status: true
    }
  },
  _count: {
    select: {
      banners: true
    }
  }
} satisfies Prisma.CampaignInclude;

type CouponRecord = Prisma.CouponGetPayload<{
  include: typeof couponInclude;
}>;

type PromotionRecord = Prisma.PromotionGetPayload<{
  include: typeof promotionInclude;
}>;

type CampaignRecord = Prisma.CampaignGetPayload<{
  include: typeof campaignInclude;
}>;

const assertMarketingBannerExists = async (transaction: Prisma.TransactionClient, bannerId: string) => {
  const row = await transaction.banner.findUnique({
    where: { id: bannerId },
    select: { id: true }
  });
  if (!row) {
    throw notFoundError("The requested banner was not found.");
  }
};

const serializeCoupon = (coupon: CouponRecord) => ({
  id: coupon.id,
  code: coupon.code,
  status: coupon.status,
  activeFrom: coupon.activeFrom,
  activeTo: coupon.activeTo,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  minOrderAmountCents: coupon.minOrderAmountCents,
  maxRedemptions: coupon.maxRedemptions,
  perCustomerLimit: coupon.perCustomerLimit,
  redemptionCount: coupon._count.redemptions,
  bannerId: coupon.bannerId,
  linkedBanner: coupon.linkedBanner,
  createdAt: coupon.createdAt,
  updatedAt: coupon.updatedAt
});

const serializePromotion = (promotion: PromotionRecord) => ({
  id: promotion.id,
  name: promotion.name,
  status: promotion.status,
  activeFrom: promotion.activeFrom,
  activeTo: promotion.activeTo,
  bannerId: promotion.bannerId,
  linkedBanner: promotion.linkedBanner,
  createdAt: promotion.createdAt,
  updatedAt: promotion.updatedAt,
  rules: promotion.rules.map((rule) => ({
    id: rule.id,
    ruleType: rule.ruleType,
    targeting: rule.targeting,
    minOrderAmountCents: rule.minOrderAmountCents,
    createdAt: rule.createdAt
  })),
  campaigns: promotion.campaigns
});

const serializeCampaign = (campaign: CampaignRecord) => ({
  id: campaign.id,
  slug: campaign.slug,
  name: campaign.name,
  status: campaign.status,
  promotion: campaign.promotion,
  bannerCount: campaign._count.banners,
  costCents: campaign.costCents,
  createdAt: campaign.createdAt,
  updatedAt: campaign.updatedAt
});

const recordMarketingMutation = async (
  transaction: Prisma.TransactionClient,
  input: {
    actorAdminUserId: string;
    actionCode: string;
    screen: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
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
        metadata: toPrismaJsonValue({
          after: input.after
        })
      }
    }),
    transaction.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        screen: input.screen,
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        before: toPrismaJsonValue(input.before),
        after: toPrismaJsonValue(input.after)
      }
    }),
    transaction.timelineEvent.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.actionCode.toUpperCase().replaceAll(".", "_"),
        actorAdminUserId: input.actorAdminUserId,
        actorType: "ADMIN",
        payload: toPrismaJsonValue({
          before: input.before,
          after: input.after
        })
      }
    })
  ]);
};

const getCouponIdsByUsageRange = async (minPct: number, maxPct: number): Promise<string[]> => {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT c.id FROM "Coupon" c
    WHERE (
      (c."maxRedemptions" IS NULL OR c."maxRedemptions" <= 0)
      AND ${minPct} <= 0
    )
    OR (
      c."maxRedemptions" IS NOT NULL
      AND c."maxRedemptions" > 0
      AND (
        SELECT COUNT(*)::float FROM "CouponRedemption" r WHERE r."couponId" = c.id
      ) / c."maxRedemptions"::float * 100 BETWEEN ${minPct} AND ${maxPct}
    )
  `);
  return rows.map((r) => r.id);
};

export const listAdminCoupons = async (
  input: PaginationInput & {
    status?: CouponRecord["status"];
    q?: string;
    discount_type?: string;
    active_from?: Date;
    active_to?: Date;
    usage_ratio_min?: number;
    usage_ratio_max?: number;
  }
) => {
  const andClauses: Prisma.CouponWhereInput[] = [];

  const where: Prisma.CouponWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          code: {
            contains: input.q.toUpperCase(),
            mode: "insensitive"
          }
        }
      : {}),
    ...(input.discount_type
      ? {
          discountType: {
            equals: input.discount_type,
            mode: "insensitive"
          }
        }
      : {})
  };

  if (input.active_from || input.active_to) {
    const rangeStart = input.active_from ?? new Date("1970-01-01");
    const rangeEnd = input.active_to ?? new Date("2099-12-31");
    andClauses.push(
      { OR: [{ activeFrom: null }, { activeFrom: { lte: rangeEnd } }] },
      { OR: [{ activeTo: null }, { activeTo: { gte: rangeStart } }] }
    );
  }

  const minU = input.usage_ratio_min ?? 0;
  const maxU = input.usage_ratio_max ?? 100;
  if (minU > 0 || maxU < 100) {
    const ids = await getCouponIdsByUsageRange(minU, maxU);
    if (ids.length === 0) {
      return {
        items: [],
        pagination: buildPaginationPayload(input, 0)
      };
    }
    andClauses.push({ id: { in: ids } });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  const [items, totalItems] = await Promise.all([
    prisma.coupon.findMany({
      where,
      include: couponInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.coupon.count({ where })
  ]);

  return {
    items: items.map(serializeCoupon),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const createAdminCoupon = async (input: {
  actorAdminUserId: string;
  code: string;
  status: CouponRecord["status"];
  activeFrom?: Date;
  activeTo?: Date;
  discountType: string;
  discountValue?: number;
  minOrderAmountCents?: number;
  maxRedemptions?: number;
  perCustomerLimit?: number;
  bannerId?: string;
}) =>
  runInTransaction(async (transaction) => {
    if (input.bannerId) {
      await assertMarketingBannerExists(transaction, input.bannerId);
    }
    const coupon = await transaction.coupon.create({
      data: {
        code: input.code,
        status: input.status,
        activeFrom: input.activeFrom,
        activeTo: input.activeTo,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minOrderAmountCents: input.minOrderAmountCents,
        maxRedemptions: input.maxRedemptions,
        perCustomerLimit: input.perCustomerLimit,
        ...(input.bannerId ? { bannerId: input.bannerId } : {})
      },
      include: couponInclude
    });

    await recordMarketingMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "marketing.coupons.create",
      screen: "marketing.coupons",
      entityType: "COUPON",
      entityId: coupon.id,
      after: serializeCoupon(coupon)
    });

    return {
      entity: serializeCoupon(coupon)
    };
  });

export const updateAdminCoupon = async (input: {
  actorAdminUserId: string;
  couponId: string;
  status?: CouponRecord["status"];
  activeFrom?: Date;
  activeTo?: Date;
  discountType?: string;
  discountValue?: number;
  minOrderAmountCents?: number;
  maxRedemptions?: number;
  perCustomerLimit?: number;
  bannerId?: string | null;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.coupon.findUnique({
      where: {
        id: input.couponId
      },
      include: couponInclude
    });

    if (!existing) {
      throw notFoundError("The requested coupon was not found.");
    }

    if (input.bannerId !== undefined && input.bannerId !== null) {
      await assertMarketingBannerExists(transaction, input.bannerId);
    }

    const updated = await transaction.coupon.update({
      where: {
        id: existing.id
      },
      data: {
        status: input.status ?? existing.status,
        activeFrom: input.activeFrom ?? existing.activeFrom,
        activeTo: input.activeTo ?? existing.activeTo,
        discountType: input.discountType ?? existing.discountType,
        discountValue: input.discountValue ?? existing.discountValue,
        minOrderAmountCents: input.minOrderAmountCents ?? existing.minOrderAmountCents,
        maxRedemptions: input.maxRedemptions ?? existing.maxRedemptions,
        perCustomerLimit: input.perCustomerLimit ?? existing.perCustomerLimit,
        ...(input.bannerId !== undefined ? { bannerId: input.bannerId } : {})
      },
      include: couponInclude
    });

    await recordMarketingMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "marketing.coupons.update",
      screen: "marketing.coupons",
      entityType: "COUPON",
      entityId: updated.id,
      before: serializeCoupon(existing),
      after: serializeCoupon(updated)
    });

    return {
      entity: serializeCoupon(updated)
    };
  });

export const deleteAdminCoupon = async (input: {
  actorAdminUserId: string;
  couponId: string;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.coupon.findUnique({
      where: {
        id: input.couponId
      },
      include: couponInclude
    });

    if (!existing) {
      throw notFoundError("The requested coupon was not found.");
    }

    if (existing._count.redemptions > 0) {
      throw conflictError(
        "This coupon has recorded redemptions and cannot be deleted. Disable it instead."
      );
    }

    await transaction.coupon.delete({
      where: {
        id: existing.id
      }
    });

    await recordMarketingMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "marketing.coupons.delete",
      screen: "marketing.coupons",
      entityType: "COUPON",
      entityId: existing.id,
      before: serializeCoupon(existing),
      after: { deleted: true }
    });

    return {
      ok: true as const
    };
  });

export const listAdminPromotions = async (
  input: PaginationInput & {
    status?: PromotionRecord["status"];
    q?: string;
  }
) => {
  const where: Prisma.PromotionWhereInput = {
    AND: [
      {
        name: {
          not: GLOBAL_RULES_PROMOTION_NAME
        }
      },
      ...(input.status ? [{ status: input.status }] : []),
      ...(input.q
        ? [
            {
              name: {
                contains: input.q,
                mode: "insensitive" as const
              }
            }
          ]
        : [])
    ]
  };

  const [items, totalItems] = await Promise.all([
    prisma.promotion.findMany({
      where,
      include: promotionInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.promotion.count({ where })
  ]);

  return {
    items: items.map(serializePromotion),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const createAdminPromotion = async (input: {
  actorAdminUserId: string;
  name: string;
  status: PromotionRecord["status"];
  activeFrom?: Date;
  activeTo?: Date;
  bannerId?: string;
  rules: Array<{
    ruleType: string;
    targeting: Record<string, unknown>;
    minOrderAmountCents?: number;
  }>;
}) =>
  runInTransaction(async (transaction) => {
    if (input.name.trim() === GLOBAL_RULES_PROMOTION_NAME) {
      throw conflictError("This promotion name is reserved for the global rules container.");
    }

    if (input.bannerId) {
      await assertMarketingBannerExists(transaction, input.bannerId);
    }

    const promotion = await transaction.promotion.create({
      data: {
        name: input.name,
        status: input.status,
        activeFrom: input.activeFrom,
        activeTo: input.activeTo,
        ...(input.bannerId ? { bannerId: input.bannerId } : {})
      }
    });

    if (input.rules.length > 0) {
      await transaction.promotionRule.createMany({
        data: input.rules.map((rule) => ({
          promotionId: promotion.id,
          ruleType: rule.ruleType,
          targeting: toPrismaJsonValue(rule.targeting)!,
          minOrderAmountCents: rule.minOrderAmountCents
        }))
      });
    }

    const created = await transaction.promotion.findUnique({
      where: {
        id: promotion.id
      },
      include: promotionInclude
    });

    await recordMarketingMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "marketing.promotions.create",
      screen: "marketing.promotions",
      entityType: "PROMOTION",
      entityId: promotion.id,
      after: created ? serializePromotion(created) : null
    });

    return {
      entity: created ? serializePromotion(created) : null
    };
  });

export const updateAdminPromotion = async (input: {
  actorAdminUserId: string;
  promotionId: string;
  name?: string;
  status?: PromotionRecord["status"];
  activeFrom?: Date;
  activeTo?: Date;
  bannerId?: string | null;
  rules?: Array<{
    ruleType: string;
    targeting: Record<string, unknown>;
    minOrderAmountCents?: number;
  }>;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.promotion.findUnique({
      where: {
        id: input.promotionId
      },
      include: promotionInclude
    });

    if (!existing) {
      throw notFoundError("The requested promotion was not found.");
    }

    if (input.name != null && input.name.trim() === GLOBAL_RULES_PROMOTION_NAME) {
      throw conflictError("This promotion name is reserved for the global rules container.");
    }

    if (input.bannerId !== undefined && input.bannerId !== null) {
      await assertMarketingBannerExists(transaction, input.bannerId);
    }

    await transaction.promotion.update({
      where: {
        id: existing.id
      },
      data: {
        name: input.name ?? existing.name,
        status: input.status ?? existing.status,
        activeFrom: input.activeFrom ?? existing.activeFrom,
        activeTo: input.activeTo ?? existing.activeTo,
        ...(input.bannerId !== undefined ? { bannerId: input.bannerId } : {})
      }
    });

    if (input.rules) {
      await transaction.promotionRule.deleteMany({
        where: {
          promotionId: existing.id
        }
      });

      if (input.rules.length > 0) {
        await transaction.promotionRule.createMany({
          data: input.rules.map((rule) => ({
            promotionId: existing.id,
            ruleType: rule.ruleType,
            targeting: toPrismaJsonValue(rule.targeting)!,
            minOrderAmountCents: rule.minOrderAmountCents
          }))
        });
      }
    }

    const updated = await transaction.promotion.findUnique({
      where: {
        id: existing.id
      },
      include: promotionInclude
    });

    await recordMarketingMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "marketing.promotions.update",
      screen: "marketing.promotions",
      entityType: "PROMOTION",
      entityId: existing.id,
      before: serializePromotion(existing),
      after: updated ? serializePromotion(updated) : null
    });

    return {
      entity: updated ? serializePromotion(updated) : null
    };
  });

export const getAdminPromotionDetail = async (promotionId: string) => {
  const promotion = await prisma.promotion.findUnique({
    where: {
      id: promotionId
    },
    include: promotionInclude
  });

  if (!promotion) {
    throw notFoundError("The requested promotion was not found.");
  }

  return {
    entity: serializePromotion(promotion)
  };
};

export const listAdminPromotionRules = async (promotionId: string) => {
  const promotion = await prisma.promotion.findUnique({
    where: {
      id: promotionId
    },
    include: promotionInclude
  });

  if (!promotion) {
    throw notFoundError("The requested promotion was not found.");
  }

  return {
    entity: {
      id: promotion.id,
      name: promotion.name,
      status: promotion.status
    },
    items: promotion.rules.map((rule) => ({
      id: rule.id,
      ruleType: rule.ruleType,
      targeting: rule.targeting,
      minOrderAmountCents: rule.minOrderAmountCents,
      createdAt: rule.createdAt
    }))
  };
};

export const createAdminPromotionRule = async (input: {
  actorAdminUserId: string;
  promotionId: string;
  ruleType: string;
  targeting: Record<string, unknown>;
  minOrderAmountCents?: number;
}) =>
  runInTransaction(async (transaction) => {
    const promotion = await transaction.promotion.findUnique({
      where: {
        id: input.promotionId
      },
      include: promotionInclude
    });

    if (!promotion) {
      throw notFoundError("The requested promotion was not found.");
    }

    const rule = await transaction.promotionRule.create({
      data: {
        promotionId: promotion.id,
        ruleType: input.ruleType,
        targeting: toPrismaJsonValue(input.targeting)!,
        minOrderAmountCents: input.minOrderAmountCents
      }
    });

    const updatedPromotion = await transaction.promotion.findUnique({
      where: {
        id: promotion.id
      },
      include: promotionInclude
    });

    await recordMarketingMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "marketing.promotions.rules.create",
      screen: "marketing.promotions",
      entityType: "PROMOTION",
      entityId: promotion.id,
      before: serializePromotion(promotion),
      after: updatedPromotion ? serializePromotion(updatedPromotion) : null
    });

    return {
      entity: updatedPromotion ? serializePromotion(updatedPromotion) : null,
      rule: {
        id: rule.id,
        ruleType: rule.ruleType,
        targeting: rule.targeting,
        minOrderAmountCents: rule.minOrderAmountCents,
        createdAt: rule.createdAt
      }
    };
  });

export const updateAdminPromotionRule = async (input: {
  actorAdminUserId: string;
  promotionId: string;
  ruleId: string;
  ruleType?: string;
  targeting?: Record<string, unknown>;
  minOrderAmountCents?: number;
}) =>
  runInTransaction(async (transaction) => {
    const [promotion, existingRule] = await Promise.all([
      transaction.promotion.findUnique({
        where: {
          id: input.promotionId
        },
        include: promotionInclude
      }),
      transaction.promotionRule.findFirst({
        where: {
          id: input.ruleId,
          promotionId: input.promotionId
        }
      })
    ]);

    if (!promotion) {
      throw notFoundError("The requested promotion was not found.");
    }

    if (!existingRule) {
      throw notFoundError("The requested promotion rule was not found.");
    }

    await transaction.promotionRule.update({
      where: {
        id: existingRule.id
      },
      data: {
        ruleType: input.ruleType ?? existingRule.ruleType,
        targeting:
          input.targeting != null
            ? toPrismaJsonValue(input.targeting)!
            : toPrismaJsonValue(existingRule.targeting) ?? Prisma.JsonNull,
        minOrderAmountCents:
          input.minOrderAmountCents ?? existingRule.minOrderAmountCents
      }
    });

    const updatedPromotion = await transaction.promotion.findUnique({
      where: {
        id: promotion.id
      },
      include: promotionInclude
    });

    await recordMarketingMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "marketing.promotions.rules.update",
      screen: "marketing.promotions",
      entityType: "PROMOTION",
      entityId: promotion.id,
      before: serializePromotion(promotion),
      after: updatedPromotion ? serializePromotion(updatedPromotion) : null
    });

    return {
      entity: updatedPromotion ? serializePromotion(updatedPromotion) : null
    };
  });

export const getOrCreateGlobalRulesPromotion = async (input: {
  actorAdminUserId: string;
}) =>
  runInTransaction(async (transaction) => {
    let promotion = await transaction.promotion.findFirst({
      where: {
        name: GLOBAL_RULES_PROMOTION_NAME
      }
    });

    if (!promotion) {
      promotion = await transaction.promotion.create({
        data: {
          name: GLOBAL_RULES_PROMOTION_NAME,
          status: "DISABLED"
        }
      });

      const created = await transaction.promotion.findUnique({
        where: {
          id: promotion.id
        },
        include: promotionInclude
      });

      await recordMarketingMutation(transaction, {
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "marketing.promotions.global_container.ensure",
        screen: "marketing.promotions",
        entityType: "PROMOTION",
        entityId: promotion.id,
        after: created ? serializePromotion(created) : null
      });
    }

    return {
      entity: {
        id: promotion.id,
        name: promotion.name,
        status: promotion.status
      }
    };
  });

export const deleteAdminPromotionRule = async (input: {
  actorAdminUserId: string;
  promotionId: string;
  ruleId: string;
}) =>
  runInTransaction(async (transaction) => {
    const [promotion, existingRule] = await Promise.all([
      transaction.promotion.findUnique({
        where: {
          id: input.promotionId
        },
        include: promotionInclude
      }),
      transaction.promotionRule.findFirst({
        where: {
          id: input.ruleId,
          promotionId: input.promotionId
        }
      })
    ]);

    if (!promotion) {
      throw notFoundError("The requested promotion was not found.");
    }

    if (!existingRule) {
      throw notFoundError("The requested promotion rule was not found.");
    }

    await transaction.promotionRule.delete({
      where: {
        id: existingRule.id
      }
    });

    const updatedPromotion = await transaction.promotion.findUnique({
      where: {
        id: promotion.id
      },
      include: promotionInclude
    });

    await recordMarketingMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "marketing.promotions.rules.delete",
      screen: "marketing.promotions",
      entityType: "PROMOTION",
      entityId: promotion.id,
      before: serializePromotion(promotion),
      after: updatedPromotion ? serializePromotion(updatedPromotion) : null
    });

    return {
      entity: updatedPromotion ? serializePromotion(updatedPromotion) : null,
      ok: true as const
    };
  });

export const deleteAdminPromotion = async (input: {
  actorAdminUserId: string;
  promotionId: string;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.promotion.findUnique({
      where: {
        id: input.promotionId
      },
      include: promotionInclude
    });

    if (!existing) {
      throw notFoundError("The requested promotion was not found.");
    }

    if (existing.name === GLOBAL_RULES_PROMOTION_NAME) {
      throw conflictError("The global rules container cannot be deleted.");
    }

    await transaction.campaign.updateMany({
      where: {
        promotionId: existing.id
      },
      data: {
        promotionId: null
      }
    });

    await transaction.promotion.delete({
      where: {
        id: existing.id
      }
    });

    await recordMarketingMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "marketing.promotions.delete",
      screen: "marketing.promotions",
      entityType: "PROMOTION",
      entityId: existing.id,
      before: serializePromotion(existing),
      after: {
        deleted: true
      }
    });

    return {
      ok: true as const
    };
  });

const bigintToNumber = (v: bigint | null | undefined) => {
  if (v == null) {
    return 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const getPromotionPulseMetrics = async () => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [activeCampaignsCount, ordersWithCoupon30d, ordersTotal30d] = await Promise.all([
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
    prisma.order.count({
      where: {
        createdAt: { gte: since },
        couponRedemptions: { some: {} }
      }
    }),
    prisma.order.count({
      where: { createdAt: { gte: since } }
    })
  ]);
  const orderCouponRedemptionRatePercent30d =
    ordersTotal30d > 0 ? Math.round((ordersWithCoupon30d / ordersTotal30d) * 10000) / 100 : 0;
  return {
    activeCampaignsCount,
    ordersWithCoupon30d,
    ordersTotal30d,
    orderCouponRedemptionRatePercent30d
  };
};

export const getAdminCouponAnalytics = async (input: { period_days: number; abuse_threshold: number }) => {
  const periodDays = input.period_days;
  const abuseThreshold = input.abuse_threshold;
  const to = new Date();
  const from = new Date(to.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const [statusCounts, redemptionCount] = await Promise.all([
    prisma.coupon.groupBy({
      by: ["status"],
      _count: {
        _all: true
      }
    }),
    prisma.couponRedemption.count()
  ]);

  const [avgUsageRow] = await prisma.$queryRaw<{ avg_usage: number | null }[]>(Prisma.sql`
    SELECT AVG(
      (SELECT COUNT(*)::float FROM "CouponRedemption" r WHERE r."couponId" = c.id)
      / c."maxRedemptions"::float * 100
    ) AS avg_usage
    FROM "Coupon" c
    WHERE c."maxRedemptions" IS NOT NULL AND c."maxRedemptions" > 0
  `);

  const [lifeDiscRow] = await prisma.$queryRaw<{ est: bigint }[]>(Prisma.sql`
    WITH ro AS (
      SELECT c."discountType", c."discountValue", r."orderId",
        COALESCE((
          SELECT SUM(oi."unitPriceAmountCents" * oi.quantity)::bigint
          FROM "OrderItem" oi
          WHERE oi."orderId" = r."orderId"
        ), 0::bigint) AS subtotal
      FROM "CouponRedemption" r
      INNER JOIN "Coupon" c ON c.id = r."couponId"
    )
    SELECT COALESCE(SUM(
      CASE
        WHEN "discountType" = 'PERCENTAGE' AND "discountValue" IS NOT NULL AND subtotal > 0
          THEN LEAST((subtotal * "discountValue"::numeric / 100)::bigint, subtotal)
        WHEN "discountType" = 'FIXED_AMOUNT' AND "discountValue" IS NOT NULL
          THEN LEAST("discountValue"::bigint, subtotal)
        ELSE 0::bigint
      END
    ), 0::bigint) AS est
    FROM ro
  `);

  const dailyRows = await prisma.$queryRaw<{ day: Date; cnt: bigint }[]>(Prisma.sql`
    SELECT DATE_TRUNC('day', r."redeemedAt") AS day, COUNT(*)::bigint AS cnt
    FROM "CouponRedemption" r
    WHERE r."redeemedAt" >= ${from} AND r."redeemedAt" <= ${to}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  const [periodAggRow] = await prisma.$queryRaw<
    { est_discount: bigint; revenue: bigint; aov_count: bigint; aov_sum: bigint; redemptions_in_period: bigint }[]
  >(Prisma.sql`
    WITH ro AS (
      SELECT r."orderId", c."discountType", c."discountValue",
        COALESCE((
          SELECT SUM(oi."unitPriceAmountCents" * oi.quantity)::bigint
          FROM "OrderItem" oi
          WHERE oi."orderId" = r."orderId"
        ), 0::bigint) AS subtotal
      FROM "CouponRedemption" r
      INNER JOIN "Coupon" c ON c.id = r."couponId"
      WHERE r."redeemedAt" >= ${from} AND r."redeemedAt" <= ${to}
    ),
    scored AS (
      SELECT *,
        CASE
          WHEN "discountType" = 'PERCENTAGE' AND "discountValue" IS NOT NULL AND subtotal > 0
            THEN LEAST((subtotal * "discountValue"::numeric / 100)::bigint, subtotal)
          WHEN "discountType" = 'FIXED_AMOUNT' AND "discountValue" IS NOT NULL
            THEN LEAST("discountValue"::bigint, subtotal)
          ELSE 0::bigint
        END AS est_line
      FROM ro
    )
    SELECT
      COALESCE(SUM(est_line), 0::bigint) AS est_discount,
      COALESCE(SUM(CASE WHEN "orderId" IS NOT NULL THEN subtotal ELSE 0::bigint END), 0::bigint) AS revenue,
      COUNT(*) FILTER (WHERE "orderId" IS NOT NULL AND subtotal > 0)::bigint AS aov_count,
      COALESCE(SUM(subtotal) FILTER (WHERE "orderId" IS NOT NULL AND subtotal > 0), 0::bigint) AS aov_sum,
      COUNT(*)::bigint AS redemptions_in_period
    FROM scored
  `);

  const topCoupons = await prisma.$queryRaw<
    { couponId: string; code: string; discountType: string; redemptionCount: bigint; estimatedDiscountCents: bigint }[]
  >(Prisma.sql`
    WITH ro AS (
      SELECT r."couponId", c.code, c."discountType", c."discountValue", r."orderId",
        COALESCE((
          SELECT SUM(oi."unitPriceAmountCents" * oi.quantity)::bigint
          FROM "OrderItem" oi
          WHERE oi."orderId" = r."orderId"
        ), 0::bigint) AS subtotal
      FROM "CouponRedemption" r
      INNER JOIN "Coupon" c ON c.id = r."couponId"
      WHERE r."redeemedAt" >= ${from} AND r."redeemedAt" <= ${to}
    ),
    scored AS (
      SELECT "couponId", code, "discountType",
        CASE
          WHEN "discountType" = 'PERCENTAGE' AND "discountValue" IS NOT NULL AND subtotal > 0
            THEN LEAST((subtotal * "discountValue"::numeric / 100)::bigint, subtotal)
          WHEN "discountType" = 'FIXED_AMOUNT' AND "discountValue" IS NOT NULL
            THEN LEAST("discountValue"::bigint, subtotal)
          ELSE 0::bigint
        END AS est_line
      FROM ro
    ),
    agg AS (
      SELECT "couponId", code, "discountType",
        COUNT(*)::bigint AS rc,
        COALESCE(SUM(est_line), 0::bigint) AS disc
      FROM scored
      GROUP BY 1, 2, 3
    )
    SELECT "couponId", code, "discountType", rc AS "redemptionCount", disc AS "estimatedDiscountCents"
    FROM agg
    ORDER BY rc DESC
    LIMIT 10
  `);

  const abuseSignals = await prisma.$queryRaw<{ userId: string; redemptionCount: bigint; lastRedeemedAt: Date }[]>(
    Prisma.sql`
    SELECT r."userId" AS "userId", COUNT(*)::bigint AS "redemptionCount", MAX(r."redeemedAt") AS "lastRedeemedAt"
    FROM "CouponRedemption" r
    WHERE r."redeemedAt" >= ${from}
      AND r."userId" IS NOT NULL
    GROUP BY r."userId"
    HAVING COUNT(*) >= ${abuseThreshold}
    ORDER BY "redemptionCount" DESC
    LIMIT 50
  `
  );

  const aovCount = bigintToNumber(periodAggRow?.aov_count);
  const aovSum = bigintToNumber(periodAggRow?.aov_sum);

  return {
    statusCounts: statusCounts.map((entry) => ({
      status: entry.status,
      count: entry._count._all
    })),
    redemptionCount,
    lifetimeEstimatedDiscountCents: bigintToNumber(lifeDiscRow?.est),
    averageUsageRatePercent:
      avgUsageRow?.avg_usage == null ? null : Math.round(Number(avgUsageRow.avg_usage) * 100) / 100,
    window: {
      days: periodDays,
      from: from.toISOString(),
      to: to.toISOString()
    },
    redemptionsInPeriod: bigintToNumber(periodAggRow?.redemptions_in_period),
    dailyRedemptions: dailyRows.map((d) => ({
      date: d.day.toISOString().slice(0, 10),
      count: Number(d.cnt)
    })),
    estimatedDiscountGivenCentsInPeriod: bigintToNumber(periodAggRow?.est_discount),
    estimatedRevenueAttributedCentsInPeriod: bigintToNumber(periodAggRow?.revenue),
    averageOrderValueCouponCentsInPeriod: aovCount > 0 ? Math.round(aovSum / aovCount) : null,
    topCouponsInPeriod: topCoupons.map((t) => ({
      couponId: t.couponId,
      code: t.code,
      discountType: t.discountType,
      redemptionCount: Number(t.redemptionCount),
      estimatedDiscountCents: bigintToNumber(t.estimatedDiscountCents)
    })),
    abuseSignals: abuseSignals.map((a) => ({
      userId: a.userId,
      redemptionCount: Number(a.redemptionCount),
      lastRedeemedAt: a.lastRedeemedAt.toISOString()
    }))
  };
};

export const getAdminCampaignPerformance = async (input: { period: "24h" | "7d" | "30d" | "all" }) => {
  const now = Date.now();
  const ms =
    input.period === "24h"
      ? 24 * 3600000
      : input.period === "7d"
        ? 7 * 24 * 3600000
        : input.period === "30d"
          ? 30 * 24 * 3600000
          : 0;
  const start = ms > 0 ? new Date(now - ms) : undefined;

  const where: Prisma.CampaignWhereInput = start
    ? {
        updatedAt: { gte: start }
      }
    : {};

  const campaigns = await prisma.campaign.findMany({
    where,
    include: campaignInclude,
    orderBy: {
      updatedAt: "desc"
    },
    take: 100
  });

  const campaignIds = campaigns.map((c) => c.id);
  let channelMix: { placement: string; bannerCount: number }[] = [];
  if (campaignIds.length > 0) {
    const mix = await prisma.banner.groupBy({
      by: ["placement"],
      where: { campaignId: { in: campaignIds } },
      _count: { _all: true }
    });
    channelMix = mix.map((m) => ({
      placement: m.placement,
      bannerCount: m._count._all
    }));
  }

  const activeInView = campaigns.filter((c) => c.status === "ACTIVE").length;
  const linkedPromo = campaigns.filter((c) => c.promotionId != null).length;
  const bannerTotal = channelMix.reduce((acc, c) => acc + c.bannerCount, 0);

  return {
    period: input.period,
    windowFrom: start?.toISOString() ?? null,
    summary: {
      campaignsInView: campaigns.length,
      activeCampaignsInView: activeInView,
      campaignsWithPromotionInView: linkedPromo,
      bannerPlacementsInView: bannerTotal,
      activationRatePercent:
        campaigns.length > 0 ? Math.round((activeInView / campaigns.length) * 10000) / 100 : 0
    },
    channelMix,
    items: campaigns.map((campaign) => ({
      ...serializeCampaign(campaign),
      promotionStatus: campaign.promotion?.status ?? null
    }))
  };
};

export const listAdminCampaigns = async (
  input: PaginationInput & {
    status?: CampaignRecord["status"];
    q?: string;
  }
) => {
  const where: Prisma.CampaignWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            {
              slug: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              name: {
                contains: input.q,
                mode: "insensitive"
              }
            }
          ]
        }
      : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: campaignInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.campaign.count({ where })
  ]);

  return {
    items: items.map(serializeCampaign),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const createAdminCampaign = async (input: {
  actorAdminUserId: string;
  slug: string;
  name: string;
  status: CampaignRecord["status"];
  promotionId?: string;
  costCents?: number | null;
}) =>
  runInTransaction(async (transaction) => {
    const campaign = await transaction.campaign.create({
      data: {
        slug: input.slug,
        name: input.name,
        status: input.status,
        promotionId: input.promotionId ?? null,
        costCents: input.costCents ?? null
      },
      include: campaignInclude
    });

    await recordMarketingMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "marketing.campaigns.create",
      screen: "marketing.campaigns",
      entityType: "CAMPAIGN",
      entityId: campaign.id,
      after: serializeCampaign(campaign)
    });

    return {
      entity: serializeCampaign(campaign)
    };
  });

export const updateAdminCampaign = async (input: {
  actorAdminUserId: string;
  campaignId: string;
  name?: string;
  status?: CampaignRecord["status"];
  promotionId?: string;
  costCents?: number | null;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.campaign.findUnique({
      where: {
        id: input.campaignId
      },
      include: campaignInclude
    });

    if (!existing) {
      throw notFoundError("The requested campaign was not found.");
    }

    const updated = await transaction.campaign.update({
      where: {
        id: existing.id
      },
      data: {
        name: input.name ?? existing.name,
        status: input.status ?? existing.status,
        promotionId: input.promotionId ?? existing.promotionId ?? null,
        costCents: input.costCents !== undefined ? input.costCents : existing.costCents
      },
      include: campaignInclude
    });

    await recordMarketingMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "marketing.campaigns.update",
      screen: "marketing.campaigns",
      entityType: "CAMPAIGN",
      entityId: updated.id,
      before: serializeCampaign(existing),
      after: serializeCampaign(updated)
    });

    return {
      entity: serializeCampaign(updated)
    };
  });
