import { WebhookEventStatus } from "@prisma/client";

import { isBrevoConfigured } from "../../config/email";
import { env } from "../../config/env";
import { queueNames } from "../../config/queue";
import { prisma } from "../../config/prisma";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const WEBHOOK_LATENCY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const WEBHOOK_LATENCY_MAX_MS = 5 * 60 * 1000;

const buildWebhookProcessingLatencyByProvider = async () => {
  const windowStart = new Date(Date.now() - WEBHOOK_LATENCY_LOOKBACK_MS);
  const attempts = await prisma.webhookProcessingAttempt.findMany({
    where: {
      status: "SUCCEEDED",
      finishedAt: { not: null },
      startedAt: { gte: windowStart }
    },
    select: {
      startedAt: true,
      finishedAt: true,
      webhookEvent: { select: { provider: true } }
    }
  });

  const byProvider = new Map<string, number[]>();
  for (const row of attempts) {
    const finishedAt = row.finishedAt;
    if (!finishedAt) {
      continue;
    }
    const ms = finishedAt.getTime() - row.startedAt.getTime();
    if (ms < 0 || ms > WEBHOOK_LATENCY_MAX_MS) {
      continue;
    }
    const provider = row.webhookEvent.provider?.trim() || "unknown";
    const list = byProvider.get(provider) ?? [];
    list.push(ms);
    byProvider.set(provider, list);
  }

  const byProviderOut = [...byProvider.entries()]
    .map(([provider, durations]) => {
      const sorted = [...durations].sort((a, b) => a - b);
      const sampleCount = sorted.length;
      const avgMs = sampleCount ? Math.round(sum(sorted) / sampleCount) : 0;
      const mid = Math.floor((sampleCount - 1) / 2);
      const p50Ms = sampleCount ? sorted[mid]! : 0;
      return { provider, sampleCount, avgMs, p50Ms };
    })
    .sort((left, right) => left.provider.localeCompare(right.provider));

  return {
    windowHours: Math.round(WEBHOOK_LATENCY_LOOKBACK_MS / (60 * 60 * 1000)),
    byProvider: byProviderOut
  };
};

export const getIntegrationHealth = async () => {
  const [webhookStatusCounts, notificationStatusCounts, recentFailedWebhooks, recentFailedNotifications, webhookLatency] =
    await Promise.all([
      prisma.webhookEvent.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      }),
      prisma.notification.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      }),
      prisma.webhookEvent.count({
        where: {
          status: {
            in: [WebhookEventStatus.FAILED, WebhookEventStatus.DEAD_LETTERED, WebhookEventStatus.INVALID_SIGNATURE]
          },
          receivedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.notification.count({
        where: {
          status: "FAILED",
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      buildWebhookProcessingLatencyByProvider()
    ]);

  return {
    providers: {
      clerk: Boolean(env.CLERK_SECRET_KEY),
      payments: Boolean(env.PAYSTACK_SECRET_KEY),
      email: isBrevoConfigured,
      storage: Boolean(
        env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
      ),
      sentry: Boolean(env.SENTRY_ENABLED && env.SENTRY_DSN)
    },
    queues: {
      prefix: env.QUEUE_PREFIX,
      names: Object.values(queueNames)
    },
    webhookEvents: {
      byStatus: webhookStatusCounts.map((entry) => ({
        status: entry.status,
        count: entry._count._all
      })),
      failuresLast24Hours: recentFailedWebhooks
    },
    notifications: {
      byStatus: notificationStatusCounts.map((entry) => ({
        status: entry.status,
        count: entry._count._all
      })),
      failuresLast24Hours: recentFailedNotifications
    },
    webhookProcessingLatency: webhookLatency
  };
};

export const getIntegrationProviders = async () => {
  const [recentWebhooks, recentNotifications] = await Promise.all([
    prisma.webhookEvent.findMany({
      orderBy: {
        receivedAt: "desc"
      },
      take: 10,
      select: {
        id: true,
        provider: true,
        eventType: true,
        status: true,
        receivedAt: true
      }
    }),
    prisma.notificationDelivery.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 10,
      select: {
        id: true,
        providerMessageId: true,
        status: true,
        sentAt: true,
        createdAt: true,
        notification: {
          select: {
            id: true,
            type: true,
            channel: true
          }
        }
      }
    })
  ]);

  return {
    configuredProviders: {
      paymentProvider: env.PAYMENT_PROVIDER,
      emailProvider: env.EMAIL_PROVIDER,
      storageProvider: env.STORAGE_PROVIDER,
      sentryEnabled: Boolean(env.SENTRY_ENABLED && env.SENTRY_DSN)
    },
    webhooks: recentWebhooks,
    notificationDeliveries: recentNotifications
  };
};

export const getIntegrationExceptions = async () => {
  const [failedWebhooks, failedNotifications, financialExceptions] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: {
        status: {
          in: [
            WebhookEventStatus.FAILED,
            WebhookEventStatus.DEAD_LETTERED,
            WebhookEventStatus.INVALID_SIGNATURE
          ]
        }
      },
      orderBy: {
        receivedAt: "desc"
      },
      take: 20,
      select: {
        id: true,
        provider: true,
        eventType: true,
        status: true,
        receivedAt: true
      }
    }),
    prisma.notification.findMany({
      where: {
        status: "FAILED"
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 20,
      select: {
        id: true,
        type: true,
        channel: true,
        recipientEmail: true,
        updatedAt: true
      }
    }),
    prisma.financialException.findMany({
      where: {
        status: "OPEN"
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 20,
      select: {
        id: true,
        exceptionType: true,
        status: true,
        orderId: true,
        paymentId: true,
        refundId: true,
        updatedAt: true
      }
    })
  ]);

  return {
    summary: {
      failedWebhookCount: failedWebhooks.length,
      failedNotificationCount: failedNotifications.length,
      openFinancialExceptionCount: financialExceptions.length
    },
    failedWebhooks,
    failedNotifications,
    financialExceptions
  };
};
