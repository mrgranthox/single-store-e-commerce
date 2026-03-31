import { z } from "zod";

const optionalNullableTrimmedString = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return value;
}, z.union([z.string(), z.null()]).optional());

export const accountProfileBodySchema = z
  .object({
    firstName: optionalNullableTrimmedString,
    lastName: optionalNullableTrimmedString,
    phoneNumber: optionalNullableTrimmedString
  })
  .refine(
    (value) =>
      value.firstName !== undefined || value.lastName !== undefined || value.phoneNumber !== undefined,
    "At least one profile field must be provided."
  );

export const accountPreferencesBodySchema = z
  .object({
    orderUpdatesEmailEnabled: z.boolean().optional(),
    shipmentUpdatesEmailEnabled: z.boolean().optional(),
    supportUpdatesEmailEnabled: z.boolean().optional(),
    reviewRemindersEnabled: z.boolean().optional(),
    securityAlertsEmailEnabled: z.boolean().optional(),
    marketingEmailEnabled: z.boolean().optional(),
    marketingSmsEnabled: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one preference must be provided.");

export const addressBodySchema = z.object({
  label: optionalNullableTrimmedString,
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: optionalNullableTrimmedString,
  country: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(120),
  postalCode: optionalNullableTrimmedString,
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: optionalNullableTrimmedString,
  deliveryInstructions: optionalNullableTrimmedString,
  isDefaultShipping: z.boolean().optional(),
  isDefaultBilling: z.boolean().optional()
});

export const updateAddressBodySchema = addressBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one address field must be provided.");

export const addressIdParamsSchema = z.object({
  addressId: z.string().uuid()
});

export const defaultAddressBodySchema = z.object({
  scope: z.enum(["shipping", "billing", "both"]).default("shipping")
});

export const accountSessionIdParamsSchema = z.object({
  sessionId: z.string().uuid()
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
  signOutOtherSessions: z.boolean().default(true)
});

export const accountPrivacyAnonymizeBodySchema = z.object({
  confirmation: z.literal("ERASE")
});
