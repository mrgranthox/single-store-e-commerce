import type { SessionMetadata } from "@prisma/client";

import type { RequestActor } from "../../common/types/request-context";
import { prisma } from "../../config/prisma";

const matchesActor = (session: SessionMetadata, actor: RequestActor) => {
  if (actor.kind === "admin") {
    return session.sessionType === "admin" && session.adminUserId === actor.adminUserId;
  }

  if (actor.kind === "customer") {
    return session.sessionType === "customer" && session.userId === actor.userId;
  }

  return false;
};

export const findSessionById = async (sessionId: string) =>
  prisma.sessionMetadata.findUnique({
    where: {
      sessionId
    }
  });

export const validateSessionForActor = async (input: {
  sessionId: string;
  actor: RequestActor;
}) => {
  const session = await findSessionById(input.sessionId);

  if (!session) {
    return {
      valid: false,
      reason: "missing" as const,
      session: null
    };
  }

  if (session.revokedAt) {
    return {
      valid: false,
      reason: "revoked" as const,
      session
    };
  }

  if (!matchesActor(session, input.actor)) {
    return {
      valid: false,
      reason: "mismatch" as const,
      session
    };
  }

  return {
    valid: true,
    reason: "active" as const,
    session
  };
};

export const touchSession = async (sessionId: string) => {
  try {
    await prisma.sessionMetadata.update({
      where: {
        sessionId
      },
      data: {
        lastActiveAt: new Date()
      }
    });
  } catch {
    return null;
  }

  return true;
};

export const upsertSessionForActor = async (input: {
  sessionId: string;
  actor: RequestActor;
  deviceLabel?: string | null;
  ipAddress?: string | null;
  ipCountry?: string | null;
  ipRegion?: string | null;
}) => {
  if (input.actor.kind !== "admin" && input.actor.kind !== "customer") {
    return null;
  }

  const existingSession = await findSessionById(input.sessionId);
  const sessionType = input.actor.kind === "admin" ? "admin" : "customer";

  if (existingSession) {
    return prisma.sessionMetadata.update({
      where: {
        id: existingSession.id
      },
      data: {
        lastActiveAt: new Date(),
        deviceLabel: input.deviceLabel ?? existingSession.deviceLabel,
        ipAddress: input.ipAddress ?? existingSession.ipAddress,
        ipCountry: input.ipCountry ?? existingSession.ipCountry,
        ipRegion: input.ipRegion ?? existingSession.ipRegion
      }
    });
  }

  return prisma.sessionMetadata.create({
    data: {
      sessionId: input.sessionId,
      sessionType,
      deviceLabel: input.deviceLabel ?? null,
      ipAddress: input.ipAddress ?? null,
      ipCountry: input.ipCountry ?? null,
      ipRegion: input.ipRegion ?? null,
      ...(input.actor.kind === "admin"
        ? {
            adminUserId: input.actor.adminUserId
          }
        : {
            userId: input.actor.userId
          })
    }
  });
};
