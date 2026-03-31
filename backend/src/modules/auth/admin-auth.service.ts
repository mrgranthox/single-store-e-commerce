import { createHash, randomBytes } from "node:crypto";

import { AdminStatus } from "@prisma/client";

import {
  invalidCredentialsError,
  invalidInputError,
  notFoundError,
  serviceUnavailableError
} from "../../common/errors/app-error";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { env } from "../../config/env";
import { clerkClient } from "../../config/clerk";
import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";
import { enqueueNotification } from "../notifications/notifications.service";
import { loadAdminAuthorization } from "../roles-permissions/rbac.service";
import {
  issueAdminApiSession,
  revokeAdminApiSessionBySessionId,
  revokeAdminApiSessionsForAdmin,
  rotateAdminApiSession
} from "./admin-api-session.service";

const PASSWORD_RESET_TTL_MINUTES = 60;
const STEP_UP_PURPOSE = "STEP_UP";

const normalizeOptionalString = (value?: string) => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const ADMIN_LOGIN_REJECTED_MESSAGE = "Invalid email or password.";
const hashChallengeToken = (token: string) => createHash("sha256").update(token).digest("hex");
const buildChallengeToken = () => `eact_${randomBytes(24).toString("base64url")}`;
const addMinutes = (value: Date, minutes: number) => new Date(value.getTime() + minutes * 60_000);

const createAdminAuthChallenge = async (input: {
  adminUserId: string;
  email: string;
  purpose: "PASSWORD_RESET" | typeof STEP_UP_PURPOSE;
  ttlMinutes: number;
}) => {
  await prisma.adminAuthChallenge.updateMany({
    where: {
      adminUserId: input.adminUserId,
      purpose: input.purpose,
      consumedAt: null
    },
    data: {
      consumedAt: new Date()
    }
  });

  const token = buildChallengeToken();

  await prisma.adminAuthChallenge.create({
    data: {
      adminUserId: input.adminUserId,
      purpose: input.purpose,
      tokenHash: hashChallengeToken(token),
      email: input.email,
      expiresAt: addMinutes(new Date(), input.ttlMinutes)
    }
  });

  return {
    token,
    expiresInMinutes: input.ttlMinutes
  };
};

const consumeAdminAuthChallenge = async (input: {
  token: string;
  purpose: "PASSWORD_RESET" | typeof STEP_UP_PURPOSE;
}) => {
  const challenge = await prisma.adminAuthChallenge.findUnique({
    where: {
      tokenHash: hashChallengeToken(input.token)
    },
    include: {
      adminUser: true
    }
  });

  if (
    !challenge ||
    challenge.purpose !== input.purpose ||
    challenge.consumedAt ||
    challenge.expiresAt <= new Date()
  ) {
    throw invalidInputError("The supplied token is invalid or expired.");
  }

  await prisma.adminAuthChallenge.update({
    where: {
      id: challenge.id
    },
    data: {
      consumedAt: new Date()
    }
  });

  return challenge;
};

const recordAdminLoginEvent = async (input: {
  adminUserId?: string | null;
  email: string;
  success: boolean;
  failureReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) => {
  await prisma.loginEvent.create({
    data: {
      adminUserId: input.adminUserId ?? null,
      email: input.email,
      success: input.success,
      failureReason: input.failureReason ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null
    }
  });
};

const createAdminSessionAnomalyEvent = async (input: {
  adminUserId: string;
  currentSessionId?: string | null;
  currentIpAddress?: string | null;
  currentDeviceLabel?: string | null;
  previousIpAddress?: string | null;
  previousDeviceLabel?: string | null;
  anomalyType: "NEW_DEVICE" | "IP_ADDRESS_CHANGED";
}) =>
  prisma.securityEvent.create({
    data: {
      adminUserId: input.adminUserId,
      severity: "MEDIUM",
      type: "ADMIN_SESSION_ANOMALY",
      metadata: toPrismaJsonValue({
        sessionId: input.currentSessionId ?? null,
        anomalyType: input.anomalyType,
        currentIpAddress: input.currentIpAddress ?? null,
        currentDeviceLabel: input.currentDeviceLabel ?? null,
        previousIpAddress: input.previousIpAddress ?? null,
        previousDeviceLabel: input.previousDeviceLabel ?? null
      })
    }
  });

const detectAdminSessionAnomalies = async (input: {
  adminUserId: string;
  currentSessionId?: string | null;
  currentIpAddress?: string | null;
  currentDeviceLabel?: string | null;
}) => {
  if (!env.ADMIN_SESSION_ANOMALY_DETECTION_ENABLED) {
    return [];
  }

  const previousSessions = await prisma.sessionMetadata.findMany({
    where: {
      adminUserId: input.adminUserId,
      sessionType: "admin",
      revokedAt: null,
      ...(input.currentSessionId
        ? {
            sessionId: {
              not: input.currentSessionId
            }
          }
        : {})
    },
    orderBy: {
      lastActiveAt: "desc"
    },
    take: 5
  });

  if (previousSessions.length === 0) {
    return [];
  }

  const latestSession = previousSessions[0] ?? null;
  const events: Promise<unknown>[] = [];

  if (
    input.currentDeviceLabel &&
    latestSession?.deviceLabel &&
    latestSession.deviceLabel !== input.currentDeviceLabel
  ) {
    events.push(
      createAdminSessionAnomalyEvent({
        adminUserId: input.adminUserId,
        currentSessionId: input.currentSessionId,
        currentIpAddress: input.currentIpAddress,
        currentDeviceLabel: input.currentDeviceLabel,
        previousIpAddress: latestSession.ipAddress,
        previousDeviceLabel: latestSession.deviceLabel,
        anomalyType: "NEW_DEVICE"
      })
    );
  }

  if (
    input.currentIpAddress &&
    latestSession?.ipAddress &&
    latestSession.ipAddress !== input.currentIpAddress
  ) {
    events.push(
      createAdminSessionAnomalyEvent({
        adminUserId: input.adminUserId,
        currentSessionId: input.currentSessionId,
        currentIpAddress: input.currentIpAddress,
        currentDeviceLabel: input.currentDeviceLabel,
        previousIpAddress: latestSession.ipAddress,
        previousDeviceLabel: latestSession.deviceLabel,
        anomalyType: "IP_ADDRESS_CHANGED"
      })
    );
  }

  if (events.length === 0) {
    return [];
  }

  return Promise.all(events);
};

const serializeSession = (session: {
  sessionId: string;
  sessionType: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  ipCountry: string | null;
  ipRegion: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  revokedAt: Date | null;
}) => ({
  sessionId: session.sessionId,
  sessionType: session.sessionType,
  deviceLabel: session.deviceLabel,
  ipAddress: session.ipAddress,
  ipCountry: session.ipCountry,
  ipRegion: session.ipRegion,
  createdAt: session.createdAt,
  lastActiveAt: session.lastActiveAt,
  revokedAt: session.revokedAt
});

export const loginAdmin = async (input: {
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) => {
  const email = normalizeEmail(input.email);

  const adminAuthorization = await prisma.adminUser.findUnique({
    where: {
      email
    },
    include: {
      roles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!adminAuthorization) {
    await recordAdminLoginEvent({
      email,
      success: false,
      failureReason: "UNKNOWN_EMAIL",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });
    throw invalidCredentialsError(ADMIN_LOGIN_REJECTED_MESSAGE);
  }

  try {
    await clerkClient.users.verifyPassword({
      userId: adminAuthorization.clerkAdminUserId,
      password: input.password
    });
  } catch {
    await recordAdminLoginEvent({
      adminUserId: adminAuthorization.id,
      email,
      success: false,
      failureReason: "INVALID_PASSWORD",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });
    throw invalidCredentialsError(ADMIN_LOGIN_REJECTED_MESSAGE);
  }

  if (adminAuthorization.status === AdminStatus.LOCKED) {
    await recordAdminLoginEvent({
      adminUserId: adminAuthorization.id,
      email,
      success: false,
      failureReason: "LOCKED",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });
    throw invalidCredentialsError(ADMIN_LOGIN_REJECTED_MESSAGE);
  }

  if (
    adminAuthorization.status === AdminStatus.SUSPENDED ||
    adminAuthorization.status === AdminStatus.DEACTIVATED
  ) {
    await recordAdminLoginEvent({
      adminUserId: adminAuthorization.id,
      email,
      success: false,
      failureReason: adminAuthorization.status,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });
    throw invalidCredentialsError(ADMIN_LOGIN_REJECTED_MESSAGE);
  }

  const permissions = [
    ...new Set(
      adminAuthorization.roles.flatMap((entry) =>
        entry.role.rolePermissions.map((rolePermission) => rolePermission.permission.code)
      )
    )
  ];

  const session = await issueAdminApiSession({
    adminUserId: adminAuthorization.id,
    deviceLabel: input.userAgent ?? null,
    ipAddress: input.ipAddress ?? null
  });

  await recordAdminLoginEvent({
    adminUserId: adminAuthorization.id,
    email,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent
  });

  await detectAdminSessionAnomalies({
    adminUserId: adminAuthorization.id,
    currentSessionId: session.sessionId,
    currentIpAddress: input.ipAddress,
    currentDeviceLabel: input.userAgent
  });

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresInSeconds: session.accessTokenExpiresInSeconds,
    admin: {
      id: adminAuthorization.id,
      email: adminAuthorization.email,
      status: adminAuthorization.status
    },
    roles: adminAuthorization.roles.map((entry) => ({
      id: entry.role.id,
      code: entry.role.code,
      name: entry.role.name
    })),
    permissions,
    session: {
      sessionId: session.sessionId,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt
    }
  };
};

export const refreshAdminSession = async (input: {
  refreshToken: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) => {
  const refreshed = await rotateAdminApiSession({
    refreshToken: input.refreshToken,
    ipAddress: input.ipAddress,
    deviceLabel: input.userAgent
  });
  const permissions = [
    ...new Set(
      refreshed.adminUser.roles.flatMap((entry) =>
        entry.role.rolePermissions.map((rolePermission) => rolePermission.permission.code)
      )
    )
  ];

  await detectAdminSessionAnomalies({
    adminUserId: refreshed.adminUser.id,
    currentSessionId: refreshed.sessionId,
    currentIpAddress: input.ipAddress,
    currentDeviceLabel: input.userAgent
  });

  return {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresInSeconds: refreshed.accessTokenExpiresInSeconds,
    admin: {
      id: refreshed.adminUser.id,
      email: refreshed.adminUser.email,
      status: refreshed.adminUser.status
    },
    roles: refreshed.adminUser.roles.map((entry) => ({
      id: entry.role.id,
      code: entry.role.code,
      name: entry.role.name
    })),
    permissions
  };
};

export const createAdminStepUpToken = async (input: {
  adminUserId: string;
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) => {
  const adminUser = await prisma.adminUser.findUnique({
    where: {
      id: input.adminUserId
    }
  });

  if (!adminUser || adminUser.email !== normalizeEmail(input.email)) {
    throw invalidCredentialsError(ADMIN_LOGIN_REJECTED_MESSAGE);
  }

  const bypassStepUpVerification =
    env.NODE_ENV === "test" && env.ALLOW_DEV_AUTH_BYPASS;

  if (!bypassStepUpVerification) {
    try {
      await clerkClient.users.verifyPassword({
        userId: adminUser.clerkAdminUserId,
        password: input.password
      });
    } catch {
      throw invalidCredentialsError(ADMIN_LOGIN_REJECTED_MESSAGE);
    }
  }

  const challenge = await createAdminAuthChallenge({
    adminUserId: adminUser.id,
    email: adminUser.email,
    purpose: STEP_UP_PURPOSE,
    ttlMinutes: env.ADMIN_STEP_UP_TTL_MINUTES
  });

  await prisma.securityEvent.create({
    data: {
      adminUserId: adminUser.id,
      severity: "INFO",
      type: "ADMIN_STEP_UP_ISSUED",
      metadata: toPrismaJsonValue({
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        expiresInMinutes: challenge.expiresInMinutes
      })
    }
  });

  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorAdminUserId: adminUser.id,
        actionCode: "admin.auth.step_up",
        entityType: "ADMIN_USER",
        entityId: adminUser.id,
        metadata: toPrismaJsonValue({
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          expiresInMinutes: challenge.expiresInMinutes
        })
      }
    }),
    prisma.adminActionLog.create({
      data: {
        adminUserId: adminUser.id,
        screen: "admin_profile_sessions",
        actionCode: "admin.auth.step_up",
        entityType: "ADMIN_USER",
        entityId: adminUser.id,
        before: toPrismaJsonValue({
          email: adminUser.email
        }),
        after: toPrismaJsonValue({
          tokenIssued: true,
          expiresInMinutes: challenge.expiresInMinutes
        })
      }
    })
  ]);

  return {
    token: challenge.token,
    expiresInMinutes: challenge.expiresInMinutes
  };
};

export const consumeAdminStepUpToken = async (input: {
  token: string;
  adminUserId: string;
}) => {
  const challenge = await consumeAdminAuthChallenge({
    token: input.token,
    purpose: STEP_UP_PURPOSE
  });

  if (challenge.adminUserId !== input.adminUserId) {
    throw invalidCredentialsError("The step-up token does not belong to the current admin.");
  }

  return {
    ok: true
  };
};

export const forgotAdminPassword = async (input: { email: string }) => {
  const email = normalizeEmail(input.email);
  const adminUser = await prisma.adminUser.findUnique({
    where: {
      email
    }
  });

  if (!adminUser) {
    return {
      submitted: true
    };
  }

  const challenge = await createAdminAuthChallenge({
    adminUserId: adminUser.id,
    email: adminUser.email,
    purpose: "PASSWORD_RESET",
    ttlMinutes: PASSWORD_RESET_TTL_MINUTES
  });

  try {
    await enqueueNotification({
      type: "PASSWORD_RESET",
      recipientEmail: adminUser.email,
      recipientType: "ADMIN",
      payload: {
        resetUrl: `${env.ADMIN_APP_URL}/admin/reset-password?token=${encodeURIComponent(challenge.token)}`,
        expiryMinutes: challenge.expiresInMinutes
      }
    });
  } catch (err) {
    logger.error(
      { err, adminUserId: adminUser.id },
      "admin.forgotPassword: notification enqueue failed — challenge created, email not sent"
    );
  }

  return {
    submitted: true
  };
};

export const resetAdminPassword = async (input: {
  token: string;
  newPassword: string;
}) => {
  const challenge = await consumeAdminAuthChallenge({
    token: input.token,
    purpose: "PASSWORD_RESET"
  });

  try {
    await clerkClient.users.updateUser(challenge.adminUser.clerkAdminUserId, {
      password: input.newPassword,
      signOutOfOtherSessions: true
    });
  } catch (error) {
    throw serviceUnavailableError("The admin password could not be reset in the identity provider.", {
      cause: error
    });
  }

  await prisma.sessionMetadata.updateMany({
    where: {
      adminUserId: challenge.adminUser.id,
      sessionType: "admin"
    },
    data: {
      revokedAt: new Date()
    }
  });

  await revokeAdminApiSessionsForAdmin({
    adminUserId: challenge.adminUser.id
  });

  await enqueueNotification({
    type: "PASSWORD_CHANGED",
    recipientEmail: challenge.adminUser.email,
    recipientType: "ADMIN",
    payload: {
      changedAt: new Date().toISOString()
    }
  });

  return {
    reset: true
  };
};

export const getCurrentAdminShell = async (input: {
  adminUserId: string;
  sessionId?: string | null;
}) => {
  const authorization = await loadAdminAuthorization({
    adminUserId: input.adminUserId
  });

  if (!authorization) {
    throw notFoundError("The admin account was not found.");
  }

  const [currentSession, sessionStats, recentSecurityEvents] = await Promise.all([
    input.sessionId
      ? prisma.sessionMetadata.findFirst({
          where: {
            sessionId: input.sessionId,
            adminUserId: input.adminUserId,
            sessionType: "admin"
          }
        })
      : null,
    prisma.sessionMetadata.groupBy({
      by: ["revokedAt"],
      where: {
        adminUserId: input.adminUserId,
        sessionType: "admin"
      },
      _count: {
        _all: true
      }
    }),
    prisma.securityEvent.count({
      where: {
        adminUserId: input.adminUserId,
        resolvedAt: null
      }
    })
  ]);

  const totalSessions = sessionStats.reduce((sum, item) => sum + item._count._all, 0);
  const activeSessions = sessionStats
    .filter((item) => item.revokedAt === null)
    .reduce((sum, item) => sum + item._count._all, 0);

  return {
    admin: {
      id: authorization.adminUser.id,
      email: authorization.adminUser.email,
      status: authorization.adminUser.status,
      createdAt: authorization.adminUser.createdAt,
      updatedAt: authorization.adminUser.updatedAt
    },
    roles: authorization.adminUser.roles.map((roleAssignment) => ({
      id: roleAssignment.role.id,
      code: roleAssignment.role.code,
      name: roleAssignment.role.name
    })),
    permissions: authorization.permissions,
    session: currentSession ? serializeSession(currentSession) : null,
    security: {
      accountStatus: authorization.adminUser.status,
      totalSessions,
      activeSessions,
      openSecurityEvents: recentSecurityEvents,
      stepUpRequiredForSensitiveActions: env.ADMIN_REQUIRE_STEP_UP_FOR_SENSITIVE_ACTIONS
    },
    featureFlags: {
      canAccessAdmin: authorization.adminUser.status === AdminStatus.ACTIVE
    }
  };
};

export const listAdminSessionsForSelf = async (adminUserId: string) => {
  const sessions = await prisma.sessionMetadata.findMany({
    where: {
      adminUserId,
      sessionType: "admin"
    },
    orderBy: [{ revokedAt: "asc" }, { lastActiveAt: "desc" }]
  });

  return {
    items: sessions.map(serializeSession),
    total: sessions.length,
    active: sessions.filter((session) => session.revokedAt === null).length
  };
};

export const revokeAdminSessionForSelf = async (input: {
  actorAdminUserId: string;
  targetSessionId: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const session = await transaction.sessionMetadata.findFirst({
      where: {
        sessionId: input.targetSessionId,
        adminUserId: input.actorAdminUserId,
        sessionType: "admin"
      }
    });

    if (!session) {
      throw notFoundError("The requested admin session was not found.");
    }

    if (!session.revokedAt) {
      await transaction.sessionMetadata.update({
        where: {
          id: session.id
        },
        data: {
          revokedAt: new Date()
        }
      });
    }

    const reason = normalizeOptionalString(input.reason);
    const note = normalizeOptionalString(input.note);

    await Promise.all([
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "admin_profile_sessions",
          actionCode: "admin.auth.sessions.revoke",
          reason,
          note,
          entityType: "SESSION",
          entityId: session.sessionId,
          before: toPrismaJsonValue({ revokedAt: session.revokedAt }),
          after: toPrismaJsonValue({ revokedAt: new Date().toISOString() })
        }
      }),
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "admin.auth.sessions.revoke",
          entityType: "SESSION",
          entityId: session.sessionId,
          reason,
          note,
          metadata: toPrismaJsonValue({
            sessionId: session.sessionId,
            wasAlreadyRevoked: Boolean(session.revokedAt)
          })
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "SESSION",
          entityId: session.sessionId,
          eventType: "SESSION_REVOKED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            reason,
            note
          })
        }
      })
    ]);

    return {
      sessionId: session.sessionId,
      revokedAt: session.revokedAt ?? new Date(),
      alreadyRevoked: Boolean(session.revokedAt)
    };
  }).then(async (result) => {
    await revokeAdminApiSessionBySessionId(result.sessionId);
    return result;
  });

export const revokeOtherAdminSessionsForSelf = async (input: {
  actorAdminUserId: string;
  currentSessionId?: string | null;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const activeSessions = await transaction.sessionMetadata.findMany({
      where: {
        adminUserId: input.actorAdminUserId,
        sessionType: "admin",
        revokedAt: null,
        ...(input.currentSessionId
          ? {
              sessionId: {
                not: input.currentSessionId
              }
            }
          : {})
      },
      select: {
        id: true,
        sessionId: true
      }
    });

    if (activeSessions.length > 0) {
      await transaction.sessionMetadata.updateMany({
        where: {
          id: {
            in: activeSessions.map((session) => session.id)
          }
        },
        data: {
          revokedAt: new Date()
        }
      });
    }

    const reason = normalizeOptionalString(input.reason);
    const note = normalizeOptionalString(input.note);

    await Promise.all([
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "admin_profile_sessions",
          actionCode: "admin.auth.sessions.revoke_all_other",
          reason,
          note,
          entityType: "SESSION",
          entityId: input.actorAdminUserId,
          before: toPrismaJsonValue({
            preservedCurrentSessionId: input.currentSessionId ?? null
          }),
          after: toPrismaJsonValue({
            revokedSessionIds: activeSessions.map((session) => session.sessionId)
          })
        }
      }),
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "admin.auth.sessions.revoke_all_other",
          entityType: "SESSION",
          entityId: input.actorAdminUserId,
          reason,
          note,
          metadata: toPrismaJsonValue({
            revokedCount: activeSessions.length,
            preservedCurrentSessionId: input.currentSessionId ?? null
          })
        }
      }),
      transaction.timelineEvent.create({
        data: {
          entityType: "ADMIN_USER",
          entityId: input.actorAdminUserId,
          eventType: "SESSIONS_REVOKED",
          actorAdminUserId: input.actorAdminUserId,
          actorType: "ADMIN",
          payload: toPrismaJsonValue({
            revokedCount: activeSessions.length,
            revokedSessionIds: activeSessions.map((session) => session.sessionId)
          })
        }
      })
    ]);

    return {
      revokedCount: activeSessions.length,
      revokedSessionIds: activeSessions.map((session) => session.sessionId),
      preservedCurrentSessionId: input.currentSessionId ?? null
    };
  }).then(async (result) => {
    await revokeAdminApiSessionsForAdmin({
      adminUserId: input.actorAdminUserId,
      exceptSessionId: input.currentSessionId
    });
    return result;
  });
