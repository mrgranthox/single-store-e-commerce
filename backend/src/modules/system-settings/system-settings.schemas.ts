import { z } from "zod";

export const updateSettingsBodySchema = z.object({
  settings: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(160),
        value: z.unknown()
      })
    )
    .min(1)
});
