import { AlertStatus, IncidentStatus, Prisma } from "@prisma/client";

import { notFoundError } from "../../common/errors/app-error";
import {
  buildPagination,
  buildPaginationPayload,
  type PaginationInput
} from "../../common/http/pagination";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { prisma } from "../../config/prisma";

const alertInclude = {
  assignee: {
    select: {
      id: true,
      email: true
    }
  },
  resolver: {
    select: {
      id: true,
      email: true
    }
  }
} satisfies Prisma.AlertInclude;

const incidentInclude = {
  createdBy: {
    select: {
      id: true,
      email: true
    }
  }
} satisfies Prisma.IncidentInclude;

const serializeAlert = (alert: Prisma.AlertGetPayload<{ include: typeof alertInclude }>) => ({
  id: alert.id,
  type: alert.type,
  status: alert.status,
  severity: alert.severity,
  assignedTo: alert.assignee,
  resolvedBy: alert.resolver,
  relatedOrderId: alert.relatedOrderId,
  relatedPaymentId: alert.relatedPaymentId,
  relatedSecurityEventId: alert.relatedSecurityEventId,
  metadata: alert.metadata,
  createdAt: alert.createdAt,
  updatedAt: alert.updatedAt
});

const serializeIncident = (
  incident: Prisma.IncidentGetPayload<{ include: typeof incidentInclude }>
) => ({
  id: incident.id,
  status: incident.status,
  title: incident.title,
  summary: incident.summary,
  createdAt: incident.createdAt,
  updatedAt: incident.updatedAt,
  closedAt: incident.closedAt,
  createdBy: incident.createdBy,
  metadata: incident.metadata
});

const recordIncidentMutation = async (
  transaction: Prisma.TransactionClient,
  input: {
    actorAdminUserId: string;
    actionCode: string;
    entityType: "ALERT" | "INCIDENT";
    entityId: string;
    before?: unknown;
    after?: unknown;
    note?: string;
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
        note: input.note,
        metadata: toPrismaJsonValue({
          before: input.before,
          after: input.after
        })
      }
    }),
    transaction.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        screen: input.entityType === "ALERT" ? "security.alerts" : "security.incidents",
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        note: input.note,
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
          note: input.note,
          after: input.after
        })
      }
    })
  ]);
};

export const createAlert = async (input: {
  type: string;
  severity: Prisma.AlertCreateInput["severity"];
  relatedOrderId?: string;
  relatedPaymentId?: string;
  relatedSecurityEventId?: string;
  metadata?: Record<string, unknown>;
}) =>
  prisma.alert.create({
    data: {
      type: input.type,
      severity: input.severity,
      relatedOrderId: input.relatedOrderId,
      relatedPaymentId: input.relatedPaymentId,
      relatedSecurityEventId: input.relatedSecurityEventId,
      metadata: toPrismaJsonValue(input.metadata)
    }
  });

export const listAlerts = async (
  input: PaginationInput & {
    status?: Prisma.AlertWhereInput["status"];
    severity?: Prisma.AlertWhereInput["severity"];
    type?: string;
  }
) => {
  const where: Prisma.AlertWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.severity ? { severity: input.severity } : {}),
    ...(input.type ? { type: input.type } : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.alert.findMany({
      where,
      include: alertInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.alert.count({ where })
  ]);

  return {
    items: items.map(serializeAlert),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAlertDetail = async (alertId: string) => {
  const alert = await prisma.alert.findUnique({
    where: {
      id: alertId
    },
    include: alertInclude
  });

  if (!alert) {
    throw notFoundError("The requested alert was not found.");
  }

  return {
    entity: serializeAlert(alert)
  };
};

export const assignAlert = async (input: {
  actorAdminUserId: string;
  alertId: string;
  assignedToAdminUserId: string | null;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.alert.findUnique({
      where: {
        id: input.alertId
      },
      include: alertInclude
    });

    if (!existing) {
      throw notFoundError("The requested alert was not found.");
    }

    if (input.assignedToAdminUserId) {
      const assignee = await transaction.adminUser.findUnique({
        where: {
          id: input.assignedToAdminUserId
        }
      });

      if (!assignee) {
        throw notFoundError("The alert assignee was not found.");
      }
    }

    const updated = await transaction.alert.update({
      where: {
        id: existing.id
      },
      data: {
        assignedToAdminUserId: input.assignedToAdminUserId,
        status: input.assignedToAdminUserId ? AlertStatus.ASSIGNED : AlertStatus.OPEN
      },
      include: alertInclude
    });

    await recordIncidentMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "security.alerts.assign",
      entityType: "ALERT",
      entityId: updated.id,
      note: input.note,
      before: serializeAlert(existing),
      after: serializeAlert(updated)
    });

    return {
      entity: serializeAlert(updated)
    };
  });

export const resolveAlert = async (input: {
  actorAdminUserId: string;
  alertId: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.alert.findUnique({
      where: {
        id: input.alertId
      },
      include: alertInclude
    });

    if (!existing) {
      throw notFoundError("The requested alert was not found.");
    }

    const updated = await transaction.alert.update({
      where: {
        id: existing.id
      },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedByAdminUserId: input.actorAdminUserId
      },
      include: alertInclude
    });

    await recordIncidentMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "security.alerts.resolve",
      entityType: "ALERT",
      entityId: updated.id,
      note: input.note,
      before: serializeAlert(existing),
      after: serializeAlert(updated)
    });

    return {
      entity: serializeAlert(updated)
    };
  });

export const acknowledgeAlert = async (input: {
  actorAdminUserId: string;
  alertId: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.alert.findUnique({
      where: {
        id: input.alertId
      },
      include: alertInclude
    });

    if (!existing) {
      throw notFoundError("The requested alert was not found.");
    }

    if (existing.status === AlertStatus.RESOLVED) {
      return {
        entity: serializeAlert(existing),
        skipped: true as const
      };
    }

    const updated = await transaction.alert.update({
      where: {
        id: existing.id
      },
      data: {
        status: AlertStatus.ACKNOWLEDGED
      },
      include: alertInclude
    });

    await recordIncidentMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "security.alerts.acknowledge",
      entityType: "ALERT",
      entityId: updated.id,
      note: input.note,
      before: serializeAlert(existing),
      after: serializeAlert(updated)
    });

    return {
      entity: serializeAlert(updated),
      skipped: false as const
    };
  });

export const bulkAcknowledgeAlerts = async (input: {
  actorAdminUserId: string;
  alertIds: string[];
  note?: string;
}) => {
  const results: Array<{ alertId: string; ok: boolean; skipped?: boolean; error?: string }> = [];
  for (const alertId of input.alertIds) {
    try {
      const r = await acknowledgeAlert({
        actorAdminUserId: input.actorAdminUserId,
        alertId,
        note: input.note
      });
      results.push({ alertId, ok: true, skipped: r.skipped });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed";
      results.push({ alertId, ok: false, error: message });
    }
  }
  return { results };
};

export const bulkAssignAlerts = async (input: {
  actorAdminUserId: string;
  alertIds: string[];
  assignedToAdminUserId: string | null;
  note?: string;
}) => {
  const results: Array<{ alertId: string; ok: boolean; error?: string }> = [];
  for (const alertId of input.alertIds) {
    try {
      await assignAlert({
        actorAdminUserId: input.actorAdminUserId,
        alertId,
        assignedToAdminUserId: input.assignedToAdminUserId,
        note: input.note
      });
      results.push({ alertId, ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed";
      results.push({ alertId, ok: false, error: message });
    }
  }
  return { results };
};

export const listIncidents = async (
  input: PaginationInput & {
    status?: Prisma.IncidentWhereInput["status"];
    q?: string;
  }
) => {
  const where: Prisma.IncidentWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            {
              title: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              summary: {
                contains: input.q,
                mode: "insensitive"
              }
            }
          ]
        }
      : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: incidentInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.incident.count({ where })
  ]);

  return {
    items: items.map(serializeIncident),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getIncidentDetail = async (incidentId: string) => {
  const incident = await prisma.incident.findUnique({
    where: {
      id: incidentId
    },
    include: incidentInclude
  });

  if (!incident) {
    throw notFoundError("The requested incident was not found.");
  }

  return {
    entity: serializeIncident(incident)
  };
};

export const createIncident = async (input: {
  actorAdminUserId: string;
  title: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}) =>
  runInTransaction(async (transaction) => {
    const incident = await transaction.incident.create({
      data: {
        title: input.title,
        summary: input.summary,
        metadata: toPrismaJsonValue(input.metadata),
        createdByAdminUserId: input.actorAdminUserId
      },
      include: incidentInclude
    });

    await recordIncidentMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "security.incidents.create",
      entityType: "INCIDENT",
      entityId: incident.id,
      after: serializeIncident(incident)
    });

    return {
      entity: serializeIncident(incident)
    };
  });

export const updateIncident = async (input: {
  actorAdminUserId: string;
  incidentId: string;
  title?: string;
  summary?: string;
  status?: IncidentStatus;
  metadata?: Record<string, unknown>;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.incident.findUnique({
      where: {
        id: input.incidentId
      },
      include: incidentInclude
    });

    if (!existing) {
      throw notFoundError("The requested incident was not found.");
    }

    const status = input.status ?? existing.status;

    const existingMeta =
      typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};
    const nextMeta =
      input.metadata != null ? { ...existingMeta, ...input.metadata } : existingMeta;

    await transaction.incident.update({
      where: {
        id: existing.id
      },
      data: {
        title: input.title ?? existing.title,
        summary: input.summary ?? existing.summary,
        status,
        closedAt:
          status === "RESOLVED" || status === "CLOSED"
            ? existing.closedAt ?? new Date()
            : null,
        metadata: toPrismaJsonValue(nextMeta)
      },
    });

    const updated = await transaction.incident.findUnique({
      where: {
        id: existing.id
      },
      include: incidentInclude
    });

    if (!updated) {
      throw notFoundError("The updated incident could not be reloaded.");
    }

    await recordIncidentMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "security.incidents.update",
      entityType: "INCIDENT",
      entityId: updated.id,
      before: serializeIncident(existing),
      after: serializeIncident(updated)
    });

    return {
      entity: serializeIncident(updated)
    };
  });
