import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .optional()
  .or(z.literal(""));

export const adminLoginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
});

export const adminRefreshTokenBodySchema = z.object({
  refreshToken: z.string().trim().min(20).max(500)
});

export const adminStepUpBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
});

export const adminForgotPasswordBodySchema = z.object({
  email: z.string().trim().email()
});

export const adminResetPasswordBodySchema = z.object({
  token: z.string().trim().min(20).max(500),
  newPassword: z.string().min(8).max(128)
});

export const revokeSessionBodySchema = z.object({
  reason: optionalTrimmedString,
  note: optionalTrimmedString
});

export const sessionIdParamsSchema = z.object({
  sessionId: z.string().min(1)
});
