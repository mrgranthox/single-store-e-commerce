import type { Job } from "bullmq";
import { NotificationStatus, Prisma } from "@prisma/client";

import { invalidInputError, notFoundError } from "../../common/errors/app-error";
import {
  buildPagination,
  buildPaginationPayload,
  type PaginationInput
} from "../../common/http/pagination";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { sendTransactionalEmail } from "../../config/email";
import { logger } from "../../config/logger";
import { prisma } from "../../config/prisma";
import { queueNames, queues } from "../../config/queue";
import { jobRunService } from "../jobs-workers/job-run.service";
import { renderNotificationEmail } from "./notification-templates";

const notificationInclude = {
  recipientUser: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  },
  deliveries: {
    orderBy: {
      createdAt: "desc" as const
    },
    take: 10
  }
} satisfies Prisma.NotificationInclude;

type NotificationRecord = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

const serializeNotification = (notification: NotificationRecord) => ({
  id: notification.id,
  type: notification.type,
  channel: notification.channel,
  status: notification.status,
  recipientUser: notification.recipientUser
    ? {
        id: notification.recipientUser.id,
        email: notification.recipientUser.email,
        name:
          [notification.recipientUser.firstName, notification.recipientUser.lastName]
            .filter(Boolean)
            .join(" ") || null
      }
    : null,
  recipientEmail: notification.recipientEmail,
  recipientType: notification.recipientType,
  payload: notification.payload,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
  deliveries: notification.deliveries.map((delivery) => ({
    id: delivery.id,
    providerMessageId: delivery.providerMessageId,
    status: delivery.status,
    error: delivery.error,
    sentAt: delivery.sentAt,
    createdAt: delivery.createdAt
  }))
});

const buildNotificationJobId = (notificationId: string, suffix?: string) =>
  ["notification", notificationId, suffix].filter(Boolean).join("-");

const deliverNotificationByChannel = async (notification: NotificationRecord) => {
  if (notification.channel !== "EMAIL") {
    throw invalidInputError("Only EMAIL notification delivery is implemented.");
  }

  const recipientEmail = notification.recipientEmail ?? notification.recipientUser?.email;

  if (!recipientEmail) {
    throw invalidInputError("The notification does not have a deliverable recipient email.");
  }

  const email = await renderNotificationEmail({
    type: notification.type,
    payload: notification.payload,
    recipientEmail
  });
  const delivery = await sendTransactionalEmail({
    notificationId: notification.id,
    notificationType: notification.type,
    recipientEmail,
    subject: email.subject,
    html: email.html,
    text: email.text
  });

  logger.info(
    {
      notificationId: notification.id,
      type: notification.type,
      channel: notification.channel,
      recipientEmail,
      provider: delivery.provider,
      messageId: delivery.providerMessageId
    },
    "Delivered notification via Brevo."
  );

  return {
    providerMessageId: delivery.providerMessageId,
    providerStatus: "SENT",
    recipientEmail
  };
};

export const enqueueNotification = async (input: {
  type: string;
  channel?: string;
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  recipientType?: string | null;
  payload?: Record<string, unknown>;
}) => {
  if (!input.recipientUserId && !input.recipientEmail) {
    throw invalidInputError("A notification requires either recipientUserId or recipientEmail.");
  }

  const notification = await prisma.notification.create({
    data: {
      type: input.type,
      channel: input.channel ?? "EMAIL",
      recipientUserId: input.recipientUserId ?? null,
      recipientEmail: input.recipientEmail ?? null,
      recipientType: input.recipientType ?? (input.recipientUserId ? "USER" : "EMAIL"),
      payload: toPrismaJsonValue(input.payload)
    }
  });

  const job = await queues.notifications.add(
    "notifications.deliver",
    {
      notificationId: notification.id
    },
    {
      jobId: buildNotificationJobId(notification.id)
    }
  );

  await jobRunService.recordQueued(job, {
    trigger: "notification_enqueue",
    notificationId: notification.id,
    retry: {
      queueName: queueNames.notifications,
      jobName: job.name,
      payload: {
        notificationId: notification.id
      }
    }
  });

  return notification;
};

export const createAdminNotification = async (input: {
  actorAdminUserId: string;
  type: string;
  channel?: string;
  recipientUserId?: string;
  recipientEmail?: string;
  recipientType?: string;
  payload?: Record<string, unknown>;
}) =>
  runInTransaction(async (transaction) => {
    if (!input.recipientUserId && !input.recipientEmail) {
      throw invalidInputError("A notification requires either recipientUserId or recipientEmail.");
    }

    const notification = await transaction.notification.create({
      data: {
        type: input.type,
        channel: input.channel ?? "EMAIL",
        recipientUserId: input.recipientUserId ?? null,
        recipientEmail: input.recipientEmail ?? null,
        recipientType: input.recipientType ?? (input.recipientUserId ? "USER" : "EMAIL"),
        payload: toPrismaJsonValue(input.payload)
      },
      include: notificationInclude
    });

    await Promise.all([
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "notifications.create",
          entityType: "NOTIFICATION",
          entityId: notification.id,
          metadata: toPrismaJsonValue({
            type: notification.type,
            channel: notification.channel
          })
        }
      }),
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "notifications.outbox",
          actionCode: "notifications.create",
          entityType: "NOTIFICATION",
          entityId: notification.id,
          after: toPrismaJsonValue(serializeNotification(notification))
        }
      })
    ]);

    return {
      entity: serializeNotification(notification)
    };
  }).then(async (result) => {
    const job = await queues.notifications.add(
      "notifications.deliver",
      {
        notificationId: result.entity.id
      },
      {
        jobId: buildNotificationJobId(result.entity.id)
      }
    );

    await jobRunService.recordQueued(job, {
      trigger: "admin_notification_enqueue",
      notificationId: result.entity.id,
      retry: {
        queueName: queueNames.notifications,
        jobName: job.name,
        payload: {
          notificationId: result.entity.id
        }
      }
    });

    return result;
  });

export const listCustomerNotifications = async (
  customerUserId: string,
  input: PaginationInput & {
    status?: NotificationStatus;
    type?: string;
    channel?: string;
  }
) => {
  const where: Prisma.NotificationWhereInput = {
    recipientUserId: customerUserId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.channel ? { channel: input.channel } : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: notificationInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.notification.count({ where })
  ]);

  return {
    items: items.map(serializeNotification),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const listAdminNotifications = async (
  input: PaginationInput & {
    status?: NotificationStatus;
    type?: string;
    channel?: string;
    recipientUserId?: string;
    recipientEmail?: string;
  }
) => {
  const where: Prisma.NotificationWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.channel ? { channel: input.channel } : {}),
    ...(input.recipientUserId ? { recipientUserId: input.recipientUserId } : {}),
    ...(input.recipientEmail ? { recipientEmail: input.recipientEmail } : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: notificationInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.notification.count({ where })
  ]);

  return {
    items: items.map(serializeNotification),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAdminNotificationDetail = async (notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: {
      id: notificationId
    },
    include: notificationInclude
  });

  if (!notification) {
    throw notFoundError("The requested notification was not found.");
  }

  return {
    entity: serializeNotification(notification)
  };
};

export const retryAdminNotification = async (input: {
  actorAdminUserId: string;
  notificationId: string;
}) => {
  const notification = await prisma.notification.findUnique({
    where: {
      id: input.notificationId
    }
  });

  if (!notification) {
    throw notFoundError("The requested notification was not found.");
  }

  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorAdminUserId: input.actorAdminUserId,
        actionCode: "notifications.retry",
        entityType: "NOTIFICATION",
        entityId: notification.id,
        metadata: toPrismaJsonValue({
          previousStatus: notification.status
        })
      }
    }),
    prisma.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        screen: "notifications.outbox",
        actionCode: "notifications.retry",
        entityType: "NOTIFICATION",
        entityId: notification.id,
        before: toPrismaJsonValue({
          status: notification.status
        }),
        after: toPrismaJsonValue({
          status: notification.status,
          retried: true
        })
      }
    })
  ]);

  const job = await queues.notifications.add(
    "notifications.deliver",
    {
      notificationId: notification.id
    },
    {
      jobId: buildNotificationJobId(notification.id, `retry-${Date.now()}`)
    }
  );

  await jobRunService.recordQueued(job, {
    trigger: "manual_retry",
    notificationId: notification.id,
    retry: {
      queueName: queueNames.notifications,
      jobName: job.name,
      payload: {
        notificationId: notification.id
      }
    }
  });

  return getAdminNotificationDetail(notification.id);
};

export const processNotificationJob = async (job: Job<{ notificationId: string }>) => {
  const notification = await prisma.notification.findUnique({
    where: {
      id: job.data.notificationId
    },
    include: notificationInclude
  });

  if (!notification) {
    throw notFoundError("The queued notification was not found.");
  }

  try {
    const delivery = await deliverNotificationByChannel(notification);

    await prisma.$transaction([
      prisma.notification.update({
        where: {
          id: notification.id
        },
        data: {
          status: NotificationStatus.SENT
        }
      }),
      prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          providerMessageId: delivery.providerMessageId,
          status: delivery.providerStatus,
          sentAt: new Date()
        }
      })
    ]);

    return {
      ok: true,
      notificationId: notification.id,
      queue: queueNames.notifications
    };
  } catch (error) {
    const errorPayload = toPrismaJsonValue({
      message: error instanceof Error ? error.message : "Unknown notification delivery failure."
    });

    await prisma.$transaction([
      prisma.notification.update({
        where: {
          id: notification.id
        },
        data: {
          status: NotificationStatus.FAILED
        }
      }),
      prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          status: "FAILED",
          error: errorPayload
        }
      })
    ]);

    throw error;
  }
};
