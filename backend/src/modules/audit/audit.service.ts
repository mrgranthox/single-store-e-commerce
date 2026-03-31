import { Prisma } from "@prisma/client";

import {
  buildPagination,
  buildPaginationPayload,
  type PaginationInput
} from "../../common/http/pagination";
import { prisma } from "../../config/prisma";

const auditInclude = {
  actorAdmin: {
    select: {
      id: true,
      email: true
    }
  }
} satisfies Prisma.AuditLogInclude;

const adminActionInclude = {
  adminUser: {
    select: {
      id: true,
      email: true
    }
  }
} satisfies Prisma.AdminActionLogInclude;

const serializeAuditLog = (item: Prisma.AuditLogGetPayload<{ include: typeof auditInclude }>) => ({
  id: item.id,
  actorType: item.actorType,
  actorAdmin: item.actorAdmin,
  actionCode: item.actionCode,
  entityType: item.entityType,
  entityId: item.entityId,
  reason: item.reason,
  note: item.note,
  metadata: item.metadata,
  createdAt: item.createdAt
});

const serializeAdminAction = (
  item: Prisma.AdminActionLogGetPayload<{ include: typeof adminActionInclude }>
) => ({
  id: item.id,
  adminUser: item.adminUser,
  screen: item.screen,
  actionCode: item.actionCode,
  reason: item.reason,
  note: item.note,
  entityType: item.entityType,
  entityId: item.entityId,
  before: item.before,
  after: item.after,
  createdAt: item.createdAt
});

const serializeTimelineEvent = (item: Prisma.TimelineEventGetPayload<object>) => ({
  id: item.id,
  entityType: item.entityType,
  entityId: item.entityId,
  eventType: item.eventType,
  actorAdminUserId: item.actorAdminUserId,
  actorType: item.actorType,
  payload: item.payload,
  occurredAt: item.occurredAt,
  createdAt: item.createdAt
});

export const listAuditLogs = async (
  input: PaginationInput & {
    actionCode?: string;
    entityType?: string;
    entityId?: string;
    actorAdminUserId?: string;
    actorEmailContains?: string;
  }
) => {
  const where: Prisma.AuditLogWhereInput = {
    ...(input.actionCode ? { actionCode: input.actionCode } : {}),
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.actorAdminUserId ? { actorAdminUserId: input.actorAdminUserId } : {}),
    ...(input.actorEmailContains?.trim()
      ? {
          actorAdmin: {
            email: {
              contains: input.actorEmailContains.trim(),
              mode: "insensitive"
            }
          }
        }
      : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: auditInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.auditLog.count({ where })
  ]);

  return {
    items: items.map(serializeAuditLog),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const listAdminActionLogs = async (
  input: PaginationInput & {
    actionCode?: string;
    entityType?: string;
    entityId?: string;
    adminUserId?: string;
    screen?: string;
  }
) => {
  const where: Prisma.AdminActionLogWhereInput = {
    ...(input.actionCode ? { actionCode: input.actionCode } : {}),
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.adminUserId ? { adminUserId: input.adminUserId } : {}),
    ...(input.screen ? { screen: input.screen } : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.adminActionLog.findMany({
      where,
      include: adminActionInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.adminActionLog.count({ where })
  ]);

  return {
    items: items.map(serializeAdminAction),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const listTimelineEvents = async (
  input: PaginationInput & {
    entityType?: string;
    entityId?: string;
    actorAdminUserId?: string;
    eventType?: string;
    occurredAtFrom?: Date;
    occurredAtTo?: Date;
  }
) => {
  const occurredFilter =
    input.occurredAtFrom || input.occurredAtTo
      ? {
          occurredAt: {
            ...(input.occurredAtFrom ? { gte: input.occurredAtFrom } : {}),
            ...(input.occurredAtTo ? { lte: input.occurredAtTo } : {})
          }
        }
      : {};

  const where: Prisma.TimelineEventWhereInput = {
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.actorAdminUserId ? { actorAdminUserId: input.actorAdminUserId } : {}),
    ...(input.eventType ? { eventType: input.eventType } : {}),
    ...occurredFilter
  };

  const [items, totalItems] = await Promise.all([
    prisma.timelineEvent.findMany({
      where,
      orderBy: {
        occurredAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.timelineEvent.count({ where })
  ]);

  return {
    items: items.map(serializeTimelineEvent),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getEntityTimeline = async (
  entityType: string,
  entityId: string,
  input: PaginationInput
) => listTimelineEvents({ ...input, entityType, entityId });
