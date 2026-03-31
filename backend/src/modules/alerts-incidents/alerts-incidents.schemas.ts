import { AlertStatus, IncidentStatus, SecuritySeverity } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const alertIdParamsSchema = z.object({
  alertId: z.string().uuid()
});

export const incidentIdParamsSchema = z.object({
  incidentId: z.string().uuid()
});

export const alertsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(AlertStatus).optional(),
  severity: z.nativeEnum(SecuritySeverity).optional(),
  type: z.string().trim().min(1).max(120).optional()
});

export const incidentsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(IncidentStatus).optional(),
  q: z.string().trim().min(1).max(160).optional()
});

export const assignAlertBodySchema = z.object({
  assignedToAdminUserId: z.string().uuid().nullable(),
  note: z.string().trim().max(1000).optional()
});

export const resolveAlertBodySchema = z.object({
  note: z.string().trim().max(1000).optional()
});

export const bulkAlertIdsBodySchema = z.object({
  alertIds: z.array(z.string().uuid()).min(1).max(100),
  note: z.string().trim().max(1000).optional()
});

export const bulkAssignAlertsBodySchema = bulkAlertIdsBodySchema.extend({
  assignedToAdminUserId: z.string().uuid().nullable()
});

export const closeIncidentBodySchema = z.object({
  note: z.string().trim().max(1000).optional()
});

export const createIncidentBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2000).optional(),
  metadata: jsonRecordSchema.optional()
});

export const updateIncidentBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(2000).optional(),
  status: z.nativeEnum(IncidentStatus).optional(),
  metadata: jsonRecordSchema.optional()
});
