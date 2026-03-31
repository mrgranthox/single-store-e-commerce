import { SecuritySeverity } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

export const securityEventIdParamsSchema = z.object({
  eventId: z.string().uuid()
});

export const riskSignalIdParamsSchema = z.object({
  riskSignalId: z.string().uuid()
});

export const securityEventsQuerySchema = paginationSchema.extend({
  severity: z.nativeEnum(SecuritySeverity).optional(),
  status: z.string().trim().min(1).max(80).optional(),
  type: z.string().trim().min(1).max(120).optional(),
  userId: z.string().uuid().optional(),
  adminUserId: z.string().uuid().optional()
});

export const loginEventsQuerySchema = paginationSchema.extend({
  success: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  email: z.string().trim().min(1).max(160).optional()
});

export const riskSignalsQuerySchema = paginationSchema.extend({
  type: z.string().trim().min(1).max(120).optional(),
  userId: z.string().uuid().optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  reviewed: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
});

export const resolveSecurityEventBodySchema = z.object({
  note: z.string().trim().max(1000).optional(),
  nextStatus: z.string().trim().min(1).max(80).default("RESOLVED")
});

export const reviewRiskSignalBodySchema = z.object({
  note: z.string().trim().max(1000).optional(),
  disposition: z.enum(["reviewed", "escalated"]).default("reviewed")
});

export const securityEventNoteBodySchema = z.object({
  note: z.string().trim().max(1000).optional()
});
