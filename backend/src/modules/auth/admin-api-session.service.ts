import { createHash, randomBytes, randomUUID } from "node:crypto";

import { authRequiredError } from "../../common/errors/app-error";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";

const addMinutes = (value: Date, minutes: number) => new Date(value.getTime() + minutes * 60_000);
const addDays = (value: Date, days: number) => new Date(value.getTime() + days * 24 * 60 * 60_000);

const hashOpaqueToken = (token: string) => createHash("sha256").update(token).digest("hex");
const buildOpaqueToken = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;

const issueRawTokens = () => {
  const now = new Date();

  return {
    sessionId: randomUUID(),
    accessToken: buildOpaqueToken("eaa"),
    refreshToken: buildOpaqueToken("ear"),
    accessTokenExpiresAt: addMinutes(now, env.ADMIN_API_ACCESS_TOKEN_TTL_MINUTES),
    refreshTokenExpiresAt: addDays(now, env.ADMIN_API_REFRESH_TOKEN_TTL_DAYS)
  };
};

export const issueAdminApiSession = async (input: {
  adminUserId: string;
  deviceLabel?: string | null;
  ipAddress?: string | null;
  ipCountry?: string | null;
  ipRegion?: string | null;
}) => {
  const tokens = issueRawTokens();

  await prisma.$transaction([
    prisma.sessionMetadata.create({
      data: {
        sessionId: tokens.sessionId,
        sessionType: "admin",
        adminUserId: input.adminUserId,
        deviceLabel: input.deviceLabel ?? null,
        ipAddress: input.ipAddress ?? null,
        ipCountry: input.ipCountry ?? null,
        ipRegion: input.ipRegion ?? null
      }
    }),
    prisma.adminApiSession.create({
      data: {
        adminUserId: input.adminUserId,
        sessionId: tokens.sessionId,
        accessTokenHash: hashOpaqueToken(tokens.accessToken),
        refreshTokenHash: hashOpaqueToken(tokens.refreshToken),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt
      }
    })
  ]);

  return {
    sessionId: tokens.sessionId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    accessTokenExpiresInSeconds: Math.floor(
      (tokens.accessTokenExpiresAt.getTime() - Date.now()) / 1000
    )
  };
};

export const findAdminApiSessionByAccessToken = async (accessToken: string) =>
  prisma.adminApiSession.findUnique({
    where: {
      accessTokenHash: hashOpaqueToken(accessToken)
    },
    include: {
      adminUser: {
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
      }
    }
  });

export const touchAdminApiSession = async (accessToken: string) =>
  prisma.adminApiSession.updateMany({
    where: {
      accessTokenHash: hashOpaqueToken(accessToken)
    },
    data: {
      lastUsedAt: new Date()
    }
  });

const adminSessionActorInclude = {
  adminUser: {
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
  }
} as const;

export const rotateAdminApiSession = async (input: {
  refreshToken: string;
  deviceLabel?: string | null;
  ipAddress?: string | null;
}) => {
  const refreshToken = input.refreshToken;
  const refreshTokenHash = hashOpaqueToken(refreshToken);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.adminApiSession.findUnique({
      where: {
        refreshTokenHash
      },
      include: adminSessionActorInclude
    });

    if (!existing || existing.revokedAt || existing.refreshTokenExpiresAt <= new Date()) {
      throw authRequiredError("The refresh token is invalid or expired.");
    }

    const metadata = await tx.sessionMetadata.findUnique({
      where: {
        sessionId: existing.sessionId
      }
    });

    if (!metadata || metadata.revokedAt) {
      throw authRequiredError("The session is no longer active.");
    }

    const nextTokens = issueRawTokens();

    const updated = await tx.adminApiSession.update({
      where: {
        refreshTokenHash
      },
      data: {
        accessTokenHash: hashOpaqueToken(nextTokens.accessToken),
        refreshTokenHash: hashOpaqueToken(nextTokens.refreshToken),
        accessTokenExpiresAt: nextTokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: nextTokens.refreshTokenExpiresAt,
        lastUsedAt: new Date()
      },
      include: adminSessionActorInclude
    });

    await tx.sessionMetadata.update({
      where: {
        sessionId: existing.sessionId
      },
      data: {
        deviceLabel: input.deviceLabel ?? metadata.deviceLabel,
        ipAddress: input.ipAddress ?? metadata.ipAddress,
        lastActiveAt: new Date()
      }
    });

    return {
      sessionId: updated.sessionId,
      accessToken: nextTokens.accessToken,
      refreshToken: nextTokens.refreshToken,
      accessTokenExpiresAt: nextTokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: nextTokens.refreshTokenExpiresAt,
      accessTokenExpiresInSeconds: Math.floor(
        (nextTokens.accessTokenExpiresAt.getTime() - Date.now()) / 1000
      ),
      adminUser: updated.adminUser
    };
  });
};

export const revokeAdminApiSessionBySessionId = async (sessionId: string) => {
  await prisma.adminApiSession.updateMany({
    where: {
      sessionId
    },
    data: {
      revokedAt: new Date()
    }
  });
};

export const revokeAdminApiSessionsForAdmin = async (input: {
  adminUserId: string;
  exceptSessionId?: string | null;
}) => {
  await prisma.adminApiSession.updateMany({
    where: {
      adminUserId: input.adminUserId,
      ...(input.exceptSessionId
        ? {
            sessionId: {
              not: input.exceptSessionId
            }
          }
        : {})
    },
    data: {
      revokedAt: new Date()
    }
  });
};
