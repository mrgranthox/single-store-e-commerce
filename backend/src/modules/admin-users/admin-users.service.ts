import { createHash, randomBytes } from "node:crypto";

import {
  AdminInvitationStatus,
  AdminStatus,
  Prisma
} from "@prisma/client";

import {
  buildPagination,
  buildPaginationPayload,
  type PaginationInput
} from "../../common/http/pagination";
import {
  conflictError,
  invalidInputError,
  invalidStateTransitionError,
  notFoundError,
  serviceUnavailableError
} from "../../common/errors/app-error";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { clerkClient, isClerkConfigured } from "../../config/clerk";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { enqueueNotification } from "../notifications/notifications.service";
import { revokeAdminApiSessionBySessionId } from "../auth/admin-api-session.service";

const ADMIN_INVITATION_TTL_DAYS = 7;
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const buildInviteToken = () => `eai_${randomBytes(24).toString("base64url")}`;
const hashInviteToken = (value: string) => createHash("sha256").update(value).digest("hex");
const addDays = (value: Date, days: number) => new Date(value.getTime() + days * 24 * 60 * 60_000);

const adminUserInclude = {
  roles: {
    include: {
      role: true
    }
  }
} satisfies Prisma.AdminUserInclude;

const adminInvitationInclude = {
  invitedBy: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  },
  revokedBy: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  },
  roles: {
    include: {
      role: true
    }
  }
} satisfies Prisma.AdminInvitationInclude;

type AdminUserRecord = Prisma.AdminUserGetPayload<{
  include: typeof adminUserInclude;
}>;

type AdminInvitationRecord = Prisma.AdminInvitationGetPayload<{
  include: typeof adminInvitationInclude;
}>;

const formatDisplayName = (value: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) => {
  const fullName = [value.firstName, value.lastName].filter(Boolean).join(" ").trim();
  return fullName.length > 0 ? fullName : value.email ?? null;
};

const serializeRole = (entry: { role: { id: string; code: string; name: string } }) => ({
  id: entry.role.id,
  code: entry.role.code,
  name: entry.role.name
});

const serializeAdminUser = (
  adminUser: AdminUserRecord,
  extras?: {
    totalSessions?: number;
    activeSessions?: number;
  }
) => ({
  id: adminUser.id,
  clerkAdminUserId: adminUser.clerkAdminUserId,
  email: adminUser.email,
  firstName: adminUser.firstName,
  lastName: adminUser.lastName,
  fullName: formatDisplayName(adminUser),
  status: adminUser.status,
  createdAt: adminUser.createdAt,
  updatedAt: adminUser.updatedAt,
  roles: adminUser.roles.map(serializeRole),
  security: extras
    ? {
        totalSessions: extras.totalSessions ?? 0,
        activeSessions: extras.activeSessions ?? 0
      }
    : undefined
});

const serializeSession = (session: {
  sessionId: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  ipCountry: string | null;
  ipRegion: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  revokedAt: Date | null;
}) => ({
  id: session.sessionId,
  current: false,
  userAgent: session.deviceLabel,
  ipAddress: session.ipAddress,
  ipCountry: session.ipCountry,
  ipRegion: session.ipRegion,
  issuedAt: session.createdAt,
  lastSeenAt: session.lastActiveAt,
  expiresAt: session.revokedAt,
  revokedAt: session.revokedAt
});

const deriveInvitationStatus = (invitation: {
  status: AdminInvitationStatus;
  expiresAt: Date;
}) => {
  if (invitation.status === AdminInvitationStatus.PENDING && invitation.expiresAt <= new Date()) {
    return AdminInvitationStatus.EXPIRED;
  }
  return invitation.status;
};

const serializeInvitation = (invitation: AdminInvitationRecord) => ({
  id: invitation.id,
  email: invitation.email,
  firstName: invitation.firstName,
  lastName: invitation.lastName,
  fullName: formatDisplayName(invitation),
  status: deriveInvitationStatus(invitation),
  expiresAt: invitation.expiresAt,
  lastSentAt: invitation.lastSentAt,
  acceptedAt: invitation.acceptedAt,
  revokedAt: invitation.revokedAt,
  note: invitation.note,
  invitedBy: invitation.invitedBy
    ? {
        id: invitation.invitedBy.id,
        email: invitation.invitedBy.email,
        fullName: formatDisplayName(invitation.invitedBy)
      }
    : null,
  revokedBy: invitation.revokedBy
    ? {
        id: invitation.revokedBy.id,
        email: invitation.revokedBy.email,
        fullName: formatDisplayName(invitation.revokedBy)
      }
    : null,
  roles: invitation.roles.map(serializeRole),
  createdAt: invitation.createdAt,
  updatedAt: invitation.updatedAt
});

const listAvailableRoles = async () =>
  prisma.role.findMany({
    orderBy: {
      name: "asc"
    }
  });

const loadRolesByCode = async (roleCodes: string[], db: Prisma.TransactionClient | typeof prisma = prisma) => {
  const normalizedCodes = [...new Set(roleCodes.map((code) => code.trim()).filter(Boolean))];
  const roles = await db.role.findMany({
    where: {
      code: {
        in: normalizedCodes
      }
    },
    orderBy: {
      name: "asc"
    }
  });

  if (roles.length !== normalizedCodes.length) {
    const found = new Set(roles.map((role) => role.code));
    const missing = normalizedCodes.filter((code) => !found.has(code));
    throw invalidInputError(`Unknown admin role code(s): ${missing.join(", ")}.`);
  }

  return roles;
};

const logAdminMutation = async (input: {
  transaction: Prisma.TransactionClient;
  actorAdminUserId: string;
  actionCode: string;
  entityType: string;
  entityId: string;
  screen: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  note?: string | null;
  reason?: string | null;
}) =>
  Promise.all([
    input.transaction.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorAdminUserId: input.actorAdminUserId,
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: toPrismaJsonValue(input.metadata),
        note: input.note ?? null,
        reason: input.reason ?? null
      }
    }),
    input.transaction.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        screen: input.screen,
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        before: toPrismaJsonValue(input.before),
        after: toPrismaJsonValue(input.after),
        note: input.note ?? null,
        reason: input.reason ?? null
      }
    }),
    input.transaction.timelineEvent.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.actionCode.toUpperCase().replaceAll(".", "_"),
        actorType: "ADMIN",
        actorAdminUserId: input.actorAdminUserId,
        payload: toPrismaJsonValue(input.metadata ?? input.after ?? input.before)
      }
    })
  ]);

const sendInvitationNotification = async (input: {
  email: string;
  firstName?: string | null;
  roleNames: string[];
  rawToken: string;
}) => {
  await enqueueNotification({
    type: "ADMIN_INVITATION",
    recipientEmail: input.email,
    payload: {
      subject: "You have been invited to the admin workspace",
      heading: "Admin workspace invitation",
      message:
        input.firstName?.trim()
          ? `${input.firstName.trim()}, you have been invited to the admin workspace.`
          : "You have been invited to the admin workspace.",
      ctaLabel: "Open admin login",
      ctaUrl: `${env.ADMIN_APP_URL}/admin/login?invite=${encodeURIComponent(input.rawToken)}`,
      roleNames: input.roleNames,
      inviteToken: input.rawToken
    }
  });
};

const maybeVerifyClerkAdminIdentity = async (input: {
  clerkAdminUserId: string;
  email?: string;
}) => {
  if (!isClerkConfigured) {
    return {
      clerkAdminUserId: input.clerkAdminUserId,
      email: input.email ? normalizeEmail(input.email) : null
    };
  }

  const clerkUser = await clerkClient.users.getUser(input.clerkAdminUserId);
  const primaryEmail =
    clerkUser.emailAddresses.find((entry) => entry.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;

  if (!primaryEmail) {
    throw serviceUnavailableError("The linked Clerk admin user has no primary email address.");
  }

  if (input.email && normalizeEmail(primaryEmail) !== normalizeEmail(input.email)) {
    throw conflictError("The supplied email does not match the linked Clerk admin user.");
  }

  return {
    clerkAdminUserId: clerkUser.id,
    email: normalizeEmail(primaryEmail)
  };
};

export const listAdminUsers = async (
  input: PaginationInput & {
    q?: string;
    status?: AdminStatus;
  }
) => {
  const where: Prisma.AdminUserWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.q?.trim()
      ? {
          OR: [
            { email: { contains: input.q.trim(), mode: "insensitive" } },
            { firstName: { contains: input.q.trim(), mode: "insensitive" } },
            { lastName: { contains: input.q.trim(), mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [items, totalItems, roles] = await Promise.all([
    prisma.adminUser.findMany({
      where,
      include: adminUserInclude,
      orderBy: [{ createdAt: "desc" }],
      ...buildPagination(input)
    }),
    prisma.adminUser.count({ where }),
    listAvailableRoles()
  ]);

  return {
    items: items.map((item) => serializeAdminUser(item)),
    availableRoles: roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name
    })),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAdminUserDetail = async (adminUserId: string) => {
  const adminUser = await prisma.adminUser.findUnique({
    where: {
      id: adminUserId
    },
    include: adminUserInclude
  });

  if (!adminUser) {
    throw notFoundError("The requested admin user was not found.");
  }

  const sessions = await prisma.sessionMetadata.findMany({
    where: {
      adminUserId,
      sessionType: "admin"
    }
  });

  return {
    entity: serializeAdminUser(adminUser, {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((session) => session.revokedAt === null).length
    })
  };
};

export const createAdminUser = async (input: {
  actorAdminUserId: string;
  clerkAdminUserId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roleCodes: string[];
}) => {
  const verifiedIdentity = await maybeVerifyClerkAdminIdentity({
    clerkAdminUserId: input.clerkAdminUserId,
    email: input.email
  });

  return runInTransaction(async (transaction) => {
    const roles = await loadRolesByCode(input.roleCodes, transaction);
    const existing = await transaction.adminUser.findFirst({
      where: {
        OR: [
          { clerkAdminUserId: verifiedIdentity.clerkAdminUserId },
          ...(verifiedIdentity.email ? [{ email: verifiedIdentity.email }] : [])
        ]
      }
    });

    if (existing) {
      throw conflictError("An admin user already exists for the supplied identity.");
    }

    const adminUser = await transaction.adminUser.create({
      data: {
        clerkAdminUserId: verifiedIdentity.clerkAdminUserId,
        email: verifiedIdentity.email ?? normalizeEmail(input.email ?? ""),
        firstName: input.firstName?.trim() || null,
        lastName: input.lastName?.trim() || null,
        roles: {
          create: roles.map((role) => ({
            roleId: role.id
          }))
        }
      },
      include: adminUserInclude
    });

    await transaction.adminInvitation.updateMany({
      where: {
        email: adminUser.email,
        status: AdminInvitationStatus.PENDING
      },
      data: {
        status: AdminInvitationStatus.ACCEPTED,
        acceptedAt: new Date()
      }
    });

    await logAdminMutation({
      transaction,
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "admin.users.create",
      entityType: "ADMIN_USER",
      entityId: adminUser.id,
      screen: "system.admin-users",
      after: serializeAdminUser(adminUser),
      metadata: {
        roleCodes: roles.map((role) => role.code)
      }
    });

    return {
      entity: serializeAdminUser(adminUser)
    };
  });
};

export const updateAdminUserProfile = async (input: {
  actorAdminUserId: string;
  adminUserId: string;
  firstName?: string | null;
  lastName?: string | null;
}) =>
  runInTransaction(async (transaction) => {
    const current = await transaction.adminUser.findUnique({
      where: {
        id: input.adminUserId
      },
      include: adminUserInclude
    });

    if (!current) {
      throw notFoundError("The requested admin user was not found.");
    }

    const updated = await transaction.adminUser.update({
      where: {
        id: input.adminUserId
      },
      data: {
        firstName:
          input.firstName === undefined ? current.firstName : input.firstName?.trim() || null,
        lastName:
          input.lastName === undefined ? current.lastName : input.lastName?.trim() || null
      },
      include: adminUserInclude
    });

    await logAdminMutation({
      transaction,
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "admin.users.update",
      entityType: "ADMIN_USER",
      entityId: updated.id,
      screen: "system.admin-user-detail",
      before: serializeAdminUser(current),
      after: serializeAdminUser(updated)
    });

    return {
      entity: serializeAdminUser(updated)
    };
  });

export const updateAdminUserRoles = async (input: {
  actorAdminUserId: string;
  adminUserId: string;
  roleCodes: string[];
}) =>
  runInTransaction(async (transaction) => {
    const current = await transaction.adminUser.findUnique({
      where: {
        id: input.adminUserId
      },
      include: adminUserInclude
    });

    if (!current) {
      throw notFoundError("The requested admin user was not found.");
    }

    if (current.id === input.actorAdminUserId) {
      throw invalidStateTransitionError("You cannot change your own role assignments from this workspace.");
    }

    const roles = await loadRolesByCode(input.roleCodes, transaction);

    await transaction.adminUserRole.deleteMany({
      where: {
        adminUserId: current.id
      }
    });

    await transaction.adminUserRole.createMany({
      data: roles.map((role) => ({
        adminUserId: current.id,
        roleId: role.id
      })),
      skipDuplicates: true
    });

    const updated = await transaction.adminUser.findUniqueOrThrow({
      where: {
        id: current.id
      },
      include: adminUserInclude
    });

    await logAdminMutation({
      transaction,
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "admin.users.manage_roles",
      entityType: "ADMIN_USER",
      entityId: updated.id,
      screen: "system.admin-user-detail",
      before: serializeAdminUser(current),
      after: serializeAdminUser(updated),
      metadata: {
        roleCodes: roles.map((role) => role.code)
      }
    });

    return {
      entity: serializeAdminUser(updated)
    };
  });

const changeAdminUserStatus = async (input: {
  actorAdminUserId: string;
  adminUserId: string;
  nextStatus: AdminStatus;
  actionCode: "admin.users.suspend" | "admin.users.reactivate";
  screen: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const current = await transaction.adminUser.findUnique({
      where: {
        id: input.adminUserId
      },
      include: adminUserInclude
    });

    if (!current) {
      throw notFoundError("The requested admin user was not found.");
    }

    if (current.id === input.actorAdminUserId) {
      throw invalidStateTransitionError("You cannot change your own admin account status.");
    }

    if (current.status === input.nextStatus) {
      throw invalidStateTransitionError("The admin user is already in the requested state.");
    }

    const updated = await transaction.adminUser.update({
      where: {
        id: current.id
      },
      data: {
        status: input.nextStatus
      },
      include: adminUserInclude
    });

    await logAdminMutation({
      transaction,
      actorAdminUserId: input.actorAdminUserId,
      actionCode: input.actionCode,
      entityType: "ADMIN_USER",
      entityId: updated.id,
      screen: input.screen,
      before: serializeAdminUser(current),
      after: serializeAdminUser(updated),
      reason: input.reason,
      note: input.note
    });

    return {
      entity: serializeAdminUser(updated)
    };
  });

export const suspendAdminUser = (input: {
  actorAdminUserId: string;
  adminUserId: string;
  reason?: string;
  note?: string;
}) =>
  changeAdminUserStatus({
    ...input,
    nextStatus: AdminStatus.SUSPENDED,
    actionCode: "admin.users.suspend",
    screen: "system.admin-user-detail"
  });

export const reactivateAdminUser = (input: {
  actorAdminUserId: string;
  adminUserId: string;
  reason?: string;
  note?: string;
}) =>
  changeAdminUserStatus({
    ...input,
    nextStatus: AdminStatus.ACTIVE,
    actionCode: "admin.users.reactivate",
    screen: "system.admin-user-detail"
  });

export const listAdminUserSessions = async (adminUserId: string) => {
  const adminUser = await prisma.adminUser.findUnique({
    where: {
      id: adminUserId
    }
  });

  if (!adminUser) {
    throw notFoundError("The requested admin user was not found.");
  }

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

export const revokeAdminUserSession = async (input: {
  actorAdminUserId: string;
  adminUserId: string;
  sessionId: string;
  reason?: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const adminUser = await transaction.adminUser.findUnique({
      where: {
        id: input.adminUserId
      },
      include: adminUserInclude
    });

    if (!adminUser) {
      throw notFoundError("The requested admin user was not found.");
    }

    const session = await transaction.sessionMetadata.findFirst({
      where: {
        sessionId: input.sessionId,
        adminUserId: input.adminUserId,
        sessionType: "admin"
      }
    });

    if (!session) {
      throw notFoundError("The requested admin session was not found.");
    }

    if (session.revokedAt) {
      throw invalidStateTransitionError("The requested admin session has already been revoked.");
    }

    await transaction.sessionMetadata.update({
      where: {
        sessionId: input.sessionId
      },
      data: {
        revokedAt: new Date()
      }
    });

    await revokeAdminApiSessionBySessionId(input.sessionId);

    await logAdminMutation({
      transaction,
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "admin.users.sessions.revoke",
      entityType: "ADMIN_USER",
      entityId: adminUser.id,
      screen: "system.admin-user-detail",
      metadata: {
        sessionId: input.sessionId
      },
      note: input.note,
      reason: input.reason
    });

    return {
      ok: true
    };
  });

export const listAdminInvitations = async (
  input: PaginationInput & {
    q?: string;
    status?: AdminInvitationStatus;
  }
) => {
  const now = new Date();
  const trimmedQuery = input.q?.trim();
  const statusFilter =
    input.status === AdminInvitationStatus.EXPIRED
      ? {
          status: AdminInvitationStatus.PENDING,
          expiresAt: {
            lt: now
          }
        }
      : input.status === AdminInvitationStatus.PENDING
        ? {
            status: AdminInvitationStatus.PENDING,
            expiresAt: {
              gt: now
            }
          }
        : input.status
          ? { status: input.status }
          : {};

  const where: Prisma.AdminInvitationWhereInput = {
    ...statusFilter,
    ...(trimmedQuery
      ? {
          OR: [
            { email: { contains: trimmedQuery, mode: "insensitive" } },
            { firstName: { contains: trimmedQuery, mode: "insensitive" } },
            { lastName: { contains: trimmedQuery, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [items, totalItems, roles] = await Promise.all([
    prisma.adminInvitation.findMany({
      where,
      include: adminInvitationInclude,
      orderBy: [{ createdAt: "desc" }],
      ...buildPagination(input)
    }),
    prisma.adminInvitation.count({ where }),
    listAvailableRoles()
  ]);

  return {
    items: items.map(serializeInvitation),
    availableRoles: roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name
    })),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const createAdminInvitation = async (input: {
  actorAdminUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roleCodes: string[];
  note?: string;
}) => {
  const normalizedEmail = normalizeEmail(input.email);
  const rawToken = buildInviteToken();

  const result = await runInTransaction(async (transaction) => {
    const existingAdmin = await transaction.adminUser.findUnique({
      where: {
        email: normalizedEmail
      }
    });

    if (existingAdmin) {
      throw conflictError("An admin user already exists for this email address.");
    }

    const existingPending = await transaction.adminInvitation.findFirst({
      where: {
        email: normalizedEmail,
        status: AdminInvitationStatus.PENDING
      }
    });

    if (existingPending && existingPending.expiresAt > new Date()) {
      throw conflictError("An active admin invitation already exists for this email address.");
    }

    const roles = await loadRolesByCode(input.roleCodes, transaction);

    const invitation = await transaction.adminInvitation.create({
      data: {
        email: normalizedEmail,
        firstName: input.firstName?.trim() || null,
        lastName: input.lastName?.trim() || null,
        status: AdminInvitationStatus.PENDING,
        tokenHash: hashInviteToken(rawToken),
        expiresAt: addDays(new Date(), ADMIN_INVITATION_TTL_DAYS),
        lastSentAt: new Date(),
        note: input.note?.trim() || null,
        invitedByAdminUserId: input.actorAdminUserId,
        roles: {
          create: roles.map((role) => ({
            roleId: role.id
          }))
        }
      },
      include: adminInvitationInclude
    });

    await logAdminMutation({
      transaction,
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "admin.users.invitations.create",
      entityType: "ADMIN_INVITATION",
      entityId: invitation.id,
      screen: "system.admin-user-invitations",
      after: serializeInvitation(invitation),
      metadata: {
        roleCodes: roles.map((role) => role.code)
      },
      note: input.note
    });

    return {
      invitation,
      roleNames: roles.map((role) => role.name)
    };
  });

  await sendInvitationNotification({
    email: result.invitation.email,
    firstName: result.invitation.firstName,
    roleNames: result.roleNames,
    rawToken
  });

  return {
    entity: serializeInvitation(result.invitation)
  };
};

export const resendAdminInvitation = async (input: {
  actorAdminUserId: string;
  invitationId: string;
}) => {
  const rawToken = buildInviteToken();

  const result = await runInTransaction(async (transaction) => {
    const invitation = await transaction.adminInvitation.findUnique({
      where: {
        id: input.invitationId
      },
      include: adminInvitationInclude
    });

    if (!invitation) {
      throw notFoundError("The requested admin invitation was not found.");
    }

    if (invitation.status === AdminInvitationStatus.ACCEPTED) {
      throw invalidStateTransitionError("Accepted invitations cannot be resent.");
    }

    const updated = await transaction.adminInvitation.update({
      where: {
        id: invitation.id
      },
      data: {
        status: AdminInvitationStatus.PENDING,
        tokenHash: hashInviteToken(rawToken),
        expiresAt: addDays(new Date(), ADMIN_INVITATION_TTL_DAYS),
        lastSentAt: new Date(),
        revokedAt: null,
        revokedByAdminUserId: null
      },
      include: adminInvitationInclude
    });

    await logAdminMutation({
      transaction,
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "admin.users.invitations.resend",
      entityType: "ADMIN_INVITATION",
      entityId: updated.id,
      screen: "system.admin-user-invitations",
      before: serializeInvitation(invitation),
      after: serializeInvitation(updated)
    });

    return {
      invitation: updated,
      roleNames: updated.roles.map((entry) => entry.role.name)
    };
  });

  await sendInvitationNotification({
    email: result.invitation.email,
    firstName: result.invitation.firstName,
    roleNames: result.roleNames,
    rawToken
  });

  return {
    entity: serializeInvitation(result.invitation)
  };
};

export const revokeAdminInvitation = async (input: {
  actorAdminUserId: string;
  invitationId: string;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const invitation = await transaction.adminInvitation.findUnique({
      where: {
        id: input.invitationId
      },
      include: adminInvitationInclude
    });

    if (!invitation) {
      throw notFoundError("The requested admin invitation was not found.");
    }

    if (invitation.status !== AdminInvitationStatus.PENDING) {
      throw invalidStateTransitionError("Only pending invitations can be revoked.");
    }

    const updated = await transaction.adminInvitation.update({
      where: {
        id: invitation.id
      },
      data: {
        status: AdminInvitationStatus.REVOKED,
        revokedAt: new Date(),
        revokedByAdminUserId: input.actorAdminUserId,
        note: input.note?.trim() || invitation.note
      },
      include: adminInvitationInclude
    });

    await logAdminMutation({
      transaction,
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "admin.users.invitations.revoke",
      entityType: "ADMIN_INVITATION",
      entityId: updated.id,
      screen: "system.admin-user-invitations",
      before: serializeInvitation(invitation),
      after: serializeInvitation(updated),
      note: input.note
    });

    return {
      entity: serializeInvitation(updated)
    };
  });
