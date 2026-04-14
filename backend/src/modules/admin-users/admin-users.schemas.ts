import { AdminInvitationStatus, AdminStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

const optionalTrimmedString = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .optional()
  .or(z.literal(""));

const roleCodesSchema = z.array(z.string().trim().min(1).max(120)).min(1).max(12);

export const adminUserIdParamsSchema = z.object({
  adminUserId: z.string().uuid()
});

export const adminInvitationIdParamsSchema = z.object({
  invitationId: z.string().uuid()
});

export const adminUserSessionParamsSchema = z.object({
  adminUserId: z.string().uuid(),
  sessionId: z.string().trim().min(1).max(255)
});

export const adminUsersQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.nativeEnum(AdminStatus).optional()
});

export const adminInvitationsQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.nativeEnum(AdminInvitationStatus).optional()
});

export const createAdminUserBodySchema = z.object({
  clerkAdminUserId: z.string().trim().min(1).max(255),
  email: z.string().trim().email().optional(),
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().min(1).max(120).optional(),
  roleCodes: roleCodesSchema
});

export const updateAdminUserBodySchema = z.object({
  firstName: z.string().trim().min(1).max(120).nullable().optional(),
  lastName: z.string().trim().min(1).max(120).nullable().optional()
});

export const updateAdminUserRolesBodySchema = z.object({
  roleCodes: roleCodesSchema
});

export const adminStatusMutationBodySchema = z.object({
  reason: optionalTrimmedString,
  note: optionalTrimmedString
});

export const createAdminInvitationBodySchema = z.object({
  email: z.string().trim().email(),
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().min(1).max(120).optional(),
  roleCodes: roleCodesSchema,
  note: z.string().trim().max(1_000).optional()
});

export const revokeAdminInvitationBodySchema = z.object({
  note: z.string().trim().max(1_000).optional()
});
