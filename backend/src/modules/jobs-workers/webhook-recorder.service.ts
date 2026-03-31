import { WebhookEventStatus } from "@prisma/client";

import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { prisma } from "../../config/prisma";

export const webhookRecorderService = {
  async recordReceivedEvent(input: {
    provider: string;
    eventType: string;
    payload: unknown;
    signatureValid?: boolean;
  }) {
    return prisma.webhookEvent.create({
      data: {
        provider: input.provider,
        eventType: input.eventType,
        signatureValid: input.signatureValid ?? false,
        status: WebhookEventStatus.RECEIVED,
        payload: toPrismaJsonValue(input.payload)!
      }
    });
  },

  async markVerified(input: {
    webhookEventId: string;
    signatureValid: boolean;
    status?: WebhookEventStatus;
  }) {
    return prisma.webhookEvent.update({
      where: {
        id: input.webhookEventId
      },
      data: {
        signatureValid: input.signatureValid,
        status:
          input.status ??
          (input.signatureValid
            ? WebhookEventStatus.VERIFIED
            : WebhookEventStatus.INVALID_SIGNATURE)
      }
    });
  },

  async markQueued(webhookEventId: string) {
    return prisma.webhookEvent.update({
      where: {
        id: webhookEventId
      },
      data: {
        status: WebhookEventStatus.QUEUED
      }
    });
  },

  async markProcessing(webhookEventId: string) {
    return prisma.webhookEvent.update({
      where: {
        id: webhookEventId
      },
      data: {
        status: WebhookEventStatus.PROCESSING
      }
    });
  },

  async markDeadLettered(webhookEventId: string) {
    return prisma.webhookEvent.update({
      where: {
        id: webhookEventId
      },
      data: {
        status: WebhookEventStatus.DEAD_LETTERED
      }
    });
  },

  async startAttempt(input: {
    webhookEventId: string;
    attemptNo: number;
    retryCount?: number;
  }) {
    return prisma.webhookProcessingAttempt.create({
      data: {
        webhookEventId: input.webhookEventId,
        attemptNo: input.attemptNo,
        status: "RUNNING",
        retryCount: input.retryCount ?? Math.max(0, input.attemptNo - 1)
      }
    });
  },

  async finalizeAttempt(input: {
    webhookEventId: string;
    attemptId: string;
    success: boolean;
    error?: unknown;
  }) {
    return runInTransaction(async (transaction) => {
      const finishedAt = new Date();

      const attempt = await transaction.webhookProcessingAttempt.update({
        where: {
          id: input.attemptId
        },
        data: {
          status: input.success ? "SUCCEEDED" : "FAILED",
          finishedAt,
          error: input.error ? toPrismaJsonValue(input.error) : undefined
        }
      });

      const webhookEvent = await transaction.webhookEvent.update({
        where: {
          id: input.webhookEventId
        },
        data: {
          status: input.success ? WebhookEventStatus.PROCESSED : WebhookEventStatus.FAILED
        }
      });

      return {
        attempt,
        webhookEvent
      };
    });
  }
};
