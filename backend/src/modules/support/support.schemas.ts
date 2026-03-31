import { TicketPriority, TicketStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

const optionalResourceTypeSchema = z.enum(["image", "video", "raw"]).optional();
const optionalDeliveryTypeSchema = z.enum(["upload", "private"]).optional();

export const ticketIdParamsSchema = z.object({
  ticketId: z.string().uuid()
});

export const createTicketBodySchema = z.object({
  orderId: z.string().uuid().optional(),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM),
  message: z.string().trim().min(1).max(5_000)
});

export const createTicketMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(5_000)
});

export const createTicketAttachmentBodySchema = z.object({
  url: z.string().trim().url(),
  storageProvider: z.string().trim().min(1).max(40).default("cloudinary"),
  publicId: z.string().trim().min(1).max(255).optional(),
  resourceType: optionalResourceTypeSchema,
  deliveryType: optionalDeliveryTypeSchema,
  originalFilename: z.string().trim().max(255).optional(),
  mimeType: z.string().trim().max(120).optional(),
  fileSizeBytes: z.coerce.number().int().min(0).optional(),
  width: z.coerce.number().int().min(1).optional(),
  height: z.coerce.number().int().min(1).optional(),
  durationSeconds: z.coerce.number().min(0).optional(),
  messageId: z.string().uuid().optional()
}).superRefine((value, context) => {
  if (value.storageProvider === "cloudinary" && !value.publicId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publicId"],
      message: "publicId is required when storageProvider is cloudinary."
    });
  }
});

export const ticketAttachmentUploadIntentBodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  fileSizeBytes: z.coerce.number().int().min(1).optional(),
  resourceType: optionalResourceTypeSchema
});

export const adminTicketsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  supportType: z.string().trim().min(1).max(80).optional(),
  assignment: z.enum(["any", "unassigned", "me"]).optional()
});

export const supportReportsQuerySchema = z.object({
  period: z.enum(["daily", "weekly", "monthly"]).optional().default("weekly")
});

export const bulkSupportTicketIdsBodySchema = z.object({
  ticketIds: z.array(z.string().uuid()).min(1).max(50)
});

export const bulkAssignTicketsBodySchema = bulkSupportTicketIdsBodySchema.extend({
  assignedToAdminUserId: z.string().uuid().nullable()
});

export const bulkStatusTicketsBodySchema = bulkSupportTicketIdsBodySchema.extend({
  status: z.nativeEnum(TicketStatus),
  note: z.string().trim().max(1_000).optional()
});

export const assignTicketBodySchema = z.object({
  assignedToAdminUserId: z.string().uuid().nullable(),
  note: z.string().trim().max(1_000).optional()
});

export const recordSupportTicketCsatBodySchema = z.object({
  csatScore: z.coerce.number().int().min(1).max(5),
  note: z.string().trim().max(500).optional()
});

export const updateTicketStatusBodySchema = z.object({
  status: z.nativeEnum(TicketStatus),
  note: z.string().trim().max(1_000).optional()
});

export const createInternalNoteBodySchema = z.object({
  note: z.string().trim().min(1).max(2_000)
});
