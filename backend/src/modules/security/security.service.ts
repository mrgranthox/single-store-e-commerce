import { IncidentStatus, Prisma, UserStatus } from "@prisma/client";

import { badRequestError, notFoundError } from "../../common/errors/app-error";
import {
  buildPagination,
  buildPaginationPayload,
  type PaginationInput
} from "../../common/http/pagination";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { prisma } from "../../config/prisma";

const readClientIpFromJson = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const m = metadata as Record<string, unknown>;
  for (const k of ["ip", "ipAddress", "sourceIp", "clientIp", "ip_address"]) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }
  return null;
};

const securityEventInclude = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  },
  adminUser: {
    select: {
      id: true,
      email: true
    }
  }
} satisfies Prisma.SecurityEventInclude;

const riskSignalInclude = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  }
} satisfies Prisma.RiskSignalInclude;

const loginEventInclude = {
  user: {
    select: {
      id: true,
      email: true
    }
  },
  adminUser: {
    select: {
      id: true,
      email: true
    }
  }
} satisfies Prisma.LoginEventInclude;

const serializeSecurityEvent = (
  item: Prisma.SecurityEventGetPayload<{ include: typeof securityEventInclude }>
) => ({
  id: item.id,
  type: item.type,
  severity: item.severity,
  status: item.status,
  createdAt: item.createdAt,
  resolvedAt: item.resolvedAt,
  metadata: item.metadata,
  user: item.user
    ? {
        id: item.user.id,
        email: item.user.email,
        name: [item.user.firstName, item.user.lastName].filter(Boolean).join(" ") || null
      }
    : null,
  adminUser: item.adminUser
});

const serializeRiskSignal = (
  item: Prisma.RiskSignalGetPayload<{ include: typeof riskSignalInclude }>
) => ({
  id: item.id,
  type: item.type,
  score: item.score,
  createdAt: item.createdAt,
  reviewedAt: item.reviewedAt,
  adminReviewedByAdminUserId: item.adminReviewedByAdminUserId,
  metadata: item.metadata,
  user: item.user
    ? {
        id: item.user.id,
        email: item.user.email,
        name: [item.user.firstName, item.user.lastName].filter(Boolean).join(" ") || null
      }
    : null
});

const serializeLoginEvent = (
  item: Prisma.LoginEventGetPayload<{ include: typeof loginEventInclude }>
) => ({
  id: item.id,
  email: item.email,
  success: item.success,
  failureReason: item.failureReason,
  ipCountry: item.ipCountry,
  ipRegion: item.ipRegion,
  userAgent: item.userAgent,
  createdAt: item.createdAt,
  user: item.user,
  adminUser: item.adminUser
});

export const getSecurityDashboard = async () => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    openSecurityEvents,
    criticalSecurityEvents,
    unreviewedRiskSignals,
    recentLoginFailures,
    openAlerts,
    recentEvents,
    topRiskSignals,
    openIncidents,
    suspendedAccounts,
    flaggedTransactionsLast24h,
    activeAlertsList,
    openIncidentsList,
    alertsOpenBySeverityGroups,
    incidentOpenOnly,
    incidentInvestigatingOnly,
    incidentsClosedLast7d,
    unreviewedRiskSignalsScoreGte70
  ] = await Promise.all([
    prisma.securityEvent.count({
      where: {
        resolvedAt: null
      }
    }),
    prisma.securityEvent.count({
      where: {
        severity: "CRITICAL",
        createdAt: {
          gte: since24h
        }
      }
    }),
    prisma.riskSignal.count({
      where: {
        reviewedAt: null
      }
    }),
    prisma.loginEvent.count({
      where: {
        success: false,
        createdAt: {
          gte: since24h
        }
      }
    }),
    prisma.alert.count({
      where: {
        status: {
          in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED"]
        }
      }
    }),
    prisma.securityEvent.findMany({
      include: securityEventInclude,
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    }),
    prisma.riskSignal.findMany({
      include: riskSignalInclude,
      orderBy: {
        score: "desc"
      },
      take: 10
    }),
    prisma.incident.count({
      where: {
        status: {
          in: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING]
        }
      }
    }),
    prisma.user.count({
      where: { status: UserStatus.SUSPENDED }
    }),
    prisma.riskSignal.count({
      where: {
        createdAt: { gte: since24h }
      }
    }),
    prisma.alert.findMany({
      where: {
        status: {
          in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED"]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        assignee: { select: { email: true } }
      }
    }),
    prisma.incident.findMany({
      where: {
        status: {
          in: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        createdBy: { select: { email: true } }
      }
    }),
    prisma.alert.groupBy({
      by: ["severity"],
      where: {
        status: {
          in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED"]
        }
      },
      _count: true
    }),
    prisma.incident.count({
      where: { status: IncidentStatus.OPEN }
    }),
    prisma.incident.count({
      where: { status: IncidentStatus.INVESTIGATING }
    }),
    prisma.incident.findMany({
      where: {
        status: {
          in: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED]
        },
        closedAt: {
          gte: since7d
        }
      },
      select: {
        createdAt: true,
        closedAt: true
      }
    }),
    prisma.riskSignal.count({
      where: {
        reviewedAt: null,
        score: {
          gte: 70
        }
      }
    })
  ]);

  const alertsOpenBySeverity: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0
  };
  for (const row of alertsOpenBySeverityGroups) {
    alertsOpenBySeverity[row.severity] = row._count;
  }

  let avgMttrHoursLast7Days: number | null = null;
  if (incidentsClosedLast7d.length > 0) {
    const totalHours = incidentsClosedLast7d.reduce((acc, row) => {
      if (!row.closedAt) {
        return acc;
      }
      return acc + (row.closedAt.getTime() - row.createdAt.getTime()) / 3_600_000;
    }, 0);
    avgMttrHoursLast7Days = totalHours / incidentsClosedLast7d.length;
  }

  return {
    metrics: {
      openSecurityEvents,
      criticalSecurityEventsLast24Hours: criticalSecurityEvents,
      unreviewedRiskSignals,
      failedLoginsLast24Hours: recentLoginFailures,
      openAlerts,
      openIncidents,
      suspendedAccounts,
      flaggedTransactionsLast24h,
      alertsOpenBySeverity,
      incidentsOps: {
        open: incidentOpenOnly,
        investigating: incidentInvestigatingOnly,
        resolvedOrClosedLast7Days: incidentsClosedLast7d.length,
        avgMttrHoursLast7Days
      },
      riskSignalsOps: {
        unreviewedScoreGte70: unreviewedRiskSignalsScoreGte70,
        createdLast24h: flaggedTransactionsLast24h
      }
    },
    recentSecurityEvents: recentEvents.map(serializeSecurityEvent),
    topRiskSignals: topRiskSignals.map(serializeRiskSignal),
    activeAlertsList: activeAlertsList.map((alertRow) => ({
      id: alertRow.id,
      type: alertRow.type,
      severity: alertRow.severity,
      status: alertRow.status,
      assignedToEmail: alertRow.assignee?.email ?? null,
      createdAt: alertRow.createdAt
    })),
    openIncidentsList: openIncidentsList.map((incidentRow) => ({
      id: incidentRow.id,
      title: incidentRow.title,
      status: incidentRow.status,
      createdAt: incidentRow.createdAt,
      ownerEmail: incidentRow.createdBy?.email ?? null
    }))
  };
};

export const listSecurityEvents = async (
  input: PaginationInput & {
    severity?: Prisma.SecurityEventWhereInput["severity"];
    status?: string;
    type?: string;
    userId?: string;
    adminUserId?: string;
  }
) => {
  const where: Prisma.SecurityEventWhereInput = {
    ...(input.severity ? { severity: input.severity } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.adminUserId ? { adminUserId: input.adminUserId } : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      include: securityEventInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.securityEvent.count({ where })
  ]);

  return {
    items: items.map(serializeSecurityEvent),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getSecurityEventDetail = async (eventId: string) => {
  const item = await prisma.securityEvent.findUnique({
    where: {
      id: eventId
    },
    include: securityEventInclude
  });

  if (!item) {
    throw notFoundError("The requested security event was not found.");
  }

  return {
    entity: serializeSecurityEvent(item)
  };
};

export const resolveSecurityEvent = async (input: {
  actorAdminUserId: string;
  eventId: string;
  nextStatus: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.securityEvent.findUnique({
      where: {
        id: input.eventId
      },
      include: securityEventInclude
    });

    if (!existing) {
      throw notFoundError("The requested security event was not found.");
    }

    const updated = await transaction.securityEvent.update({
      where: {
        id: existing.id
      },
      data: {
        status: input.nextStatus,
        resolvedAt: new Date(),
        metadata: toPrismaJsonValue({
          ...(typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
            ? (existing.metadata as Record<string, unknown>)
            : {}),
          resolutionNote: input.note
        })
      },
      include: securityEventInclude
    });

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "security.events.resolve",
          entityType: "SECURITY_EVENT",
          entityId: updated.id,
          note: input.note,
          metadata: toPrismaJsonValue({
            before: serializeSecurityEvent(existing),
            after: serializeSecurityEvent(updated)
          })
        }
      }),
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "security.events",
          actionCode: "security.events.resolve",
          entityType: "SECURITY_EVENT",
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
          entityType: "SECURITY_EVENT",
          entityId: updated.id,
          eventType: "SECURITY_EVENT_RESOLVED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            note: input.note,
            nextStatus: input.nextStatus
          })
        }
      })
    ]);

    return {
      entity: serializeSecurityEvent(updated)
    };
  });

export const listRiskSignals = async (
  input: PaginationInput & {
    type?: string;
    userId?: string;
    minScore?: number;
    reviewed?: boolean;
  }
) => {
  const where: Prisma.RiskSignalWhereInput = {
    ...(input.type ? { type: input.type } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.minScore != null ? { score: { gte: input.minScore } } : {}),
    ...(input.reviewed != null
      ? input.reviewed
        ? { reviewedAt: { not: null } }
        : { reviewedAt: null }
      : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.riskSignal.findMany({
      where,
      include: riskSignalInclude,
      orderBy: [
        {
          reviewedAt: "asc"
        },
        {
          score: "desc"
        }
      ],
      ...buildPagination(input)
    }),
    prisma.riskSignal.count({ where })
  ]);

  return {
    items: items.map(serializeRiskSignal),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const reviewRiskSignal = async (input: {
  actorAdminUserId: string;
  riskSignalId: string;
  note?: string;
  disposition?: "reviewed" | "escalated";
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.riskSignal.findUnique({
      where: {
        id: input.riskSignalId
      },
      include: riskSignalInclude
    });

    if (!existing) {
      throw notFoundError("The requested risk signal was not found.");
    }

    const disposition = input.disposition ?? "reviewed";
    const baseMeta =
      typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};

    if (disposition === "escalated") {
      const escalations = Array.isArray(baseMeta.escalations) ? [...(baseMeta.escalations as unknown[])] : [];
      escalations.push({
        at: new Date().toISOString(),
        actorAdminUserId: input.actorAdminUserId,
        note: input.note ?? null
      });
      const updated = await transaction.riskSignal.update({
        where: {
          id: existing.id
        },
        data: {
          metadata: toPrismaJsonValue({
            ...baseMeta,
            escalations
          })
        },
        include: riskSignalInclude
      });

      await Promise.all([
        transaction.auditLog.create({
          data: {
            actorType: "ADMIN",
            actorAdminUserId: input.actorAdminUserId,
            actionCode: "security.risk.escalate",
            entityType: "RISK_SIGNAL",
            entityId: updated.id,
            note: input.note,
            metadata: toPrismaJsonValue({
              before: serializeRiskSignal(existing),
              after: serializeRiskSignal(updated)
            })
          }
        }),
        transaction.adminActionLog.create({
          data: {
            adminUserId: input.actorAdminUserId,
            screen: "security.risk-signals",
            actionCode: "security.risk.escalate",
            entityType: "RISK_SIGNAL",
            entityId: updated.id,
            note: input.note,
            before: toPrismaJsonValue(serializeRiskSignal(existing)),
            after: toPrismaJsonValue(serializeRiskSignal(updated))
          }
        }),
        transaction.timelineEvent.create({
          data: {
            entityType: "RISK_SIGNAL",
            entityId: updated.id,
            eventType: "RISK_SIGNAL_ESCALATED",
            actorAdminUserId: input.actorAdminUserId,
            actorType: "ADMIN",
            payload: toPrismaJsonValue({
              note: input.note
            })
          }
        })
      ]);

      return {
        entity: serializeRiskSignal(updated),
        disposition: "escalated" as const
      };
    }

    const updated = await transaction.riskSignal.update({
      where: {
        id: existing.id
      },
      data: {
        adminReviewedByAdminUserId: input.actorAdminUserId,
        reviewedAt: new Date(),
        metadata: toPrismaJsonValue({
          ...baseMeta,
          reviewNote: input.note
        })
      },
      include: riskSignalInclude
    });

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "security.risk.review",
          entityType: "RISK_SIGNAL",
          entityId: updated.id,
          note: input.note,
          metadata: toPrismaJsonValue({
            before: serializeRiskSignal(existing),
            after: serializeRiskSignal(updated)
          })
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "RISK_SIGNAL",
          entityId: updated.id,
          eventType: "RISK_SIGNAL_REVIEWED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            note: input.note
          })
        }
      })
    ]);

    return {
      entity: serializeRiskSignal(updated),
      disposition: "reviewed" as const
    };
  });

export const notifySecurityEventFollowUp = async (input: {
  actorAdminUserId: string;
  eventId: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.securityEvent.findUnique({
      where: {
        id: input.eventId
      },
      include: securityEventInclude
    });

    if (!existing) {
      throw notFoundError("The requested security event was not found.");
    }

    const alert = await transaction.alert.create({
      data: {
        type: "SECURITY_EVENT_FOLLOW_UP",
        severity: existing.severity,
        relatedSecurityEventId: existing.id,
        metadata: toPrismaJsonValue({
          source: "security_event_notify",
          note: input.note ?? null
        })
      }
    });

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "security.events.notify",
          entityType: "SECURITY_EVENT",
          entityId: existing.id,
          note: input.note,
          metadata: toPrismaJsonValue({
            alertId: alert.id
          })
        }
      }),
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "security.events",
          actionCode: "security.events.notify",
          entityType: "SECURITY_EVENT",
          entityId: existing.id,
          note: input.note,
          after: toPrismaJsonValue({
            alertId: alert.id
          })
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "SECURITY_EVENT",
          entityId: existing.id,
          eventType: "SECURITY_EVENT_NOTIFY",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            alertId: alert.id,
            note: input.note
          })
        }
      })
    ]);

    return {
      alertId: alert.id,
      entity: serializeSecurityEvent(existing)
    };
  });

export const requestSecurityEventIpBlock = async (input: {
  actorAdminUserId: string;
  eventId: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const existing = await transaction.securityEvent.findUnique({
      where: {
        id: input.eventId
      },
      include: securityEventInclude
    });

    if (!existing) {
      throw notFoundError("The requested security event was not found.");
    }

    const ip = readClientIpFromJson(existing.metadata);
    if (!ip) {
      throw badRequestError("No client IP is present on this event metadata.");
    }

    const prev =
      typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};
    const requests = Array.isArray(prev.ipBlockRequests) ? [...(prev.ipBlockRequests as unknown[])] : [];
    requests.push({
      requestedAt: new Date().toISOString(),
      actorAdminUserId: input.actorAdminUserId,
      ip,
      note: input.note ?? null
    });

    const updated = await transaction.securityEvent.update({
      where: {
        id: existing.id
      },
      data: {
        metadata: toPrismaJsonValue({
          ...prev,
          ipBlockRequests: requests
        })
      },
      include: securityEventInclude
    });

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "security.events.ip_block_request",
          entityType: "SECURITY_EVENT",
          entityId: existing.id,
          note: input.note,
          metadata: toPrismaJsonValue({
            ip,
            before: serializeSecurityEvent(existing),
            after: serializeSecurityEvent(updated)
          })
        }
      }),
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "security.events",
          actionCode: "security.events.ip_block_request",
          entityType: "SECURITY_EVENT",
          entityId: existing.id,
          note: input.note,
          before: toPrismaJsonValue(serializeSecurityEvent(existing)),
          after: toPrismaJsonValue(serializeSecurityEvent(updated))
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "SECURITY_EVENT",
          entityId: existing.id,
          eventType: "SECURITY_EVENT_IP_BLOCK_REQUESTED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            ip,
            note: input.note
          })
        }
      })
    ]);

    return {
      entity: serializeSecurityEvent(updated)
    };
  });

export const listLoginEvents = async (
  input: PaginationInput & {
    success?: boolean;
    email?: string;
  }
) => {
  const where: Prisma.LoginEventWhereInput = {
    ...(input.success != null ? { success: input.success } : {}),
    ...(input.email
      ? {
          email: {
            contains: input.email,
            mode: "insensitive"
          }
        }
      : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.loginEvent.findMany({
      where,
      include: loginEventInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.loginEvent.count({ where })
  ]);

  return {
    items: items.map(serializeLoginEvent),
    pagination: buildPaginationPayload(input, totalItems)
  };
};
