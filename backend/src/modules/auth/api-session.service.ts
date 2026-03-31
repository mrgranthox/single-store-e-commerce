import { createHash, randomBytes, randomUUID } from "node:crypto";

import { authRequiredError } from "../../common/errors/app-error";
import { prisma } from "../../config/prisma";

const ACCESS_TOKEN_TTL_MINUTES = 15;
const REFRESH_TOKEN_TTL_DAYS = 30;

const addMinutes = (value: Date, minutes: number) => new Date(value.getTime() + minutes * 60_000);
const addDays = (value: Date, days: number) => new Date(value.getTime() + days * 24 * 60 * 60_000);

export const hashOpaqueToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const buildOpaqueToken = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;

const issueRawTokens = () => {
  const now = new Date();

  return {
    sessionId: randomUUID(),
    accessToken: buildOpaqueToken("eca"),
    refreshToken: buildOpaqueToken("ecr"),
    accessTokenExpiresAt: addMinutes(now, ACCESS_TOKEN_TTL_MINUTES),
    refreshTokenExpiresAt: addDays(now, REFRESH_TOKEN_TTL_DAYS)
  };
};

export const issueCustomerApiSession = async (input: {
  userId: string;
  deviceLabel?: string | null;
  ipCountry?: string | null;
  ipRegion?: string | null;
}) => {
  const tokens = issueRawTokens();

  await prisma.$transaction([
    prisma.sessionMetadata.create({
      data: {
        sessionId: tokens.sessionId,
        sessionType: "customer",
        userId: input.userId,
        deviceLabel: input.deviceLabel ?? null,
        ipCountry: input.ipCountry ?? null,
        ipRegion: input.ipRegion ?? null
      }
    }),
    prisma.customerApiSession.create({
      data: {
        userId: input.userId,
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

export const findCustomerApiSessionByAccessToken = async (accessToken: string) =>
  prisma.customerApiSession.findUnique({
    where: {
      accessTokenHash: hashOpaqueToken(accessToken)
    },
    include: {
      user: true
    }
  });

export const touchCustomerApiSession = async (accessToken: string) =>
  prisma.customerApiSession.updateMany({
    where: {
      accessTokenHash: hashOpaqueToken(accessToken)
    },
    data: {
      lastUsedAt: new Date()
    }
  });

export const rotateCustomerApiSession = async (refreshToken: string) => {
  const existing = await prisma.customerApiSession.findUnique({
    where: {
      refreshTokenHash: hashOpaqueToken(refreshToken)
    },
    include: {
      user: true
    }
  });

  if (!existing || existing.revokedAt || existing.refreshTokenExpiresAt <= new Date()) {
    throw authRequiredError("The refresh token is invalid or expired.");
  }

  const metadata = await prisma.sessionMetadata.findUnique({
    where: {
      sessionId: existing.sessionId
    }
  });

  if (!metadata || metadata.revokedAt) {
    throw authRequiredError("The session is no longer active.");
  }

  const nextTokens = issueRawTokens();

  const updated = await prisma.customerApiSession.update({
    where: {
      id: existing.id
    },
    data: {
      accessTokenHash: hashOpaqueToken(nextTokens.accessToken),
      refreshTokenHash: hashOpaqueToken(nextTokens.refreshToken),
      accessTokenExpiresAt: nextTokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: nextTokens.refreshTokenExpiresAt,
      lastUsedAt: new Date()
    },
    include: {
      user: true
    }
  });

  await prisma.sessionMetadata.update({
    where: {
      sessionId: existing.sessionId
    },
    data: {
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
    user: updated.user
  };
};

export const revokeCustomerApiSessionBySessionId = async (sessionId: string) => {
  await prisma.customerApiSession.updateMany({
    where: {
      sessionId
    },
    data: {
      revokedAt: new Date()
    }
  });
};

export const revokeCustomerApiSessionsForUser = async (input: {
  userId: string;
  exceptSessionId?: string | null;
}) => {
  await prisma.customerApiSession.updateMany({
    where: {
      userId: input.userId,
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
