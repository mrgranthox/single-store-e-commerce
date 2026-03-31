import { z } from "zod";

export const registerBodySchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  phoneNumber: z.string().trim().regex(/^\+[1-9]\d{7,14}$/).optional(),
  password: z.string().min(8).max(128),
  marketingOptIn: z.boolean().default(false),
  acceptTerms: z.literal(true)
});

export const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
});

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().trim().min(20).max(500)
});

export const forgotPasswordBodySchema = z.object({
  email: z.string().trim().email()
});

export const resetPasswordBodySchema = z.object({
  token: z.string().trim().min(20).max(500),
  newPassword: z.string().min(8).max(128)
});

export const verifyEmailBodySchema = z.object({
  token: z.string().trim().min(20).max(500)
});

export const resendVerificationBodySchema = z.object({
  email: z.string().trim().email()
});
