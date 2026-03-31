import { NotificationStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const notificationIdParamsSchema = z.object({
  notificationId: z.string().uuid()
});

export const notificationsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(NotificationStatus).optional(),
  type: z.string().trim().min(1).max(120).optional(),
  channel: z.string().trim().min(1).max(80).optional()
});

export const adminNotificationsQuerySchema = notificationsQuerySchema.extend({
  recipientUserId: z.string().uuid().optional(),
  recipientEmail: z.string().trim().email().optional()
});

export const createNotificationBodySchema = z.object({
  type: z.string().trim().min(1).max(120),
  channel: z.string().trim().min(1).max(80).default("EMAIL"),
  recipientUserId: z.string().uuid().optional(),
  recipientEmail: z.string().trim().email().optional(),
  recipientType: z.string().trim().min(1).max(80).optional(),
  payload: jsonRecordSchema.default({})
});
