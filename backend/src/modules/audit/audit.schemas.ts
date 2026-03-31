import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

export const entityTimelineParamsSchema = z.object({
  entityType: z.string().trim().min(1).max(80),
  entityId: z.string().trim().min(1).max(200)
});

export const auditLogsQuerySchema = paginationSchema.extend({
  actionCode: z.string().trim().min(1).max(120).optional(),
  entityType: z.string().trim().min(1).max(80).optional(),
  entityId: z.string().trim().min(1).max(200).optional(),
  actorAdminUserId: z.string().uuid().optional(),
  /** Case-insensitive substring match on actor admin email. */
  actorEmailContains: z.string().trim().min(1).max(160).optional()
});

export const adminActionsQuerySchema = paginationSchema.extend({
  actionCode: z.string().trim().min(1).max(120).optional(),
  entityType: z.string().trim().min(1).max(80).optional(),
  entityId: z.string().trim().min(1).max(200).optional(),
  adminUserId: z.string().uuid().optional(),
  screen: z.string().trim().min(1).max(120).optional()
});

export const timelineQuerySchema = paginationSchema.extend({
  entityType: z.string().trim().min(1).max(80).optional(),
  entityId: z.string().trim().min(1).max(200).optional(),
  actorAdminUserId: z.string().uuid().optional(),
  eventType: z.string().trim().min(1).max(120).optional(),
  occurredAtFrom: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim();
      if (!t) return undefined;
      const d = new Date(t);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }),
  occurredAtTo: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim();
      if (!t) return undefined;
      const d = new Date(t);
      return Number.isNaN(d.getTime()) ? undefined : d;
    })
});
